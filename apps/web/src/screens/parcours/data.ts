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
