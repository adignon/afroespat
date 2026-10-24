/**
 * Données des écrans D01 à D16, reprises de `docs/template/10 Administration.dc.html`.
 *
 * Seul D02 garde des données ici : les autres écrans (D03 à D16) ont leur composant
 * (`components/admin/ecrans/*`) et leurs schémas dans `@app/shared`.
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
  /** Aucun bloc ne porte la moindre mesure : base neuve, `metric_snapshots` vide. */
  readonly aucuneMesure: boolean;
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
  aucuneMesure: false,
  membres: { inscrits: ATTENTE, actifs30j: ATTENTE, niveau2: ATTENTE },
  parcours: { crees: ATTENTE, actifs: ATTENTE, aboutis: ATTENTE, enPause: ATTENTE },
  entraide: { ouvertes: ATTENTE, resolues: ATTENTE, delaiMedian: ATTENTE },
  guides: { publies: ATTENTE, aVerifier: ATTENTE },
  services: { annonces: ATTENTE, fichesPro: ATTENTE },
};
