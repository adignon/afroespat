/**
 * Les écrans de `docs/template/10 Administration.dc.html` — D01 à D16.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ─── CE N'EST PAS L'APPLICATION DES MEMBRES ────────────────────────────────────
 *
 * 15 §2.1, règle dure : « un compte équipe ne peut jamais se connecter à
 * l'application membres avec ses identifiants, ni l'inverse ». Les deux domaines
 * sont hermétiques — une route d'équipe porte `@RequiresStaffRole`, jamais
 * `@RequiresCapability`, et l'authentification passe par un COOKIE de session
 * plus un TOTP obligatoire, pas par le jeton porteur des membres.
 *
 * Côté front, cela se voit dans le chemin de sortie : ces écrans vivent sous
 * `apps/web/src/app/(admin)/`, un groupe de routes à part, et n'empruntent RIEN
 * à `(app)` — ni coquille, ni rail membre, ni barre d'onglets. La maquette dit la
 * même chose à sa façon : « application séparée, plus dense, tableaux, même
 * palette · rail admin, pas de colonne droite ».
 *
 * ─── CETTE MAQUETTE EST ENTIÈREMENT STATIQUE ───────────────────────────────────
 *
 * Son `renderVals()` est littéralement `renderVals() { return {}; }` ; le fichier
 * ne contient ni `{{ … }}` ni `<sc-for>` — zéro de chacun, contre 767 et 328 pour
 * `03 Accueil v2`. Il n'y a donc RIEN à recopier dans un `data.ts` : chaque valeur
 * affichée est écrite en clair dans le HTML et se retrouve telle quelle dans le
 * JSX transcodé. Voir `apps/web/src/screens/administration/data.ts`, qui porte un
 * type vide et le dit.
 *
 * ─── UN SEUL CADRE PAR ÉCRAN, ET CE N'EST PAS UN OUBLI ─────────────────────────
 *
 * Les maquettes membres dessinent deux planches par écran — 1440 px et 390 px.
 * Celle-ci n'en dessine qu'une, de 1440 px, pour D02 à D16 : l'administration est
 * une application d'ordinateur, « plus dense, tableaux, largeur pleine ». Aucun
 * cadre mobile n'existe, et en inventer un serait dessiner à la place du porteur.
 * `ScreenFrames` sert alors ce cadre unique à toutes les largeurs, comme il le
 * fait déjà pour O05 et H06.
 *
 * ─── LE TITRE DE PAGE EST DÉCLARÉ AVEC SON CORPS ───────────────────────────────
 *
 * La maquette n'écrit AUCUN `<h2>` : son unique `<h1>` est celui de la planche de
 * documentation, hors section. Le titre de chaque page est donc déclaré ici, avec
 * son texte visible ET sa taille — et la taille n'est pas du zèle sur cette
 * maquette : le titre d'une page d'administration figure AUSSI dans le menu
 * latéral (« Modération », « Référentiels », « Services », « Réglages »), et c'est
 * l'entrée du MENU qui vient en premier dans le document. Sans discriminant, on
 * promeut la mauvaise, et le défaut est invisible : le texte affiché est le même.
 *
 * Les titres de page font tous 28 px dans cette maquette ; les entrées de menu,
 * 13 px.
 *
 * ─── D02 ET D03 N'ONT PAS DE TITRE, ET ON NE LEUR EN INVENTE PAS ───────────────
 *
 * Le tableau de bord et la page Membres sont les deux seules planches où la
 * maquette n'écrit aucun titre dans le contenu : D02 commence par la carte
 * « INDICATEUR CLÉ », D03 par son champ de recherche. Le seul endroit où
 * « Tableau de bord » et « Membres » sont écrits, c'est le MENU LATÉRAL.
 *
 * Promouvoir cette entrée en `<h1>` mettrait le titre de la page DANS le `<nav>`
 * — la page annoncerait qu'elle parle de son propre menu. Écrire un titre masqué
 * serait rédiger un texte d'interface que la maquette ne donne pas. Les deux
 * cadres partent donc sans `<h1>`, le générateur le DIT à chaque régénération, et
 * c'est consigné dans le rapport pour que le porteur tranche.
 *
 * (`page-has-heading-one` est une règle « best-practice » d'axe-core, hors des
 * étiquettes WCAG que `e2e/a11y.spec.ts` retient : la suite reste verte, mais le
 * manque est réel et il est dit plutôt que maquillé.)
 */

const FILE = 'docs/template/10 Administration.dc.html';

/**
 * ─── LE RAIL D'ÉQUIPE ÉTAIT ENTIÈREMENT MORT, ET C'EST MESURÉ ────────────────
 *
 * Sur les quinze cadres de ce module, le rail que la maquette dessine à gauche —
 * neuf entrées, « Tableau de bord » à « Réglages » — était fait de NEUF `<span>`.
 * Pas de liens cassés : AUCUN LIEN. Zéro balise `<a>` sur tout le module, zéro
 * `cursor: pointer`, et cliquer « Membres » ne changeait pas l'URL.
 *
 * La maquette est ainsi : elle DESSINE la navigation, elle ne la CÂBLE pas. Et
 * personne ne l'avait signalé parce que `e2e/administration.spec.ts` visite ses
 * seize routes en TAPANT L'URL — ses dix-huit cas passaient, sur une application
 * dont aucune page n'était atteignable depuis une autre.
 *
 * ── CE QUE CETTE TABLE DÉCLARE, ET CE QU'ELLE NE DEVINE PAS ─────────────────
 *
 * Les destinations sont celles de T5 §11, les mêmes que `ROUTES` dans
 * `e2e/administration.spec.ts`. Elles sont DÉCLARÉES ici, jamais déduites du
 * libellé : « Services » est écrit dans le rail ET comme titre de la page D10, et
 * les deux ne vont pas au même endroit — l'un navigue, l'autre est un titre. C'est
 * `dans` qui les distingue : le rail est le seul `<nav>` du cadre, et le titre de
 * page est dehors.
 *
 * ── LE RAIL A NEUF ENTRÉES POUR QUINZE PAGES : SIX N'ONT AUCUNE ENTRÉE ──────
 *
 * Relevé en lisant les quinze `<nav>` de la maquette, un par un. L'entrée ACTIVE
 * (fond blanc, graisse 700) dit ce que la maquette considère comme la rubrique
 * courante :
 *
 *   D02 → Tableau de bord   D03 → Membres        D04 → Modération
 *   D05 → Modération        D06 → Parcours       D07 → Parcours
 *   D08 → Référentiels      D09 → Contenu        D10 → Services
 *   D11 → Contenu           D12 → Contenu        D13 → Revenus
 *   D14 → Revenus           D15 → Réglages       D16 → Tableau de bord
 *
 * Donc SIX pages n'étaient accessibles par AUCUNE entrée du rail : D07
 * (Bibliothèque d'étapes), D09 (Guides), D11 (Alertes arnaques), D13
 * (Partenaires), D16 (Rapport d'impact) — et D05, qui est le détail d'un dossier,
 * donc atteint depuis la file. Pour D16 c'était particulièrement net : le rapport
 * d'impact mettait « Tableau de bord » en surbrillance, c'est-à-dire qu'il
 * s'annonçait comme une page qu'il n'est pas.
 *
 * ── LE PORTEUR A TRANCHÉ : LES CINQ ENTRÉES SONT AJOUTÉES ───────────────────
 *
 * Le manque avait été REMONTÉ plutôt que comblé, et c'était la bonne décision :
 * « dessiner cinq lignes de rail que la maquette ne dessine pas serait décider à
 * la place du porteur de la structure de son menu d'administration ». Il a
 * tranché. Verbatim : « Le rail d'équipe a 9 entrées pour 15 pages c'est à
 * corriger et pour toutes les autres ».
 *
 * Les cinq entrées sont donc ajoutées — par la clé `rail`, dont le mécanisme et
 * ses garde-fous sont documentés dans `completerRail` (`tools/dc-to-jsx.mjs`). Ce
 * qui est RECOPIÉ et ce qui est DÉDUIT y est dit ligne par ligne ; le seul point
 * déduit est L'ICÔNE, qui est celle du parent, faute d'un tracé dessiné pour ces
 * cinq rubriques. Le rail compte maintenant QUATORZE entrées pour quinze pages :
 * la quinzième est D05, le dossier, atteint depuis la file de modération.
 *
 * ── ET LA SURBRILLANCE SUIT MAINTENANT LA PAGE ──────────────────────────────
 *
 * `PAGE_COURANTE` déclare, écran par écran, l'entrée que la page met en
 * surbrillance. C'est ce qui corrige le défaut de D16 — et ce qui rend légitime
 * l'`aria-current="page"` que l'en-tête refusait jusqu'ici de poser : l'état
 * courant n'est plus DÉDUIT du dessin, il est DÉCLARÉ, et c'est la déclaration qui
 * peint. Voir `completerRail`.
 *
 * ── `aria-current` : POSÉ, PARCE QU'IL EST MAINTENANT DÉCLARÉ ──────────────
 *
 * Il ne l'était pas, et pour une bonne raison : « le déduire du style serait un
 * SECOND mécanisme, qui lirait du dessin pour en tirer un état ». La page courante
 * est désormais DÉCLARÉE dans `PAGE_COURANTE`, écran par écran ; l'attribut recopie
 * donc cette déclaration au lieu de lire le dessin, et le rail annonce enfin la
 * page où l'on se trouve.
 */
const NAV_EQUIPE =
  '<nav style="background:#16211D;border-radius:22px;padding:10px;display:flex;flex-direction:column;gap:2px;margin-top:8px">';

/**
 * ─── LES CINQ ENTRÉES AJOUTÉES, ET OÙ CHACUNE SE POSE ────────────────────────
 *
 * Un rail PLAT de quatorze entrées, chaque enfant immédiatement APRÈS son parent —
 * le parent étant celui que le designer a lui-même désigné par la surbrillance.
 * L'ordre relatif des neuf entrées d'origine est intact ; on n'insère que cinq.
 *
 * NI RETRAIT NI GROUPEMENT : un retrait aurait exigé d'inventer une valeur de
 * remplissage — `padding:0 12px` est le seul que la maquette donne au rail — et un
 * groupement aurait exigé un titre de section, donc un texte d'interface qu'elle
 * n'écrit pas. L'ordre porte la hiérarchie sans inventer ni couleur ni forme.
 *
 * LES LIBELLÉS VIENNENT DU `data-screen-label` DE LA PLANCHE, mot pour mot :
 * « D07 Bibliothèque d'étapes », « D09 Guides », « D11 Alertes arnaques »,
 * « D13 Partenaires », « D16 Rapport d'impact ». Aucun mot inventé.
 *
 * « ALERTES ARNAQUES » SE POSE APRÈS « GUIDES », et il faut le dire : Contenu a
 * DEUX enfants, et les poser tous deux « après Contenu » les mettrait dans l'ordre
 * inverse du relevé. Elle suit donc l'autre enfant. Son tracé reste celui de
 * Contenu — Guides en est déjà le clone — exactement comme si elle l'avait cloné
 * directement.
 */
const RAIL_AJOUTS = [
  ['Tableau de bord', 'Rapport d’impact', 'D16'],
  ['Parcours', 'Bibliothèque d’étapes', 'D07'],
  ['Contenu', 'Guides', 'D09'],
  ['Guides', 'Alertes arnaques', 'D11'],
  ['Revenus', 'Partenaires', 'D13'],
].map(([apres, libelle, planche]) => ({
  apres,
  libelle,
  pourquoi:
    `${planche} n’avait AUCUNE entrée de rail — sa route répondait, rien n’y menait. ` +
    `Entrée clonée de « ${apres} », la rubrique que la maquette désigne elle-même par ` +
    'la surbrillance de cette planche ; libellé pris dans son `data-screen-label`. ' +
    'Le tracé de l’icône est celui du parent : la maquette n’en dessine aucun pour ' +
    'cette rubrique (DÉDUCTION, remontée au porteur).',
}));

/**
 * CE QUE CHAQUE ÉCRAN MET EN SURBRILLANCE — une entrée du rail, et la SIENNE.
 *
 * Avant cette table, cinq planches surlignaient l'entrée d'une AUTRE page, faute
 * d'en avoir une : D16 s'annonçait « Tableau de bord », D07 « Parcours », D09 et
 * D11 « Contenu », D13 « Revenus ». Les cinq ont maintenant la leur.
 *
 * D05 EST LA SEULE EXCEPTION, et elle est voulue : c'est le DOSSIER d'un
 * signalement, atteint depuis la file, pas une rubrique du menu. Il surligne donc
 * « Modération », sa rubrique — exactement ce que la maquette peignait déjà, et ce
 * que `/admin/moderation/[id]` dit de sa place dans l'arborescence.
 */
const PAGE_COURANTE = {
  D02: 'Tableau de bord',
  D03: 'Membres',
  D04: 'Modération',
  D05: 'Modération',
  D06: 'Parcours',
  D07: 'Bibliothèque d’étapes',
  D08: 'Référentiels',
  D09: 'Guides',
  D10: 'Services',
  D11: 'Alertes arnaques',
  D12: 'Contenu',
  D13: 'Partenaires',
  D14: 'Revenus',
  D15: 'Réglages',
  D16: 'Rapport d’impact',
};

/**
 * Les QUATORZE entrées, avec LEUR destination — les neuf que la maquette dessine
 * et les cinq que `RAIL_AJOUTS` ajoute. L'ordre est celui du rail produit.
 *
 * Le discriminant est le TEXTE VISIBLE : les quatorze en portent un, donc ni
 * `aria` ni `marqueur` n'est nécessaire ici. `fois` reste à son défaut de 1 — et
 * c'est ce qui fait de `markLinks` le CONTRÔLE de l'injection : une entrée ajoutée
 * qui manquerait, ou qui serait posée deux fois, arrête la génération en nommant
 * son libellé, au lieu de laisser un lien mort.
 */
const RAIL_EQUIPE = [
  ['Tableau de bord', '/admin'],
  ['Rapport d’impact', '/admin/impact'],
  ['Membres', '/admin/membres'],
  ['Modération', '/admin/moderation'],
  ['Parcours', '/admin/parcours'],
  ['Bibliothèque d’étapes', '/admin/etapes'],
  ['Contenu', '/admin/contenu'],
  ['Guides', '/admin/guides'],
  ['Alertes arnaques', '/admin/alertes'],
  ['Référentiels', '/admin/referentiels'],
  ['Services', '/admin/services'],
  ['Revenus', '/admin/revenus'],
  ['Partenaires', '/admin/partenaires'],
  ['Réglages', '/admin/reglages'],
].map(([texte, vers]) => ({
  dans: NAV_EQUIPE,
  texte,
  vers,
  why: `L’entrée « ${texte} » du rail d’équipe mène à ${vers} (T5 §11). La maquette la dessine en <span> : elle n’était pas un lien.`,
}));

const screen = ({ section, frames, dataType = 'AdministrationData', rail = true, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${section.toLowerCase()}`,
  dataModule: '../administration/data',
  dataType,
  frames,
  /**
   * LE RAIL EST DANS LES QUINZE CADRES PLEIN ÉCRAN, ET DANS AUCUN AUTRE.
   *
   * `rail: false` est donc une exception NOMMÉE, et D01 est la seule : ses trois
   * planches sont des cartes de connexion de 420 px, et la maquette ne leur dessine
   * aucun menu — on ne navigue pas dans une console avant de s'y être authentifié.
   * Le déclarer par défaut plutôt que quinze fois à la main évite l'oubli qui ferait
   * repartir un cadre avec un rail mort, sans que rien ne le dise.
   *
   * `navigationDeclaree` suit le rail : il rend le garde-fou de `href="#"` DUR sur
   * ces écrans. Il n'y a aujourd'hui aucun `<a>` dans cette maquette — zéro,
   * compté — donc le drapeau ne refuse rien ; c'est précisément ce qu'on veut qu'il
   * garde. Le jour où une planche d'administration dessinera un lien sans
   * destination, la génération s'arrêtera au lieu de produire un lien qui a l'air de
   * marcher.
   */
  ...(rail
    ? {
        liens: RAIL_EQUIPE,
        navigationDeclaree: true,
        /**
         * LA CLÉ `rail` EST POSÉE ICI, avec `liens`, et pour la même raison : un
         * écran qui porte le rail le porte ENTIER. `actif` est le seul morceau qui
         * varie d'une planche à l'autre, et il est cherché dans `PAGE_COURANTE` —
         * dont l'absence ARRÊTE la génération plutôt que de laisser une planche
         * surligner l'entrée d'une autre page, qui est le défaut d'origine.
         */
        rail: {
          dans: NAV_EQUIPE,
          ajoutees: RAIL_AJOUTS,
          actif: (() => {
            const actif = PAGE_COURANTE[section];
            if (actif === undefined) {
              throw new Error(
                `${section} porte le rail d’équipe mais n’est pas dans PAGE_COURANTE : on ne sait ` +
                  'pas quelle entrée cette page doit surligner. La déclarer.',
              );
            }
            return actif;
          })(),
        },
      }
    : {}),
  ...rest,
});

/** Un titre de page : le texte visible, et le corps qui le distingue du menu. */
const titre = (text) => ({ text, size: '28px' });

/** Le cadre unique d'un écran d'administration, avec son titre de page. */
const pleinEcran = (title) => [{ width: 1440, name: 'Desktop', occurrence: 0, ...(title === undefined ? {} : { title }) }];

// ─── Les cartes que la maquette répète, écrites UNE fois ─────────────────────
//
// Même discipline que `08-compte.mjs` : chaque fabrique reproduit un fragment de
// la maquette à l'identique, ses textes en paramètres, et sert DEUX FOIS — à
// écrire le `noeud` (les lignes telles que la maquette les dessine, avec leurs
// textes d'exemple) et le `devient` (la même ligne, une fois, interpolée). Le
// troisième contrôle du générateur compare les deux : si la maquette bouge d'un
// caractère, la génération s'arrête au lieu de produire un écran faux.

/** Le style de cellule du tableau des villes (D08), écrit cinq fois par ligne. */
const CELLULE_D08 = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

/**
 * D08 — une ligne du tableau des villes.
 *
 * ─── LA ZÉBRURE N'EST PAS LIÉE, ET C'EST UNE LIMITE MESURÉE DU MÉCANISME ────
 *
 * La deuxième des trois lignes de la maquette porte `background:#FAFBFB`, les
 * deux autres rien : une zébrure, donc une donnée de RANG. La lier était le
 * premier réflexe, et elle a été liée — `…#F0F3F2;{{ v.fondLigne }}"` — puis
 * MESURÉE dans le JSX produit : `grep fondLigne` rend 0, `grep FAFBFB` rend 0.
 *
 * La cause est dans le transcodeur, pas dans la déclaration : il parse
 * l'attribut `style` en paires `clé:valeur`, et une interpolation posée à la
 * place d'une DÉCLARATION ENTIÈRE n'est pas une paire — elle est jetée, en
 * silence. Les quatre contrôles de `donnees` ne l'attrapent pas : le quatrième
 * vérifie que `devient` PORTE une interpolation, aucun ne vérifie que le JSX
 * PRODUIT la porte encore.
 *
 * La liaison est donc retirée plutôt que gardée : le journal annonçait une donnée
 * que l'écran n'affichait pas, ce qui est précisément le mensonge que ce
 * mécanisme existe pour empêcher. Conséquence assumée et dite : toutes les lignes
 * se dessinent comme la PREMIÈRE de la maquette, sans zébrure. Le trou du
 * mécanisme est remonté au porteur ; il ne se rebouche pas ici, parce qu'il est
 * dans `tools/dc-to-jsx.mjs`, que ce lot ne touche pas.
 *
 * `fondLigne` SURVIT COMME PARAMÈTRE, pour le seul `noeud` : il doit rester
 * VERBATIM, et la deuxième ligne de la maquette porte bel et bien son
 * `background:#FAFBFB`. Le `devient`, lui, passe la chaîne vide — la forme de la
 * première ligne. Rien n'est interpolé là, donc rien n'y est promis.
 */
const LIGNE_VILLE = (fondLigne, ville, region, membres, statut, action) =>
  '<div style="display:grid;grid-template-columns:1.4fr 1.4fr 90px 100px 1.4fr;gap:12px;padding:12px 16px;align-items:center;font-size:13px;border-bottom:1px solid #F0F3F2;' +
  fondLigne +
  '"><span style="' +
  CELLULE_D08 +
  '">' +
  ville +
  '</span><span style="' +
  CELLULE_D08 +
  '">' +
  region +
  '</span><span style="' +
  CELLULE_D08 +
  '">' +
  membres +
  '</span><span style="' +
  CELLULE_D08 +
  '">' +
  statut +
  '</span><span style="' +
  CELLULE_D08 +
  '">' +
  action +
  '</span></div>';

/**
 * D08 — la pastille de statut d'une ville. TROIS variantes dessinées, et les
 * trois couleurs sont des DONNÉES.
 *
 * Lier le seul libellé laisserait « Bientôt » sur le fond vert d'une ville
 * active, ce qui serait pire que la maquette figée — c'est l'arbitrage déjà pris
 * sur les pastilles de niveau de K03.
 */
const PASTILLE_VILLE = (fond, texte, libelle) =>
  '<span style="background:' +
  fond +
  ';color:' +
  texte +
  ';font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">' +
  libelle +
  '</span>';

/**
 * D08 — le bouton « Activer » de la colonne d'action, tel que la maquette le
 * dessine sur la ligne de Nantes.
 *
 * Déclaré en MOTIF dans la liaison, et il faut dire pourquoi : les trois lignes
 * de la maquette n'ont pas la même colonne d'action — un texte nu
 * (« Fusionner »), ce bouton, puis un `<span>` gras (« Fusionner avec Lyon »).
 * Les réunir sous trois `<sc-if>` est un REMONTAGE, que le troisième contrôle du
 * générateur refuse tant qu'il n'est pas déclaré. C'est exactement ce qu'on veut :
 * le remontage se lit, au lieu de passer pour un simple collage.
 */
const BOUTON_ACTIVER_D08 =
  '<span style="background:#16785E;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:10px">Activer</span>';

/** D08 — l'amorce du `<span>` « Fusionner avec … ». Motif, même raison. */
const AMORCE_FUSION_D08 = '<span style="font-weight:700">Fusionner avec ';

export const screens = [
  /**
   * ── D01 · `/admin/connexion` — TROIS CARTES, PAS TROIS ÉCRANS ──────────────
   *
   * 15 §2.1 et T5 D01 : « email, mot de passe, puis code TOTP (six cases),
   * enrôlement forcé si absent ». La maquette dessine les trois moments comme
   * trois cartes de 420 px posées côte à côte, étiquetées « 1 · IDENTIFIANTS »,
   * « 2 · CODE TOTP » et « ENRÔLEMENT FORCÉ ». C'est une seule route, et la page
   * choisit la carte selon `?etape=`.
   *
   * `frameIsCard` : le conteneur extérieur de ces trois planches n'est PAS une
   * planche, c'est la CARTE elle-même — son fond blanc, sa bordure, son rayon de
   * 28 px et son remplissage de 24 px sont du design. Voir la note dans
   * `tools/generate-screens.mjs`.
   *
   * Les deux premières cartes portent « Administration » en 17 px gras comme seul
   * titre ; la troisième écrit « Activer la double authentification », qui dit ce
   * que l'écran demande. On recopie ce que la maquette écrit, sans l'uniformiser.
   */
  screen({
    section: 'D01',
    // Aucun rail : on ne navigue pas dans la console avant de s'y authentifier.
    rail: false,
    frameIsCard: true,
    frames: [
      { width: 420, name: 'Identifiants', occurrence: 0, title: 'Administration' },
      { width: 420, name: 'Totp', occurrence: 1, title: 'Administration' },
      {
        width: 420,
        name: 'Enrolement',
        occurrence: 2,
        title: 'Activer la double authentification',
      },
    ],
  }),

  /**
   * ── D02 · `/admin` — le tableau de bord ────────────────────────────────────
   *
   * 15 §5.1 et T5 D02.
   *
   * ─── LA RÉSERVE SUR `metric_snapshots` ÉTAIT FAUSSE, POUR LA DEUXIÈME FOIS ──
   *
   * Ce bloc disait « LE BACK-END NE LE SERT PAS ENCORE : §6 ajoute la table
   * `metric_snapshots` et elle manque au schéma ». C'est la MÊME réserve que le lot
   * précédent a déjà levée sur D16, et elle était fausse ici aussi :
   * `GET /v1/admin/dashboard` répond 200 sur l'API qui tourne et rend onze blocs
   * de points de mesure. Relevé avec une vraie session d'équipe — mot de passe
   * argon2id puis TOTP — et non déduit du service.
   *
   * ─── CINQ CARTES SUR DOUZE, ET LE CRITÈRE EST UNE SEULE RÈGLE ──────────────
   *
   *   UNE CARTE N'EST LIÉE QUE SI CHAQUE NOMBRE QU'ELLE PORTE EST SERVI.
   *
   * Ces cartes ne sont pas des listes : chaque nombre a son libellé propre à côté
   * de lui. Lier « File » sur une carte MODÉRATION dont « SLA respecté » resterait
   * figé à « 93 % » ne donnerait pas une carte à moitié vraie — ça donnerait une
   * carte dont le premier nombre bouge, ce qui fait croire que le second aussi. Un
   * nombre figé à côté d'un nombre vivant est PIRE qu'une carte entièrement figée,
   * parce que la carte figée se reconnaît et l'autre non.
   *
   * Liées : MEMBRES (3 nombres), PARCOURS (4), ENTRAIDE (3), GUIDES (2),
   * SERVICES (2). Le détail de ce qui manque aux sept autres est dans
   * `apps/web/src/screens/administration/data.ts`, carte par carte et avec le nom
   * du nombre absent.
   *
   * ─── LE BANDEAU D'ALERTES N'EST PAS ENTAMÉ ─────────────────────────────────
   *
   * « SLA dépassé · 3 dossiers de modération », « Justificatifs pro · 5 en
   * attente », « Villes à activer · Nantes, Rennes ». `GET /admin/dashboard` ne
   * rend AUCUNE alerte. Les trois morceaux vivraient dans trois routes distinctes
   * (`/moderation/stats`, `/pro-profiles`, `/ref/cities`) ; les recoller ici
   * fabriquerait un bandeau d'alertes que l'API ne sert pas, et dont personne ne
   * pourrait dire s'il est complet. Il reste DESSINÉ, entier. Remonté au porteur.
   *
   * ─── ET LE TABLEAU DE BORD N'APPELLE QU'UNE ROUTE, PAR SÉCURITÉ ────────────
   *
   * `GET /admin/dashboard` est ouvert aux QUATRE rôles. Les nombres manquants
   * vivent dans des routes plus restreintes — `/moderation/stats` exclut
   * `SUPPORT`. Les appeler d'ici rendrait le tableau de bord 403 pour un rôle que
   * §2.2 autorise explicitement à le voir, et le défaut serait invisible pour qui
   * développe en SUPER_ADMIN.
   *
   * Sans titre : voir l'en-tête de ce fichier.
   */
  screen({
    section: 'D02',
    dataType: 'D02Data',
    frames: pleinEcran(),
    donnees: [
      // ── MEMBRES ────────────────────────────────────────────────────────────
      //
      // LE LIBELLÉ EST LE DISCRIMINANT, et il n'est pas décoratif : les douze
      // cartes de D02 dessinent leurs lignes à l'identique, et « 5 820 » seul ne
      // dirait pas laquelle. C'est ce que `fois` existe pour empêcher — les
      // quatorze fragments ci-dessous ont été COMPTÉS dans ce cadre, un chacun.
      {
        noeud: '>Inscrits</span><strong>5 820</strong>',
        devient: '>Inscrits</span><strong>{{ membres.inscrits }}</strong>',
        why: 'Les membres inscrits : `members.registered` du bloc `membres` de `GET /admin/dashboard`.',
      },
      {
        noeud: '>Actifs 30 j</span><strong>3 140</strong>',
        devient: '>Actifs 30 j</span><strong>{{ membres.actifs30j }}</strong>',
        why: 'Les membres actifs sur 30 jours : `members.active_30d`.',
      },
      {
        noeud: '>Niveau 2</span><strong>41 %</strong>',
        devient: '>Niveau 2</span><strong>{{ membres.niveau2 }}</strong>',
        why: 'La part des membres au niveau L2, calculée sur `members.by_level` — rapportée à la somme des niveaux, et non à `members.registered` qui ne compte pas la même population.',
      },

      // ── PARCOURS — les quatre statuts de `JourneyStatus` ───────────────────
      {
        noeud: '>Créés</span><strong>1 212</strong>',
        devient: '>Créés</span><strong>{{ parcours.crees }}</strong>',
        why: 'Les parcours créés : la somme de toutes les tranches de `journeys.by_status` — un parcours créé porte toujours un statut.',
      },
      {
        noeud: '>Actifs</span><strong>860</strong>',
        devient: '>Actifs</span><strong>{{ parcours.actifs }}</strong>',
        why: 'Les parcours actifs : `journeys.by_status`, tranche `ACTIVE`.',
      },
      {
        noeud: '>Aboutis</span><strong>214</strong>',
        devient: '>Aboutis</span><strong>{{ parcours.aboutis }}</strong>',
        why: 'Les parcours aboutis : `journeys.by_status`, tranche `COMPLETED`. Une tranche absente vaut zéro — c’est un `GROUP BY`, un seau vide ne produit aucune ligne.',
      },
      {
        noeud: '>En pause</span><strong>138</strong>',
        devient: '>En pause</span><strong>{{ parcours.enPause }}</strong>',
        why: 'Les parcours en pause : `journeys.by_status`, tranche `PAUSED`.',
      },

      // ── ENTRAIDE — les deux statuts utiles de `HelpStatus`, plus le délai ──
      {
        noeud: '>Ouvertes</span><strong>412</strong>',
        devient: '>Ouvertes</span><strong>{{ entraide.ouvertes }}</strong>',
        why: 'Les entraides ouvertes : `help.by_status`, tranche `OPEN`.',
      },
      {
        noeud: '>Résolues</span><strong>1 780</strong>',
        devient: '>Résolues</span><strong>{{ entraide.resolues }}</strong>',
        why: 'Les entraides résolues : `help.by_status`, tranche `RESOLVED`.',
      },
      {
        noeud: '>Délai médian</span><strong>19 h</strong>',
        devient: '>Délai médian</span><strong>{{ entraide.delaiMedian }}</strong>',
        why: 'Le délai médian de première réponse : `help.first_response_median_minutes`, servi EN MINUTES et rendu en heures comme la maquette l’écrit.',
      },

      // ── GUIDES — deux statuts de `GuideStatus` ────────────────────────────
      {
        noeud: '>Publiés</span><strong>386</strong>',
        devient: '>Publiés</span><strong>{{ guides.publies }}</strong>',
        why: 'Les guides publiés : `guides.by_status`, tranche `PUBLISHED`.',
      },
      {
        noeud: '>À vérifier</span><strong>22</strong>',
        devient: '>À vérifier</span><strong>{{ guides.aVerifier }}</strong>',
        why: 'Les guides à vérifier : `guides.by_status`, tranche `FLAGGED` — un guide signalé est un guide à vérifier.',
      },

      // ── SERVICES ──────────────────────────────────────────────────────────
      {
        noeud: '>Annonces</span><strong>244</strong>',
        devient: '>Annonces</span><strong>{{ services.annonces }}</strong>',
        why: 'Les annonces en ligne : `housing.by_status` plus `jobs.by_status`, tranches `ACTIVE`. La maquette ne dit pas si les expirées comptent ; la lecture retenue est écrite dans `appels.ts`.',
      },
      {
        noeud: '>Fiches pro</span><strong>58</strong>',
        devient: '>Fiches pro</span><strong>{{ services.fichesPro }}</strong>',
        why: 'Les fiches professionnelles approuvées : `pros.by_verification`, tranche `APPROVED`.',
      },
    ],
  }),

  /**
   * ── D03 · `/admin/membres` — la fiche membre ───────────────────────────────
   *
   * RÈGLE DURE (15 §3.1) : « l'application admin n'affiche jamais un numéro de
   * téléphone en clair ». La maquette la tient par le dessin, et c'est vérifiable
   * à l'œil : le champ de recherche montre « +33 6 12 … » suivi de « Recherche
   * par empreinte », et la fiche écrit « +33 6 •• •• •• 18 · +229 •• 42 ». Aucun
   * numéro complet n'est transcrit, parce qu'aucun n'est dessiné. La carte
   * d'actions le répète en toutes lettres : « Chaque action demande un motif.
   * Aucun numéro n'est affiché en clair. »
   *
   * La maquette dessine la LISTE et la FICHE dans le même cadre, en deux colonnes.
   * T5 annonce `admin/membres · /:id` ; il n'y a pourtant qu'une planche, donc une
   * seule route. Découper une vue de détail que la maquette ne dessine pas serait
   * l'inventer.
   *
   * Sans titre : voir l'en-tête de ce fichier.
   */
  screen({ section: 'D03', frames: pleinEcran() }),

  /**
   * ── D04 · `/admin/moderation` — la file (13 §4.1) ──────────────────────────
   *
   * « Une file unique, triée par priorité puis `sla_due_at` », et la maquette la
   * dessine ainsi, colonne SLA comprise (« dépassé », « 2 h », « 3 h »…).
   *
   * UN SEUL NOMBRE EST LIÉ — « 46 dossiers ouverts » — ET LA FILE RESTE DESSINÉE.
   *
   * Ce n'est pas un demi-travail, c'est le même critère que partout dans ce lot :
   * une LIGNE de tableau n'est liée que si la route sert CHACUNE de ses cellules.
   * `GET /admin/moderation/cases` en sert TROIS sur sept, et les quatre qui
   * manquent sont celles qui nomment des gens et des choses :
   *
   *   · SUJET — le type est servi (`subjectType`), l'EXTRAIT (« Vends attestation
   *     d’hébergement ») non : la route rend `subjectId`, pas le contenu ;
   *   · AUTEUR — `subjectAuthorUserId` est un UUID, relevé `null`. Aucun nom ;
   *   · SIGN. — le nombre de signalements n'est pas dans la ligne de liste (il
   *     faudrait `reports` du DÉTAIL, donc un appel par ligne) ;
   *   · ASSIGNÉ — `assignedStaffId` est un UUID. Aucun nom.
   *
   * Lier les trois colonnes servies dans un `<sc-for>` ferait répéter les quatre
   * littéraux de la PREMIÈRE ligne sur toutes les lignes : chaque dossier de la
   * file s'afficherait comme « Joël K. · Vends attestation d’hébergement · 5
   * signalements », à côté d'une priorité et d'un SLA bien réels. Un tableau dont
   * trois colonnes vivent et quatre mentent est pire que le tableau figé, parce que
   * le figé se reconnaît. Remonté au porteur : il manque les NOMS et l'EXTRAIT à
   * la ligne de file.
   */
  screen({
    section: 'D04',
    dataType: 'D04Data',
    frames: pleinEcran(titre('Modération')),
    donnees: [
      {
        noeud: '>46 dossiers ouverts<',
        devient: '>{{ file.ouverts }} dossiers ouverts<',
        why: 'Les dossiers dans la file : somme de `openByPriority` de `GET /admin/moderation/stats` — qui compte `OPEN` ET `IN_REVIEW`, soit 1 847 là où la mesure du tableau de bord en voit 1 811. Les deux sont justes et ne comptent pas la même chose.',
      },
    ],
  }),

  /**
   * ── D05 · `/admin/moderation/:id` — le dossier (13 §4.2) ───────────────────
   *
   * Le titre de la page est le NUMÉRO DU DOSSIER — « Dossier #4812 » — et non
   * « Modération » : c'est ce que la maquette écrit en 28 px, l'entrée de menu
   * « Modération » restant à 13 px dans le rail. Un titre déduit aurait pris le
   * menu.
   *
   * La maquette tient la règle du motif à l'écran : « Motif · 20 caractères
   * minimum » et un compteur « 48 / 20 » à côté du bouton « Appliquer ».
   * « Bannir · super-admin » porte son rôle dans son libellé (13 §4.2).
   */
  /**
   * ── CE QUI EST LIÉ ICI : LE SOUS-TITRE, ET RIEN D'AUTRE ────────────────────
   *
   * « Publication · priorité 1 · SLA dépassé ». Les trois valeurs sont servies par
   * `GET /admin/moderation/cases/:id` — `subjectType`, `priority`, `sla` — et c'est
   * le SEUL endroit de cette planche où la route sert tout ce qui est écrit.
   *
   * LE TITRE N'EST PAS LIÉ, et il faut dire pourquoi : la maquette écrit
   * « Dossier #4812 », un numéro court et lisible. La route ne rend qu'un `id`
   * UUID. Afficher « Dossier #01a0e4a8-50ff-7000-aec3-d2eb62ce6b17 » serait exact
   * et illisible, et laisserait croire que #4812 existe ailleurs. Il manque une
   * RÉFÉRENCE COURTE de dossier au back ; remonté au porteur.
   *
   * CE QUI MANQUE AU RESTE est écrit champ par champ dans
   * `screens/administration/data.ts`. Le manque qui compte, et qui dépasse ce lot :
   * AUCUNE ROUTE D'ÉQUIPE NE JOINT LE CONTENU VISÉ AU DOSSIER. L'écran qui sert à
   * décider d'une sanction ne peut pas montrer ce qu'il sanctionne — le modérateur
   * voit « Publication · priorité 1 · SLA dépassé » et doit trancher à l'aveugle.
   * C'est le défaut le plus lourd relevé par ce lot.
   */
  screen({
    section: 'D05',
    dataType: 'D05Data',
    frames: pleinEcran(titre('Dossier #4812')),
    donnees: [
      {
        noeud: '>Publication · priorité 1 · SLA dépassé<',
        devient: '>{{ dossier.sujet }} · priorité {{ dossier.priorite }} · SLA {{ dossier.slaEtat }}<',
        why: 'Le sous-titre du dossier : `subjectType`, `priority` et `sla` de `GET /admin/moderation/cases/:id`. L’état du SLA est calculé par le SERVEUR — l’horloge du navigateur est réglable, et un modérateur en retard d’une heure ne doit pas lire « respecté » sur un dossier hors délai.',
      },
    ],
  }),

  // ── D06 · `/admin/parcours` — modèles et versions (T5 D06) ─────────────────
  //
  // Le titre est celui de la VERSION ouverte dans l'éditeur, « Parcours Études ·
  // version 2026 », pas le mot « Parcours » du menu.
  screen({ section: 'D06', frames: pleinEcran(titre('Parcours Études · version 2026')) }),

  // ── D07 · `/admin/etapes` — la bibliothèque d'étapes ───────────────────────
  //
  // L'apostrophe est la COURBE, telle que la maquette l'écrit. Une droite ne
  // trouverait rien, et le générateur le dirait.
  screen({ section: 'D07', frames: pleinEcran(titre('Bibliothèque d’étapes')) }),

  /**
   * ── D08 · `/admin/referentiels` — 02 §4.2 ──────────────────────────────────
   *
   * La confirmation « Activer Nantes ? » est dessinée DANS la page, en carte de
   * 440 px à côté du tableau — pas en fenêtre par-dessus. Elle n'est donc pas
   * transcodée en modale : la maquette ne lui dessine ni voile ni panneau, et
   * `Modal` en attend exactement un de chaque.
   *
   * BRANCHÉ SUR `GET /admin/ref/cities` (`staffApi.get('/ref/cities', …)`), relevé
   * sur l'API qui tourne avec une vraie session d'équipe. La réponse porte tout ce
   * que le tableau dessine : `name`, `region`, `memberCount`, `isActive`,
   * `activatedAt`, `mergedIntoCityId` — et `isPilot`.
   *
   * ─── `isPilot` ÉTAIT RENDU PAR L'API ET AFFICHÉ PAR PERSONNE ───────────────
   *
   * C'est la mesure qui ouvrait ce lot, et elle était juste : la charge relevée
   * sur `/admin/ref/cities` contient `"isPilot":true` sur Paris — `PILOT_CITY_SLUG`
   * de `@app/shared` — et aucun écran ne le montrait. Il apparaît désormais dans la
   * PASTILLE DE STATUT, dont le libellé et les deux couleurs sont déjà des données.
   *
   * Aucun pixel n'est inventé pour cela, et c'est la raison de ce choix plutôt
   * qu'un badge de plus : la maquette ne dessine pas de pastille « pilote », et lui
   * en ajouter une serait dessiner à la place du porteur. Le libellé de la pastille
   * est une chaîne que la couche de données compose — comme « En contact depuis
   * le … » sur K05 — donc la ville pilote porte son propre mot dans la case que la
   * maquette a déjà prévue, avec les couleurs qu'elle a déjà choisies.
   *
   * ACTIVER OU FERMER UNE VILLE RESTE UNE DÉCISION PRODUIT. Aucun bouton de cet
   * écran n'est branché : `POST /ref/cities/:id/activate` existe, et l'appeler
   * depuis un `onClick` créerait le réseau de ville et y rattacherait les membres —
   * ce que la carte annonce en toutes lettres. 15 §2.3 est une règle dure (toute
   * écriture passe par `AuditService.record()`), et un bouton qui n'écrit rien est
   * un mensonge tracé nulle part. Ils restent inertes, comme dans tout ce module.
   */
  screen({
    section: 'D08',
    dataType: 'D08Data',
    frames: pleinEcran(titre('Référentiels')),
    donnees: [
      {
        /**
         * LES TROIS LIGNES DESSINÉES, liées en UNE boucle.
         *
         * Les trois colonnes d'action de la maquette sont les TROIS cas de 02 §4.2 —
         * une ville active qu'on peut fusionner, une ville à activer, un doublon à
         * rattacher — et aucune n'est jetée : chacune garde son dessin sous son
         * `<sc-if>`. Ne garder que la première aurait donné une liste où aucune ville
         * ne s'active jamais, et le défaut n'aurait sauté aux yeux de personne.
         */
        noeud:
          LIGNE_VILLE(
            '',
            'Lyon',
            'Auvergne-Rhône-Alpes',
            '1 400',
            PASTILLE_VILLE('#E3F0EB', '#0F5C48', 'Active'),
            'Fusionner',
          ) +
          LIGNE_VILLE(
            'background:#FAFBFB',
            'Nantes',
            'Pays de la Loire',
            '190',
            PASTILLE_VILLE('#FBE3D4', '#B4581F', 'Bientôt'),
            BOUTON_ACTIVER_D08,
          ) +
          LIGNE_VILLE(
            '',
            'Lyon 07',
            'Auvergne-Rhône-Alpes',
            '4',
            PASTILLE_VILLE('#F2F5F4', '#5D6B66', 'Doublon'),
            AMORCE_FUSION_D08 + 'Lyon</span>',
          ),
        devient:
          '<sc-for list="{{ villes }}" as="v">' +
          LIGNE_VILLE(
            '',
            '{{ v.nom }}',
            '{{ v.region }}',
            '{{ v.membres }}',
            PASTILLE_VILLE('{{ v.statutFond }}', '{{ v.statutTexte }}', '{{ v.statut }}'),
            '<sc-if value="{{ v.fusionnable }}">Fusionner</sc-if>' +
              '<sc-if value="{{ v.activable }}">' +
              BOUTON_ACTIVER_D08 +
              '</sc-if><sc-if value="{{ v.doublon }}">' +
              AMORCE_FUSION_D08 +
              '{{ v.fusionneAvec }}</span></sc-if>',
          ) +
          '</sc-for>',
        /**
         * Le remontage des trois colonnes d'action, DÉCLARÉ.
         *
         * Sans ces deux motifs, le troisième contrôle refuse — et il a raison de
         * refuser : les trois cellules ne sont pas contiguës dans la maquette, donc
         * les réunir est bien un remontage. Les deux fragments sont vérifiés présents
         * DANS CE CADRE à chaque génération.
         */
        motifs: [BOUTON_ACTIVER_D08, AMORCE_FUSION_D08],
        why: 'Le tableau des villes, de `GET /admin/ref/cities` — nom, région, nombre de membres, statut et les trois actions de 02 §4.2. La ville pilote (`isPilot`, Paris) porte son statut ici, où rien ne l’affichait.',
      },
      {
        noeud: '>Activer Nantes ?<',
        devient: '>Activer {{ activation.ville }} ?<',
        why: 'La carte de confirmation porte le nom de la ville CANDIDATE — la première ville inactive de `GET /admin/ref/cities`, et non un nom figé.',
      },
      {
        noeud:
          'Un réseau de ville sera créé et les 190 membres y seront rattachés automatiquement.',
        devient:
          'Un réseau de ville sera créé et les {{ activation.membres }} membres y seront rattachés automatiquement.',
        why: 'Le nombre de membres qui seront rattachés (`memberCount` de la ville candidate) : 02 §4.2 le promet, et un nombre figé en ferait une promesse fausse.',
      },
    ],
  }),

  // ── D09 · `/admin/guides` — propositions escaladées et guides obsolètes ────
  screen({ section: 'D09', frames: pleinEcran(titre('Guides')) }),

  /**
   * ── D10 · `/admin/services` — justificatifs pro et annonces à risque ───────
   *
   * UN SEUL NOMBRE LIÉ : le compte des justificatifs pro en attente.
   *
   * Il est compté EN SUIVANT LE CURSEUR jusqu'au bout, et c'est possible ici parce
   * que `GET /admin/pro-profiles` pagine HONNÊTEMENT — `take: limit + 1` puis
   * `buildPage`, donc un `nextCursor` non nul quand il reste des pages. Cinq
   * routes d'équipe ne le font pas (voir `lireToutesLesVilles` dans `appels.ts`) ;
   * celle-ci, oui, et c'est vérifié.
   *
   * ─── LA LIGNE DE JUSTIFICATIF N'EST PAS LIÉE, POUR UN SEUL MOT ─────────────
   *
   * La maquette écrit « MB · Me Mariam Bah · Avocate · carte professionnelle ».
   * Trois des quatre valeurs sont servies, et richement : `member.displayName`
   * (« Sarah Traoré », un vrai nom), `profession.nameFr` (« Chauffagiste »), les
   * initiales s'en dérivent. Mais LE TYPE DU JUSTIFICATIF ne l'est pas : `proof`
   * porte `mime` (« application/pdf »), `sizeBytes`, `status` et `storageKey` —
   * jamais « carte professionnelle ».
   *
   * Et ce mot-là n'est pas décoratif : il AFFIRME de quel document il s'agit. Lié
   * aux trois autres dans une boucle, il écrirait « carte professionnelle » sous le
   * nom d'un chauffagiste dont le justificatif est peut-être un SIRET ou un
   * diplôme. Une fausse affirmation sur la pièce d'identité professionnelle d'une
   * personne réelle est pire qu'une ligne entièrement dessinée. Il manque un TYPE
   * DE JUSTIFICATIF au back ; remonté.
   *
   * ─── LES DEUX AUTRES BLOCS N'ONT AUCUNE ROUTE ──────────────────────────────
   *
   *   · ANNONCES LOGEMENT À RISQUE — aucune route d'équipe ne sert de file de
   *     risque logement. Les scores (82, 61) et les indices (« prix bas · compte
   *     récent · photos réutilisées ») n'existent que comme PONDÉRATIONS dans le
   *     réglage `housing.risk_weights`, pas comme liste d'annonces scorées.
   *   · BORNES DE PRIX PAR VILLE — `housing.price_bounds` est UNE SEULE paire
   *     GLOBALE, relevée `{ minCents: 15000, maxCents: 800000 }`. La maquette
   *     dessine un tableau par VILLE et par TYPE (chambre, studio, T2), soit six
   *     valeurs pour deux villes. Cette granularité n'existe pas au réglage ; poser
   *     la paire globale dans six cases serait inventer six bornes de prix.
   */
  screen({
    section: 'D10',
    dataType: 'D10Data',
    frames: pleinEcran(titre('Services')),
    donnees: [
      {
        noeud: '>JUSTIFICATIFS PRO · 5<',
        devient: '>JUSTIFICATIFS PRO · {{ justificatifs.enAttente }}<',
        why: 'Les fiches pro en attente de validation, comptées en suivant le curseur de `GET /admin/pro-profiles?status=PENDING` jusqu’au bout — cette route pagine honnêtement, donc le compte est complet.',
      },
    ],
  }),

  // ── D11 · `/admin/alertes` — alertes arnaques (13 §5) ──────────────────────
  screen({ section: 'D11', frames: pleinEcran(titre('Alertes arnaques')) }),

  // ── D12 · `/admin/contenu` — pages statiques et annonces (15 §4.1, §4.2) ───
  //
  // La maquette porte l'avertissement de §4.1 à l'écran : « Publier cette version
  // redemandera le consentement de tous les membres. »
  screen({ section: 'D12', frames: pleinEcran(titre('Pages et annonces')) }),

  // ── D13 · `/admin/partenaires` — placements par étape ──────────────────────
  screen({ section: 'D13', frames: pleinEcran(titre('Partenaires')) }),

  // ── D14 · `/admin/revenus` — abonnements et revenus ────────────────────────
  screen({ section: 'D14', frames: pleinEcran(titre('Abonnements et revenus')) }),

  // ── D15 · `/admin/reglages` — flags, paramètres, équipe, journal d'audit ───
  //
  // 15 §2.3, règle dure : « toute écriture depuis l'application admin passe par
  // `AuditService.record()` ». Le journal est dessiné ici, avec ses filtres
  // (acteur, action, cible, période) et son export.
  screen({ section: 'D15', frames: pleinEcran(titre('Réglages')) }),

  /**
   * ── D16 · `/admin/impact` — le rapport d'impact (15 §5.3) ──────────────────
   *
   * LA RÉSERVE SUR `metric_snapshots` EST LEVÉE, et elle était fausse. Ce fichier
   * disait « table ajoutée par §6 et absente du schéma » : `GET /v1/admin/impact`
   * répond 200 sur l'API qui tourne, et rend `{ trimestre, items }` où chaque
   * `item` est `{ metric, dimension, value, periodStart }`. Les cinq nombres de la
   * première planche y sont, nommément — `impact.members_accompanied`,
   * `impact.journeys_completed`, `impact.event_attendances`,
   * `impact.help_resolved`, `impact.mentorships_completed`. Relevé, pas supposé.
   *
   * ─── LE MUR DES TÉMOIGNAGES RESTE INTACT ───────────────────────────────────
   *
   * La troisième planche dessine « Témoignages citables », signés d'un prénom et
   * d'une ville (« — Kofi, Lyon »). §5.3 l'autorise — « extraits … avec accord de
   * l'auteur » — et c'est justement là que tout se joue : l'accord se lit dans
   * `guides.quotable` et `city_tips.quotable`, DEUX COLONNES QUI N'EXISTENT PAS au
   * schéma.
   *
   * Elles ne sont pas contournées, et il faut dire pourquoi plutôt que de le faire
   * discrètement : citer un membre sans son accord est EXACTEMENT ce que ces
   * colonnes existent pour empêcher. Les remplacer par n'importe quel autre
   * critère — un avis bien noté, un témoignage « assez générique » — reviendrait à
   * décider à la place du membre. Les deux citations restent donc DESSINÉES,
   * c'est-à-dire visiblement fausses, ce qui est préférable à deux vraies
   * citations publiées sans accord. Remonté au porteur, pour la troisième fois.
   *
   * ─── CE QUI N'EST PAS LIÉ NON PLUS, ET POURQUOI ────────────────────────────
   *
   * La « Répartition par pays » de la deuxième planche est un GRAPHIQUE : quatre
   * noms de pays et leurs barres. `GET /admin/impact` rend bien
   * `impact.members_by_origin_country`, mais sa `dimension` est un UUID de pays, et
   * la hauteur des barres est dessinée en dur dans la maquette. Lier les noms sans
   * les barres donnerait quatre libellés sur des hauteurs fausses — pire que le
   * graphique figé, parce que ça aurait l'air juste. Signalé.
   */
  screen({
    section: 'D16',
    dataType: 'D16Data',
    frames: pleinEcran(titre('Rapport d’impact')),
    donnees: [
      {
        noeud: '>5 820 membres accompagnés<',
        devient: '>{{ impact.membres }} membres accompagnés<',
        why: 'Le titre de la première planche : `impact.members_accompanied` de `GET /admin/impact`.',
      },
      {
        /**
         * LE LIBELLÉ SERT DE DISCRIMINANT, et il n'est pas décoratif : les quatre
         * tuiles sont dessinées à l'identique, et « 214 » seul ne dirait pas
         * laquelle. C'est le cas que `fois` existe pour empêcher — lier la mauvaise
         * tuile produirait un écran qui compile, s'affiche, et ment.
         */
        noeud: '>214</div><div style="font-size:10.5px;color:#5D6B66">parcours aboutis<',
        devient:
          '>{{ impact.parcours }}</div><div style="font-size:10.5px;color:#5D6B66">parcours aboutis<',
        why: 'Les parcours aboutis : `impact.journeys_completed`.',
      },
      {
        noeud: '>2 310</div><div style="font-size:10.5px;color:#5D6B66">présences<',
        devient:
          '>{{ impact.presences }}</div><div style="font-size:10.5px;color:#5D6B66">présences<',
        why: 'Les présences aux événements : `impact.event_attendances`.',
      },
      {
        noeud: '>1 780</div><div style="font-size:10.5px;color:#5D6B66">entraides<',
        devient:
          '>{{ impact.entraides }}</div><div style="font-size:10.5px;color:#5D6B66">entraides<',
        why: 'Les entraides résolues : `impact.help_resolved`.',
      },
      {
        noeud: '>148</div><div style="font-size:10.5px;color:#5D6B66">parrainages<',
        devient:
          '>{{ impact.parrainages }}</div><div style="font-size:10.5px;color:#5D6B66">parrainages<',
        why: 'Les parrainages aboutis : `impact.mentorships_completed`.',
      },
      {
        noeud: '>T3 2026 ▾<',
        devient: '>{{ impact.trimestre }} ▾<',
        why: 'Le trimestre du rapport, tel que `GET /admin/impact` le nomme (`trimestre`, « 2026-T3 ») — jamais déduit de l’horloge du navigateur.',
      },
      {
        /**
         * LE MÊME TRIMESTRE SUR LES TROIS PLANCHES, lié en une fois.
         *
         * `fois: 3` est COMPTÉ, pas estimé : la maquette écrit la légende sur ses
         * trois planches (« · 1/4 », « · 2/4 », « · 3/4 »), et le fragment commun
         * s'arrête avant le numéro. Si le designer en ajoute ou en retire une, la
         * génération s'arrête en nommant le fragment au lieu de laisser deux
         * planches sur trois afficher un trimestre figé.
         */
        noeud: "RAPPORT D'IMPACT · T3 2026 · ",
        devient: "RAPPORT D'IMPACT · {{ impact.trimestre }} · ",
        fois: 3,
        why: 'La légende des trois planches porte le trimestre réel, et les trois sont liées ensemble.',
      },
    ],
  }),
];
