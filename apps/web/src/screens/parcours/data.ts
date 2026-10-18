/**
 * Données des écrans J01 à J11, reprises de `docs/template/04 Parcours.dc.html`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE FICHIER NE RESSEMBLE PAS À `a01/data.ts`, ET C'EST LA MAQUETTE QUI DÉCIDE.
 *
 * `a01/data.ts` recopie le `renderVals()` de `03 Accueil v2` : la maquette du
 * fil calcule ses fonds, ses couleurs de texte et ses états actifs, et le JSX
 * généré les consomme. `04 Parcours`, elle, n'a PAS de `renderVals()` — sa
 * méthode rend `{}` — et son HTML ne contient pas une seule interpolation
 * `{{ … }}` ni un seul `<sc-for>` (contre 767 et 328 pour `03 Accueil`).
 *
 * Il n'y a donc RIEN à recopier ici : chaque valeur affichée est écrite en clair
 * dans le HTML et se retrouve telle quelle dans le JSX transcodé. Inventer un
 * `data.ts` qui « alimenterait » ces écrans reviendrait à réécrire la maquette
 * en données — exactement ce que le transcodage interdit.
 *
 * CE QUE LA MAQUETTE DONNE À LA PLACE, ce sont des ÉTATS : « aucun parcours »,
 * « un parcours abouti », « plan atteint », « variante Régulariser »,
 * « sélecteur ouvert », « modifier les étapes ». Chacun est une PLANCHE à part
 * entière. Le rôle de ce fichier est donc de les NOMMER, et celui des pages de
 * choisir la planche qui correspond — pas de peupler un composant.
 *
 * Au lot 3, quand l'API alimentera réellement ces écrans, c'est la maquette qui
 * devra d'abord gagner ses interpolations ; ce fichier redeviendra alors un
 * `data.ts` ordinaire.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Les propriétés que les composants générés consomment.
 *
 * Elles ne viennent PAS du dialecte de la maquette — il est vide — mais des
 * adaptations du générateur, qui branche les boutons qu'il reconnaît
 * (`BUTTON_ACTIONS` dans `tools/generate-screens.mjs`). Toutes sont facultatives
 * du point de vue d'un cadre donné : `collectProps` ne déclare à chaque
 * composant que ce qu'il emploie réellement.
 *
 * `onPublish` N'EXISTE TOUJOURS PAS, et c'est la règle dure §3.5 rendue visible :
 * « l'objet cible n'est créé qu'à l'appel explicite de la route de publication ».
 * Le générateur ne reconnaît pas le libellé « Publier », donc aucun `onClick`
 * n'est posé sur ce bouton — et aucune suite de clics ne publie. Le brouillon,
 * lui, est bien créé et bien annulable : voir `use-parcours-api.ts`.
 *
 * CE QUI A CHANGÉ : ces gestes ne sont plus inertes. `onContinue`, `onCancel` et
 * l'ouverture de J03 appellent de vraies routes de `journeys` — création du
 * parcours (§3.1), brouillon de blocage et son annulation (§3.5), refus de
 * partage (§3.6). Ils restent inertes là où l'URL ne nomme aucun parcours, parce
 * qu'il n'y aurait rien à écrire ; `use-parcours-api.ts` dit lesquelles et
 * pourquoi.
 */
export type ParcoursData = {
  /** Un envoi est en cours : les boutons d'action se désactivent. */
  readonly busy: boolean;
  /** J02 « Régulariser » — crée le parcours « Régulariser ma situation » (§3.1). */
  readonly onContinue: () => void;
  /** J03 — volet suivant (« Suivant », « Voir l'aperçu »). */
  readonly onNext: () => void;
  /** J03 — volet précédent (« Retour »). */
  readonly onBack: () => void;
  /** J03 « Annuler » (§3.5 → `CANCELLED`) et J04 « Plus tard » (§3.6). */
  readonly onCancel: () => void;
  /**
   * ─── LES SEPT ENTRÉES DU PANNEAU « MON PARCOURS » ─────────────────────────
   *
   * La maquette les dessine en `<span>` : ce n'étaient pas des liens cassés,
   * CE N'ÉTAIENT PAS DES LIENS, et c'est la phrase du porteur (« Aucun sous lien
   * aussi ne fonctionne »). La déclaration d'écran
   * (`tools/screens/04-parcours.mjs`, `ENTREES_PANNEAU_PARCOURS`) les promeut en
   * boutons, un gestionnaire par entrée.
   *
   * POURQUOI SEPT NOMS ET NON UN SEUL AVEC UN ARGUMENT : `collectProps` déduit
   * les propriétés d'un cadre des RACINES des interpolations de la maquette. Une
   * flèche (`onClick={() => aller('equipe')}`) ne commence pas par un
   * identifiant, donc sa racine est indéterminée et la propriété ne serait PAS
   * déclarée — le composant généré référencerait un nom qu'il ne reçoit pas.
   * Mesuré sur `collectProps`, pas supposé.
   *
   * POURQUOI DES GESTIONNAIRES ET NON DES `href` : la destination a besoin du
   * `:id` de la route, et `markLinks` n'accepte un `vers` interpolé que DANS une
   * boucle. Le manque est remonté au porteur ; voir l'en-tête de la déclaration.
   */
  readonly onPanneauVue: () => void;
  readonly onPanneauEtape: () => void;
  readonly onPanneauDiscussion: () => void;
  readonly onPanneauEquipe: () => void;
  readonly onPanneauDocuments: () => void;
  readonly onPanneauHistorique: () => void;
  readonly onPanneauReglages: () => void;
};

/**
 * LES FENÊTRES ET FEUILLES QUE CE MODULE OUVRE.
 *
 * Le nom est celui que le transcodeur pose en `data-modal-open` sur le bouton
 * déclencheur, et que `Modal` reçoit en `name`. L'identifiant de titre est celui
 * que le transcodeur dérive de la SECTION de la maquette — `j05-titre` pour la
 * feuille d'invitation, parce qu'elle est dessinée dans la section J05.
 */
export const MODALES = {
  /** J03 — « Je suis bloqué·e », trois volets (§3.5). */
  J03: { titleId: 'j03-titre' },
  /** J04 — « Partager un jalon » (§3.6). */
  J04: { titleId: 'j04-titre' },
  /** J01M — la feuille « Mes parcours · 3 » du sélecteur, sur mobile. */
  J01M: { titleId: 'j01m-titre' },
  /** J05 — « Inviter dans l'équipe ». */
  J05I: { titleId: 'j05-titre' },
  /** J07 — « Exporter mon parcours », réservé à Premium. */
  J07X: { titleId: 'j07-titre' },
  /** J08 — « Arrêter « Mes études à Lyon » ? » (§3.9, sans vocabulaire d'échec). */
  J08A: { titleId: 'j08-titre' },
} as const;

export type NomModale = keyof typeof MODALES;

/**
 * LES TROIS VOLETS DE « JE SUIS BLOQUÉ·E », et la règle qu'ils portent.
 *
 * 03 §1.2 : « un parcours ne publie JAMAIS rien tout seul. Il propose. »
 * §3.5 : « flux en quatre temps, sans jamais publier automatiquement », et la
 * règle dure « le brouillon n'est jamais promu sans cet appel ».
 *
 * La maquette tient cette règle par le DESSIN : le bouton « Publier » n'est
 * dessiné que sur le troisième volet. Les deux premiers n'offrent que
 * « Suivant » / « Voir l'aperçu ». C'est ce que `e2e/parcours-bloque.spec.ts`
 * éprouve — pas que le code soit écrit ainsi, mais qu'aucune suite de clics
 * n'atteigne « Publier » sans traverser les trois volets.
 */
export const VOLETS_BLOCAGE = 3;

/**
 * LES ÉTATS PASSENT PAR L'URL, et chaque route déclare les siens.
 *
 * POURQUOI UN PARAMÈTRE D'URL plutôt qu'un bouton : parce que la maquette ne
 * dessine PAS toujours le contrôle qui mènerait à l'état. Il n'y a, par exemple,
 * aucun sélecteur dans l'en-tête mobile de J01 — la planche J01M en montre un,
 * mais dans son DÉCOR, c'est-à-dire dans la partie qui représente l'écran de
 * dessous et que le transcodeur retire. Inventer ce contrôle serait réécrire la
 * maquette ; laisser l'état inatteignable serait livrer une planche morte.
 * L'URL le rend atteignable, testable, et n'ajoute aucun pixel.
 *
 * La table n'est PAS centralisée ici : les états de `/parcours/:id` (`vide`,
 * `abouti`, `parcours`, `edition`) et ceux de `/parcours/nouveau`
 * (`regulariser`, `plan`) n'ont rien en commun, et une table unique aurait
 * laissé croire à chaque page qu'elle accepte les valeurs de l'autre. Chacune
 * déclare les siennes, à côté du composant qui les rend.
 */

/* ══════════════════════════════════════════════════════════════════════════════
 * LES PRISES DE J01 ET J05 À J11 — un type par écran, et ce qu'il contient.
 *
 * L'en-tête de ce fichier disait : « au lot 3, quand l'API alimentera réellement
 * ces écrans, c'est la maquette qui devra d'abord gagner ses interpolations ». La
 * seconde moitié de cette phrase s'est révélée fausse, et c'est `08-compte.mjs`
 * qui l'a montré : la maquette NE GAGNE PAS d'interpolations — on ne la réécrit
 * pas — c'est la DÉCLARATION D'ÉCRAN qui porte la prise, sous la clé `donnees` de
 * `tools/screens/04-parcours.mjs`. Le reste de la phrase tient : le JSX transcodé
 * n'a pas bougé d'une virgule, et c'est ici que les champs arrivent.
 *
 * ── CE QUI EST UNE DONNÉE ET CE QUI N'EN EST PAS ────────────────────────────
 *
 * Les COULEURS sont parfois des données, et elles viennent toujours de la
 * maquette. C'est le précédent de K03 dans le module Compte : lier le seul libellé
 * d'une pastille laisserait « En pause » sur le fond vert d'un parcours actif, ce
 * qui serait pire que la maquette figée. Aucune teinte n'est assombrie.
 *
 * Les BOOLÉENS de variante (`coche` / `aFaire`, `actif` / `enPause`, `courant` /
 * `autre`, `premiere` / `suivante`) existent parce que la maquette dessine
 * PLUSIEURS variantes et qu'elles vont toutes sous `<sc-if>`. Ils sont exclusifs
 * deux à deux, et `appels.ts` les calcule au même endroit pour qu'ils ne puissent
 * pas se contredire.
 *
 * Le NIVEAU DE VÉRIFICATION n'autorise rien ici. Il n'apparaît que pour décider
 * si la maquette dessine « Proposer comme parrain » (J09), et c'est le parrainage
 * qui refusera une proposition qu'il n'accepte pas. La règle du socle est sans
 * exception.
 * ══════════════════════════════════════════════════════════════════════════════ */

/**
 * LE PANNEAU DE GAUCHE — les dix planches d'ordinateur dessinent la même carte.
 *
 * `type` est la forme COURTE et capitale que l'étiquette « PARCOURS … » attend ;
 * `typeNom` est le nom tel que l'API l'écrit (`template.nameFr`), employé par J08
 * (« Parcours Études · version 2026 ») et J10 (« parcours Études abouti »). Les
 * deux viennent du même champ et ne peuvent donc pas se contredire.
 */
export interface PanneauParcours {
  readonly titre: string;
  readonly type: string;
  readonly typeNom: string;
  readonly avancement: number;
  readonly rang: number;
  readonly etape: string;
  readonly echeance: string;
  readonly equipe: number;
}

/** L'entête du parcours : ce que les planches écrivent autour de son avancement. */
export interface EnteteParcours {
  readonly visibilite: string;
  readonly visibiliteTitre: string;
  readonly origine: string;
  readonly destination: string;
  readonly depart: string;
  /** `journey.doneCount` — hors étapes facultatives, comme `total` (§3.2). */
  readonly franchies: number;
  readonly total: number;
  readonly duree: string;
  readonly aboutiLe: string;
  readonly version: number;
}

/** L'étape sur laquelle l'écran porte : celle de l'URL, ou celle du serveur. */
export interface EtapeAffichee {
  readonly rang: number;
  readonly titre: string;
  readonly etat: string;
  readonly echeance: string;
  readonly description: string;
  /** §3.3 — documents cochés sur documents listés, au PROPRIÉTAIRE seul (§3.4). */
  readonly cochees: number;
  readonly actions: number;
}

/** Un membre de l'équipe du parcours (§3.4), prêt à poser dans la planche. */
export interface MembreAffiche {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur […] partout
   * où le nom est affiché ». Les noms dessinés dans les cadres étaient des
   * `<span>` et aucun ne menait au profil.
   *
   * FACULTATIVE : le cadre ne pose le lien que si la ligne porte une adresse.
   * Sans elle, le nom reste nu — exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly fond: string;
  readonly initiales: string;
  readonly nom: string;
  readonly depuis: string;
  readonly badgeFond: string;
  readonly badgeTexte: string;
  readonly role: string;
  /** J05 ordinateur : le menu « … » n'est dessiné que pour un accompagnant. */
  readonly menu: boolean;
  /** J05 ordinateur : on ne se retire pas de son propre parcours. */
  readonly retirable: boolean;
  /** J05 mobile : la maquette ne trace pas de filet au-dessus de la première ligne. */
  readonly premiere: boolean;
  readonly suivante: boolean;
}

/** Une étape franchie de la frise, avec sa durée RÉELLE (`durationDays`). */
export interface EtapeFrise {
  readonly titre: string;
  readonly duree: string;
}

/** Un type de parcours proposé (§2.1). `etapes` vient de `version.stepCount`. */
export interface ModeleAffiche {
  readonly nom: string;
  readonly etapes: number;
  readonly phrase: string;
}

/**
 * Un type de parcours tel que J02 le PROPOSE — un modèle, plus l'état du choix.
 *
 * `choisi` et `autre` sont les DEUX variantes de carte que la maquette de J02
 * dessine : la première ligne est teintée, bordée de 2 px et porte une coche ; les
 * autres sont blanches et nues. Deux champs plutôt qu'un booléen et sa négation,
 * comme `courant` / `autre` de `ChoixParcours` et `courante` / `revocable` d'une
 * session de K04 : le cadre transcodé dessine les deux et n'en montre qu'une, et
 * c'est le chargeur qui décide — jamais le JSX.
 *
 * CE N'EST PAS UNE DONNÉE DU SERVEUR, et `appels.ts` l'écrit sans détour : le
 * choix est un état d'INTERACTION, et aucune carte de J02 n'est cliquable (la
 * maquette les dessine en `<div>`, pas en `<button>`, donc le générateur n'y pose
 * aucun `onClick`). Le chargeur reproduit donc ce que la maquette montre — la
 * première proposition est présélectionnée — et rien de plus.
 */
export interface ModeleProposé extends ModeleAffiche {
  readonly choisi: boolean;
  readonly autre: boolean;
}

/** Une ligne du sélecteur « Mes parcours » (J01M). */
export interface ChoixParcours {
  readonly fond: string;
  readonly titre: string;
  readonly pastilleFond: string;
  readonly pastilleTexte: string;
  readonly etat: string;
  readonly sousTitre: string;
  readonly barre: string;
  readonly teinte: string;
  readonly pourcent: string;
  readonly courant: boolean;
  readonly autre: boolean;
}

/** Un document de la checklist (§3.3). AUCUN fichier : seulement un libellé. */
export interface DocumentAffiche {
  readonly libelle: string;
  readonly coche: boolean;
  readonly aFaire: boolean;
}

/** Une autre étape du parcours, sa checklist repliée (J06). */
export interface GroupeEtape {
  readonly titre: string;
  readonly compte: string;
  readonly compteCourt: string;
  readonly teinteCompte: string;
  readonly barre: string;
  readonly teinteBarre: string;
}

/**
 * Une entrée du journal (§3.8), avec SON icône.
 *
 * Les six drapeaux `ic…` sont exclusifs : exactement un est vrai. La maquette
 * dessine CINQ icônes sur chaque cadre et `JourneyActivityType` compte HUIT
 * valeurs — `appels.ts` range les trois sans icône propre sous la famille la plus
 * proche, et le dit.
 */
export interface EntreeJournal {
  readonly icEtape: boolean;
  readonly icEntraide: boolean;
  readonly icFranchie: boolean;
  readonly icJalon: boolean;
  readonly icEquipe: boolean;
  readonly titre: string;
  readonly detail: string;
  readonly quand: string;
  /** La maquette dessine « Voir » sur les entrées qui pointent un objet publié. */
  readonly lien: boolean;
  /** Le cadre mobile replie la date et le détail sur une seule ligne. */
  readonly ligneMobile: string;
}

/** Un segment de la frise d'un parcours public (§3.7). */
export interface SegmentPublic {
  readonly teinte: string;
  readonly teinteTitre: string;
  readonly titre: string;
  readonly duree: string;
}

/** Un parcours public d'un autre membre (§3.7) — jamais son titre personnel. */
export interface ParcoursPublicAffiche {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur […] partout
   * où le nom est affiché ». Les noms dessinés dans les cadres étaient des
   * `<span>` et aucun ne menait au profil.
   *
   * FACULTATIVE : le cadre ne pose le lien que si la ligne porte une adresse.
   * Sans elle, le nom reste nu — exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly fond: string;
  readonly initiales: string;
  readonly nom: string;
  readonly sousTitre: string;
  readonly pourcent: string;
  readonly enCours: string;
  readonly segments: readonly SegmentPublic[];
  /** La maquette dessine « Proposer comme parrain » sur une carte et pas l'autre. */
  readonly parrainable: boolean;
}

/** La fiche d'un parcours public (J09 MobileFiche) — la liste FERMÉE de §3.7. */
export interface FichePublique {
  readonly prenom: string;
  readonly nom: string;
  readonly initiales: string;
  readonly type: string;
  readonly ville: string;
  readonly pourcent: string;
  readonly enCours: string;
}

/** Une carte de « Mes parcours » (J11). */
export interface CarteParcours {
  /**
   * L'ADRESSE DU DÉTAIL, ou absente.
   *
   * Le porteur, après avoir vu les gestes revenir sur la carte du fil : « c'est
   * bon aussi pour les autres ? » Non : mesuré au navigateur, ces cartes ne
   * menaient nulle part, même sur leur propre page. Elles portent maintenant
   * leur adresse, et `CadreCliquable` rend un `<div>` quand elle manque — ce qui
   * est le cas des cartes DESSINÉES par la maquette, qui n'ont pas d'identifiant.
   */
  readonly href?: string;

  readonly type: string;
  readonly actif: boolean;
  readonly enPause: boolean;
  readonly titre: string;
  readonly sousTitre: string;
  readonly sousTitreCourt: string;
  readonly pourcent: string;
  readonly barre: string;
  readonly teinte: string;
}

/**
 * LA LIMITE DU PLAN (§3.1), AFFICHÉE — et jamais appliquée ici.
 *
 * `limite` vient de `JOURNEY_FREE_ACTIVE_LIMIT` dans `@app/shared`, la MÊME
 * constante que le serveur applique avant de répondre `422 PLAN_LIMIT_REACHED`.
 * Une borne écrite à la main dans l'écran aurait divergé le jour où le plan
 * change, et l'écran aurait annoncé une limite que le serveur n'applique plus.
 *
 * Le front N'EMPÊCHE RIEN sur cette base : il tente la création, et c'est le
 * refus du serveur qui décide. L'afficher est de l'information, pas de
 * l'autorisation.
 */
export interface PlanParcours {
  readonly actifs: number;
  readonly limite: number;
  /** Tout est gratuit (réglage serveur) : le bandeau « plan gratuit » est masqué. */
  readonly gratuit: boolean;
}

/** Les deux filtres actifs de « Parcours publics » (§3.7). */
export interface FiltrePublics {
  readonly type: string;
  readonly ville: string;
}

// ── Un type par écran ───────────────────────────────────────────────────────

/** J01 · `/parcours/:id` — `GET /journeys/:id`. */
export interface J01Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly parcours: EnteteParcours;
  readonly etape: EtapeAffichee;
  readonly equipe: readonly MembreAffiche[];
  readonly frise: readonly EtapeFrise[];
}

/** J01M · le sélecteur — `GET /journeys` ET `GET /journeys/:id`. */
export interface J01MData extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly mesParcours: readonly ChoixParcours[];
  readonly total: number;
}

/**
 * J02 · `/parcours/nouveau` — « Créer un parcours ».
 *
 * `modeles` vient de `GET /journey-templates` (§2.1), et son `etapes` de
 * `version.stepCount`. Le dossier est formel sur ce point, dans le commentaire de
 * `journeyTemplateVersionSchema` : le « 12 étapes » de la maquette est une
 * illustration, l'API répond 15 pour `STUDIES`, et « recopier le nombre de la
 * maquette afficherait un engagement faux au moment précis où le membre choisit
 * son parcours ».
 *
 * `panneau` est celui de MON parcours actif, pour le rail du cadre d'ordinateur.
 * Sans parcours — le cas normal de cet écran — il est VIDE, et la carte reste
 * dessinée avec ses valeurs absentes plutôt qu'avec celles de la maquette.
 */
export interface J02Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly modeles: readonly ModeleProposé[];
}

/** J01E, état « aucun parcours » — `GET /journey-templates` (§2.1). */
export interface J01EVideData extends ParcoursData {
  readonly modeles: readonly ModeleAffiche[];
}

/** J01E, état « un parcours abouti » — `GET /journeys/:id`. */
export interface J01EAboutiData extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly parcours: EnteteParcours;
  readonly frise: readonly EtapeFrise[];
}

/** J01S · `/parcours/:id/etapes/:etape` — `GET /journeys/:id`. */
export interface J01SData extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly parcours: EnteteParcours;
  readonly etape: EtapeAffichee;
}

/**
 * J01D · `/parcours/:id/discussion` — `GET /journeys/:id` POUR SON CADRE SEUL.
 *
 * Les messages appartiennent à la messagerie : `journey.groupConversationId` en
 * donne l'identifiant (et vaut `null` pour un OBSERVATEUR, que §3.4 n'autorise pas
 * à écrire), mais les lire demande les routes de `conversations`, hors de ce
 * périmètre. Les bulles de la planche restent celles de la maquette.
 */
export interface J01DData extends ParcoursData {
  readonly panneau: PanneauParcours;
}

/** J05 · `/parcours/:id/equipe` — `GET /journeys/:id` (§3.4). */
export interface J05Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly equipe: readonly MembreAffiche[];
}

/** J06 · `/parcours/:id/documents` — `GET /journeys/:id` (§3.3). */
export interface J06Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  /** `meta.checklistNotice` : la phrase appartient à l'API, pas à l'écran. */
  readonly bandeau: string;
  readonly etape: EtapeAffichee;
  readonly documents: readonly DocumentAffiche[];
  readonly autresEtapes: readonly GroupeEtape[];
}

/** J07 · `/parcours/:id/historique` — `GET /journeys/:id/activities` (§3.8). */
export interface J07Data extends ParcoursData {
  /** Tout est gratuit : l'encart « Export PDF réservé à Premium » est masqué. */
  readonly gratuit: boolean;
  readonly panneau: PanneauParcours;
  readonly journal: readonly EntreeJournal[];
}

/** J08 · `/parcours/:id/reglages` — `GET /journeys/:id`. */
export interface J08Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly parcours: EnteteParcours;
}

/** J08, la feuille de confirmation d'arrêt (§3.9, sans vocabulaire d'échec). */
export interface J08ArretData extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly parcours: EnteteParcours;
}

/** J09 · `/parcours/publics` — `GET /journeys/public` (§3.7). */
export interface J09Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly publics: readonly ParcoursPublicAffiche[];
  readonly compte: number;
  readonly filtre: FiltrePublics;
}

/** J09 · `/parcours/publics/:id` — `GET /journeys/public/:id`, AUTRE forme. */
export interface J09FicheData extends ParcoursData {
  readonly membre: FichePublique;
  readonly franchies: readonly EtapeFrise[];
}

/** J10 · `/parcours/:id/abouti` — `GET /journeys/:id`. */
export interface J10Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly parcours: EnteteParcours;
}

/** J11 · `/parcours` — `GET /journeys` (§5.1), la forme de la LISTE. */
export interface J11Data extends ParcoursData {
  readonly panneau: PanneauParcours;
  readonly actifs: readonly CarteParcours[];
  readonly aboutis: readonly CarteParcours[];
  readonly plan: PlanParcours;
}
