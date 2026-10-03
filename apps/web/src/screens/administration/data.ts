/**
 * Données des écrans D01 à D16, reprises de `docs/template/10 Administration.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE — ce fichier existe pour le dire, pas pour combler un vide.
 *
 * Les maquettes `01 Accès et Onboarding` et `03 Accueil v2` calculent leurs valeurs
 * d'affichage dans un `renderVals()` et les interpolent dans le HTML (`{{ p.comment }}`,
 * `<sc-for>`). `apps/web/src/screens/a01/data.ts` recopie ce `renderVals()` à
 * l'identique : c'est la séparation qui tient tout, la FORME transcodée d'un côté,
 * la DONNÉE écrite à la main de l'autre.
 *
 * `10 Administration` ne fonctionne pas ainsi. Son `renderVals()` est littéralement
 * `renderVals() { return {}; }`, le fichier ne contient ni `{{ }}` ni `<sc-for>`, et
 * tout le contenu — les 46 dossiers de la file, les cinq blocs du tableau de bord,
 * les trois lignes du journal d'audit — est écrit en clair dans le HTML. C'est vrai
 * des sept maquettes 04 à 10 ; seules 01 et 03 emploient le dialecte.
 *
 * Recopier ce `renderVals()` à l'identique, c'est donc n'écrire aucune donnée. En
 * écrire une — extraire les lignes de tableau du HTML pour les remettre dans un
 * tableau TypeScript — serait choisir une structure que la maquette n'a pas choisie,
 * et introduire exactement l'écart de jugement que le transcodage supprime.
 *
 * ─── CE QUI A CHANGÉ : LA PRISE EXISTE, ET D08 S'EN SERT ───────────────────────
 *
 * Ce fichier disait « Le type ci-dessous est le point d'accroche du lot qui
 * branchera ». C'est ce lot. La prise a été DÉCLARÉE dans
 * `tools/screens/10-administration.mjs`, sous la clé `donnees`, et le JSX
 * transcodé n'a pas bougé d'une virgule — c'est tout l'intérêt du mécanisme.
 *
 * Le type vide survit pour les cadres qui ne lisent RIEN, et ils sont encore la
 * majorité. Ce qui les retient est écrit route par route dans `appels.ts` : pour
 * la plupart, la route d'équipe n'existe pas, et on ne lui fabrique pas une
 * source.
 *
 * ─── CE QUE CE LOT NE BRANCHE PAS, ET POURQUOI ─────────────────────────────────
 *
 * D16 (rapport d'impact) réclame `guides.quotable` et `city_tips.quotable`, qui
 * n'existent pas au schéma. Citer un membre sans son accord est exactement ce que
 * ces colonnes existent pour empêcher : le mur reste intact, et les témoignages
 * de la planche restent dessinés.
 *
 * Le MRR n'est pas posé, faute de règle sur les plans annuels — « un MRR faux est
 * pire qu'un MRR absent » — et la répartition Mobile Money / carte ainsi que
 * l'affiliation sont dans le même cas. Les quatre tuiles de tête de D14 et le bloc
 * REVENUS de D02 restent donc ceux de la maquette.
 *
 * ─── L'AUTHENTIFICATION N'EST PAS CELLE DES MEMBRES ────────────────────────────
 *
 * 15 §2.1 : cookie `HttpOnly` `Strict` de session d'équipe (8 h, 30 min
 * d'inactivité) et TOTP obligatoire — pas le jeton porteur des membres. Aucun écran
 * de ce lot ne suppose le contraire : rien n'y lit de jeton, rien n'y appelle
 * l'API, et D01 dessine les deux temps (identifiants puis TOTP) plus l'enrôlement
 * forcé. Le type ci-dessous est le point d'accroche du lot qui branchera.
 */

/**
 * Aucun champ : les cadres générés reçoivent `_props`.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe quelle
 * valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un type qui
 * n'interdit rien ne dirait pas que l'écran ne consomme rien.
 *
 * Aucune entrée n'a été ajoutée à `BUTTON_ACTIONS` pour ce lot, et c'est délibéré :
 * brancher un `onClick` qui ne fait rien ferait CROIRE à l'équipe qu'une sanction a
 * été appliquée ou qu'une ville a été activée. 15 §2.3 est une règle dure — « toute
 * écriture depuis l'application admin passe par `AuditService.record()` avant
 * validation de la transaction » — donc une action qui n'écrit rien n'est pas une
 * action : c'est un mensonge tracé nulle part. Les boutons restent inertes.
 */
export type AdministrationData = Record<string, never>;

/**
 * D08 — les référentiels, onglet Villes (`/admin/referentiels`).
 *
 * `GET /admin/ref/cities` via `staffApi`. Les trois états de 02 §4.2 sont des
 * BOOLÉENS SÉPARÉS et non une énumération, parce que la maquette dessine trois
 * colonnes d'action structurellement différentes et que chacune garde son dessin
 * sous son propre `<sc-if>`. Un seul champ `etat: 'active' | 'bientot' | 'doublon'`
 * aurait obligé le JSX à décider, et le JSX transcodé ne décide rien.
 */
export interface VilleD08 {
  readonly nom: string;
  readonly region: string;
  /** Déjà mis en forme — « 1 400 », espace insécable comprise. */
  readonly membres: string;
  /**
   * Le libellé de la pastille, et ses DEUX couleurs.
   *
   * Lier le seul libellé laisserait « Bientôt » sur le fond vert d'une ville
   * active. Les trois paires sont celles de la maquette, relevées sur ses propres
   * planches et jamais assombries.
   */
  readonly statut: string;
  readonly statutFond: string;
  readonly statutTexte: string;
  /** Une ville ouverte : la maquette lui laisse « Fusionner » en texte nu. */
  readonly fusionnable: boolean;
  /** Une ville à ouvrir : le bouton vert « Activer ». */
  readonly activable: boolean;
  /** Un doublon déjà rattaché : « Fusionner avec … ». */
  readonly doublon: boolean;
  /** Le nom de la ville cible de la fusion, vide hors du cas `doublon`. */
  readonly fusionneAvec: string;
}

export interface D08Data {
  readonly villes: readonly VilleD08[];
  /**
   * La carte « Activer … ? », qui porte la ville CANDIDATE.
   *
   * La maquette la dessine toujours : ce n'est pas une fenêtre, c'est une carte de
   * la page. Quand aucune ville n'est candidate, les deux champs le disent plutôt
   * que d'afficher « undefined ».
   */
  readonly activation: { readonly ville: string; readonly membres: string };
}

/**
 * D16 — le rapport d'impact (`/admin/impact`, 15 §5.3).
 *
 * Les cinq nombres de la première planche, plus le trimestre que le SERVEUR
 * nomme. Tous sont déjà mis en forme : « 5 820 », espace fine insécable comprise.
 *
 * CE TYPE NE PORTE AUCUN TÉMOIGNAGE, et c'est le point de l'écran : `guides.quotable`
 * et `city_tips.quotable` n'existent pas au schéma, donc rien ne dit qu'un membre a
 * donné son accord pour être cité. Un champ `temoignages` ici serait la première
 * marche vers une citation publiée sans accord — ce que ces colonnes manquantes
 * existent pour empêcher. Les deux citations de la maquette restent dessinées.
 */
export interface D16Data {
  readonly impact: {
    readonly membres: string;
    readonly parcours: string;
    readonly presences: string;
    readonly entraides: string;
    readonly parrainages: string;
    /** « T3 2026 », dans l'ordre que la maquette écrit — l'API dit « 2026-T3 ». */
    readonly trimestre: string;
  };
}

/**
 * D02 — le tableau de bord (`/admin`, 15 §5.1).
 *
 * LA RÉSERVE INSCRITE DANS CE MODULE ÉTAIT FAUSSE, et c'est la deuxième fois.
 * `tools/screens/10-administration.mjs` et `app/(admin)/admin/page.tsx` disaient
 * tous deux « §6 ajoute la table `metric_snapshots` et elle manque au schéma,
 * donc cet écran n'est pas branché ». `GET /v1/admin/dashboard` répond 200 sur
 * l'API qui tourne et rend onze blocs de points de mesure. La table existe. La
 * réserve a été levée pour D16 par le lot précédent ; elle est levée ici pour la
 * même raison — vérifié plutôt que repris.
 *
 * ─── CINQ CARTES SUR DOUZE, ET LE CRITÈRE EST ÉCRIT ────────────────────────────
 *
 * La planche D02 dessine douze cartes. Cinq sont liées, sept restent dessinées, et
 * le partage suit UNE SEULE RÈGLE, énoncée ici pour qu'elle soit relisible :
 *
 *   UNE CARTE N'EST LIÉE QUE SI CHAQUE NOMBRE QU'ELLE PORTE EST SERVI.
 *
 * Elle n'est pas du zèle. Ces cartes ne sont pas des listes : chaque nombre a son
 * libellé propre, posé à côté. Lier « File » sur une carte MODÉRATION dont
 * « SLA respecté » resterait à « 93 % » ne donnerait pas une carte à moitié vraie
 * — ça donnerait une carte dont le premier nombre bouge, ce qui fait croire que le
 * second aussi. Un nombre figé à côté d'un nombre vivant est PIRE qu'une carte
 * entièrement figée, parce que la carte figée se reconnaît et l'autre non.
 *
 * C'est le même arbitrage que le bandeau d'alertes : entier, ou dessiné.
 *
 * ─── CE QUI N'EST PAS LIÉ, CARTE PAR CARTE ET AVEC LE NOMBRE QUI MANQUE ───────
 *
 *   · ALERTES — « SLA dépassé · 3 dossiers », « Justificatifs pro · 5 en
 *     attente », « Villes à activer · Nantes, Rennes ». `GET /admin/dashboard` ne
 *     rend AUCUNE alerte : ses blocs ne portent que des points de mesure. Les
 *     trois morceaux vivraient dans trois routes distinctes, et les recoller ici
 *     fabriquerait un bandeau dont personne ne pourrait dire s'il est complet.
 *     Entier ou remonté — c'est remonté.
 *   · REVENUS — `blocks.revenus` est relevé VIDE. Le MRR n'est pas posé, ni la
 *     répartition Mobile Money/carte, ni l'affiliation. « Un MRR faux est pire
 *     qu'un MRR absent. »
 *   · INDICATEUR CLÉ — le pourcentage se calculerait
 *     (`key_indicator.city_present_90d` / `key_indicator.city_members`), mais
 *     « +2,1 pts » demande un historique que rien ne sert, « objectif 30 % » n'est
 *     dans aucun réglage, et les trois lignes par ville sont ventilées par UUID
 *     de ville, sans nom. Trois nombres manquants sur quatre.
 *   · MODÉRATION — « File » est servi (`moderation.cases_by_status` OPEN),
 *     « SLA respecté » NON : il est dans `GET /admin/moderation/stats`,
 *     `slaComplianceRate`. ET IL NE FAUT PAS ALLER LE CHERCHER LÀ : cette route
 *     exige MODERATOR, CONTENT_ADMIN ou SUPER_ADMIN, tandis que le tableau de bord
 *     est ouvert aux QUATRE rôles (`STAFF_SCOPES.dashboard`). L'appeler depuis D02
 *     rendrait le tableau de bord 403 POUR `SUPPORT` — un rôle que §2.2 autorise
 *     explicitement à le voir. Un écran ne doit pas exiger plus que ce qu'il
 *     affiche.
 *   · PARRAINAGE — « En cours » est servi, « Note 4,7 » non : aucune mesure de
 *     note de parrainage n'est rendue.
 *   · ÉVÉNEMENTS — « Présences » est servi (`events.checked_in`), « Ce mois » non :
 *     `events.by_status` ventile par STATUT, pas par fenêtre de temps.
 *   · RÉSEAUX — « Actifs » est servi, « Intérêt » non : `communities.by_status` ne
 *     connaît que ACTIVE et ARCHIVED ; « intérêt » est un TYPE de réseau, pas un
 *     statut.
 *
 * Tous les nombres ci-dessous sont DÉJÀ MIS EN FORME par `appels.ts` — « 1 978 »,
 * espace fine insécable comprise, et « 2 % » avec son signe. Le JSX transcodé ne
 * calcule rien.
 */
export interface D02Data {
  /** Les trois nombres de la carte MEMBRES. */
  readonly membres: {
    readonly inscrits: string;
    readonly actifs30j: string;
    /** Part des membres au niveau L2, « 2 % » — calculée, voir `appels.ts`. */
    readonly niveau2: string;
  };
  /** Les quatre nombres de la carte PARCOURS, par statut de `JourneyStatus`. */
  readonly parcours: {
    /** Tous statuts confondus : un parcours créé porte toujours un statut. */
    readonly crees: string;
    readonly actifs: string;
    readonly aboutis: string;
    readonly enPause: string;
  };
  /** Les trois nombres de la carte ENTRAIDE. */
  readonly entraide: {
    readonly ouvertes: string;
    readonly resolues: string;
    /** « 19 h » — le délai médian de première réponse, servi EN MINUTES. */
    readonly delaiMedian: string;
  };
  /** Les deux nombres de la carte GUIDES, par statut de `GuideStatus`. */
  readonly guides: {
    readonly publies: string;
    /** `FLAGGED` : un guide signalé est un guide à vérifier. */
    readonly aVerifier: string;
  };
  /** Les deux nombres de la carte SERVICES. */
  readonly services: {
    /** Logements ACTIFS plus emplois ACTIFS : les annonces en ligne. */
    readonly annonces: string;
    /** Fiches pro APPROUVÉES (`pros.by_verification`). */
    readonly fichesPro: string;
  };
}

/**
 * D04 — la file de modération (`/admin/moderation`, 13 §4.1).
 *
 * ─── UN SEUL NOMBRE, ET LE TABLEAU RESTE DESSINÉ ───────────────────────────────
 *
 * C'est peu, et c'est le résultat d'un arbitrage qu'il faut écrire en entier,
 * parce qu'il se reproduira sur presque tous les tableaux de ce module.
 *
 * La planche dessine sept colonnes : PRIO, SUJET, AUTEUR, SOURCE, SIGN., ASSIGNÉ,
 * SLA. La charge relevée de `GET /admin/moderation/cases` en sert TROIS —
 * `priority`, `source`, `sla` — et une quatrième à moitié (`subjectType` donne
 * « Publication », pas l'extrait « · « Vends attestation… » »). Manquent
 * entièrement :
 *
 *   · AUTEUR — aucun nom, aucun handle, pas même l'identifiant de l'auteur du
 *     contenu visé. Seuls `subjectId` et `subjectType` arrivent ;
 *   · SIGN. — le nombre de signalements n'est PAS dans la ligne de liste. Il n'est
 *     que dans le dossier (`reports` de `GET /moderation/cases/:id`) ;
 *   · ASSIGNÉ — `assignedStaffId` est un UUID. Le nom se lit dans
 *     `GET /admin/staff`, QUI EXIGE SUPER_ADMIN (`STAFF_SCOPES.staffAdmin`)
 *     tandis que la file est ouverte à MODERATOR. L'appeler d'ici rendrait la file
 *     403 pour le rôle dont c'est le métier — c'est la leçon de D02, et elle vaut
 *     deux fois ici.
 *
 * ─── POURQUOI ON NE LIE PAS « LES TROIS COLONNES QUI MARCHENT » ────────────────
 *
 * Parce qu'une LISTE n'est pas une carte. Lier la ligne en `<sc-for>` ferait
 * rendre les cellules non liées avec le texte de la ligne qui a servi de modèle :
 * les quarante-six dossiers afficheraient TOUS « Joël K. » comme auteur et TOUS
 * « 5 » signalements. Ce n'est pas une donnée figée, c'est une donnée FAUSSE
 * répétée quarante-six fois, et elle aurait l'air parfaitement normale.
 *
 * Un tableau entièrement dessiné se reconnaît pour ce qu'il est. Un tableau dont
 * la priorité et le SLA bougent pendant que l'auteur ne bouge pas serait lu comme
 * vrai en entier. Le tableau reste donc dessiné, et c'est remonté : si le porteur
 * veut cette file, c'est à la route de servir l'auteur et le nombre de
 * signalements.
 */
export interface D04Data {
  readonly file: {
    /**
     * Les dossiers DANS LA FILE — statut `OPEN` **ou** `IN_REVIEW`.
     *
     * Somme de `openByPriority` de `GET /admin/moderation/stats`, et c'est la
     * bonne source : mesurée à 1847 là où `moderation.cases_by_status/OPEN` du
     * tableau de bord vaut 1811. Les deux sont justes et ne comptent pas la même
     * chose — 36 dossiers sont en cours d'examen, et ils sont bien dans la file.
     *
     * Déjà mis en forme : « 1 847 », espace fine insécable comprise.
     */
    readonly ouverts: string;
  };
}

/**
 * D05 — le dossier de modération (`/admin/moderation/:id`, 13 §4.2).
 *
 * UNE SEULE LIGNE LIÉE, et c'est le sous-titre : « Publication · priorité 1 · SLA
 * dépassé ». Ses trois valeurs sont servies, toutes les trois, par
 * `GET /admin/moderation/cases/:id` — `subjectType`, `priority`, `sla`. C'est le
 * seul endroit de cette planche où c'est le cas.
 *
 * ─── CE QUI N'EST PAS LIÉ, ET LE NOMBRE QUI MANQUE À CHAQUE FOIS ──────────────
 *
 *   · CONTENU — ni le texte du contenu visé, ni son auteur, ni sa ville, ni son
 *     âge. La route rend `subjectId` et `subjectType` ; le CONTENU lui-même vit
 *     dans sa propre table et aucune route d'équipe ne le joint. C'est le manque
 *     le plus lourd de l'écran : un modérateur ne peut pas décider sans voir ce
 *     qu'il modère.
 *   · VERDICT IA — « Vente de faux documents · confiance 0,94 ». La confiance est
 *     servie (`aiScore`, relevée `0.95`), la DESCRIPTION non : `aiVerdict` vaut
 *     `ALLOW`, `QUEUE` ou `BLOCK`, ce qui est une décision, pas une description.
 *     Lier la seule confiance laisserait « Vente de faux documents » figé à côté
 *     d'un nombre vivant — la faute que ce lot refuse partout ailleurs.
 *   · SANCTIONS, DOSSIERS, SIGNALEMENTS — relevés VIDES sur tous les dossiers
 *     atteignables (`sanctions: []`, `reports: []`, `authorHistory: null`). Leur
 *     longueur serait lisible, mais afficher « 0 avertissement » et « 0
 *     signalement » sur un dossier de la base de développement ne prouverait rien
 *     et masquerait que ces listes n'ont jamais été observées remplies. On ne lie
 *     pas ce qu'on n'a pas vu.
 *   · Les deux pastilles « argent » et « document » correspondent à `aiLabels`
 *     (relevé `["SCAM","MONEY_REQUEST"]`), mais la maquette les écrit en français
 *     minuscule et la route rend des constantes d'énumération. Traduire
 *     demanderait un dictionnaire de tous les libellés IA, qu'aucune charge
 *     relevée n'énumère — en inventer la moitié ferait afficher `MONEY_REQUEST`
 *     tel quel sur le premier libellé non prévu.
 */
export interface D05Data {
  readonly dossier: {
    /** « Publication » — `subjectType` dans les mots de la maquette. */
    readonly sujet: string;
    /** « 1 » à « 5 ». */
    readonly priorite: string;
    /** « dépassé », « bientôt dépassé » ou « respecté » — calculé par le SERVEUR. */
    readonly slaEtat: string;
  };
}

/**
 * D10 — les services (`/admin/services`, 10 §4.1).
 *
 * UN SEUL NOMBRE : le compte des justificatifs pro EN ATTENTE.
 *
 * ─── IL EST COMPTÉ EN SUIVANT LE CURSEUR, ET C'EST POSSIBLE ICI ───────────────
 *
 * `GET /admin/pro-profiles` pagine HONNÊTEMENT — `take: query.limit + 1` puis
 * `buildPage`, donc un `nextCursor` non nul quand il reste des pages. On peut donc
 * compter en suivant le curseur jusqu'au bout, ce qui est la seule façon d'être
 * complet sans `meta.count`.
 *
 * Ce n'est PAS le cas de toutes les listes de ce module, et c'est pourquoi la
 * remarque est ici : cinq routes d'équipe appliquent `take: query.limit` puis
 * rendent `nextCursor: null` EN DUR, donc tronquent en affirmant la fin. Le détail
 * est dans `appels.ts`, au-dessus de `lireToutesLesVilles`, qui en est la victime.
 *
 * ─── CE QUI N'EST PAS LIÉ ─────────────────────────────────────────────────────
 *
 *   · la LIGNE de justificatif (« MB · Me Mariam Bah · Avocate · carte
 *     professionnelle ») est une liste, et le TYPE du justificatif n'est pas servi :
 *     `proof` porte `mime`, `sizeBytes`, `status` et `storageKey`, pas « carte
 *     professionnelle ». Lier le nom laisserait le type figé sur toutes les lignes ;
 *   · ANNONCES LOGEMENT À RISQUE — aucune route d'équipe ne sert la file de risque
 *     logement. Les scores (82, 61) et les indices (« prix bas · compte récent ·
 *     photos réutilisées ») viennent de `housing.risk_weights`, qui est un RÉGLAGE
 *     de pondération, pas une liste d'annonces scorées ;
 *   · BORNES DE PRIX PAR VILLE — `GET /admin/settings` sert `housing.price_bounds`,
 *     mais c'est UNE SEULE paire GLOBALE (`minCents: 15000`, `maxCents: 800000`).
 *     La maquette dessine un tableau par VILLE et par TYPE de logement (chambre,
 *     studio, T2), soit six valeurs pour deux villes. Cette granularité n'existe
 *     pas. Lier la paire globale dans six cases serait inventer six bornes.
 */
export interface D10Data {
  readonly justificatifs: {
    /** Les fiches pro en attente de validation, comptées en entier. */
    readonly enAttente: string;
  };
}

/**
 * ─── LES SIX SQUELETTES : LE CADRE SE REND TOUT DE SUITE, LA DONNÉE ARRIVE APRÈS ─
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CINQ ROUTES D'ÉQUIPE SUR DIX SERVAIENT UNE COQUILLE VIDE, et ce sont    │
 * │ exactement les cinq qui lisent des données. Mesuré sans exécuter de      │
 * │ JavaScript : `/admin`, `/admin/moderation`, `/admin/referentiels`,       │
 * │ `/admin/services` et `/admin/impact` servaient DEUX mots visibles        │
 * │ (« Administration Chargement… ») et ZÉRO entrée de rail, là où           │
 * │ `/admin/etapes` en servait 126 et 14.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La cause n'était pas la navigation : la page répondait 200 et les liens EXISTENT
 * dans le cadre généré. C'est le CADRE qui n'était pas rendu — la branche d'attente
 * de `ecran-donnees.tsx` remplaçait l'écran entier, rail compris, et sa branche
 * d'échec faisait pareil : un chargement raté laissait le membre de l'équipe sans
 * aucune navigation.
 *
 * Le motif correct existait déjà dans le dépôt, et c'est celui d'`app/(app)/accueil` :
 * « ce qui reste importé de `data.ts` est le DESSIN que la maquette calcule […] et
 * il n'a aucune raison de venir du serveur ». Les six cadres d'équipe branchés sont
 * des fonctions PURES de leurs props — le rail, l'en-tête de recherche et les
 * colonnes y sont dessinés sans condition, et les props ne remplissent que des
 * cellules de contenu. Il suffit donc de leur donner tout de suite des props
 * d'attente pour que le cadre entier soit servi, et de ne remplacer que le contenu
 * quand la réponse arrive.
 *
 * ─── CE QUE CES VALEURS ONT LE DROIT D'ÊTRE ────────────────────────────────────
 *
 * `10 Administration` NE DESSINE NI ATTENTE NI ÉCHEC : aucune de ses dix-huit
 * planches ne montre de squelette. Ces valeurs sont donc la seule chose de ces
 * écrans qui ne soit pas transcodée, et la liberté est bornée à la ZONE DE CONTENU
 * — le rail, l'en-tête et les colonnes restent exactement ce que la maquette
 * dessine, puisque rien ici ne les touche.
 *
 * `ATTENTE` est un TIRET CADRATIN, et c'est le seul choix qui ne mente pas :
 *
 *   · un ZÉRO serait un nombre. « Inscrits 0 » est faux et se lit comme vrai —
 *     c'est la faute que `appels.ts` refuse carte par carte ;
 *   · une CHAÎNE VIDE laisserait une cellule nue, donc indiscernable d'un libellé
 *     qu'on aurait oublié de brancher ;
 *   · le tiret est la convention du produit pour « rien à afficher ici », et il ne
 *     peut être confondu avec aucune mesure.
 *
 * AUCUN HEXADÉCIMAL N'EST INTRODUIT ICI, et c'est vérifiable d'un coup d'œil : ces
 * six objets ne portent que du texte et une liste vide. `VilleD08` exige bien deux
 * couleurs de pastille, mais `SQUELETTE_D08` ne sert AUCUNE ville — donc aucune
 * couleur n'a eu à être choisie, ni a fortiori assombrie.
 */
const ATTENTE = '—';

/** D02 — les cinq cartes liées du tableau de bord, en attente. */
export const SQUELETTE_D02: D02Data = {
  membres: { inscrits: ATTENTE, actifs30j: ATTENTE, niveau2: ATTENTE },
  parcours: { crees: ATTENTE, actifs: ATTENTE, aboutis: ATTENTE, enPause: ATTENTE },
  entraide: { ouvertes: ATTENTE, resolues: ATTENTE, delaiMedian: ATTENTE },
  guides: { publies: ATTENTE, aVerifier: ATTENTE },
  services: { annonces: ATTENTE, fichesPro: ATTENTE },
};

/** D04 — le seul nombre lié de la file de modération, en attente. */
export const SQUELETTE_D04: D04Data = { file: { ouverts: ATTENTE } };

/** D05 — le sous-titre du dossier, en attente. */
export const SQUELETTE_D05: D05Data = {
  dossier: { sujet: ATTENTE, priorite: ATTENTE, slaEtat: ATTENTE },
};

/**
 * D08 — les référentiels, en attente.
 *
 * `villes: []` et non une ville d'exemple : le cadre généré itère
 * `(villes ?? []).map(…)`, donc une liste vide rend l'en-tête du tableau et tout
 * le reste de la planche SANS inventer de ligne. Une ligne d'attente, elle, aurait
 * nommé une ville qui n'existe pas — et avec son nombre de membres.
 *
 * C'est aussi ce qui garde ce squelette SANS COULEUR : `VilleD08` impose
 * `statutFond` et `statutTexte` à chaque ligne, et une ligne d'attente aurait donc
 * obligé à choisir deux hexadécimaux que la maquette ne dessine pour aucun état
 * d'attente. Zéro ligne, zéro couleur à inventer.
 */
export const SQUELETTE_D08: D08Data = {
  villes: [],
  activation: { ville: ATTENTE, membres: ATTENTE },
};

/** D10 — le compte des justificatifs pro, en attente. */
export const SQUELETTE_D10: D10Data = { justificatifs: { enAttente: ATTENTE } };

/** D16 — les cinq nombres et le trimestre du rapport d'impact, en attente. */
export const SQUELETTE_D16: D16Data = {
  impact: {
    membres: ATTENTE,
    parcours: ATTENTE,
    presences: ATTENTE,
    entraides: ATTENTE,
    parrainages: ATTENTE,
    trimestre: ATTENTE,
  },
};
