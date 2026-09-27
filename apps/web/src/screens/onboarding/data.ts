'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Données et état des écrans d'accès et d'onboarding.
 *
 * PORTÉ, non réécrit, depuis le bloc `<script type="text/x-dc">` de
 * `docs/template/01 Accès et Onboarding.dc.html`. Les libellés, les couleurs,
 * les tracés d'icônes et les valeurs de démonstration sont ceux de la maquette,
 * à la virgule près : c'est elle qui fait foi.
 *
 * La maquette ne se contente pas de décrire une image — elle porte trois états
 * (`phase`, `create`, `help`) et leurs gestionnaires. Ce sont eux qui rendent
 * les cartes cliquables et les interrupteurs vivants, et ils sont repris ici
 * tels quels plutôt que réinventés.
 *
 * Les huit sections partagent UN SEUL jeu de données, comme dans la maquette :
 * un unique `renderVals()` les sert toutes. Les séparer donnerait huit copies de
 * `seg()`, et des barres de progression qui finiraient par diverger.
 */

export interface OnboardingState {
  /** Carte de phase sélectionnée à l'écran O01 : 0, 1 ou 2. */
  readonly phase: number;
  /** Le numéro en cours de saisie (P01), tel que le membre le tape. */
  readonly phone: string;
  /** Le code reçu par SMS (P02), 0 à 6 chiffres. */
  readonly code: string;
  /** O03 — créer le parcours proposé à la fin de l'inscription. */
  readonly create: boolean;
  /** O04 — « je suis disponible pour aider ». */
  readonly help: boolean;
}

/** La maquette démarre sur la deuxième carte et les deux interrupteurs actifs. */
export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  phase: 1,
  // La maquette montre « 97 12 34 42 » et trois chiffres déjà saisis : ce sont
  // des EXEMPLES, faits pour illustrer une image. Un écran réel s'ouvre vide, et
  // l'exemple du téléphone survit en `placeholder`.
  phone: '',
  code: '',
  create: true,
  help: true,
};

/** Une pastille de choix : fond, texte et bord changent selon l'état. */
interface Chip {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly bd: string;
}

const chip = (label: string, on = false): Chip => ({
  label,
  bg: on ? '#16785E' : '#fff',
  fg: on ? '#fff' : '#16211D',
  bd: on ? '#16785E' : '#E6EBE9',
});

/**
 * La barre de progression : six segments, `n` remplis.
 *
 * Six, parce que l'onboarding compte six écrans (§5) — et la maquette affiche
 * « 1/6 » en clair à côté. Un septième segment ici serait un écran manquant là.
 */
const seg = (n: number): string[] =>
  Array.from({ length: 6 }, (_, i) => (i < n ? '#16785E' : '#DDE3E0'));

/** Les trois cartes de phase (O01), avant application de l'état. */
const PHASE_CARDS = [
  {
    title: 'Je prépare mon départ',
    sub: 'Visa, logement, budget avant d’arriver',
    icon: 'M3 16h18M6 16l2-8 4 3 4-3 2 8M12 3v5',
  },
  {
    title: 'Je viens d’arriver (moins de 6 mois)',
    sub: 'Premières démarches et premiers contacts',
    icon: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  },
  {
    title: 'Je suis installé·e',
    sub: 'Entraide, réseaux, transmettre',
    icon: 'M4 11 12 4l8 7v9H4zM10 20v-6h4v6',
  },
] as const;

/** `on` explicite sur chaque carte : sans lui, `as const` donne quatre types
 *  différents et `g.on` n'existe que sur la première. */
const GOAL_CARDS: readonly {
  readonly title: string;
  readonly steps: string;
  readonly icon: string;
  readonly on: boolean;
}[] = [
  { title: 'Étudier', steps: '12 étapes', icon: 'M2 9 12 4l10 5-10 5zM6 11v5c3 2 9 2 12 0v-5', on: true },
  { title: 'Travailler', steps: '10 étapes', icon: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', on: false },
  {
    title: 'Rejoindre ma famille',
    steps: '9 étapes',
    icon: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
    on: false,
  },
  {
    title: 'Régulariser ma situation',
    steps: '8 étapes',
    icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
    on: false,
  },
];

/**
 * Ce que la PAGE fournit : l'appel à l'API et son état d'attente.
 *
 * Obligatoire, sans valeur par défaut. Un `() => {}` de repli donnerait des
 * boutons silencieusement morts — le pire des défauts, puisque l'écran a l'air
 * de fonctionner. Ici, oublier de les passer ne compile pas.
 */
export interface ScreenActions {
  /** Un appel est en cours : les boutons se désactivent. */
  readonly busy: boolean;
  /** P01 — envoyer le code. */
  readonly onSubmit: () => void;
  /** O01 à O04 — enregistrer et passer à l'écran suivant. */
  readonly onContinue: () => void;
}

export interface OnboardingVals extends ScreenActions {
  readonly phoneValue: string;
  readonly onPhoneChange: (event: { target: { value: string } }) => void;
  readonly codeValue: string;
  readonly onCodeChange: (event: { target: { value: string } }) => void;
  readonly phases: readonly {
    readonly title: string;
    readonly sub: string;
    readonly icon: string;
    readonly bg: string;
    readonly bd: string;
    readonly iconBg: string;
    readonly checkBg: string;
    readonly checkBd: string;
    readonly onPick: () => void;
  }[];
  readonly reassure: readonly { readonly text: string; readonly icon: string }[];
  readonly otp: readonly { readonly v: string; readonly bg: string; readonly bd: string }[];
  readonly otpBad: readonly string[];
  readonly toc: readonly {
    readonly label: string;
    readonly w: number;
    readonly bg: string;
    readonly fg: string;
  }[];
  readonly resources: readonly {
    readonly name: string;
    readonly desc: string;
    readonly phone: string;
    readonly hours: string;
  }[];
  readonly seg1: readonly string[];
  readonly seg2: readonly string[];
  readonly seg3: readonly string[];
  readonly seg4: readonly string[];
  readonly cities: readonly {
    readonly name: string;
    readonly meta: string;
    readonly bg: string;
    readonly fg: string;
    readonly metaFg: string;
    readonly metaBg: string;
  }[];
  readonly goals: readonly {
    readonly title: string;
    readonly steps: string;
    readonly icon: string;
    readonly on: boolean;
    readonly bg: string;
    readonly bd: string;
    readonly iconBg: string;
  }[];
  readonly statuses: readonly Chip[];
  readonly create: boolean;
  readonly toggleCreate: () => void;
  readonly createBg: string;
  readonly createBd: string;
  readonly createHelp: string;
  readonly help: boolean;
  readonly toggleHelp: () => void;
  readonly helpTrack: string;
  readonly helpKnob: string;
  readonly helpTypes: readonly Chip[];
  readonly events: readonly {
    readonly d: string;
    readonly m: string;
    readonly t: string;
    readonly s: string;
  }[];
}

/**
 * Les valeurs dérivées de l'état. Équivalent de `renderVals()` dans la maquette.
 *
 * Pure : elle reçoit l'état et de quoi le changer, et ne lit rien d'autre. C'est
 * ce qui permet de la rendre côté serveur comme côté client, et de la tester
 * sans monter un composant.
 */
export function onboardingVals(
  state: OnboardingState,
  patch: (next: Partial<OnboardingState>) => void,
  actions: ScreenActions,
): OnboardingVals {
  return {
    ...actions,
    phases: PHASE_CARDS.map((p, i) => {
      const on = state.phase === i;
      return {
        ...p,
        bg: on ? '#EFF7F3' : '#fff',
        bd: on ? '2px solid #16785E' : '1px solid #E6EBE9',
        iconBg: on ? '#fff' : '#E3F0EB',
        checkBg: on ? '#16785E' : 'transparent',
        checkBd: on ? 'none' : '1.5px solid #CBD5D1',
        onPick: () => patch({ phase: i }),
      };
    }),

    phoneValue: state.phone,
    onPhoneChange: (event: { target: { value: string } }) => {
      // Seuls les chiffres et les espaces : le reste est refusé à la FRAPPE,
      // plutôt que signalé après envoi. `normalizePhone` fera le ménage côté
      // API, mais un champ qui accepte des lettres laisse croire qu'elles
      // comptent.
      patch({ phone: event.target.value.replace(/[^\d\s]/g, '').slice(0, 20) });
    },
    codeValue: state.code,
    onCodeChange: (event: { target: { value: string } }) => {
      patch({ code: event.target.value.replace(/\D/g, '').slice(0, 6) });
    },

    reassure: [
      {
        text: 'Chaque membre a une identité vérifiée',
        icon: 'M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6zM9 12l2 2 4-4',
      },
      {
        text: 'Jamais de paiement pour obtenir de l’aide',
        icon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
      },
    ],

    /**
     * Les six cases du code.
     *
     * Elles AFFICHENT, elles ne saisissent pas : un seul champ les alimente. Six
     * `<input>` casseraient le collage du code et l'autoremplissage depuis le
     * SMS, qui sont précisément ce dont un membre a besoin ici.
     *
     * La maquette montre « 482 » avec le curseur sur la quatrième case : c'est
     * une illustration de saisie en cours. Ici, la position du curseur suit ce
     * qui est réellement tapé.
     */
    otp: Array.from({ length: 6 }, (_, i) => {
      const v = state.code[i] ?? '';
      return {
        v,
        bg: v === '' ? '#F2F5F4' : '#fff',
        bd: i === state.code.length ? '#16785E' : v === '' ? '#EAEEEC' : '#E6EBE9',
      };
    }),
    otpBad: ['4', '8', '2', '9', '1', '7'],

    toc: [
      { label: 'Ce que nous collectons', w: 700, bg: '#E3F0EB', fg: '#0F5C48' },
      { label: 'Où sont vos données', w: 500, bg: 'transparent', fg: '#16211D' },
      { label: 'Vos droits', w: 500, bg: 'transparent', fg: '#16211D' },
      { label: 'Durées de conservation', w: 500, bg: 'transparent', fg: '#16211D' },
      { label: 'Nous contacter', w: 500, bg: 'transparent', fg: '#16211D' },
    ],

    // Numéros RÉELS de services d'aide. À ne pas inventer ni « rafraîchir » :
    // un numéro faux sur cet écran-là se paie très cher.
    resources: [
      {
        name: 'SOS Amitié',
        desc: 'Écoute anonyme pour les personnes en détresse.',
        phone: '09 72 39 40 50',
        hours: '24 h / 24',
      },
      {
        name: 'Info Migrants — permanence juridique',
        desc: 'Questions sur le titre de séjour et les recours.',
        phone: '01 43 14 84 84',
        hours: 'Lun–ven · 9 h–17 h',
      },
      {
        name: 'Violences Femmes Info',
        desc: 'Écoute, information, orientation.',
        phone: '3919',
        hours: '24 h / 24',
      },
    ],

    seg1: seg(1),
    seg2: seg(2),
    seg3: seg(3),
    seg4: seg(4),

    cities: [
      {
        name: 'Lyon',
        meta: '1 400 membres',
        bg: '#E3F0EB',
        fg: '#16211D',
        metaFg: '#0F5C48',
        metaBg: '#fff',
      },
      {
        name: 'Lyon 7e — Guillotière',
        meta: 'Quartier',
        bg: 'transparent',
        fg: '#16211D',
        metaFg: '#5D6B66',
        metaBg: '#F2F5F4',
      },
      {
        name: 'Lys-lez-Lannoy',
        meta: 'bientôt',
        bg: 'transparent',
        fg: '#8A958F',
        metaFg: '#8A958F',
        metaBg: '#F2F5F4',
      },
      {
        name: 'Lyons-la-Forêt',
        meta: 'bientôt',
        bg: 'transparent',
        fg: '#8A958F',
        metaFg: '#8A958F',
        metaBg: '#F2F5F4',
      },
    ],

    goals: GOAL_CARDS.map((g) => ({
      ...g,
      bg: g.on ? '#EFF7F3' : '#fff',
      bd: g.on ? '2px solid #16785E' : '1px solid #E6EBE9',
      iconBg: g.on ? '#fff' : '#E3F0EB',
    })),

    statuses: [
      chip('Étudiant·e', true),
      chip('Salarié·e'),
      chip('En recherche'),
      chip('Indépendant·e'),
      chip('Famille'),
    ],

    create: state.create,
    toggleCreate: () => patch({ create: !state.create }),
    createBg: state.create ? '#16785E' : '#fff',
    createBd: state.create ? 'none' : '1.5px solid #CBD5D1',
    createHelp: state.create
      ? 'Le parcours « Étudier » (12 étapes) sera créé à la fin de l’inscription.'
      : 'Aucun parcours ne sera créé. Vous pourrez en créer un plus tard depuis Parcours.',

    help: state.help,
    toggleHelp: () => patch({ help: !state.help }),
    helpTrack: state.help ? '#16785E' : '#CBD5D1',
    // La pastille de l'interrupteur : 3 px à gauche, 23 px à droite. C'est le
    // SEUL mouvement de cet écran, et il tient en une transition de `left`.
    helpKnob: state.help ? '23px' : '3px',
    helpTypes: [
      chip('Démarches', true),
      chip('Relecture CV', true),
      chip('Trajet'),
      chip('Traduction'),
      chip('Matériel'),
    ],

    events: [
      { d: '24', m: 'FÉV', t: 'Apéro Diaspora et Étudiants', s: 'Berges du Rhône · 19h00' },
      { d: '02', m: 'MAR', t: 'Atelier CV et stage', s: 'Maison des Assos · 14h30' },
      { d: '09', m: 'MAR', t: 'Permanence titre de séjour', s: 'Lyon 3e · 10h00' },
    ],
  };
}

/** L'état et les valeurs, pour un composant client. */
export function useOnboarding(
  actions: ScreenActions,
  initial: OnboardingState = INITIAL_ONBOARDING_STATE,
): {
  state: OnboardingState;
  patch: (next: Partial<OnboardingState>) => void;
  vals: OnboardingVals;
} {
  const [state, setState] = useState<OnboardingState>(initial);
  const patch = useCallback(
    (next: Partial<OnboardingState>) => setState((s) => ({ ...s, ...next })),
    [],
  );
  const vals = useMemo(() => onboardingVals(state, patch, actions), [state, patch, actions]);
  return { state, patch, vals };
}
