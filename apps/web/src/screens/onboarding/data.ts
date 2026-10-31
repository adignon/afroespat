'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
// `import type` : les enums générés servent ici de TYPES et rien de plus. Une
// importation de valeur depuis un module `'use client'` rapporterait une référence
// client au lieu de l'objet — le piège déjà payé sur `resume.ts` (voir
// docs/decisions.md). Un type, lui, est effacé à la compilation.
import {
  exempleNational,
  handleSchema,
  masqueNumero,
  formaterSaisieNumero,
  numeroValide,
} from '@app/shared';
import type { HelpType, OccupationStatus } from '@app/shared';
import { createAnnounce, goalCards, type GoalCard, type JourneyTemplateChoice } from './from-api';
import { drapeauDe } from './drapeau';
import type { ChoixItem } from './choix-referentiel';
import type { LieuAtterrissage } from './atterrissage';

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
  /**
   * Carte d'OBJECTIF sélectionnée à l'écran O03 — le rang du modèle de parcours.
   *
   * Un RANG et non un identifiant : les modèles arrivent de `GET
   * /journey-templates` et la maquette dessine quatre cartes dans l'ordre servi.
   * Garder un identifiant obligerait à le réconcilier quand la liste change
   * (un type retiré, un pays différent) ; un rang se borne tout seul.
   *
   * Zéro par défaut : c'est la carte que la maquette met en avant, donc un membre
   * qui ne touche à rien obtient ce qu'il voyait.
   */
  readonly goal: number;
  /** Le numéro en cours de saisie (P01), tel que le membre le tape. */
  readonly phone: string;
  /**
   * Le champ a-t-il été QUITTÉ au moins une fois ? Tant que non, on ne reproche rien : le trait
   * ne passe au refus qu'à la sortie du champ (`onBlur`), puis suit la saisie.
   */
  readonly phoneTouched: boolean;
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
  /**
   * O04 — les compétences et les langues retenues, par identifiant.
   *
   * DES IDENTIFIANTS, pas des noms : `updateProfileSchema` attend `skillIds` et
   * `languageIds`, deux tableaux d'UUID bornés à dix. Garder les noms obligerait
   * à les retrouver au moment d'enregistrer, et un nom qui ne retrouve pas sa
   * ligne partirait en silence.
   */
  readonly skillIds: readonly string[];
  readonly languageIds: readonly string[];
  /**
   * O02 — le panneau de choix du pays est ouvert.
   *
   * Il vit dans l'état du flux et non dans celui de l'écran parce que les DEUX
   * cadres de `ScreenFrames` doivent s'ouvrir et se fermer ensemble : un membre
   * qui redimensionne sa fenêtre pendant le choix ne doit pas retrouver un
   * panneau ouvert d'un côté et fermé de l'autre. Cet état n'est pas conservé
   * d'une visite à l'autre — rien de ce flux ne l'est — donc un rechargement
   * revient sur l'écran, panneau fermé.
   */
  readonly originOuvert: boolean;
  /** P01 — le panneau de choix de l'indicatif est ouvert. Même raison qu'en O02. */
  readonly countryOuvert: boolean;
  /**
   * O02 — le panneau de choix de la VILLE est ouvert.
   *
   * Le porteur : « La sélection de ville : utilise le panneau aussi. » Deux
   * manières de choisir un lieu sur le même écran — un panneau pour le pays, une
   * liste à plat pour la ville — était l'incohérence qu'il corrige.
   */
  readonly villeOuvert: boolean;
}

/** La maquette démarre sur la deuxième carte et les deux interrupteurs actifs. */
export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  phase: 1,
  // La carte que la maquette met en avant — voir `goal` dans `OnboardingState`.
  goal: 0,
  // La maquette montre « 97 12 34 42 » et trois chiffres déjà saisis : ce sont
  // des EXEMPLES, faits pour illustrer une image. Un écran réel s'ouvre vide, et
  // l'exemple du téléphone survit en `placeholder`.
  phone: '',
  phoneTouched: false,
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
  // Les panneaux de choix de pays s'ouvrent sur un geste, jamais à l'arrivée.
  originOuvert: false,
  countryOuvert: false,
  villeOuvert: false,
  // La maquette montre deux compétences et trois langues : des EXEMPLES, comme
  // « Amina Diallo ». Un écran réel s'ouvre sans rien de coché.
  skillIds: [],
  languageIds: [],
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
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES VILLES PROPOSÉES — LA RÈGLE A CHANGÉ AVEC LE PANNEAU                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Elle rendait un tableau VIDE tant qu'on n'avait pas tapé deux lettres, et six
 * résultats au plus. C'était juste pour la liste à plat que la planche dessine
 * SOUS le champ : une liste qui s'ouvre toute seule sous une page d'inscription
 * la pousse vers le bas à chaque frappe.
 *
 * Le porteur a demandé le PANNEAU (« La sélection de ville : utilise le panneau
 * aussi »), et dans un panneau la règle s'inverse : il s'ouvre pour qu'on
 * CHOISISSE, et s'ouvrir vide ressemble à un écran cassé — mesuré, « villes
 * listées : 0 » à l'ouverture.
 *
 * Donc : sans recherche, TOUTES les villes, dans l'ordre du serveur. Avec
 * recherche, celles qui correspondent. La borne de six tombe avec la liste à
 * plat qui la justifiait — le panneau défile, c'est sa raison d'être.
 */
function matchCities(catalogue: readonly CityChoice[], search: string): readonly CityChoice[] {
  const needle = fold(search.trim());
  if (needle === '') return catalogue;
  return catalogue.filter((c) => fold(c.name).includes(needle));
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
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TYPES D'AIDE — HUIT, ET TROIS AVAIENT PERDU LEUR CODE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « ajoute aussi plus d'option au niveau de la section je suis
 * disponible pour aider ».
 *
 * ── CE QUI A CHANGÉ DEPUIS, ET QUI N'ÉTAIT PAS VISIBLE ────────────────────
 *
 * Ce commentaire disait, à raison à l'époque : « "Trajet", "Traduction" et
 * "Matériel" n'ont pas de code propre — ils relèvent de `OTHER` ». Il y avait
 * DEUX énumérations `HelpType` dans le dépôt, et c'est la plus pauvre qui servait
 * ici. Elles ont été fusionnées depuis (`20261004054632_fusion_help_type`) : il
 * existe maintenant `RIDE`, `MATERIAL` et `SERVICE`.
 *
 * Trois pastilles sur cinq s'enregistraient donc en `OTHER`, et le dédoublonnage
 * de `helpTypeCodes` les réduisait à UNE SEULE valeur. Un membre qui cochait
 * « Trajet » et « Matériel » enregistrait un seul `OTHER` : la moitié de son
 * choix disparaissait en silence.
 *
 * ── LES CINQ LABELS DESSINÉS SONT GARDÉS, TROIS SONT AJOUTÉS ─────────────
 *
 * Les cinq premiers sont ceux de la planche, mot pour mot. Les trois derniers
 * viennent de `HELP_TYPE_LABELS` (`@app/shared`), la table unique créée par la
 * fusion — on ne réinvente pas leurs mots, on les lit.
 *
 * « Traduction » reçoit `SERVICE`, le code générique de service rendu : c'est le
 * seul des huit qui n'ait pas de correspondance exacte, et le dire vaut mieux que
 * de le laisser retomber dans `OTHER` avec deux autres. REMONTÉ au porteur.
 *
 * AU PLUS CINQ CHOIX : `updateProfileSchema.helpTypes` porte `.max(5)`. Offrir
 * huit pastilles sans tenir cette borne ferait refuser l'enregistrement par le
 * serveur, sur un écran qui aurait laissé cocher.
 */
const HELP_TYPES = [
  // Les cinq de la planche.
  { label: 'Démarches', code: 'PAPERWORK' },
  { label: 'Relecture CV', code: 'JOB' },
  { label: 'Trajet', code: 'RIDE' },
  { label: 'Traduction', code: 'SERVICE' },
  { label: 'Matériel', code: 'MATERIAL' },
  // Les trois que la fusion rend disponibles, avec les mots de `HELP_TYPE_LABELS`.
  { label: 'Logement', code: 'HOUSING' },
  { label: 'Accueil', code: 'WELCOME' },
  { label: 'Autre', code: 'OTHER' },
] as const;

/**
 * `updateProfileSchema` : dix compétences et dix langues au plus. La borne vit
 * là-bas — elle est recopiée ici parce que l'écran doit la tenir AVANT l'envoi,
 * sinon le serveur refuse un formulaire qui a laissé cocher.
 */
const CHOIX_MAX = 10;

/** Les lignes du catalogue qui portent ces identifiants, dans l'ordre retenu. */
function resoudre(
  catalogue: readonly ChoixItem[],
  ids: readonly string[],
): readonly ChoixItem[] {
  return ids
    .map((id) => catalogue.find((c) => c.id === id))
    .filter((c): c is ChoixItem => c !== undefined);
}

/** `updateProfileSchema.helpTypes` : au plus cinq. La borne vit là-bas, pas ici. */
const HELP_TYPES_MAX = 5;

const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Nettoie une saisie de pseudo À LA FRAPPE — §2.6.
 *
 * LOT A. L'ancienne `toHandle` MODIFIAIT silencieusement ce que le membre tapait :
 * « Awa » devenait « awa », « 7ans » restait accepté et « jean- » perdait son
 * tiret à l'envoi. Le schéma partagé (`handleSchema`) REFUSE ces trois saisies ;
 * l'écran en disait donc autre chose que le serveur. Désormais l'écran ne retire
 * que ce qui ne peut jamais appartenir à un pseudo (espaces, ponctuation, symboles)
 * et translittère les accents (« Aïcha » → « Aicha », comme `generateHandle` côté
 * serveur) ; la CASSE, le chiffre en tête, la longueur et le séparateur final sont
 * laissés tels quels, et `etatPseudo` puis l'envoi les REFUSENT avec le message du
 * schéma partagé.
 */
export function saisieHandle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 30);
}

/**
 * Le pseudo saisi est-il acceptable ? `null` s'il l'est (ou s'il est vide : le
 * pseudo est facultatif à l'inscription, le serveur en génère un), sinon le
 * message du schéma partagé — le même que la ligne d'aide sous le champ.
 */
export function refusPseudo(handle: string): string | null {
  if (handle === '') return null;
  const forme = handleSchema.safeParse(handle);
  return forme.success ? null : (forme.error.issues[0]?.message ?? 'Pseudo invalide.');
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
  /** Le pays de la ville — `GET /places/cities` le rend (lot W1A, phase 0.2). */
  readonly countryId: string;
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
  /** Pays d'ORIGINE ou de DESTINATION (02 §2.1) : décide quelles villes l'écran du lieu propose. */
  readonly kind?: 'ORIGIN' | 'DESTINATION' | 'BOTH';
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES VILLES QUE L'ÉCRAN DU LIEU PROPOSE (lot W1A, phase 0.2)               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le sélecteur « Votre ville » listait les 65 villes de la base, tous pays mêlés :
 * « Abomey » ouvrait la liste d'un membre qui venait de dire qu'il vivait en
 * France. L'audit l'avait noté (« liste de villes non détectée »), et le défaut
 * était réel : un membre pouvait « choisir » une ville sans rapport avec l'endroit
 * où il vit, et le parcours créé ensuite avait cette ville pour destination.
 *
 * La question de l'écran est « Où vivez-vous ? ». Le pays où le membre vit se
 * déduit de ce qu'il a déjà dit à l'écran de la phase :
 *
 *   · AVANT LE DÉPART (`PRE_DEPARTURE`) — il vit encore au pays : ses villes sont
 *     celles du pays d'ORIGINE qu'il vient de choisir au-dessus ;
 *   · DÉJÀ ARRIVÉ ou INSTALLÉ — il vit dans un pays de DESTINATION : les villes de
 *     tous les pays de destination.
 *
 * Tant que la phase n'est pas connue (la réponse de `GET /me` n'est pas arrivée),
 * rien n'est filtré : une liste complète un instant vaut mieux qu'une liste vide.
 * Et si le filtre ne laissait AUCUNE ville (un pays sans ville amorcée), on rend
 * le catalogue entier plutôt que d'enfermer le membre sur un écran où « Continuer »
 * est refusé et où rien ne se choisit.
 */
export function villesProposees(
  catalogue: readonly CityChoice[],
  pays: readonly CountryChoice[],
  phase: string | null,
  originIso2: string,
): readonly CityChoice[] {
  if (phase === null) return catalogue;
  const ids = new Set(
    phase === 'PRE_DEPARTURE'
      ? pays.filter((c) => c.iso2 === originIso2).map((c) => c.id)
      : pays.filter((c) => c.kind === 'DESTINATION' || c.kind === 'BOTH').map((c) => c.id),
  );
  if (ids.size === 0) return catalogue;
  const gardees = catalogue.filter((c) => ids.has(c.countryId));
  return gardees.length === 0 ? catalogue : gardees;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LE CHAMP DE PSEUDO ANNONCE — CINQ ÉTATS, UNE SEULE FORME            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette ne dessine qu'un état : la coche verte et « Disponible » en
 * `#16785E`. Les quatre autres réemploient EXACTEMENT la même boîte — même
 * taille, même graisse, même position — et ne changent que le mot et la teinte.
 *
 * ── D'OÙ VIENNENT LES DEUX TEINTES ────────────────────────────────────────
 *
 * `#16785E` est celle que la maquette écrit sur « Disponible ». `#B4581F` est
 * dessinée dans LA MÊME maquette (`01 Accès et Onboarding.dc.html`, trois
 * occurrences) et c'est sa teinte de refus. Rien n'est inventé.
 *
 * ── LES MOTS, EUX, NE SONT PAS DESSINÉS ───────────────────────────────────
 *
 * « Déjà pris », « Vérification… » et le rappel de format n'existent sur aucune
 * planche, parce qu'aucune ne dessine ces états. Ils sont secs et factuels, et
 * REMONTÉS au porteur comme les autres textes d'interface non dessinés.
 *
 * ── POURQUOI « ON NE SAIT PAS » NE DIT RIEN ───────────────────────────────
 *
 * `pris === null` après une vérification couvre deux cas : rien n'a encore été
 * demandé, ou l'appel a échoué (réseau, `429`). Dans les deux, la coche reste
 * ÉTEINTE et la phrase vide. Allumer la coche « par défaut » est exactement le
 * défaut qu'on corrige : une promesse que personne n'a vérifiée.
 */
export function etatPseudo(
  handle: string,
  pris: boolean | null,
  enCours: boolean,
): { handleCheckDisplay: string; handleHint: string; handleHintColor: string } {
  const eteint = { handleCheckDisplay: 'none', handleHint: '', handleHintColor: '#5D6B66' };
  if (handle === '') return eteint;

  /**
   * LA MÊME RÈGLE QUE LE SERVEUR, LUE DEPUIS LE SERVEUR. `handleSchema` vient de
   * `@app/shared` : trois caractères au moins, trente au plus, minuscules,
   * chiffres, tiret et souligné sans doublon, et jamais un chiffre en tête. La
   * recopier ici ferait deux vérités, et c'est la seconde qui finit par mentir.
   */
  const forme = handleSchema.safeParse(handle);
  if (!forme.success) {
    return {
      handleCheckDisplay: 'none',
      handleHint: forme.error.issues[0]?.message ?? 'Pseudo invalide.',
      handleHintColor: '#B4581F',
    };
  }

  if (enCours) return { ...eteint, handleHint: 'Vérification…' };
  if (pris === true) {
    return { handleCheckDisplay: 'none', handleHint: 'Déjà pris', handleHintColor: '#B4581F' };
  }
  if (pris === false) {
    // Le seul état que la maquette dessine : la coche et son mot, à l'identique.
    return { handleCheckDisplay: 'block', handleHint: 'Disponible', handleHintColor: '#16785E' };
  }
  return eteint;
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
  /** P01 — à la sortie du champ : dit POURQUOI le numéro est refusé (même message que l'envoi). */
  readonly verifierNumero?: () => void;
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
  /** Le bouton retour de l'en-tête — remonte d'une étape. Voir `use-onboarding-flow.ts`. */
  readonly onBack: () => void;
  /**
   * Les pays proposés, chargés depuis `/places/countries`.
   *
   * Vide tant que l'appel n'a pas répondu : le sélecteur montre alors le seul
   * indicatif de la maquette, ce qui vaut mieux qu'un menu vide.
   */
  readonly countryOptions: readonly CountryChoice[];
  /** TOUTES les villes, chargées une fois (02 §2.2) ; l'écran n'en propose que `villesProposees`. */
  readonly cityCatalogue: readonly CityChoice[];
  /**
   * La phase du membre telle que le SERVEUR la connaît (`GET /me`), ou `null` tant
   * qu'elle n'est pas lue. Elle décide du pays dont on propose les villes.
   */
  readonly phaseServeur: string | null;
  /**
   * Les compétences et les langues proposées — `GET /places/skills` et
   * `GET /places/languages`. Soixante et vingt-quatre lignes, servies triées :
   * assez peu pour tenir en une réponse, d'où un filtre à l'écran plutôt qu'un
   * aller-retour par frappe.
   */
  readonly skillCatalogue: readonly ChoixItem[];
  readonly languageCatalogue: readonly ChoixItem[];
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
  /**
   * Le drapeau du pays choisi, dérivé de son code ISO (`drapeau.ts`).
   *
   * Il REMPLACE `originFlagDisplay`, qui ne servait qu'à MASQUER la pastille :
   * la maquette ne peint qu'un drapeau, celui du Bénin, et l'afficher à côté du
   * Sénégal aurait été un défaut. Un drapeau juste pour chaque pays rend ce
   * masquage inutile.
   */
  /**
   * ── P01 : L'INDICATIF S'OUVRE DANS LE MÊME PANNEAU QUE O02 ───────────────
   *
   * Le porteur : « Utilise le modal de sélection du pays ici aussi. » C'est le
   * même contrôle, monté une seconde fois par la page — et la même raison : un
   * `<option>` ne rend que du texte, donc le menu natif ne pouvait pas porter de
   * drapeau.
   */
  readonly countryFlag: string;
  readonly countryOuvert: boolean;
  readonly onCountryOuvrir: () => void;
  readonly onCountryFermer: () => void;
  readonly onCountryPick: (iso2: string) => void;
  readonly paysIndicatifSelecteur: ReactNode;

  readonly originFlag: string;
  /** Le panneau de choix du pays est ouvert — porte `aria-expanded`. */
  readonly originOuvert: boolean;
  readonly onOriginOuvrir: () => void;
  readonly onOriginFermer: () => void;
  /** Choisir un pays le retient ET referme le panneau : un seul geste. */
  readonly onOriginPick: (iso2: string) => void;
  /**
   * LE PANNEAU LUI-MÊME, monté par la page.
   *
   * Il ne peut pas être construit ici : `data.ts` n'est pas un fichier de rendu,
   * et surtout les deux cadres ont une GÉOMÉTRIE DIFFÉRENTE — la carte blanche de
   * 22 px de rayon sur ordinateur, la page nue sur téléphone. La page passe donc
   * à chaque cadre le panneau de sa variante, exactement comme
   * `nouvelle-story-screen.tsx` fait pour le sélecteur de parcours de A14.
   *
   * `null` pour les cinq autres écrans de l'onboarding, qui n'en ont pas.
   */
  readonly paysSelecteur: ReactNode;
  /**
   * Les pays proposés comme ORIGINE. La France en est exclue : elle est
   * `DESTINATION` (02 §2.1), et l'API refuse de l'accepter comme pays d'origine.
   * La proposer serait offrir un choix qui échoue.
   */
  readonly originOptions: readonly CountryChoice[];
  readonly citySearch: string;
  readonly onCitySearch: (event: { target: { value: string } }) => void;
  /**
   * ── O02 : LA VILLE DANS LE PANNEAU ────────────────────────────────────────
   *
   * `villeNom` est la ville retenue, ou l'invite que la planche écrit dans son
   * champ (« Votre ville ») tant que rien n'est choisi : la ligne dit alors ce
   * qu'elle attend, comme le faisait le champ qu'elle remplace.
   */
  readonly villeNom: string;
  readonly villeOuvert: boolean;
  readonly onVilleOuvrir: () => void;
  readonly onVilleFermer: () => void;
  readonly villeSelecteur: ReactNode;

  // ── O04 : profil ──────────────────────────────────────────────────────────
  readonly displayNameValue: string;
  readonly onDisplayNameChange: (event: { target: { value: string } }) => void;
  readonly handleValue: string;
  readonly onHandleChange: (event: { target: { value: string } }) => void;
  /**
   * ── LE PSEUDO EST-IL LIBRE ? ──────────────────────────────────────────────
   *
   * Le porteur : « Le pseudo est vérifié ? » Il ne l'était pas. La maquette
   * dessine une coche verte et le mot « Disponible » SOUS le champ, et ces deux
   * littéraux s'affichaient quoi qu'on tape — y compris sur un pseudo déjà pris.
   *
   * Les trois prises ci-dessous ne font que donner une VALEUR à ce que la
   * maquette dessine déjà : la coche s'affiche ou non, et la phrase change de
   * mot et de teinte. Aucune forme nouvelle, aucune position nouvelle.
   */
  readonly handleCheckDisplay: string;
  readonly handleHint: string;
  readonly handleHintColor: string;

  // ── O04 : compétences et langues ──────────────────────────────────────────
  /**
   * LES DEUX CHAMPS, montés par la page.
   *
   * `data.ts` n'est pas un fichier de rendu — il ne peut pas construire de JSX.
   * La page passe donc le contrôle à chaque cadre, exactement comme pour le
   * panneau de pays de O02. `null` partout ailleurs.
   */
  /**
   * ── LE PORTRAIT ───────────────────────────────────────────────────────────
   *
   * `avatarFond` est une valeur CSS `background-image` : `none` tant qu'aucune
   * photo n'est choisie, `url(...)` ensuite. L'appareil photo de la maquette
   * s'efface alors (`avatarIconDisplay`), sans quoi il se superposerait au
   * portrait.
   *
   * Les trois sont recouvertes par la page, qui tient le choisisseur de fichier.
   */
  /** « 2 / 5 » — l'idiome de compteur de ce dossier, pas une phrase nouvelle. */
  readonly helpTypesCount: string;

  readonly onAvatar: () => void;
  readonly avatarFond: string;
  readonly avatarIconDisplay: string;

  readonly competencesChamp: ReactNode;
  readonly languesChamp: ReactNode;
  readonly competencesOptions: readonly ChoixItem[];
  readonly competencesChoisies: readonly ChoixItem[];
  readonly onAjouterCompetence: (id: string) => void;
  readonly onRetirerCompetence: (id: string) => void;
  /**
   * CRÉER une compétence qui n'existe pas encore — « le free typing ». Elle naît
   * rattachée à son auteur et n'est choisissable que par lui, jusqu'à ce que
   * l'équipe la globalise. Recouverte par le crochet, qui tient le catalogue.
   */
  readonly onCreerCompetence: (nom: string) => Promise<void>;
  readonly languesOptions: readonly ChoixItem[];
  readonly languesChoisies: readonly ChoixItem[];
  readonly onAjouterLangue: (id: string) => void;
  readonly onRetirerLangue: (id: string) => void;
  /** `updateProfileSchema` : dix au plus, pour chacune des deux listes. */
  readonly choixMax: number;
  readonly onPhoneChange: (event: { target: { value: string } }) => void;
  /** Sortie du champ numéro : active la validation (trait et message), voir `phoneTouched`. */
  readonly onPhoneBlur: () => void;
  /**
   * ── LE NUMÉRO, VALIDÉ PAR `libphonenumber` ───────────────────────────────
   *
   * Le porteur : « il faut la validation du numéro selon le pays. Backend et
   * frontend aussi », puis « utilise les librairies de validation de lib number
   * de Google ».
   *
   * `phoneExemple` remplace l'invite dessinée « 97 12 34 42 » — un numéro
   * béninois d'AVANT la renumérotation de 2023, que la bibliothèque refuse
   * aujourd'hui — par l'exemple officiel du pays choisi.
   *
   * `phoneBordure` reprend le trait dessiné et le passe au refus quand ce qui est
   * tapé ne vaut rien. Un champ VIDE reste vert : on ne reproche rien à qui n'a
   * encore rien écrit.
   *
   * `phoneValide` grise « Recevoir le code » : on n'envoie pas un SMS pour
   * recevoir un refus.
   */
  readonly phoneExemple: string;
  readonly phoneValide: boolean;
  readonly phoneBordure: string;
  /**
   * Le numéro MASQUÉ, pour l'écran du code. La planche écrit « +229 •• •• •• 42 »
   * en clair, et cet exemple s'affichait quel que soit le numéro tapé — c'est le
   * défaut que le porteur a signalé. Le serveur ne peut pas le fournir : il ne
   * masque que pour un membre authentifié, et le code n'est pas encore vérifié.
   */
  readonly phoneMasque: string;
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
    readonly id: string;
    readonly name: string;
    readonly meta: string;
    readonly bg: string;
    readonly fg: string;
    readonly metaFg: string;
    readonly metaBg: string;
    /** Vrai quand le réseau de la ville n'est pas ouvert (grisée, mais choisissable). */
    readonly bientot: boolean;
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
    /** Choisir ce type décide du parcours créé à la fin de l'inscription. */
    readonly onPick: () => void;
    /** Le rang dans la liste COMPLÈTE des modèles — voir le bloc `goals`. */
    readonly rang: number;
  })[];
  /** Les objectifs qui n'ouvrent AUCUN parcours — la section « sans créer de parcours ». */
  readonly goalsSansParcours: readonly (GoalCard & {
    readonly bg: string;
    readonly bd: string;
    readonly iconBg: string;
    readonly onPick: () => void;
    readonly rang: number;
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
  /**
   * LE MEMBRE CRÉERA-T-IL VRAIMENT UN PARCOURS ?
   *
   * Deux conditions, et il faut les deux : la case cochée, ET un type qui ouvre
   * quelque chose. Les objectifs « sans créer de parcours » portent
   * `creates_journey = false` — voir `packages/db/prisma/schema/03-journeys.prisma`.
   *
   * Tant que la liste n'est pas arrivée, `templates[state.goal]` est `undefined` :
   * on s'en tient alors à la case, comme avant ce lot. Un écran qui annoncerait
   * « aucun parcours » le temps d'un aller-retour réseau mentirait dans l'autre
   * sens.
   */
  const choisi = actions.templates[state.goal];
  const creeUnParcours = state.create && choisi?.createsJourney !== false;

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
      patch({
        countryIso2: event.target.value,
        phone: formaterSaisieNumero(state.phone, event.target.value),
      });
    },
    onPhoneChange: (event: { target: { value: string } }) => {
      // Mise en forme À LA FRAPPE (AsYouType, plan du pays choisi) : seuls les
      // chiffres, les espaces et un « + » de tête survivent. Le serveur reçoit le
      // numéro tel quel et le ramène au format international.
      patch({ phone: formaterSaisieNumero(event.target.value, state.countryIso2) });
    },
    onPhoneBlur: () => {
      patch({ phoneTouched: true });
      actions.verifierNumero?.();
    },
    /**
     * Le pays de l'INDICATIF (P01), et non celui d'origine : c'est lui qui décide
     * du plan de numérotation. Les deux sont distincts depuis toujours (§2.7).
     */
    phoneExemple: exempleNational(state.countryIso2),
    phoneValide: numeroValide(state.phone, state.countryIso2),
    phoneBordure:
      !state.phoneTouched || state.phone.trim() === '' || numeroValide(state.phone, state.countryIso2)
        ? '1.5px solid #16785E'
        : '1.5px solid #B4581F',
    phoneMasque: masqueNumero(state.phone, state.countryIso2),
    codeValue: state.code,
    onCodeChange: (event: { target: { value: string } }) => {
      patch({ code: event.target.value.replace(/\D/g, '').slice(0, 6) });
    },

    originIso2: state.originIso2,
    originName:
      actions.countryOptions.find((c) => c.iso2 === state.originIso2)?.nameFr ?? 'Bénin',
    countryFlag: drapeauDe(state.countryIso2),
    countryOuvert: state.countryOuvert,
    onCountryOuvrir: () => patch({ countryOuvert: true }),
    onCountryFermer: () => patch({ countryOuvert: false }),
    /**
     * UN SEUL `patch` : retenir l'indicatif ET refermer. Deux appels feraient deux
     * rendus, et le second rouvrirait un panneau que le premier a remplacé.
     */
    onCountryPick: (iso2: string) =>
      patch({
        countryIso2: iso2,
        countryOuvert: false,
        phone: formaterSaisieNumero(state.phone, iso2),
      }),
    // La page de P01 passe le sien ; les autres écrans n'en ont pas.
    paysIndicatifSelecteur: null,
    originFlag: drapeauDe(state.originIso2),
    originOptions: actions.countryOptions.filter((c) => c.iso2 !== 'FR'),
    originOuvert: state.originOuvert,
    onOriginOuvrir: () => patch({ originOuvert: true }),
    onOriginFermer: () => patch({ originOuvert: false }),
    /**
     * UN SEUL `patch` pour les deux changements : le pays retenu et la fermeture.
     * Deux appels successifs feraient deux rendus, et le second rouvrirait un
     * panneau que le premier a déjà remplacé — c'est le genre de scintillement
     * qu'on ne voit qu'au navigateur.
     */
    onOriginPick: (iso2: string) => patch({ originIso2: iso2, originOuvert: false }),
    // Les cinq autres écrans n'ont pas de panneau ; la page de O02 passe le sien.
    paysSelecteur: null,
    displayNameValue: state.displayName,
    onDisplayNameChange: (event: { target: { value: string } }) => {
      patch({ displayName: event.target.value.slice(0, 60) });
    },
    handleValue: state.handle,
    onHandleChange: (event: { target: { value: string } }) => {
      patch({ handle: saisieHandle(event.target.value) });
    },
    /**
     * L'ÉTAT PAR DÉFAUT NE SAIT RIEN DU SERVEUR — et c'est volontaire.
     *
     * Cette fonction est pure : elle ne peut pas interroger l'API. Le crochet
     * `use-onboarding-flow` recouvre ces trois valeurs une fois la réponse
     * connue. Ici on ne décide que de ce qui se lit SANS le serveur : un champ
     * vide ou trop court ne promet rien.
     */
    ...etatPseudo(state.handle, null, false),

    /**
     * ── CE QUI EST RETENU, RÉSOLU DEPUIS LE CATALOGUE ───────────────────────
     *
     * L'état ne garde que des identifiants ; les NOMS viennent du catalogue. Un
     * identifiant qui n'y est plus — une compétence désactivée en back-office
     * entre deux visites — disparaît simplement de l'affichage au lieu de rendre
     * une pastille vide.
     */
    competencesOptions: actions.skillCatalogue,
    competencesChoisies: resoudre(actions.skillCatalogue, state.skillIds),
    onAjouterCompetence: (id: string) => {
      if (state.skillIds.includes(id) || state.skillIds.length >= CHOIX_MAX) return;
      patch({ skillIds: [...state.skillIds, id] });
    },
    onRetirerCompetence: (id: string) => {
      patch({ skillIds: state.skillIds.filter((x) => x !== id) });
    },
    /**
     * Le défaut ne crée RIEN : cette fonction est pure, elle ne peut pas appeler
     * l'API. `use-onboarding-flow` la recouvre — c'est lui qui tient le catalogue
     * et qui doit y ajouter la ligne créée pour que la pastille sache se nommer.
     */
    // `Promise.resolve()` et non `async` : une fonction `async` sans `await` est
    // refusée par la règle `require-await`, et elle aurait raison — il n'y a rien
    // à attendre ici.
    onCreerCompetence: () => Promise.resolve(),
    languesOptions: actions.languageCatalogue,
    languesChoisies: resoudre(actions.languageCatalogue, state.languageIds),
    onAjouterLangue: (id: string) => {
      if (state.languageIds.includes(id) || state.languageIds.length >= CHOIX_MAX) return;
      patch({ languageIds: [...state.languageIds, id] });
    },
    onRetirerLangue: (id: string) => {
      patch({ languageIds: state.languageIds.filter((x) => x !== id) });
    },
    choixMax: CHOIX_MAX,
    // Les cinq autres écrans n'ont pas ces champs ; la page de O04 passe les siens.
    competencesChamp: null,
    languesChamp: null,
    /**
     * Le portrait, à l'état « rien de choisi » — c'est exactement ce que la
     * maquette dessine. La page de O04 recouvre les trois dès qu'une photo part.
     */
    onAvatar: () => undefined,
    avatarFond: 'none',
    avatarIconDisplay: 'block',
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
    villeNom:
      actions.cityCatalogue.find((c) => c.id === state.cityId)?.name ?? 'Votre ville',
    villeOuvert: state.villeOuvert,
    onVilleOuvrir: () => patch({ villeOuvert: true }),
    onVilleFermer: () => patch({ villeOuvert: false }),
    // La page de O02 passe le sien ; les autres écrans n'en ont pas.
    villeSelecteur: null,
    cities: matchCities(
      villesProposees(actions.cityCatalogue, actions.countryOptions, actions.phaseServeur, state.originIso2),
      state.citySearch,
    ).map((city) => {
      const chosen = state.cityId === city.id;
      return {
        /** L'identifiant : le panneau en a besoin pour sa clé et sa coche. */
        id: city.id,
        name: city.name,
        meta: city.isActive ? `${city.memberCount} membres` : 'bientôt',
        bg: chosen ? '#E3F0EB' : 'transparent',
        fg: city.isActive || chosen ? '#16211D' : '#8A958F',
        metaFg: chosen ? '#0F5C48' : city.isActive ? '#5D6B66' : '#8A958F',
        metaBg: chosen ? '#fff' : '#F2F5F4',
        bientot: !city.isActive,
        /**
         * CHOISIR UNE VILLE REFERME LE PANNEAU — un seul geste, comme pour le
         * pays. `citySearch` est vidé plutôt que rempli du nom : la recherche a
         * fait son travail, et la rouvrir sur un filtre déjà posé cacherait les
         * autres villes.
         */
        onPick: () => patch({ cityId: city.id, citySearch: '', villeOuvert: false }),
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
    /**
     * ── DEUX GROUPES, UN SEUL INDEX ───────────────────────────────────────────
     *
     * `GET /journey-templates` sert maintenant SIX objectifs : les quatre qui
     * ouvrent un parcours, et les deux que T5 §O03 met sous « sans créer de
     * parcours » (`createsJourney: false`). La maquette les dessine en deux
     * sections ; la donnée les sépare donc ici, et NULLE PART AILLEURS.
     *
     * `state.goal` reste un rang dans la liste COMPLÈTE, et c'est le point : les
     * deux listes filtrent mais conservent l'index d'origine dans leur `onPick`.
     * Un index par section obligerait `use-onboarding-flow.ts` à savoir laquelle
     * a été choisie pour retrouver le modèle — deux sources pour un seul choix.
     */
    goals: goalCards(actions.templates, state.goal)
      .map((g, i) => ({ ...g, rang: i }))
      .filter((g) => actions.templates[g.rang]?.createsJourney !== false)
      .map((g) => ({
        ...g,
        onPick: () => patch({ goal: g.rang }),
        bg: g.on ? '#EFF7F3' : '#fff',
        bd: g.on ? '2px solid #16785E' : '1px solid #E6EBE9',
        iconBg: g.on ? '#fff' : '#E3F0EB',
      })),

    /**
     * Les objectifs QUI N'OUVRENT PAS DE PARCOURS — la seconde section.
     *
     * Mêmes jetons de sélection que la première : T5 §O03 pose que « les deux
     * groupes ont le même rang visuel de choix », donc la même paire
     * `#EFF7F3` / `2px solid #16785E` que la maquette emploie déjà pour la carte
     * choisie. Rien n'est inventé : c'est son état choisi, repris tel quel.
     */
    goalsSansParcours: goalCards(actions.templates, state.goal)
      .map((g, i) => ({ ...g, rang: i }))
      .filter((g) => actions.templates[g.rang]?.createsJourney === false)
      .map((g) => ({
        ...g,
        onPick: () => patch({ goal: g.rang }),
        bg: g.on ? '#EFF7F3' : '#fff',
        bd: g.on ? '2px solid #16785E' : '1px solid #E6EBE9',
        iconBg: g.on ? '#fff' : '#E3F0EB',
      })),

    // Un seul statut à la fois : c'est une colonne unique dans `user_profiles`.
    statuses: OCCUPATIONS.map((o, i) =>
      chip(o.label, state.occupation === i, () => patch({ occupation: i })),
    ),

    /**
     * ── UN OBJECTIF NON DÉVELOPPABLE NE CRÉE RIEN, ET LA CASE LE DIT ─────────
     *
     * « M'intégrer, rencontrer du monde » et « Aider les autres » portent
     * `creates_journey = false` : choisir l'un d'eux n'ouvre aucun parcours, et
     * `use-onboarding-flow.ts` s'arrête avant la création.
     *
     * La case et sa phrase doivent le dire. Sans cela l'écran annonçait « Le
     * parcours “M'intégrer, rencontrer du monde” (0 étapes) sera créé à la fin de
     * l'inscription » — mesuré au navigateur — c'est-à-dire exactement ce qui ne
     * se passera pas. Un engagement faux sur le dernier écran avant la fin.
     *
     * `creeUnParcours` est donc la VÉRITÉ AFFICHÉE : la case du membre ET le type
     * choisi. L'état `state.create` n'est pas touché — le membre le retrouve tel
     * qu'il l'a laissé s'il revient sur un parcours développable.
     */
    create: creeUnParcours,
    toggleCreate: () => patch({ create: !state.create }),
    createBg: creeUnParcours ? '#16785E' : '#fff',
    createBd: creeUnParcours ? 'none' : '1.5px solid #CBD5D1',
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
    createHelp: !creeUnParcours
      ? 'Aucun parcours ne sera créé. Vous pourrez en créer un plus tard depuis Parcours.'
      : createAnnounce(actions.templates, state.goal),

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
    /**
     * Huit types d'aide, AU PLUS CINQ RETENUS.
     *
     * La borne est celle du serveur (`updateProfileSchema.helpTypes.max(5)`).
     * Un sixième appui ne fait RIEN plutôt que de remplacer un choix au hasard :
     * remplacer sans le dire ferait disparaître une pastille que le membre vient
     * de cocher, sous ses yeux, sans qu'il comprenne pourquoi.
     */
    /**
     * LE COMPTEUR DES TYPES D'AIDE — « il faut préciser le nombre d'aide possible
     * à cocher. J'ai remarqué que c'était 5. »
     *
     * La forme « 2 / 5 » n'est PAS inventée : c'est le compteur que ce dossier
     * écrit déjà, mot pour mot, sous la zone de texte de A14 (« 118 / 280 »).
     * Reprendre son idiome évite d'écrire une phrase d'interface pour dire un
     * nombre.
     *
     * La borne vient de `updateProfileSchema.helpTypes.max(5)` — elle n'est pas
     * choisie ici, elle est RECOPIÉE de ce que le serveur accepte, et c'est la
     * même constante qui empêche le sixième appui.
     */
    helpTypesCount: `${String(state.helpChoices.length)} / ${String(HELP_TYPES_MAX)}`,
    helpTypes: HELP_TYPES.map((h, i) => {
      const on = state.helpChoices.includes(i);
      const plein = !on && state.helpChoices.length >= HELP_TYPES_MAX;
      return chip(h.label, on, () => {
        if (plein) return;
        patch({
          helpChoices: on
            ? state.helpChoices.filter((x) => x !== i)
            : [...state.helpChoices, i],
        });
      });
    }),

    /**
     * Les prochains événements de la ville. VIDE ICI, et c'est voulu : la planche
     * dessinait trois événements lyonnais (« Apéro Diaspora et Étudiants »…) que
     * tout membre voyait, où qu'il vive. `FinScreen` les remplace par ceux de
     * `GET /events` (voir `atterrissage.ts`) ; les autres écrans n'en lisent aucun.
     */
    events: [],
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
  /**
   * L'identifiant du parcours créé, ou `null` tant que `GET /journeys` n'a pas
   * répondu. C'est lui que « Commencer » ouvre — le bouton n'avait AUCUN geste
   * (« Le bouton commencer ne marche pas sur cet écran »), et il ne pouvait pas
   * en avoir : l'écran lisait le titre et le rang de l'étape, jamais l'identifiant.
   */
  readonly id: string | null;
  readonly titre: string;
  readonly rang: number;
  readonly total: number;
  readonly etape: string;
  /**
   * La description de l'étape en cours. Vide tant que la réponse n'est pas là —
   * et vide pour de bon si l'étape n'en a pas : la planche écrivait sinon
   * « Campus France, choix des formations, lettre de motivation » sous l'étape de
   * n'importe quel parcours.
   */
  readonly description: string;
}

export const PARCOURS_INCONNU: ParcoursPret = {
  id: null,
  titre: '',
  rang: 0,
  total: 0,
  etape: '',
  description: '',
};

/**
 * O05 — les deux atterrissages de §5, écran 6.
 *
 * Il ÉTEND `OnboardingVals` : `FinScreen` répand les mêmes valeurs dans ses deux
 * planches, et les quinze autres cadres de la maquette gardent leur signature.
 */
export interface O05Data extends OnboardingVals {
  readonly parcours: ParcoursPret;
  /**
   * « Commencer » — il n'avait AUCUN geste. Il ouvre le parcours que l'écran vient
   * d'annoncer, par son identifiant ; tant que `GET /journeys` n'a pas répondu, il
   * ne fait rien plutôt que d'aller sur une adresse construite avec `null`.
   */
  readonly onCommencer: () => void;
  /**
   * « Aller à l'accueil » de la variante sans parcours — il n'avait AUCUN geste
   * (lot W1A, phase 0.1). Vérifie la session, puis ouvre `/accueil`.
   */
  readonly onAccueil: () => void;
  /** La ville, son réseau, ses événements et le parrain suggéré — voir `atterrissage.ts`. */
  readonly lieu: LieuAtterrissage;
  /** « Demander » : mène à la fiche du parrain suggéré, où la demande se rédige. */
  readonly onDemander: () => void;
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
