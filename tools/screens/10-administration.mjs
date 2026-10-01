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

const screen = ({ section, frames, dataType = 'AdministrationData', ...rest }) => ({
  file: FILE,
  section,
  out: `apps/web/src/screens/${section.toLowerCase()}`,
  dataModule: '../administration/data',
  dataType,
  frames,
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
