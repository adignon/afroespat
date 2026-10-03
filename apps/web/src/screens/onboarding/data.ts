'use client';

import { useCallback, useMemo, useState } from 'react';
// `import type` : les enums générés servent ici de TYPES et rien de plus. Une
// importation de valeur depuis un module `'use client'` rapporterait une référence
// client au lieu de l'objet — le piège déjà payé sur `resume.ts` (voir
// docs/decisions.md). Un type, lui, est effacé à la compilation.
import type { HelpType, OccupationStatus } from '@app/shared';
import { createAnnounce, goalCards, type GoalCard, type JourneyTemplateChoice } from './from-api';

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
  /** Le pays de l'INDICATIF choisi en P01. Distinct du pays d'origine (§2.7). */
  readonly countryIso2: string;
  /** Le pays d'ORIGINE choisi en O02. Modifiable une seule fois ensuite (§2.7). */
  readonly originIso2: string;
  /** Ce que le membre tape dans la recherche de ville (O02). */
  readonly citySearch: string;
  /**
   * L'acceptation des CGU et de la confidentialité (P01).
   *
   * FAUX par défaut, alors que la maquette dessine la case cochée. Ce n'est pas
   * une divergence de forme mais de droit : un consentement pré-coché n'est pas
   * un consentement, et la preuve enregistrée ne vaudrait rien.
   */
  readonly consentAccepted: boolean;
  /** O04 — nom d'affichage et pseudo. */
  readonly displayName: string;
  readonly handle: string;
  /** Le statut d'occupation choisi (O04), index dans `OCCUPATIONS`. */
  readonly occupation: number;
  /** Les types d'aide retenus (O04), index dans `HELP_TYPES`. */
  readonly helpChoices: readonly number[];
  /** L'identifiant de la ville retenue, ou `null`. */
  readonly cityId: string | null;
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
  // La maquette dessine « +229 » : c'est le pays d'origine ouvert au lancement
  // (02 §2.1), donc un défaut raisonnable — et le membre peut en changer.
  countryIso2: 'BJ',
  originIso2: 'BJ',
  citySearch: '',
  cityId: null,
  consentAccepted: false,
  // La maquette montre « Amina Diallo » et « @amina.d » : des EXEMPLES, qui
  // survivent en `placeholder`. Un écran réel s'ouvre vide.
  displayName: '',
  handle: '',
  // La maquette coche « Étudiant·e » et deux types d'aide : on reprend ces
  // valeurs de départ, qui évitent un écran sans rien de sélectionné.
  occupation: 0,
  helpChoices: [0, 1],
  code: '',
  create: true,
  help: true,
};

/**
 * Les villes correspondant à une saisie, sans accent ni casse.
 *
 * Comparer sans normaliser fait échouer « segou » sur « Ségou » et « lyon » sur
 * « Lyon » — deux échecs que le membre lit comme « ma ville n'existe pas ».
 *
 * Aucun résultat sous deux caractères : le catalogue compte des dizaines de
 * villes, et les afficher toutes ne rendrait service à personne.
 */
function matchCities(catalogue: readonly CityChoice[], search: string): readonly CityChoice[] {
  const needle = fold(search.trim());
  if (needle.length < 2) return [];
  return catalogue.filter((c) => fold(c.name).includes(needle)).slice(0, 6);
}

/** Le pays que la maquette a dessiné : le seul dont elle fournit le drapeau. */
const DRAWN_COUNTRY = 'BJ';

/** Une pastille de choix : fond, texte et bord changent selon l'état. */
interface Chip {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly bd: string;
  /** Sélectionnée. Le générateur en fait `aria-pressed`. */
  readonly on: boolean;
  readonly onPick: () => void;
}

/**
 * Les statuts d'occupation, dans l'ordre de la maquette.
 *
 * Les libellés viennent d'elle ; les CODES, de l'enum `OccupationStatus` du
 * schéma. Les tenir côte à côte évite qu'un libellé traduit parte vers l'API.
 */
const OCCUPATIONS = [
  { label: 'Étudiant·e', code: 'STUDENT' },
  { label: 'Salarié·e', code: 'EMPLOYEE' },
  { label: 'En recherche', code: 'JOB_SEEKER' },
  { label: 'Indépendant·e', code: 'ENTREPRENEUR' },
  { label: 'Famille', code: 'OTHER' },
] as const;

/**
 * Les types d'aide. La maquette en montre cinq ; l'enum `HelpType` en compte
 * cinq aussi, mais « Trajet », « Traduction » et « Matériel » n'y ont pas de
 * code propre — ils relèvent de `OTHER`, ce que la spec assume (§2.7 liste
 * PAPERWORK, HOUSING, JOB, WELCOME, OTHER).
 */
const HELP_TYPES = [
  { label: 'Démarches', code: 'PAPERWORK' },
  { label: 'Relecture CV', code: 'JOB' },
  { label: 'Trajet', code: 'OTHER' },
  { label: 'Traduction', code: 'OTHER' },
  { label: 'Matériel', code: 'OTHER' },
] as const;

const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Nettoie une saisie de pseudo — §2.6 : minuscules, chiffres, tiret, souligné.
 *
 * Les accents sont TRANSLITTÉRÉS, pas supprimés. Les retirer faisait de « Aïcha
 * Sègbédji » un `achasgbdji` méconnaissable : le membre voit son nom se
 * désagréger sous ses doigts. `fold` ramène chaque lettre accentuée à sa base,
 * comme le fait `generateHandle` côté serveur — les deux doivent s'accorder,
 * sinon le pseudo proposé et le pseudo saisi ne se ressemblent pas.
 */
export function toHandle(input: string): string {
  return (
    fold(input)
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      // Pas de séparateurs consécutifs (§2.6).
      .replace(/([_-])\1+/g, '$1')
      // Pas de séparateur en TÊTE : aucun pseudo valide n'en commence par un, et
      // le laisser ne mène qu'à un refus plus tard.
      .replace(/^[_-]+/, '')
      .slice(0, 30)
  );
}

/**
 * Le pseudo tel qu'il PART vers l'API.
 *
 * Le séparateur final est coupé ici, et non à la frappe : l'enlever pendant la
 * saisie rendrait « jean-baptiste » impossible à taper, puisque le tiret
 * disparaîtrait avant la seconde moitié. La règle du §2.6 est donc appliquée au
 * moment où elle compte — à l'envoi.
 */
export function finalHandle(input: string): string {
  return toHandle(input).replace(/[_-]+$/, '');
}

/**
 * Le code à envoyer à l'API pour le statut choisi.
 *
 * Le type de retour est `OccupationStatus`, l'enum GÉNÉRÉ depuis le schéma Prisma
 * — et non `string`. La différence n'est pas cosmétique : avec `string`, une faute
 * de frappe dans `OCCUPATIONS` ci-dessus (`'EMPLOYE'` pour `'EMPLOYEE'`) partait
 * jusqu'à l'API, qui répondait `400 VALIDATION_FAILED` sur un champ que le membre
 * n'avait aucun moyen de corriger. Le compilateur compare maintenant la table à
 * l'enum.
 */
export function occupationCode(index: number): OccupationStatus {
  return OCCUPATIONS[index]?.code ?? 'OTHER';
}

/** Les codes des types d'aide retenus, sans doublon. */
export function helpTypeCodes(indexes: readonly number[]): HelpType[] {
  return [...new Set(indexes.map((i) => HELP_TYPES[i]?.code ?? 'OTHER'))];
}

const chip = (label: string, on: boolean, onPick: () => void): Chip => ({
  label,
  bg: on ? '#16785E' : '#fff',
  fg: on ? '#fff' : '#16211D',
  bd: on ? '#16785E' : '#E6EBE9',
  on,
  onPick,
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

/**
 * Les cartes d'objectif et la phrase d'engagement viennent de `from-api.ts`.
 *
 * Elles y sont parce que ce sont des CONVERSIONS — de la réponse de l'API vers
 * les prises du JSX — et non des valeurs de la maquette. Les garder ici les
 * rendait inéprouvables sans monter un navigateur : la règle « le nombre d'étapes
 * vient du serveur, jamais de la maquette » n'était gardée que par un test de
 * bout en bout. C'est la forme que le branchement de A01 a posée : `api.ts` pour
 * les appels, `from-api.ts` pour la conversion, `use-*.ts` pour l'état.
 */

/**
 * Ce que la PAGE fournit : l'appel à l'API et son état d'attente.
 *
 * Obligatoire, sans valeur par défaut. Un `() => {}` de repli donnerait des
 * boutons silencieusement morts — le pire des défauts, puisque l'écran a l'air
 * de fonctionner. Ici, oublier de les passer ne compile pas.
 */
/** Une ville proposée par la recherche de O02. */
export interface CityChoice {
  readonly id: string;
  readonly name: string;
  readonly region: string | null;
  readonly isActive: boolean;
  readonly memberCount: number;
}

/** Un pays proposé au sélecteur d'indicatif. */
export interface CountryChoice {
  /** L'API attend l'identifiant, pas le code ISO, pour `originCountryId`. */
  readonly id: string;
  readonly iso2: string;
  readonly nameFr: string;
  readonly dialCode: string;
}

/**
 * Le compte à rebours de renvoi et le bouton qui l'attend — P02.
 *
 * UN SEUL objet pour les deux, parce que c'est un seul état : la maquette dessine
 * « Nouveau code dans 0:45 » À CÔTÉ d'un « Renvoyer » grisé, et les deux moitiés
 * de cette ligne disent la même chose. Les séparer en six propriétés plates aurait
 * permis qu'un bouton actif côtoie un compteur qui tourne.
 */
export interface ResendVals {
  /** Le temps restant, au format de la maquette : `0:45`. */
  readonly label: string;
  /**
   * `visible` ou `hidden`.
   *
   * On CACHE au lieu de retirer : la ligne est en `justify-content:
   * space-between`, donc retirer le compteur ferait sauter « Renvoyer » à gauche.
   * `visibility: hidden` garde la boîte de la maquette et retire le texte de
   * l'arbre d'accessibilité — ce qu'on veut d'un compteur arrêté.
   */
  readonly countdown: 'visible' | 'hidden';
  /**
   * La couleur du contrôle, relevée dans la maquette et jamais choisie :
   * `#8A958F` est celle qu'elle lui donne pendant l'attente, `#16785E` celle de
   * son « Recevoir un nouveau code » du panneau « CODE EXPIRÉ ».
   */
  readonly color: string;
  readonly cursor: 'default' | 'pointer';
  /** L'attente n'est pas finie : le bouton refuse le clic. */
  readonly blocked: boolean;
  readonly onPick: () => void;
}

/**
 * Le temps restant au format de la maquette — `0:45`.
 *
 * `m:ss` SANS BORNE SUPÉRIEURE, et c'est un choix. Un `429` sur
 * `POST /auth/otp/request` répond `Retry-After: 3600`, donc le compteur affiche
 * « 59:58 » puis descend. Passer à `h:mm:ss` au-delà de l'heure inventerait un
 * format que la maquette n'écrit nulle part ; prolonger le sien est la seule
 * extension qui ne décide rien à la place du porteur.
 */
export function resendLabel(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

export interface ScreenActions {
  /** Un appel est en cours : les boutons se désactivent. */
  readonly busy: boolean;
  /** P01 — envoyer le code. */
  readonly onSubmit: () => void;
  /**
   * P02 — les secondes qui restent avant de pouvoir redemander un code.
   *
   * `0` quand l'attente est finie. La valeur vient du parcours, qui la tient dans
   * `sessionStorage` : une actualisation de la page ne doit PAS remettre le
   * compteur à zéro, sans quoi le membre pourrait épuiser les trois envois par
   * heure et par numéro en trois rechargements.
   */
  readonly resendIn: number;
  /** P02 — redemander un code. Refusé tant que `resendIn` n'est pas nul. */
  readonly onResend: () => void;
  /** P02 — « Changer de numéro » : revenir à la saisie du numéro. */
  readonly onChangeNumber: () => void;
  /** O01 à O04 — enregistrer et passer à l'écran suivant. */
  readonly onContinue: () => void;
  /**
   * Les pays proposés, chargés depuis `/places/countries`.
   *
   * Vide tant que l'appel n'a pas répondu : le sélecteur montre alors le seul
   * indicatif de la maquette, ce qui vaut mieux qu'un menu vide.
   */
  readonly countryOptions: readonly CountryChoice[];
  /** Les villes du pays de destination, chargées une fois (02 §2.2). */
  readonly cityCatalogue: readonly CityChoice[];
  /**
   * Les modèles de parcours, chargés depuis `GET /journey-templates` (03 §2.1).
   *
   * VIDE tant que l'appel n'a pas répondu, et vide aussi sur les écrans qui n'en
   * ont pas besoin : la route demande un jeton, donc l'appeler depuis P01 —
   * avant l'OTP — enverrait un `401` puis un rafraîchissement sans cookie, ce qui
   * marque la session morte avant même qu'elle naisse.
   *
   * Tant qu'elle est vide, O03 montre les quatre cartes de la maquette, sans
   * nombre d'étapes : le nombre est la seule chose qu'on ne peut pas afficher
   * sans mentir, et un écran vide serait pire.
   */
  readonly templates: readonly JourneyTemplateChoice[];
}

export interface OnboardingVals extends ScreenActions {
  readonly phoneValue: string;
  /** L'indicatif du pays choisi, affiché dans le sélecteur. */
  readonly dialCode: string;
  readonly countryIso2: string;
  readonly onCountryChange: (event: { target: { value: string } }) => void;
  /**
   * `none` dès que le pays choisi n'est plus celui que la maquette a dessiné.
   * Un drapeau béninois à côté d'un « +33 » serait un défaut visible ; en
   * inventer d'autres serait dessiner à la place du porteur.
   */
  readonly flagDisplay: string;
  readonly consentAccepted: boolean;
  readonly onToggleConsent: () => void;
  readonly consentBg: string;
  readonly consentBorder: string;
  /** Transparent quand la case est décochée : la coche disparaît sans bouger. */
  readonly consentCheck: string;

  // ── O02 : pays d'origine et ville ─────────────────────────────────────────
  readonly originName: string;
  readonly originIso2: string;
  readonly onOriginChange: (event: { target: { value: string } }) => void;
  readonly originFlagDisplay: string;
  /**
   * Les pays proposés comme ORIGINE. La France en est exclue : elle est
   * `DESTINATION` (02 §2.1), et l'API refuse de l'accepter comme pays d'origine.
   * La proposer serait offrir un choix qui échoue.
   */
  readonly originOptions: readonly CountryChoice[];
  readonly citySearch: string;
  readonly onCitySearch: (event: { target: { value: string } }) => void;

  // ── O04 : profil ──────────────────────────────────────────────────────────
  readonly displayNameValue: string;
  readonly onDisplayNameChange: (event: { target: { value: string } }) => void;
  readonly handleValue: string;
  readonly onHandleChange: (event: { target: { value: string } }) => void;
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
  /** P02 — le compte à rebours et le bouton « Renvoyer ». */
  readonly resend: ResendVals;
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
  /**
   * Les villes proposées. Chacune porte son gestionnaire : la maquette les
   * dessinait en `<div>` sans comportement, et le générateur les convertit en
   * boutons — il leur faut donc quelque chose à appeler.
   */
  readonly cities: readonly {
    readonly name: string;
    readonly meta: string;
    readonly bg: string;
    readonly fg: string;
    readonly metaFg: string;
    readonly metaBg: string;
    readonly onPick: () => void;
  }[];
  /**
   * Les cartes d'objectif : ce que `from-api.ts` en tire, plus les couleurs que la
   * maquette leur donne. `GoalCard` n'est pas recopié ici — une seconde définition
   * de la même forme divergerait au premier champ ajouté.
   */
  readonly goals: readonly (GoalCard & {
    readonly bg: string;
    readonly bd: string;
    readonly iconBg: string;
  })[];
  readonly statuses: readonly Chip[];
  readonly create: boolean;
  readonly toggleCreate: () => void;
  readonly createBg: string;
  readonly createBd: string;
  readonly createHelp: string;
  /**
   * O05 « AVEC PARCOURS » — le nombre d'étapes du parcours créé.
   *
   * « ÉTAPE 1 SUR 12 » est un ENGAGEMENT : la planche s'intitule « Votre parcours
   * est prêt ». Le 12 de la maquette est une illustration, et il est faux depuis
   * que `STUDIES` est en version 3 — l'API répond 15, et
   * `journeyTemplateVersionSchema` le dit en toutes lettres. O03 l'avait déjà
   * corrigé pour sa phrase d'annonce (`createHelp`) ; les deux écrans se
   * contredisaient à une page d'intervalle.
   *
   * MÊME SOURCE QUE `createHelp`, exactement : le PREMIER modèle servi, qui est
   * celui que `use-onboarding-flow.ts` envoie à `POST /journeys` (`templates[0]`).
   * Deux dérivations du même champ ne peuvent donc pas se contredire.
   *
   * UNE CHAÎNE ET NON UN NOMBRE : tant que `GET /journey-templates` n'a pas
   * répondu, il n'y a aucun nombre à montrer, et `0` serait un mensonge pire que
   * le `12` de la maquette. Le tiret cadratin dit « pas encore », ce qui est vrai.
   */
  readonly journeyStepCount: string;
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
    countryIso2: state.countryIso2,
    dialCode:
      actions.countryOptions.find((c) => c.iso2 === state.countryIso2)?.dialCode ?? '+229',
    flagDisplay: state.countryIso2 === DRAWN_COUNTRY ? 'block' : 'none',
    onCountryChange: (event: { target: { value: string } }) => {
      patch({ countryIso2: event.target.value });
    },
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

    originIso2: state.originIso2,
    originName:
      actions.countryOptions.find((c) => c.iso2 === state.originIso2)?.nameFr ?? 'Bénin',
    originFlagDisplay: state.originIso2 === DRAWN_COUNTRY ? 'block' : 'none',
    originOptions: actions.countryOptions.filter((c) => c.iso2 !== 'FR'),
    onOriginChange: (event: { target: { value: string } }) => {
      patch({ originIso2: event.target.value });
    },
    displayNameValue: state.displayName,
    onDisplayNameChange: (event: { target: { value: string } }) => {
      patch({ displayName: event.target.value.slice(0, 60) });
    },
    handleValue: state.handle,
    onHandleChange: (event: { target: { value: string } }) => {
      patch({ handle: toHandle(event.target.value) });
    },
    consentAccepted: state.consentAccepted,
    onToggleConsent: () => patch({ consentAccepted: !state.consentAccepted }),
    consentBg: state.consentAccepted ? '#16785E' : '#fff',
    consentBorder: state.consentAccepted ? 'none' : '1.5px solid #CBD5D1',
    consentCheck: state.consentAccepted ? '#fff' : 'transparent',
    citySearch: state.citySearch,
    onCitySearch: (event: { target: { value: string } }) => {
      // La ville retenue est oubliée dès qu'on retape : garder l'ancienne
      // enregistrerait une ville que le membre ne voit plus dans la liste.
      patch({ citySearch: event.target.value, cityId: null });
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

    /**
     * Le compte à rebours de renvoi.
     *
     * La maquette écrit « 0:45 » : c'est elle qui fixe le délai, et le parcours s'y
     * tient. Les deux couleurs sont les SIENNES — voir `ResendVals`.
     */
    resend: {
      label: resendLabel(actions.resendIn),
      countdown: actions.resendIn > 0 ? 'visible' : 'hidden',
      color: actions.resendIn > 0 ? '#8A958F' : '#16785E',
      cursor: actions.resendIn > 0 ? 'default' : 'pointer',
      blocked: actions.resendIn > 0,
      onPick: actions.onResend,
    },

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

    /**
     * Les villes qui correspondent à la saisie.
     *
     * La maquette en montre quatre en dur, avec « Lyon » retenue et deux villes
     * « bientôt » en gris — c'est une illustration. Ici la liste vient du
     * catalogue, filtrée SANS ACCENT ni casse.
     *
     * Les couleurs suivent celles de la maquette : la ville retenue est sur fond
     * vert pâle, une ville sans réseau ouvert est grisée et porte « bientôt » —
     * elle reste sélectionnable, comme 02 §2.2 l'exige.
     */
    cities: matchCities(actions.cityCatalogue, state.citySearch).map((city) => {
      const chosen = state.cityId === city.id;
      return {
        name: city.name,
        meta: city.isActive ? `${city.memberCount} membres` : 'bientôt',
        bg: chosen ? '#E3F0EB' : 'transparent',
        fg: city.isActive || chosen ? '#16211D' : '#8A958F',
        metaFg: chosen ? '#0F5C48' : city.isActive ? '#5D6B66' : '#8A958F',
        metaBg: chosen ? '#fff' : '#F2F5F4',
        onPick: () => patch({ cityId: city.id, citySearch: city.name }),
      };
    }),

    /**
     * Les cartes d'objectif, alimentées par `GET /journey-templates`.
     *
     * LA MAQUETTE NE LES REND PAS CLIQUABLES — ni le cadre de 1440 px ni celui
     * de 390 px : elles sont dessinées en `<div>`, sans déclencheur, et la
     * première est simplement mise en avant. On n'ajoute donc PAS de sélecteur.
     * Le seul contrôle de cet écran est la case « Créer mon parcours maintenant »,
     * et c'est elle que `onContinue` respecte.
     *
     * Conséquence à connaître, et à remonter plutôt qu'à corriger d'autorité : le
     * parcours créé est celui du PREMIER modèle servi — celui que la maquette
     * met en avant. Le choix réel du type se fait sur J02 (`/parcours/nouveau`),
     * où la maquette dessine bien quatre cartes sélectionnables.
     */
    goals: goalCards(actions.templates).map((g) => ({
      ...g,
      bg: g.on ? '#EFF7F3' : '#fff',
      bd: g.on ? '2px solid #16785E' : '1px solid #E6EBE9',
      iconBg: g.on ? '#fff' : '#E3F0EB',
    })),

    // Un seul statut à la fois : c'est une colonne unique dans `user_profiles`.
    statuses: OCCUPATIONS.map((o, i) =>
      chip(o.label, state.occupation === i, () => patch({ occupation: i })),
    ),

    create: state.create,
    toggleCreate: () => patch({ create: !state.create }),
    createBg: state.create ? '#16785E' : '#fff',
    createBd: state.create ? 'none' : '1.5px solid #CBD5D1',
    /**
     * La phrase sous la case, avec le NOM et le NOMBRE D'ÉTAPES du vrai modèle.
     *
     * La maquette écrit « Le parcours « Étudier » (12 étapes) sera créé » : c'est
     * une illustration, et son nombre est faux depuis que le modèle `STUDIES` est
     * en version 3 (15 étapes, mesuré sur l'API). La phrase est un ENGAGEMENT —
     * elle annonce ce qui va être créé — donc elle se dérive de la réponse.
     *
     * Tant que la liste n'est pas arrivée, on annonce le parcours sans le
     * chiffrer : promettre un nombre qu'on ne connaît pas est exactement la faute
     * que la maquette commettait.
     */
    createHelp: !state.create
      ? 'Aucun parcours ne sera créé. Vous pourrez en créer un plus tard depuis Parcours.'
      : createAnnounce(actions.templates),

    /**
     * Le même `templates[0]` que `createHelp` et que la création elle-même.
     *
     * Pas de nombre tant que la liste n'est pas arrivée : « ÉTAPE 1 SUR — » dit
     * qu'on ne sait pas encore, là où « ÉTAPE 1 SUR 0 » affirmerait un parcours
     * sans étape.
     */
    journeyStepCount:
      actions.templates[0] === undefined ? '—' : String(actions.templates[0].stepCount),

    help: state.help,
    toggleHelp: () => patch({ help: !state.help }),
    helpTrack: state.help ? '#16785E' : '#CBD5D1',
    // La pastille de l'interrupteur : 3 px à gauche, 23 px à droite. C'est le
    // SEUL mouvement de cet écran, et il tient en une transition de `left`.
    helpKnob: state.help ? '23px' : '3px',
    // Plusieurs types d'aide, au plus cinq (`updateProfileSchema`).
    helpTypes: HELP_TYPES.map((h, i) =>
      chip(h.label, state.helpChoices.includes(i), () =>
        patch({
          helpChoices: state.helpChoices.includes(i)
            ? state.helpChoices.filter((x) => x !== i)
            : [...state.helpChoices, i],
        }),
      ),
    ),

    events: [
      { d: '24', m: 'FÉV', t: 'Apéro Diaspora et Étudiants', s: 'Berges du Rhône · 19h00' },
      { d: '02', m: 'MAR', t: 'Atelier CV et stage', s: 'Maison des Assos · 14h30' },
      { d: '09', m: 'MAR', t: 'Permanence titre de séjour', s: 'Lyon 3e · 10h00' },
    ],
  };
}

/**
 * ─── O05 « AVEC PARCOURS » — LE PARCOURS QUI VIENT D'ÊTRE CRÉÉ ──────────────
 *
 * Le dernier écran de l'inscription s'intitule « Votre parcours est prêt » et
 * nommait le parcours de l'EXEMPLE de la maquette : « Mes études à Lyon », « ÉTAPE
 * 1 SUR 12 », « Obtenir votre admission ». Quatre affirmations sur l'objet que le
 * membre vient de créer, et trois d'entre elles ne le concernaient pas.
 *
 * TOUT VIENT D'UN APPEL QUE L'ÉCRAN FAISAIT DÉJÀ. `FinScreen` lit `GET /journeys`
 * pour choisir entre ses deux planches, et `journeyListItemSchema` porte `title`,
 * `doneCount`, `stepCount` et `currentStep: { id, title }`. Rien n'est demandé de
 * plus au serveur ; ce qui change, c'est qu'on ne jette plus la réponse.
 *
 * `rang` EST `doneCount + 1`, ET C'EST UNE DÉRIVATION ASSUMÉE : la liste ne porte
 * pas le rang de l'étape en cours, elle porte le nombre d'étapes franchies. Sur un
 * parcours frais, `doneCount` vaut zéro et le rang vaut un — ce que la maquette
 * dessine. Le serveur ne contredit pas ce calcul : `currentStep` est, par
 * construction du service, la première étape non franchie.
 *
 * `description` RESTE VIDE, et c'est l'écart remonté : elle vit dans
 * `journeyStepSchema` et ne sort que de `GET /journeys/:id`. La planche garde donc
 * la phrase de la maquette — le seul littéral de ce cadre qui n'ait pas de source.
 *
 * ── CE QU'ON MONTRE PENDANT QUE L'APPEL VOYAGE ──────────────────────────────
 *
 * `PARCOURS_INCONNU` porte des chaînes vides et des zéros. Ce n'est pas un défaut
 * déguisé : `FinScreen` choisit sa planche sur la même réponse, et il part de la
 * valeur de l'URL — raison écrite dans ce fichier-là. Le court instant où la
 * planche « avec parcours » s'affiche sans son contenu est un CHARGEMENT ; afficher
 * « Mes études à Lyon » en attendant serait un mensonge, et c'est précisément ce
 * qu'on retire. Les valeurs de la maquette ne reviennent jamais en repli.
 */
export interface ParcoursPret {
  readonly titre: string;
  readonly rang: number;
  readonly total: number;
  readonly etape: string;
}

export const PARCOURS_INCONNU: ParcoursPret = { titre: '', rang: 0, total: 0, etape: '' };

/**
 * O05 — les deux atterrissages de §5, écran 6.
 *
 * Il ÉTEND `OnboardingVals` : `FinScreen` répand les mêmes valeurs dans ses deux
 * planches, et les quinze autres cadres de la maquette gardent leur signature.
 */
export interface O05Data extends OnboardingVals {
  readonly parcours: ParcoursPret;
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
