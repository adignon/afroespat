/**
 * Les écrans de `docs/template/05 Entraide.dc.html`.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ─── CETTE MAQUETTE N'A PAS DE DIALECTE, ET C'EST `donnees` QUI S'EN CHARGE ───
 *
 * `01 Accès et Onboarding` et `03 Accueil v2` écrivent leurs valeurs dans un
 * `renderVals()` et les interpolent — `{{ p.comment }}`, `<sc-for>`. Les sept
 * autres maquettes, dont celle-ci, ne le font PAS : leur `renderVals()` rend `{}`
 * et tout le contenu est écrit en clair dans le HTML.
 *
 * L'en-tête de ce fichier disait, et c'était exact pour le lot où il a été écrit :
 * « ces quatorze cadres n'ont AUCUNE donnée à reprendre […] les composants générés
 * reçoivent `_props` ». Le souligné disait que le paramètre n'était pas lu : ces
 * écrans recevaient des données et les IGNORAIENT, faute d'avoir où les mettre.
 *
 * On ne crée PAS la prise en ajoutant des `{{ }}` dans `docs/template/` — le
 * porteur a été formel, on ne réécrit pas les maquettes — et pas davantage en
 * retouchant les `*.generated.tsx`, que la régénération suivante efface. On la
 * DÉCLARE, ici, avec l'écran : c'est la clé `donnees`, dont
 * `tools/generate-screens.mjs` porte le raisonnement complet et les quatre
 * contrôles. Ce qu'il faut en savoir pour lire ce fichier :
 *
 *   · `noeud` est le littéral de la maquette, VERBATIM, avec ses délimiteurs
 *     (`>Lyon<`) — sans eux, « Lyon » serait attrapé au milieu d'une phrase ;
 *   · `fois` dit combien de fois la maquette l'écrit DANS CE CADRE, et la
 *     génération ÉCHOUE si le compte ne tombe pas juste. Chaque nombre de ce
 *     fichier a été COMPTÉ sur les octets de la maquette, cadre par cadre, pas
 *     deviné ;
 *   · `devient` est la réécriture dans le dialecte, et rien de plus : ce qui en
 *     reste quand on ôte les interpolations doit être dessiné dans `noeud`, dans
 *     l'ordre où la maquette le dessine ;
 *   · `frames` sépare les deux cadres, qui n'ont PAS le même contenu — le mobile
 *     de H02 écrit « Studio vide à Lyon 3e, récupération samedi. » là où
 *     l'ordinateur écrit le corps entier.
 *
 * Les valeurs vivent dans le `data.ts` DE CHAQUE ÉCRAN (`screens/h01/data.ts` …
 * `screens/h10/data.ts`) —
 * un type PAR ÉCRAN, pas un type partagé par le module : sinon chaque page devrait
 * fournir les champs de toutes les autres. Les appels vivent dans
 * `apps/web/src/screens/entraide/appels.ts`. Le JSX transcodé n'a pas bougé.
 *
 * ─── LE TITRE DE CHAQUE CADRE EST DÉCLARÉ ──────────────────────────────────────
 *
 * Aucune section de cette maquette ne contient de `<h2>` : son unique `<h1>` est
 * celui de la planche de documentation, hors section. Le titre de page est donc
 * déclaré ici, avec son TEXTE VISIBLE, et le générateur promeut l'élément qui le
 * porte en `<h1>` (voir `titleFor` et `promoteTitle` : `title` répond à LEQUEL des
 * titres, son discriminant à QUEL texte promouvoir).
 *
 * Les deux cadres d'un même écran ne le disent pas toujours pareil, et c'est la
 * maquette qui en décide : H09 titre « Mes demandes » sur ordinateur, mais
 * « Fil d'entraide » sur mobile — parce que le mobile range « Mes demandes » dans
 * une pastille sous un en-tête commun. Un titre déduit aurait gommé cet écart.
 */

/** Les deux cadres que chaque section dessine, ordinateur puis mobile. */
const both = (desktop, mobile) => [
  { width: 1440, name: 'Desktop', title: desktop },
  { width: 390, name: 'Mobile', title: mobile },
];

/**
 * ─── LE BANDEAU DE SECTION, LIÉ SUR LES DIX CADRES D'ORDINATEUR ─────────────
 *
 * Les dix planches d'ordinateur dessinent le même rail : la carte « MA RÉPUTATION »
 * (sombre), le panneau ENTRAIDE avec ses trois pastilles de comptage, le panneau
 * PARRAINAGE, et la barre haute avec l'avatar et le prénom.
 *
 * LES COMPTES ONT ÉTÉ RELEVÉS, cadre par cadre, et ils sont RIGOUREUSEMENT
 * réguliers : une fois chacun sur les dix planches, sans exception. C'est ce qui
 * autorise une fonction plutôt que dix copies — et le jour où le designer ajoute
 * un second avatar au rail, la génération s'arrête sur le cadre concerné en
 * nommant le fragment, au lieu de produire neuf écrans justes et un faux.
 *
 * LES QUATRE NOMBRES DU BANDEAU VIENNENT TOUS DE `stats`, et c'est une correction
 * à son propre compte : ce commentaire a d'abord affirmé que trois d'entre eux
 * « n'avaient aucune route ». C'était faux, et le vérifier coûtait une lecture de
 * `publicProfileResponseSchema` — `stats` y porte `helpValidatedCount`,
 * `guideHelpfulVotes`, `guideContributions`, `mentorshipsCompleted` et
 * `eventsOrganized`. Un écart ANNONCÉ sans être vérifié est pire qu'un écart
 * manqué : il envoie le porteur construire ce qui existe déjà.
 */
const PASTILLE = (n) =>
  '<span style="background:#E0733A;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:flex;align-items:center;justify-content:center">' +
  n +
  '</span>';

const bandeau = () => [
  {
    noeud: '<span style="font-size:34px;font-weight:800;letter-spacing:-1px">23</span>',
    devient:
      '<span style="font-size:34px;font-weight:800;letter-spacing:-1px">{{ reputation.entraides }}</span>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les entraides validées du rail, de `GET /users/{pseudo}` (`stats.helpValidatedCount`).',
  },
  {
    noeud: '>4 guides utiles · 2 parrainages · 6 événements<',
    devient:
      '>{{ reputation.guides }} guides utiles · {{ reputation.parrainages }} parrainages · {{ reputation.evenements }} événements<',
    fois: 1,
    frames: ['Desktop'],
    why: 'La ligne de réputation du rail : `guideHelpfulVotes`, `mentorshipsCompleted` et `eventsOrganized` de `stats` (`GET /users/{pseudo}`).',
  },
  {
    noeud: PASTILLE(41),
    devient:
      '<sc-if value="{{ compteurs.ouvertes }}">' +
      PASTILLE('{{ compteurs.ouvertes }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Toutes les demandes » compte les demandes ouvertes de la ville (`meta.open` de `GET /help`) ; à zéro, elle disparaît au lieu d’afficher un rond orange vide.',
  },
  {
    noeud: PASTILLE(4),
    devient:
      '<sc-if value="{{ compteurs.pouvezAider }}">' +
      PASTILLE('{{ compteurs.pouvezAider }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Vous pouvez aider » compte les suggestions de `GET /help/can-help`.',
  },
  {
    noeud: PASTILLE(1),
    devient:
      '<sc-if value="{{ compteurs.parrainages }}">' +
      PASTILLE('{{ compteurs.parrainages }}') +
      '</sc-if>',
    fois: 1,
    frames: ['Desktop'],
    why: 'La pastille « Mes parrainages » compte les parrainages en cours et les demandes en attente (`GET /me/mentorships`).',
  },
  {
    noeud: '>AD<',
    devient: '>{{ moi.initiales }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les initiales de l’avatar de repli de la barre haute, dérivées du nom affiché.',
  },
  {
    noeud: '>Amina<',
    devient: '>{{ moi.prenom }}<',
    fois: 1,
    frames: ['Desktop'],
    why: 'Le prénom de la barre haute, premier mot du nom affiché de `GET /me`.',
  },
];

/**
 * ─── LA COLONNE DE DROITE DE H01 ET H04 : LA MÊME CARTE DE RÉPUTATION ──────
 *
 * Deux planches sur dix la dessinent — H01 et H04, comptées — et elles la
 * dessinent dans une AUTRE forme que le rail : un `<div>` de 30 px au lieu d'un
 * `<span>` de 34, et trois mini-compteurs en grille. Les deux formes portent le
 * même nombre, et les lier séparément est la seule lecture honnête : les mêler
 * demanderait de déclarer un `motifs`, c'est-à-dire d'affirmer un remontage que la
 * maquette ne fait pas.
 *
 * H10 dessine aussi le `<div>` de 30 px, mais SANS les mini-compteurs — sa colonne
 * dit « entraides validées sur 31 réponses ». Il reprend donc la première ligne
 * seule, et c'est pour cela que `minis` est un argument.
 */
const MINI = (valeur, nom) =>
  '<div style="background:#F6F8F7;border-radius:12px;padding:8px"><div style="font-size:15px;font-weight:800">' +
  valeur +
  '</div><div style="font-size:10.5px;color:#5D6B66">' +
  nom +
  '</div></div>';

const colonneReputation = ({ minis = true } = {}) => [
  {
    noeud: '<div style="font-size:30px;font-weight:800;margin-top:6px">23</div>',
    devient:
      '<div style="font-size:30px;font-weight:800;margin-top:6px">{{ reputation.entraides }}</div>',
    fois: 1,
    frames: ['Desktop'],
    why: 'Les entraides validées de la colonne de droite — même nombre que le rail, autre forme dessinée.',
  },
  ...(minis
    ? [
        {
          noeud: MINI(4, 'guides'),
          devient: MINI('{{ reputation.guides }}', 'guides'),
          fois: 1,
          frames: ['Desktop'],
          why: 'Le mini-compteur « guides » de la colonne de droite : `stats.guideHelpfulVotes`, le même nombre que la ligne du rail.',
        },
        {
          noeud: MINI(2, 'parrainages'),
          devient: MINI('{{ reputation.parrainages }}', 'parrainages'),
          fois: 1,
          frames: ['Desktop'],
          why: 'Le mini-compteur « parrainages » : `stats.mentorshipsCompleted`.',
        },
        {
          noeud: MINI(6, 'événements'),
          devient: MINI('{{ reputation.evenements }}', 'événements'),
          fois: 1,
          frames: ['Desktop'],
          why: 'Le mini-compteur « événements » : `stats.eventsOrganized`.',
        },
      ]
    : []),
];

/** Le sous-titre d'un en-tête d'écran, dans la forme que les quatre partagent. */
const SOUS_TITRE = (texte) =>
  '<div style="font-size:13.5px;color:#5D6B66;margin-top:4px">' + texte + '</div>';

/**
 * ─── H02 · UNE RÉPONSE À UNE DEMANDE, ÉCRITE UNE FOIS ───────────────────────
 *
 * La maquette en dessine TROIS côte à côte, et elles ne diffèrent que par leurs
 * textes, la couleur de l'avatar, et LA PASTILLE « ça m'a aidé » — remplie sur la
 * réponse marquée, détourée sur les deux autres. Ce sont les DEUX VARIANTES que la
 * maquette dessine, et elles vont chacune sous son `<sc-if>` : n'en garder qu'une
 * serait un mensonge sur les autres lignes, exactement comme la pastille
 * « Actuelle » de K04 l'aurait été sur les sessions révocables.
 *
 * La fabrique sert DEUX FOIS — pour écrire le `noeud` (les trois réponses telles
 * que la maquette les dessine) et pour écrire le `devient` (la même, une fois,
 * interpolée). Le générateur compare les deux : si la maquette change d'un pixel,
 * `fois` ne tombe plus juste et la génération s'arrête en nommant le fragment.
 */
const REPONSE = (fond, initiales, nom, age, corps, pastille) =>
  '<div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #F0F3F2">' +
  '<span style="width:36px;height:36px;border-radius:999px;background:' +
  fond +
  ';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
  initiales +
  '</span><div style="flex:1;min-width:0">' +
  '<div style="display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700">' +
  nom +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10"/>' +
  '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2.2" fill="none"/></svg>' +
  '<span style="font-size:11.5px;color:#8A958F;font-weight:500">' +
  age +
  '</span></div><div style="font-size:13.5px;line-height:1.55;margin-top:4px">' +
  corps +
  '</div>' +
  pastille +
  '</div></div>';

/** La pastille d'une réponse DÉJÀ marquée : remplie, avec sa coche. */
const PASTILLE_MARQUEE =
  '<span style="display:inline-flex;margin-top:8px;align-items:center;gap:6px;background:#16785E;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px">' +
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 12 4.5 4.5L19 7"/></svg>Ça m’a aidé</span>';

/**
 * H06 — une évaluation de parrain, avec sa rangée de CINQ étoiles.
 *
 * Les cinq étoiles sont dessinées cinq fois à l'identique par la maquette, sur
 * CHACUNE de ses deux évaluations : ce n'est donc pas une note variable, et la
 * fabrique les recopie telles quelles. Lier la note demanderait de dessiner une
 * rangée à longueur variable que la maquette n'a pas dessinée.
 */
const ETOILE =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E0733A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';

const EVALUATION = (commentaire, auteur) =>
  '<div style="padding:12px 0;border-bottom:1px solid #F0F3F2"><div style="display:flex;gap:2px">' +
  ETOILE.repeat(5) +
  '</div><div style="font-size:13.5px;margin-top:4px">« ' +
  commentaire +
  ' »</div><div style="font-size:12px;color:#8A958F;margin-top:2px">' +
  auteur +
  '</div></div>';

/** La pastille d'une réponse QU'ON PEUT marquer : détourée, sans coche. */
const PASTILLE_A_MARQUER =
  '<span style="display:inline-flex;margin-top:8px;align-items:center;gap:6px;border:1.5px solid #CFE3DA;color:#0F5C48;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px">Ça m’a aidé</span>';

export const screens = [
  /**
   * ── H01 · /entraide — le fil ───────────────────────────────────────────────
   *
   * Le sous-titre porte les DEUX compteurs que `GET /help` renvoie dans son
   * `meta` : `open` et `resolvedThisMonth`. Ils sont comptés par le serveur sur la
   * ville entière, et c'est ce qui compte : les compter sur la page courante
   * afficherait « 20 » là où la ville en a deux cents.
   */
  {
    section: 'H01',
    frames: both('Fil d’entraide', 'Fil d’entraide'),
    donnees: [
      ...bandeau(),
      ...colonneReputation(),
      {
        noeud: SOUS_TITRE('41 demandes ouvertes à Lyon · 178 résolues ce mois-ci'),
        devient: SOUS_TITRE(
          '{{ compteurs.ouvertes }} demandes ouvertes à {{ ville }} · {{ compteurs.resoluesCeMois }} résolues ce mois-ci',
        ),
        fois: 1,
        frames: ['Desktop'],
        why: 'Les deux compteurs de ville du `meta` de `GET /help` (`open`, `resolvedThisMonth`) et le nom de la ville.',
      },
    ],
  },

  /**
   * Le titre d'un détail est celui de la demande affichée — la maquette n'en met
   * pas d'autre, et en ajouter un (« Demande ») serait exactement le titre inventé
   * qui a coûté A01.
   *
   * L'apostrophe de « l'installation » est DROITE ici, alors que « Fil d’entraide »
   * porte la courbe. C'est la maquette qui mélange les deux ; la déclaration la
   * recopie sans la corriger, sans quoi le titre ne serait plus trouvé.
   */
  {
    section: 'H02',
    frames: both("Un lit et une table pour l'installation", "Un lit et une table pour l'installation"),
    donnees: [
      ...bandeau(),
      {
        noeud:
          '<div style="font-size:12.5px;font-weight:700;color:#B4581F;margin-top:10px">Étape 7 · Logement · parcours Études · échéance dans 9 jours</div>',
        devient:
          '<sc-if value="{{ demande.parcours }}">' +
          '<div style="font-size:12.5px;font-weight:700;color:#B4581F;margin-top:10px">Étape {{ demande.parcours.etape }} · parcours {{ demande.parcours.type }} · échéance dans {{ demande.parcours.jours }} jours</div>' +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le contexte de parcours de `journeyContext` (§2.5) : l’étape et le TYPE de parcours, jamais son titre personnel. Absent, la ligne disparaît au lieu d’afficher « Étape undefined ». LE « 7 » DISPARAÎT : `journeyContext` ne porte aucun RANG d’étape, et en composer un serait inventer un numéro — mieux vaut « Étape Logement » que « Étape 1 » faux.',
      },
      /**
       * LE `noeud` DE CE TITRE S'ÉCRIT `>texte<` ET PAS AUTREMENT, et c'est une
       * contrainte du générateur qu'il a fallu rencontrer pour la voir.
       *
       * Écrit avec son `<div>` entier, la liaison marchait — le titre s'affichait
       * bien depuis les données — mais `retitrerSurDonnees` ne la reconnaissait
       * plus : il compare `nu(noeud)` au texte déclaré, et `nu` ne dépouille qu'un
       * `>` initial et un `<` final. Le journal a crié « ⚠ titre déclaré
       * introuvable : la page n'aura pas de <h1> », et la cause était à deux
       * mécanismes de distance — exactement ce que l'en-tête de
       * `retitrerSurDonnees` raconte de K02.
       */
      {
        noeud: ">Un lit et une table pour l'installation<",
        devient: '>{{ demande.titre }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le titre de la demande, de `GET /help/:id` — et c’est AUSSI le titre de la page, repris par `retitrerSurDonnees`.',
      },
      {
        noeud:
          '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.6">J\'emménage le 1er octobre dans un studio vide à Lyon 3e. Je cherche un lit et une petite table. Récupération possible en camionnette samedi.</p>',
        devient:
          '<p style="margin:8px 0 0;font-size:14.5px;line-height:1.6">{{ demande.corps }}</p>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le corps ENTIER de la demande (`request.body`) — la carte de liste, elle, reçoit l’extrait tronqué à 280 caractères.',
      },
      {
        noeud:
          '<span style="width:40px;height:40px;border-radius:999px;background:#E0733A;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">KB</span>',
        devient:
          '<span style="width:40px;height:40px;border-radius:999px;background:{{ demande.auteur.fond }};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">{{ demande.auteur.initiales }}</span>',
        fois: 1,
        frames: ['Desktop'],
        why: 'L’avatar de repli de l’auteur. La COULEUR est une donnée parce que la maquette en dessine trois (#E0733A, #0F5C48, #2FA37D) : n’en garder qu’une teindrait tous les membres de la même.',
      },
      {
        noeud: '>Kofi Boateng<',
        devient: '>{{ demande.auteur.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom affiché de l’auteur, de `request.author.displayName`.',
      },
      {
        noeud:
          '<span style="display:block;font-size:12px;color:#8A958F">Arrivé · Lyon 3e</span>',
        devient:
          '<span style="display:block;font-size:12px;color:#8A958F">{{ demande.auteur.phase }} · {{ demande.auteur.ville }}</span>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La phase et la ville de l’auteur (`author.phase`, `author.cityName`). ÉCART : la maquette GENRE la phase (« Arrivé »), et aucun champ de l’API ne porte le genre — les formes inclusives de `01` sont employées.',
      },
      /**
       * ── LE BANDEAU « APRÈS RÉSOLUTION » — TROUVÉ AU NAVIGATEUR ────────────
       *
       * Cette liaison n'existait pas, et c'est l'EXERCICE qui l'a réclamée, pas une
       * relecture. Un test affirmait que le nom dessiné « Sandra M. » avait disparu
       * de H02 une fois l'écran branché ; il a rougi sur un texte que personne
       * n'avait regardé : la planche dessine, SOUS la liste des réponses, un bandeau
       * « APRÈS RÉSOLUTION · Demande résolue — Sandra M. a été marquée “ça m'a
       * aidé” ».
       *
       * Un nom de membre écrit en dur, affiché à tous les lecteurs de toutes les
       * demandes. Lier les réponses sans lier ce bandeau laissait donc l'écran
       * nommer une personne qui n'a rien à voir avec la demande affichée — et le
       * défaut aurait survécu à tous les contrôles du générateur, puisque chacun ne
       * vérifie que ce qui est DÉCLARÉ. C'est exactement la raison pour laquelle la
       * méthode exige un navigateur et pas seulement un `tsc`.
       *
       * Le bandeau passe sous `<sc-if>` : il ne se dessine que sur une demande
       * RÉSOLUE. Sans la condition, une demande ouverte annoncerait sa propre
       * résolution.
       */
      {
        noeud:
          '<div style="font-size:14.5px;font-weight:700;margin-top:6px">Demande résolue — Sandra M. a été marquée « ça m\'a aidé »</div>',
        devient:
          '<sc-if value="{{ demande.resolue }}">' +
          '<div style="font-size:14.5px;font-weight:700;margin-top:6px">Demande résolue — {{ demande.resolue.aidant }} a été marquée « ça m\'a aidé »</div>' +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le bandeau « APRÈS RÉSOLUTION » nomme l’aidant dont la réponse a été marquée (`resolvedByResponseId`). TROUVÉ AU NAVIGATEUR : il affichait « Sandra M. » en dur à tous les lecteurs de toutes les demandes.',
      },
      {
        noeud:
          '<span style="flex:1;font-size:13.5px;font-weight:600">Marquer l\'étape Logement comme franchie ?</span>',
        devient:
          '<sc-if value="{{ demande.parcours }}">' +
          '<span style="flex:1;font-size:13.5px;font-weight:600">Marquer l\'étape {{ demande.parcours.etape }} comme franchie ?</span>' +
          '</sc-if>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La proposition de §2.4 nomme l’ÉTAPE de la demande, pas « Logement » en dur. Sous `<sc-if>` : une demande qui ne vient pas d’un parcours n’a aucune étape à franchir.',
      },
      {
        noeud: '>3 RÉPONSES · VUE AUTEUR<',
        devient: '>{{ demande.nbReponses }} RÉPONSES · VUE AUTEUR<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de réponses VISIBLES — celles d’un membre bloqué sont déjà retirées par le serveur, donc ce compte est celui de la liste rendue, pas `responseCount`.',
      },
      {
        noeud:
          REPONSE('#0F5C48', 'SM', 'Sandra M.', '· il y a 1 h', 'J’ai une table pliante à donner, Lyon 7e.', PASTILLE_MARQUEE) +
          REPONSE('#0F5C48', 'MD', 'Moussa D.', '· il y a 40 min', 'Emmaüs Villeurbanne a des lits à 30 €.', PASTILLE_A_MARQUER) +
          REPONSE('#2FA37D', 'FN', 'Fatou N.', '· il y a 10 min', 'Je peux prêter ma camionnette samedi matin.', PASTILLE_A_MARQUER),
        devient:
          '<sc-for list="{{ reponses }}" as="r">' +
          REPONSE(
            '{{ r.fond }}',
            '{{ r.initiales }}',
            '{{ r.nom }}',
            '{{ r.age }}',
            '{{ r.corps }}',
            '<sc-if value="{{ r.marquee }}">' +
              PASTILLE_MARQUEE +
              '</sc-if><sc-if value="{{ r.peutMarquer }}">' +
              PASTILLE_A_MARQUER +
              '</sc-if>',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les réponses publiques de `GET /help/:id` : la pastille REMPLIE marque celle qui a aidé, la DÉTOURÉE celles que l’auteur peut encore marquer (`canMarkHelpful`) — les deux variantes que la maquette dessine.',
      },

      /**
       * ── LE CADRE MOBILE DE H02, LIÉ LUI AUSSI ─────────────────────────────
       *
       * C'EST LE SEUL CADRE MOBILE DE CE MODULE QUI SOIT BRANCHÉ, et il faut dire
       * pourquoi les neuf autres ne le sont pas : le mobile ne dessine pas le même
       * contenu que l'ordinateur. Il n'a PAS de rail, donc pas de bandeau à lier ;
       * ce qu'il dessine à la place, ce sont les LISTES de cartes — et ce sont
       * exactement les listes que `screens/entraide/data.ts` remonte plutôt que de
       * monter à moitié.
       *
       * H02 est l'exception parce que son mobile dessine un DÉTAIL, pas une liste :
       * un titre, un corps, et des réponses qui emploient la MÊME carte que
       * l'ordinateur — la fabrique `REPONSE` les reproduit toutes les deux sans une
       * ligne de plus, ce qui est la preuve que la maquette les dessine pareil.
       *
       * LE MOBILE ÉCRIT UN CORPS PLUS COURT — « Studio vide à Lyon 3e, récupération
       * samedi. » contre le paragraphe entier de l'ordinateur. La maquette abrège à
       * la main ; l'API ne rend qu'UN corps et un extrait tronqué à 280 caractères.
       * Le mobile reçoit donc l'EXTRAIT, qui est la donnée faite pour la place
       * disponible — pas le corps entier, qui déborderait.
       */
      {
        noeud: '>Un lit et une table pour l\'installation<',
        devient: '>{{ demande.titre }}<',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le titre de la demande sur mobile — et c’est aussi le `<h1>` que ce cadre promeut.',
      },
      {
        noeud:
          '<p style="margin:6px 0 0;font-size:13.5px;line-height:1.55">Studio vide à Lyon 3e, récupération samedi.</p>',
        devient:
          '<p style="margin:6px 0 0;font-size:13.5px;line-height:1.55">{{ demande.extrait }}</p>',
        fois: 1,
        frames: ['Mobile'],
        why: 'L’EXTRAIT tronqué par le serveur (`excerpt`, 280 caractères) et non le corps entier : le mobile abrège, et c’est la donnée faite pour cette place.',
      },
      {
        noeud:
          '<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">Étape 7 · Logement</div>',
        devient:
          '<sc-if value="{{ demande.parcours }}">' +
          '<div style="font-size:12px;font-weight:700;color:#B4581F;margin-top:8px">Étape {{ demande.parcours.etape }}</div>' +
          '</sc-if>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Le contexte de parcours sur mobile, réduit à l’étape — et le « 7 » disparaît pour la même raison que sur l’ordinateur : aucun rang n’est envoyé.',
      },
      {
        noeud:
          REPONSE('#0F5C48', 'SM', 'Sandra M.', '· 1 h', 'Table pliante à donner.', PASTILLE_MARQUEE) +
          REPONSE('#2FA37D', 'FN', 'Fatou N.', '· 10 min', 'Je prête ma camionnette.', PASTILLE_A_MARQUER),
        devient:
          '<sc-for list="{{ reponses }}" as="r">' +
          REPONSE(
            '{{ r.fond }}',
            '{{ r.initiales }}',
            '{{ r.nom }}',
            '{{ r.age }}',
            '{{ r.corps }}',
            '<sc-if value="{{ r.marquee }}">' +
              PASTILLE_MARQUEE +
              '</sc-if><sc-if value="{{ r.peutMarquer }}">' +
              PASTILLE_A_MARQUER +
              '</sc-if>',
          ) +
          '</sc-for>',
        fois: 1,
        frames: ['Mobile'],
        why: 'Les mêmes réponses sur mobile : la fabrique `REPONSE` reproduit les DEUX cartes du mobile sans une ligne de plus, ce qui prouve que la maquette les dessine comme celles de l’ordinateur.',
      },
    ],
  },

  /**
   * ── H03 · /entraide/nouveau — le composeur ─────────────────────────────────
   *
   * CE N'EST PAS UN ÉCRAN DE LECTURE, et presque rien n'y est une donnée : les
   * libellés, les cinq types et la phrase « Pour un logement ou un emploi,
   * utilisez Services. » sont du TEXTE DE RÈGLE, vrai pour tout le monde — et
   * cette dernière est d'ailleurs `HELP_USE_SERVICES_HINT` dans `@app/shared`,
   * donc déjà une source unique.
   *
   * Les deux seules vraies données sont la VILLE prérenseignée — `GET /me` rend
   * `cityId`, un UUID, et seul `GET /users/{pseudo}` en donne le nom — et les
   * exemples des champs, qui deviennent des `placeholder` au transcodage.
   *
   * L'ENCART « OFFRE · NIVEAU L0 » reste tel quel, et c'est une décision : le
   * niveau est AFFICHÉ, jamais employé pour autoriser (00 §7.3). On tente la
   * publication, et c'est le serveur qui répond `403 LEVEL_REQUIRED` avec de quoi
   * afficher l'invitation. Lier cet encart au niveau du jeton reviendrait à
   * décider côté écran ce que le serveur décide.
   */
  {
    section: 'H03',
    frames: both('Publier une demande', 'Publier une demande'),
    donnees: [...bandeau()],
  },

  /**
   * ── H04 · /entraide/aider — « Vous pouvez aider » ──────────────────────────
   *
   * Le sous-titre compte les suggestions de `GET /help/can-help`, et c'est le
   * nombre que la pastille du rail porte aussi : UNE donnée, deux endroits.
   */
  {
    section: 'H04',
    frames: both('Vous pouvez aider', 'Vous pouvez aider'),
    donnees: [
      ...bandeau(),
      ...colonneReputation(),
      {
        noeud: SOUS_TITRE('4 demandes correspondent à votre expérience'),
        devient: SOUS_TITRE('{{ compteurs.pouvezAider }} demandes correspondent à votre expérience'),
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de demandes suggérées, compté sur `GET /help/can-help` (§2.6).',
      },
    ],
  },

  /**
   * ── H05 · /parrainage — la liste des parrains ──────────────────────────────
   *
   * La ville du filtre est la SEULE donnée scalaire de cet écran : les trois
   * autres sélecteurs (« Langue », « Type de parcours », « Pays ») n'affichent que
   * leur libellé, sans valeur choisie.
   */
  {
    section: 'H05',
    frames: both('Parrainage', 'Parrainage'),
    donnees: [...bandeau()],
  },

  /**
   * H06 N'A PAS DE CADRE MOBILE, et ce n'est pas un oubli de déclaration.
   *
   * La section dessine quatre planches : la FICHE (cadre de 1440 px), la FEUILLE DE
   * DEMANDE (carte nue de 540 px), APRÈS ENVOI (carte de 420 px) et MOBILE — qui
   * n'est pas la fiche sur téléphone, mais la FEUILLE DE DEMANDE posée sur un voile.
   *
   * Autrement dit, la maquette ne dessine pas la fiche du parrain sur mobile, et
   * elle ne dessine pas la feuille de demande sur ordinateur avec son voile. La
   * feuille n'est donc pas transcodable en modale ici : son cadre d'ordinateur est
   * une carte sans voile et sans panneau marqué, et `extractFrame` en retirerait de
   * surcroît la boîte blanche elle-même, puisque c'est le conteneur extérieur.
   *
   * La fiche est donc livrée seule, sur son unique cadre — `ScreenFrames` la sert
   * alors à toutes les largeurs, comme il le fait pour O05. La feuille de demande
   * est signalée dans le rapport plutôt que d'être à moitié montée.
   */
  /**
   * ── H06 · /parrainage/:handle — la fiche d'un parrain ──────────────────────
   *
   * BRANCHÉE SUR `GET /mentors/{handle}`, et le titre de la page EST le nom du
   * parrain : c'est une donnée, et `retitrerSurDonnees` la reprend.
   *
   * TROIS LITTÉRAUX DE CETTE PLANCHE NE SONT PAS LIÉS, et chacun pour une raison
   * mesurée plutôt que par fatigue :
   *
   *   · LES CINQ ÉTOILES. La maquette dessine CINQ étoiles sur CHACUNE de ses
   *     deux évaluations — compté. Ce n'est donc pas une note variable qu'elle
   *     dessine, c'est une rangée fixe. L'API rend bien `reviews[].rating` de 1 à
   *     5, mais le lier demanderait de dessiner une rangée à longueur variable que
   *     la maquette n'a pas dessinée. Écart signalé.
   *   · « 3 mois · durée habituelle ». C'est la DURÉE DE RÈGLE du §2.3
   *     (`MENTORSHIP_DURATION_DAYS = 90`), vraie pour tous les parrainages, pas une
   *     statistique de ce parrain. Aucun champ de `GET /mentors/:handle` ne la
   *     porte, et c'est juste : elle est déjà une source unique dans
   *     `@app/shared`.
   *   · « Réponse sous 7 jours ». Même nature : c'est
   *     `MENTORSHIP_REQUEST_EXPIRY_DAYS`, le délai au bout duquel une demande
   *     expire — pas le temps de réponse observé de ce parrain.
   *
   * ET UNE ABSENCE DE L'API, remontée : la ligne « Installée depuis 2019 · Lyon 7e
   * · Bénin » veut l'année d'arrivée et le pays d'origine. `MENTOR_SELECT`
   * sélectionne bien `arrivalDate` et `originCountryId` côté service, mais
   * `card()` n'en rend AUCUN des deux — ni l'année, ni le pays, ni même la phase.
   * La ligne est donc liée sur ce que la fiche ENVOIE : la ville, et rien d'autre
   * n'est inventé à côté.
   */
  {
    section: 'H06',
    frames: [{ width: 1440, name: 'Desktop', title: 'Aïcha Diop' }],
    donnees: [
      ...bandeau(),
      {
        noeud: '>AI<',
        devient: '>{{ parrain.initiales }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les initiales de l’avatar de repli du parrain, dérivées de `displayName`.',
      },
      {
        noeud:
          '<span style="background:#E3F0EB;color:#0F5C48;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">Disponible</span>',
        devient:
          '<span style="background:{{ parrain.dispo.fond }};color:{{ parrain.dispo.texte }};font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap">{{ parrain.dispo.libelle }}</span>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La pastille « Disponible » / « Complet » (`availability`). Le LIBELLÉ et les DEUX couleurs sont des données : lier le seul libellé laisserait « Complet » sur le vert de « Disponible ».',
      },
      {
        noeud: '>Aïcha Diop<',
        devient: '>{{ parrain.nom }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nom du parrain, de `GET /mentors/{handle}` — et c’est le titre de la page.',
      },
      {
        noeud:
          '<div style="font-size:13.5px;color:#8A958F;margin-top:4px">Installée depuis 2019 · Lyon 7e · Bénin</div>',
        devient:
          '<div style="font-size:13.5px;color:#8A958F;margin-top:4px">{{ parrain.situation }}</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La ligne de situation. UN SEUL CHAMP et non trois : `card()` ne rend ni l’année d’arrivée, ni le pays d’origine, ni la phase — seule la ville arrive. Écart signalé, pas comblé en devinant.',
      },
      {
        noeud:
          '<p style="margin:14px 0 0;max-width:520px;font-size:14.5px;line-height:1.65">Arrivée comme étudiante, aujourd\'hui comptable. J\'aide surtout pour le logement, la CAF et les premiers mois à Lyon.</p>',
        devient:
          '<p style="margin:14px 0 0;max-width:520px;font-size:14.5px;line-height:1.65">{{ parrain.bio }}</p>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La présentation du parrain (`bio`), nullable côté API.',
      },
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">4</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">parrainages menés</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">{{ parrain.menes }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">parrainages menés</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les parrainages menés (`completedCount`). §3.2 : la fiche porte cela et la note, et RIEN sur le réseau du parrain.',
      },
      {
        noeud:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">4,8</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">note moyenne</div>',
        devient:
          '<div style="font-size:24px;font-weight:800;letter-spacing:-0.6px;color:#16211D">{{ parrain.note }}</div><div style="font-size:12px;color:#5D6B66;margin-top:2px">note moyenne</div>',
        fois: 1,
        frames: ['Desktop'],
        why: 'La note moyenne (`avgRating`), nullable : un parrain sans évaluation n’en a pas, et la virgule décimale est celle du français.',
      },
      /**
       * LES ÉVALUATIONS, EN `<sc-for>` — ET PAS EN LIAISONS INDEXÉES.
       *
       * Première tentative : deux liaisons, `{{ evaluations.0.commentaire }}` et
       * `{{ evaluations.1.commentaire }}`. Le générateur l'a acceptée — rien dans
       * ses quatre contrôles ne s'y oppose — et le JSX émis était
       * `{evaluations.0.commentaire}`, qui n'est PAS du JavaScript valide. Le
       * défaut ne se voyait qu'au `tsc`, deux étapes plus loin, et il aurait pu se
       * voir seulement à la construction du front : quinze minutes.
       *
       * Une liaison indexée n'a donc pas de forme valide ici, et c'est tant mieux —
       * figer deux emplacements aurait de toute façon menti sur la troisième
       * évaluation.
       *
       * Les deux items de la maquette sont RIGOUREUSEMENT identiques à leurs
       * textes près, cinq étoiles comprises : la fabrique les reproduit tous les
       * deux, et le `fois: 1` le vérifie.
       */
      {
        noeud:
          EVALUATION('Disponible et très claire sur la CAF.', 'Fatou') +
          EVALUATION('M’a aidé à trouver ma coloc.', 'Kofi'),
        devient:
          '<sc-for list="{{ evaluations }}" as="e">' +
          EVALUATION('{{ e.commentaire }}', '{{ e.auteur }}') +
          '</sc-for>',
        fois: 1,
        frames: ['Desktop'],
        why: 'Les évaluations visibles de `GET /mentors/{handle}`. ÉCART MESURÉ : la liste reste VIDE pendant 14 jours — `visibleReviewsFor` exige deux évaluations sur le MÊME sujet, ce qu’un parrainage ne produit jamais. Les CINQ ÉTOILES restent dessinées : la maquette en met cinq sur chacune, donc elle ne dessine pas une note variable.',
      },
      {
        noeud: '>Demander comme parraine<',
        devient: '>Demander comme {{ parrain.appellation }}<',
        fois: 1,
        frames: ['Desktop'],
        why: 'Le bouton de demande. « parraine » est GENRÉ par la maquette et aucun champ de l’API ne porte le genre : l’appellation est une donnée pour que l’écart soit visible, pas deviné d’après le prénom.',
      },
    ],
  },

  {
    section: 'H07',
    frames: both('Mes parrainages', 'Mes parrainages'),
    donnees: [...bandeau()],
  },

  /**
   * ── H08 · /parrainage/devenir ──────────────────────────────────────────────
   *
   * LES TROIS CONDITIONS SONT DU TEXTE DE RÈGLE — « Identité vérifiée », « Numéro
   * français vérifié », « Parcours abouti ou 12 mois d'installation » — et elles
   * sont vraies pour tout le monde (§2.1). Elles ne sont donc PAS liées : l'API
   * dit si le membre est éligible en REFUSANT `PUT /me/mentor-profile` avec
   * `MENTOR_NOT_ELIGIBLE`, et il n'existe aucune route qui réponde « voici
   * lesquelles des trois vous manquent ». Lier des pastilles d'état ici
   * demanderait d'inventer ce diagnostic. Écart signalé.
   */
  {
    section: 'H08',
    frames: both('Devenir parrain', 'Devenir parrain'),
    donnees: [...bandeau()],
  },

  // H09 et H10 ne figurent pas dans T5 ; la maquette et l'API les portent
  // (`/help/mine`, `/help/my-responses`, §5 « Panneau Entraide »). Leurs routes
  // sont celles que la maquette écrit sous leur numéro de planche.
  {
    section: 'H09',
    frames: both('Mes demandes', 'Fil d’entraide'),
    donnees: [
      ...bandeau(),
      {
        noeud: SOUS_TITRE('4 demandes · 1 avec de nouvelles réponses'),
        devient: SOUS_TITRE(
          '{{ mesDemandes.total }} demandes · {{ mesDemandes.avecNouvelles }} avec de nouvelles réponses',
        ),
        fois: 1,
        frames: ['Desktop'],
        why: 'Le nombre de MES demandes, compté sur `GET /help/mine`.',
      },
    ],
  },

  /**
   * ── H10 · /entraide/mes-reponses ───────────────────────────────────────────
   *
   * Le sous-titre et la carte de bilan portent les MÊMES deux nombres, et la
   * colonne de droite les répète : « 23 » deux fois, « 31 » deux fois. Les deux
   * formes du « 23 » ont été comptées séparément, parce que la maquette les
   * dessine dans deux balises différentes.
   */
  {
    section: 'H10',
    frames: both('Mes réponses', 'Fil d’entraide'),
    donnees: [
      ...bandeau(),
      ...colonneReputation({ minis: false }),
      {
        noeud: SOUS_TITRE('31 réponses · 23 marquées utiles'),
        devient: SOUS_TITRE(
          '{{ mesReponses.total }} réponses · {{ mesReponses.utiles }} marquées utiles',
        ),
        fois: 1,
        frames: ['Desktop'],
        why: 'Mes réponses et celles marquées « ça m’a aidé », comptées sur `GET /help/my-responses`.',
      },
      {
        noeud: '>entraides validées sur 31 réponses<',
        devient: '>entraides validées sur {{ mesReponses.total }} réponses<',
        fois: 1,
        frames: ['Desktop'],
        why: 'La légende de la carte de bilan : le même total que le sous-titre.',
      },
    ],
  },
].map((s) => ({
  file: 'docs/template/05 Entraide.dc.html',
  section: s.section,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  /**
   * UN TYPE PAR ÉCRAN, dans le `data.ts` de l'écran lui-même.
   *
   * Un `EntraideData` partagé par les dix obligerait CHAQUE page à fournir les
   * champs de toutes les autres : H03, qui ne lit qu'un référentiel de villes,
   * devrait inventer des parrains et des réponses. Le type par écran dit
   * exactement ce que la page charge, et `tsc` le vérifie.
   */
  dataModule: './data',
  dataType: `${s.section}Data`,
  frames: s.frames,
  ...(s.donnees === undefined ? {} : { donnees: s.donnees }),
}));
