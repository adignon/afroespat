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

const screen = ({ section, frames, ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${section.toLowerCase()}`,
  dataModule: '../administration/data',
  dataType: 'AdministrationData',
  frames,
  ...rest,
});

/** Un titre de page : le texte visible, et le corps qui le distingue du menu. */
const titre = (text) => ({ text, size: '28px' });

/** Le cadre unique d'un écran d'administration, avec son titre de page. */
const pleinEcran = (title) => [{ width: 1440, name: 'Desktop', occurrence: 0, ...(title === undefined ? {} : { title }) }];

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
   * 15 §5.1 et T5 D02. LE BACK-END NE LE SERT PAS ENCORE : §6 ajoute la table
   * `metric_snapshots` (« historique des indicateurs pour les courbes ») et elle
   * manque au schéma. Cet écran est donc transcodé et NON branché — ce qu'il
   * affiche est ce que la maquette dessine, pas une mesure.
   *
   * Sans titre : voir l'en-tête de ce fichier.
   */
  screen({ section: 'D02', frames: pleinEcran() }),

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

  // ── D04 · `/admin/moderation` — la file (13 §4.1) ───────────────────────────
  //
  // « Une file unique, triée par priorité puis `sla_due_at` », et la maquette la
  // dessine ainsi, colonne SLA comprise (« dépassé », « 2 h », « 3 h »…).
  screen({ section: 'D04', frames: pleinEcran(titre('Modération')) }),

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
  screen({ section: 'D05', frames: pleinEcran(titre('Dossier #4812')) }),

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

  // ── D08 · `/admin/referentiels` — 02 §4.2 ──────────────────────────────────
  //
  // La confirmation « Activer Nantes ? » est dessinée DANS la page, en carte de
  // 440 px à côté du tableau — pas en fenêtre par-dessus. Elle n'est donc pas
  // transcodée en modale : la maquette ne lui dessine ni voile ni panneau, et
  // `Modal` en attend exactement un de chaque.
  screen({ section: 'D08', frames: pleinEcran(titre('Référentiels')) }),

  // ── D09 · `/admin/guides` — propositions escaladées et guides obsolètes ────
  screen({ section: 'D09', frames: pleinEcran(titre('Guides')) }),

  // ── D10 · `/admin/services` — justificatifs pro et annonces à risque ───────
  screen({ section: 'D10', frames: pleinEcran(titre('Services')) }),

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
   * MÊME RÉSERVE QUE D02 : les chiffres viennent de `metric_snapshots`, table
   * ajoutée par §6 et absente du schéma. Écran transcodé, rien de branché.
   *
   * « Toutes les données sont agrégées, jamais nominatives » — la maquette s'y
   * tient, à une exception près qu'elle assume : les témoignages citables sont
   * signés d'un prénom et d'une ville (« — Kofi, Lyon »), ce que §5.3 autorise
   * explicitement (« extraits … avec accord de l'auteur »).
   */
  screen({ section: 'D16', frames: pleinEcran(titre('Rapport d’impact')) }),
];
