'use client';

import {
  DASHBOARD_BLOCKS,
  DASHBOARD_METRICS,
  IMPACT_METRICS,
  MAX_PAGE_LIMIT,
  adminCitiesResponseSchema,
  adminDashboardResponseSchema,
  adminImpactResponseSchema,
  adminModerationCaseDetailSchema,
  adminModerationStatsResponseSchema,
  adminProProfilesResponseSchema,
  type AdminCitiesResponse,
  type AdminCity,
  type AdminDashboardResponse,
  type AdminModerationCaseDetail,
  type AdminModerationStatsResponse,
  type MetricPoint,
  type ReportSubjectType,
} from '@app/shared';
/**
 * Chemin RELATIF, et non l'alias `@/` : c'est ce qu'emploient tous les modules de
 * ce dépôt qui portent un test unitaire (`screens/reseaux/from-api.ts`,
 * `screens/accueil/…`). `apps/web/vitest.config.ts` ne déclare pas `resolve.alias`,
 * donc un import en `@/` se résout sous Next mais PAS sous Vitest — et la dérivation
 * de cet écran doit être éprouvable. Le relatif marche sous les deux.
 */
import { staffApi } from '../../lib/api/index';
import type { D02Data, D04Data, D05Data, D08Data, D10Data, D16Data, VilleD08 } from './data';

/**
 * LES APPELS DES ÉCRANS D01 À D16 — le domaine ÉQUIPE, et lui seul.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE FICHIER N'IMPORTE QUE `staffApi`. Pas `memberApi`, pas `fetchMe`, pas │
 * │ `session.ts`. C'est la règle dure 15 §2.1 tenue à l'endroit où elle se   │
 * │ romprait le plus facilement : la couche d'appel.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Et ce n'est pas qu'une consigne qu'on se donne. `staffApi` ne PEUT PAS atteindre
 * le domaine membre, par trois faits indépendants décrits dans
 * `lib/api/domains.ts` — le type (`/admin/…` ne compile pas), la base (tous les
 * chemins atterrissent sous `/v1/admin`, `/me` est inexprimable) et le transport
 * (`staff.ts` n'importe pas `session.ts` et reçoit `{ kind: 'cookie' }`, un
 * descripteur qui ne contient AUCUNE fonction capable de rendre le jeton).
 *
 * Conséquence à retenir avant d'ajouter une ligne ici : un en-tête `Authorization`
 * sur une route d'équipe n'est pas une erreur à éviter, c'est une erreur
 * INEXPRIMABLE. Si vous avez besoin d'une donnée de membre sur un écran d'équipe,
 * la route est mal rangée côté API — remontez-le, ne la contournez pas.
 *
 * ── LES CHEMINS S'ÉCRIVENT SANS `/admin` ────────────────────────────────────
 *
 *     staffApi.get('/ref/cities', …)   →  GET /v1/admin/ref/cities
 *
 * Le client pose le préfixe. `StaffOnly<P>` refuse `/admin/…` à la compilation,
 * pour que le préfixe ne soit pas écrit deux fois — ce qui ne donnerait qu'un 404
 * sans cause lisible.
 *
 * ── TOUT APPEL PORTE UN SCHÉMA, ET IL VIENT DE `@app/shared` ────────────────
 *
 * Il n'existe aucune variante sans schéma. Les schémas de RÉPONSE de ce lot ont
 * été écrits dans `packages/shared`, à côté des schémas de requête de leur module
 * — `adminCitySchema` dans `validation/referentials.ts` — parce que §4 fait de
 * `packages/shared` la source unique et qu'un schéma recopié dans le front est une
 * deuxième définition qui divergera.
 *
 * Ils ont été RELEVÉS SUR L'API QUI TOURNE, avec une vraie session d'équipe
 * (mot de passe argon2id puis TOTP), et non déduits des services : vingt villes
 * réelles, `isPilot` à `true` sur Paris. La nullabilité, elle, suit le schéma
 * Prisma et non l'échantillon — `region` est `String?` même si les vingt villes
 * relevées en portent une.
 *
 * ── ON DÉCIDE SUR `error.code`, JAMAIS SUR LE STATUT ────────────────────────
 *
 * Mesuré sur ce projet : `FORBIDDEN_WORD` répond 400 chez les pros et 422 chez les
 * guides ; `WEBHOOK_SIGNATURE_INVALID` répond 401 chez Didit et 400 chez Stripe. Un
 * aiguillage sur le statut est donc faux par construction. Dans ce module, le cas
 * qui mord est `STAFF_SESSION_REQUIRED` et `CROSS_DOMAIN_TOKEN` : même statut 401,
 * même message serveur, deux incidents opposés — voir `ecran-donnees.tsx`.
 *
 * ── AUCUNE ÉCRITURE N'EST BRANCHÉE, ET C'EST UNE DÉCISION ───────────────────
 *
 * 15 §2.3 est une règle dure : « toute écriture depuis l'application admin passe
 * par `AuditService.record()` avant validation de la transaction ». Un bouton qui
 * n'écrit rien n'est donc pas un bouton inoffensif — c'est une action non tracée
 * que l'équipe croira avoir faite. Activer une ville crée son réseau et y rattache
 * les membres ; appliquer une sanction touche un membre. Les boutons restent
 * inertes jusqu'à ce que leur écriture soit branchée pour de bon.
 */

// ─── Mise en forme ───────────────────────────────────────────────────────────

/**
 * Un entier dans les mots de la maquette : « 1 400 ».
 *
 * `Intl` plutôt qu'une concaténation : le séparateur de milliers français est une
 * espace fine insécable, pas une espace ordinaire, et l'écrire à la main produit
 * une coupure de ligne au milieu d'un nombre.
 */
const nombreFr = new Intl.NumberFormat('fr-FR');
const nombre = (n: number): string => nombreFr.format(n);

// ─── Les couleurs des pastilles, RELEVÉES SUR LA MAQUETTE ────────────────────
//
// Les trois paires sont celles que `10 Administration` dessine sur ses propres
// lignes de D08. Aucune n'est modifiée : les assombrir pour gagner du contraste
// est précisément ce que le porteur a refusé, et le garde-fou du dépôt tient à
// 16/24 — un hexadécimal retouché arrête la génération.

const VILLE_ACTIVE = { fond: '#E3F0EB', texte: '#0F5C48' } as const;
const VILLE_BIENTOT = { fond: '#FBE3D4', texte: '#B4581F' } as const;
const VILLE_DOUBLON = { fond: '#F2F5F4', texte: '#5D6B66' } as const;

// ─── D08 · /admin/referentiels ───────────────────────────────────────────────

/**
 * Le nombre de pages que l'on accepte de suivre avant de REFUSER.
 *
 * ── POURQUOI UNE BORNE, ET POURQUOI ELLE DOIT ÉCHOUER FORT ─────────────────
 *
 * Le premier réflexe était `?limit=50` — la borne maximale de §5.3 — et de servir
 * ce qui vient. C'est la faute que ce projet a déjà payée : une borne écrite à la
 * main devient FAUSSE PAR ACCUMULATION. Le référentiel des villes de France en
 * compte des milliers ; le jour où il dépasse la première page, l'écran D08
 * afficherait cinquante villes sur deux mille et aurait l'air parfaitement normal.
 * Personne ne regarde un tableau pour vérifier qu'il est complet.
 *
 * On suit donc le curseur jusqu'au bout — c'est la seule façon d'être complet — et
 * la borne porte sur le NOMBRE DE PAGES, pour qu'une pagination cassée côté serveur
 * ne fasse pas tourner le navigateur à l'infini. L'atteindre n'est pas une
 * troncature silencieuse : c'est une exception NOMMÉE, qui dit le nombre de pages,
 * le nombre de villes déjà lues et quoi faire. Elle remonte dans
 * `EcranDonneesEquipe`, qui l'affiche.
 *
 * Vingt pages de cinquante font mille villes. Si le référentiel les dépasse pour de
 * bon, ce tableau n'est plus la bonne forme et il faut une pagination à l'écran —
 * que la maquette ne dessine pas. C'est alors au porteur de trancher, et cette
 * erreur est ce qui le lui apprendra.
 */
const PAGES_VILLES_MAX = 20;

/**
 * Toutes les villes, en suivant le curseur.
 *
 * La pagination est par CURSEUR et jamais par décalage (§5.3) : on repasse le
 * `nextCursor` opaque tel quel, sans le lire ni le fabriquer.
 */
async function lireToutesLesVilles(): Promise<readonly AdminCity[]> {
  const villes: AdminCity[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < PAGES_VILLES_MAX; page += 1) {
    /**
     * Les deux annotations ne sont pas décoratives : sans elles, `tsc` refuse
     * (TS7022). `cursor` est réaffecté depuis `reponse.nextCursor`, donc son type
     * dépend de celui de `reponse`, qui dépend du chemin — une boucle d'inférence
     * que le compilateur ne sait pas dénouer seul. L'annoter la coupe, et c'est
     * préférable à un `any` qui aurait fait taire la frontière de validation.
     */
    const chemin: string =
      cursor === null
        ? `/ref/cities?limit=${MAX_PAGE_LIMIT}`
        : `/ref/cities?limit=${MAX_PAGE_LIMIT}&cursor=${encodeURIComponent(cursor)}`;
    const reponse: AdminCitiesResponse = await staffApi.get(chemin, adminCitiesResponseSchema);
    villes.push(...reponse.items);
    if (reponse.nextCursor === null) return villes;
    cursor = reponse.nextCursor;
  }

  throw new Error(
    `Le référentiel des villes dépasse ${PAGES_VILLES_MAX} pages de ${MAX_PAGE_LIMIT} ` +
      `(${villes.length} villes lues et il en reste). D08 dessine un tableau sans ` +
      `pagination : il n’est plus la bonne forme pour ce volume. À trancher par le ` +
      `porteur — on refuse plutôt que d’afficher un tableau incomplet qui aurait l’air normal.`,
  );
}

/**
 * Une ville, dans les mots et les couleurs de la maquette.
 *
 * ─── L'ORDRE DES TROIS CAS N'EST PAS INDIFFÉRENT ───────────────────────────
 *
 * Un doublon se teste EN PREMIER : une ville fusionnée reste `isActive` en base, et
 * tester l'activité d'abord lui donnerait « Active » plus le bouton « Fusionner »,
 * c'est-à-dire la proposition de fusionner ce qui est déjà fusionné.
 *
 * ─── OÙ `isPilot` S'AFFICHE, ET POURQUOI LÀ ────────────────────────────────
 *
 * `isPilot` était rendu par l'API et affiché par personne. Il apparaît dans le
 * LIBELLÉ de la pastille, qui est déjà une donnée, parce que la maquette ne dessine
 * pas de pastille « pilote » et que lui en ajouter une serait dessiner à la place du
 * porteur.
 *
 * Il ne se substitue à « Active » QUE sur une ville effectivement ouverte, et c'est
 * le point délicat : `isPilot` est dérivé du SLUG (`PILOT_CITY_SLUG`, « paris »),
 * pas de l'ouverture. Une ville pilote pas encore ouverte existe donc, et afficher
 * « Pilote » dessus laisserait croire qu'elle est en service. Elle porte « Bientôt »,
 * comme les autres villes fermées — ce qui est vrai — et « Pilote » n'apparaît que
 * là où il implique « ouverte ».
 */
function vueVille(ville: AdminCity, parId: ReadonlyMap<string, string>): VilleD08 {
  const doublon = ville.mergedIntoCityId !== null;

  const pastille = doublon
    ? { libelle: 'Doublon', ...VILLE_DOUBLON }
    : ville.isActive
      ? { libelle: ville.isPilot ? 'Pilote' : 'Active', ...VILLE_ACTIVE }
      : { libelle: 'Bientôt', ...VILLE_BIENTOT };

  return {
    nom: ville.name,
    /** Nulle au schéma Prisma (`String?`) : un tiret, jamais « null » à l'écran. */
    region: ville.region ?? '—',
    membres: nombre(ville.memberCount),
    statut: pastille.libelle,
    statutFond: pastille.fond,
    statutTexte: pastille.texte,
    fusionnable: !doublon && ville.isActive,
    activable: !doublon && !ville.isActive,
    doublon,
    /**
     * Le nom de la ville absorbante, résolu DANS la liste déjà chargée.
     *
     * Aucun appel de plus : la cible d'une fusion est une ville du même
     * référentiel, et on vient de le lire en entier. Si elle manque quand même, on
     * écrit un tiret plutôt que d'inventer un nom — « Fusionner avec Lyon » sur une
     * ville qui n'a pas fusionné avec Lyon serait pire qu'un tiret.
     */
    fusionneAvec:
      ville.mergedIntoCityId === null ? '' : (parId.get(ville.mergedIntoCityId) ?? '—'),
  };
}

/**
 * D08 — le tableau des villes et la carte d'activation.
 *
 * LA VILLE CANDIDATE est celle qui a le PLUS DE MEMBRES parmi les villes fermées,
 * et ce choix se justifie : 02 §4.2 ouvre une ville « en général à 20 membres »,
 * donc la prochaine à ouvrir est la plus peuplée de celles qui attendent. Prendre
 * la première de la liste aurait donné une ville au hasard de l'ordre alphabétique
 * — exactement le défaut de tri que ce dépôt a déjà rencontré.
 */
export async function chargerD08(): Promise<D08Data> {
  const villes = await lireToutesLesVilles();
  const parId = new Map(villes.map((v) => [v.id, v.name]));

  const candidate = villes
    .filter((v) => !v.isActive && v.mergedIntoCityId === null)
    .reduce<AdminCity | null>(
      (meilleure, v) => (meilleure === null || v.memberCount > meilleure.memberCount ? v : meilleure),
      null,
    );

  return {
    villes: villes.map((v) => vueVille(v, parId)),
    /**
     * Aucune ville à ouvrir est un cas NORMAL — c'est même l'état souhaitable. La
     * maquette dessine la carte en dur, sans `<sc-if>` : on ne peut pas la masquer
     * sans redessiner, donc elle dit qu'il n'y a rien plutôt que « undefined ».
     */
    activation:
      candidate === null
        ? { ville: '—', membres: '0' }
        : { ville: candidate.name, membres: nombre(candidate.memberCount) },
  };
}

// ─── D16 · /admin/impact ─────────────────────────────────────────────────────

/**
 * Lit UNE mesure, et REFUSE si elle manque.
 *
 * ── POURQUOI PAS `?? 0`, QUI ÉTAIT LE PREMIER RÉFLEXE ──────────────────────
 *
 * Un rapport d'impact qui affiche « 0 parcours aboutis » parce que le nom de la
 * mesure est mal orthographié est indiscernable d'un rapport qui affiche « 0 »
 * parce qu'aucun parcours n'a abouti. Le premier est un bogue, le second un fait,
 * et c'est un document qui sort de l'entreprise — §5.3 en fait un rapport
 * exportable en PDF.
 *
 * Zéro est donc une VALEUR, pas un repli. Une mesure absente de la réponse est un
 * désaccord de contrat, et elle lève — avec le nom de la mesure et la liste de ce
 * que l'API a réellement envoyé, pour que la correction prenne une minute et non
 * une heure.
 *
 * `dimension: ''` est exigée : ces cinq mesures ne sont pas ventilées. Sans ce
 * filtre, une mesure qui se mettrait à l'être rendrait la PREMIÈRE ventilation
 * venue — « les parcours aboutis à Lyon » affichés comme le total national.
 */
function mesure(items: readonly MetricPoint[], nom: string): number {
  const point = items.find((p) => p.metric === nom && p.dimension === '');
  if (point === undefined) {
    throw new Error(
      `La mesure « ${nom} » manque à la réponse de GET /admin/impact. Le rapport ` +
        `d’impact n’affiche pas zéro à sa place : zéro est un fait, pas une absence. ` +
        `Mesures reçues : ${items.map((p) => p.metric).join(', ') || '(aucune)'}.`,
    );
  }
  return point.value;
}

/**
 * « 2026-T3 » → « T3 2026 », l'ordre que la maquette écrit.
 *
 * Le trimestre vient du SERVEUR et n'est jamais déduit de l'horloge du
 * navigateur : un rapport trimestriel daté par la machine du lecteur changerait de
 * titre selon qui l'ouvre, et deux exports du même rapport ne porteraient pas le
 * même nom.
 *
 * Une forme inattendue est rendue TELLE QUELLE plutôt que réarrangée au hasard :
 * si l'API change sa convention, mieux vaut lire « 2027-S1 » que « S1 2027 » obtenu
 * par un découpage qui a deviné.
 */
function trimestreFr(brut: string): string {
  const m = /^(\d{4})-(T[1-4])$/.exec(brut);
  return m === null ? brut : `${m[2]} ${m[1]}`;
}

/**
 * D16 — le rapport d'impact.
 *
 * UNE SEULE ROUTE, et c'est notable : `GET /admin/impact` rend les cinq nombres
 * de la première planche d'un coup. La réserve inscrite dans ce module — « les
 * chiffres viennent de `metric_snapshots`, table absente du schéma » — était
 * FAUSSE : la route répond 200 et la table existe. Vérifié plutôt que repris.
 */
export async function chargerD16(): Promise<D16Data> {
  const rapport = await staffApi.get('/impact', adminImpactResponseSchema);
  const { items } = rapport;

  return {
    impact: {
      membres: nombre(mesure(items, IMPACT_METRICS.membresAccompagnes)),
      parcours: nombre(mesure(items, IMPACT_METRICS.parcoursAboutis)),
      presences: nombre(mesure(items, IMPACT_METRICS.presences)),
      entraides: nombre(mesure(items, IMPACT_METRICS.entraidesResolues)),
      parrainages: nombre(mesure(items, IMPACT_METRICS.parrainagesAboutis)),
      trimestre: trimestreFr(rapport.trimestre),
    },
  };
}

// ─── D02 · /admin — le tableau de bord ───────────────────────────────────────

/**
 * UN SEUL APPEL, et c'est une décision de SÉCURITÉ, pas d'économie.
 *
 * `GET /admin/dashboard` est ouvert aux QUATRE rôles (`STAFF_SCOPES.dashboard` :
 * SUPER_ADMIN, CONTENT_ADMIN, MODERATOR, SUPPORT). Les nombres qui manquent aux
 * cartes de D02 vivent dans des routes PLUS RESTREINTES —
 * `GET /admin/moderation/stats` exclut `SUPPORT`, `GET /admin/ref/cities` exige
 * `content` (SUPER_ADMIN ou CONTENT_ADMIN).
 *
 * Les appeler d'ici pour compléter une carte rendrait le tableau de bord 403 pour
 * des rôles que §2.2 autorise à le voir. Un écran ne doit JAMAIS exiger plus de
 * privilège que ce qu'il affiche : c'est la règle dure « aucune donnée personnelle
 * au-delà de ce que le rôle permet » prise par l'autre bout — ici ce n'est pas une
 * fuite, c'est un refus de service, et il serait invisible pour qui développe en
 * SUPER_ADMIN.
 *
 * D'où la règle inscrite dans `data.ts` : une carte n'est liée que si CETTE route
 * porte chacun de ses nombres. Les sept autres restent dessinées.
 */

/**
 * Un bloc que l'écran ATTEND, et qui doit donc être là.
 *
 * `adminDashboardResponseSchema` valide la FORME (`z.record`, parce que le serveur
 * décide des blocs et qu'un douzième ne doit pas arrêter le tableau de bord).
 * Ici on exige le CONTENU dont l'écran dépend : un bloc attendu qui manque est un
 * désaccord de contrat, et il lève avec la liste de ce que l'API a réellement
 * envoyé.
 *
 * Pas de `?? []` : un bloc absent rendu comme un bloc vide donnerait « 0 inscrit »
 * sur un tableau de bord d'apparence normale. C'est le raisonnement de `mesure()`
 * ci-dessus, au niveau du bloc.
 */
function bloc(reponse: AdminDashboardResponse, nom: string): readonly MetricPoint[] {
  const points = reponse.blocks[nom];
  if (points === undefined) {
    throw new Error(
      `Le bloc « ${nom} » manque à la réponse de GET /admin/dashboard. Le tableau de ` +
        `bord n’affiche pas zéro à sa place : zéro est un fait, pas une absence. ` +
        `Blocs reçus : ${Object.keys(reponse.blocks).join(', ') || '(aucun)'}.`,
    );
  }
  return points;
}

/**
 * La mesure GLOBALE d'un bloc — celle dont la ventilation est vide.
 *
 * Même exigence que `mesure()` : une mesure absente LÈVE. `dimension: ''` est la
 * tranche globale, et l'exiger empêche de rendre la première ventilation venue à
 * la place du total.
 */
function globale(points: readonly MetricPoint[], nom: string): number {
  const point = points.find((p) => p.metric === nom && p.dimension === '');
  if (point === undefined) {
    throw new Error(
      `La mesure « ${nom} » manque au bloc lu de GET /admin/dashboard. Zéro est un ` +
        `fait, pas une absence. Mesures reçues : ` +
        `${points.map((p) => p.metric).join(', ') || '(aucune)'}.`,
    );
  }
  return point.value;
}

/**
 * UNE TRANCHE d'une mesure ventilée — et ici, l'absence VEUT DIRE ZÉRO.
 *
 * ── POURQUOI LA RÈGLE S'INVERSE, ET POURQUOI CE N'EST PAS UN RELÂCHEMENT ────
 *
 * `globale()` lève sur une mesure absente ; celle-ci rend 0 sur une TRANCHE
 * absente. La différence n'est pas de rigueur, elle est de nature, et elle est
 * mesurable sur la charge relevée : `journeys.by_status` arrive avec la SEULE
 * dimension `ACTIVE`, parce que ces mesures sont des `GROUP BY` — un seau vide ne
 * produit aucune ligne. `COMPLETED` absent veut donc dire « aucun parcours
 * abouti », ce qui est un FAIT, et lever dessus arrêterait le tableau de bord
 * d'une plateforme jeune où presque tous les seaux sont vides.
 *
 * Ce qui reste gardé est le NOM DE LA MESURE : si `journeys.by_status` n'apparaît
 * sur AUCUNE ligne, c'est un désaccord de contrat — un nom mal orthographié, une
 * mesure renommée — et là on lève. Un nom introuvable et un seau vide ne se
 * confondent pas, et c'est exactement la distinction qu'un `?? 0` posé partout
 * aurait effacée.
 */
function tranche(points: readonly MetricPoint[], nom: string, dimension: string): number {
  if (!points.some((p) => p.metric === nom)) {
    throw new Error(
      `La mesure ventilée « ${nom} » ne figure sur AUCUNE ligne du bloc lu de ` +
        `GET /admin/dashboard — ce n’est pas une tranche vide, c’est un nom que ` +
        `l’API ne connaît pas. Mesures reçues : ` +
        `${[...new Set(points.map((p) => p.metric))].join(', ') || '(aucune)'}.`,
    );
  }
  return points.find((p) => p.metric === nom && p.dimension === dimension)?.value ?? 0;
}

/** La somme de toutes les tranches d'une mesure ventilée. */
function sommeDesTranches(points: readonly MetricPoint[], nom: string): number {
  if (!points.some((p) => p.metric === nom)) {
    throw new Error(
      `La mesure ventilée « ${nom} » ne figure sur aucune ligne du bloc lu de ` +
        `GET /admin/dashboard. Mesures reçues : ` +
        `${[...new Set(points.map((p) => p.metric))].join(', ') || '(aucune)'}.`,
    );
  }
  return points.filter((p) => p.metric === nom).reduce((t, p) => t + p.value, 0);
}

/**
 * Une part, dans les mots de la maquette : « 41 % ».
 *
 * ARRONDIE À L'ENTIER, comme la maquette l'écrit, et le dénominateur à zéro rend
 * « 0 % » plutôt que « NaN % » — une plateforme sans aucun membre est un état
 * normal le premier jour, pas une erreur.
 */
function part(numerateur: number, denominateur: number): string {
  if (denominateur === 0) return '0 %';
  return `${nombre(Math.round((numerateur / denominateur) * 100))} %`;
}

/**
 * Un délai en minutes, dans les mots de la maquette : « 19 h ».
 *
 * La maquette écrit des heures ; l'API sert des MINUTES
 * (`help.first_response_median_minutes`). Sous l'heure, on garde les minutes
 * plutôt que d'écrire « 0 h » — qui dirait « immédiat » là où le vrai délai est de
 * quarante minutes.
 */
function delai(minutes: number): string {
  if (minutes < 60) return `${nombre(Math.round(minutes))} min`;
  return `${nombre(Math.round(minutes / 60))} h`;
}

/**
 * D02 — les cinq cartes dont CHAQUE nombre est servi, DÉRIVÉES SANS APPEL.
 *
 * ── POURQUOI LA DÉRIVATION EST SÉPARÉE DE L'APPEL ──────────────────────────
 *
 * `chargerD02` ne fait que deux choses : appeler, puis passer la réponse ici.
 * Tout le jugement — quel bloc, quelle mesure, quelle tranche, quel arrondi —
 * est dans cette fonction PURE, et c'est ce qui la rend éprouvable sur la charge
 * RELEVÉE (`fixtures/admin_dashboard.json`, 7 905 octets pris sur l'API qui
 * tourne) plutôt que sur un objet façonné à la mesure du test.
 *
 * C'est la discipline des autres modules de ce dépôt — voir
 * `screens/reseaux/from-api.ts` et son test : charge réelle → schéma partagé →
 * prises du cadre, la chaîne complète et non les convertisseurs seuls.
 *
 * Les sept autres cartes restent dessinées, et `data.ts` dit laquelle à cause de
 * quel nombre manquant. Rien n'est recollé depuis une autre route : voir
 * l'en-tête de cette section.
 */
export function vueD02(reponse: AdminDashboardResponse): D02Data {
  const membres = bloc(reponse, DASHBOARD_BLOCKS.membres);
  const parcours = bloc(reponse, DASHBOARD_BLOCKS.parcours);
  const entraide = bloc(reponse, DASHBOARD_BLOCKS.entraide);
  const guides = bloc(reponse, DASHBOARD_BLOCKS.guides);
  const services = bloc(reponse, DASHBOARD_BLOCKS.services);

  /**
   * « Niveau 2 » est une PART, et son dénominateur est la somme des niveaux — pas
   * `members.registered`. Les deux diffèrent : un membre supprimé sort du compte
   * des inscrits sans forcément sortir de la ventilation par niveau, et rapporter
   * L2 à un total pris ailleurs donnerait une part fausse sans que rien ne le
   * dise. On rapporte la tranche à la somme des tranches de la MÊME mesure.
   */
  const niveaux = sommeDesTranches(membres, DASHBOARD_METRICS.membresParNiveau);

  return {
    membres: {
      inscrits: nombre(globale(membres, DASHBOARD_METRICS.membresInscrits)),
      actifs30j: nombre(globale(membres, DASHBOARD_METRICS.membresActifs30j)),
      niveau2: part(tranche(membres, DASHBOARD_METRICS.membresParNiveau, 'L2'), niveaux),
    },
    parcours: {
      crees: nombre(sommeDesTranches(parcours, DASHBOARD_METRICS.parcoursParStatut)),
      actifs: nombre(tranche(parcours, DASHBOARD_METRICS.parcoursParStatut, 'ACTIVE')),
      aboutis: nombre(tranche(parcours, DASHBOARD_METRICS.parcoursParStatut, 'COMPLETED')),
      enPause: nombre(tranche(parcours, DASHBOARD_METRICS.parcoursParStatut, 'PAUSED')),
    },
    entraide: {
      ouvertes: nombre(tranche(entraide, DASHBOARD_METRICS.entraideParStatut, 'OPEN')),
      resolues: nombre(tranche(entraide, DASHBOARD_METRICS.entraideParStatut, 'RESOLVED')),
      delaiMedian: delai(globale(entraide, DASHBOARD_METRICS.entraideDelaiMedianMinutes)),
    },
    guides: {
      publies: nombre(tranche(guides, DASHBOARD_METRICS.guidesParStatut, 'PUBLISHED')),
      aVerifier: nombre(tranche(guides, DASHBOARD_METRICS.guidesParStatut, 'FLAGGED')),
    },
    services: {
      /**
       * Les annonces EN LIGNE : logements actifs plus emplois actifs.
       *
       * La maquette écrit « Annonces » sans dire si les expirées comptent. Les deux
       * mesures ventilent par statut et la charge relevée porte `EXPIRED` sur les
       * deux ; prendre la somme de TOUTES les tranches aurait donné le nombre
       * d'annonces jamais publiées, pas le nombre d'annonces. On prend les actives,
       * qui est ce qu'un tableau de bord d'aujourd'hui montre, et la lecture est
       * écrite ici pour que le porteur puisse la corriger d'une ligne.
       */
      annonces: nombre(
        tranche(services, DASHBOARD_METRICS.logementsParStatut, 'ACTIVE') +
          tranche(services, DASHBOARD_METRICS.emploisParStatut, 'ACTIVE'),
      ),
      fichesPro: nombre(tranche(services, DASHBOARD_METRICS.prosParVerification, 'APPROVED')),
    },
  };
}

/** D02 — l'appel, et rien d'autre : tout le jugement est dans `vueD02`. */
export async function chargerD02(): Promise<D02Data> {
  return vueD02(await staffApi.get('/dashboard', adminDashboardResponseSchema));
}

// ─── D04 · /admin/moderation ─────────────────────────────────────────────────

/**
 * D04 — le compte des dossiers DANS LA FILE.
 *
 * ─── POURQUOI `/moderation/stats` ET NON LA LONGUEUR DE LA LISTE ───────────
 *
 * Le réflexe est de compter `items.length` sur `GET /moderation/cases`. Il est
 * faux, et mesurablement : cette route pagine à `MAX_PAGE_LIMIT`, donc la
 * longueur plafonne à cinquante et afficherait « 50 dossiers ouverts » sur une
 * file de mille huit cent quarante-sept. Un plafond qui ressemble à un total est
 * exactement le défaut que ce dépôt a déjà payé.
 *
 * `openByPriority` est un `GROUP BY` sur toute la table, donc un vrai total, et
 * sa somme est le nombre de dossiers de la file. Les deux routes exigent le MÊME
 * jeu de rôles — MODERATOR, CONTENT_ADMIN, SUPER_ADMIN — donc l'appeler d'ici
 * n'interdit l'écran à personne qui y aurait droit. C'est la vérification que D02
 * a rendue obligatoire : on compare les rôles AVANT d'ajouter un appel.
 *
 * ── `OPEN` + `IN_REVIEW`, ET C'EST LE BON COMPTE POUR CET ÉCRAN ────────────
 *
 * `openByPriority` compte les statuts `OPEN` et `IN_REVIEW` (vérifié dans
 * `ModerationService.stats`). Sa somme est donc à 1847 quand
 * `moderation.cases_by_status/OPEN` du tableau de bord est à 1811 : 36 dossiers
 * sont en cours d'examen. Les deux nombres sont justes ; celui-ci est celui de la
 * FILE, et la file est ce que cet écran montre. Prendre l'autre aurait fait
 * disparaître du compteur trente-six dossiers qui sont bien dans le tableau.
 */
export function vueD04(stats: AdminModerationStatsResponse): D04Data {
  const ouverts = Object.values(stats.openByPriority).reduce((t, n) => t + n, 0);
  return { file: { ouverts: nombre(ouverts) } };
}

export async function chargerD04(): Promise<D04Data> {
  return vueD04(await staffApi.get('/moderation/stats', adminModerationStatsResponseSchema));
}

// ─── D05 · /admin/moderation/:id ─────────────────────────────────────────────

/**
 * Le type de contenu visé, dans les mots de la maquette.
 *
 * `ReportSubjectType` est une énumération FERMÉE de douze valeurs, et les douze
 * sont nommées ici — pas onze. Un `?? subjectType` en repli aurait affiché
 * `HELP_RESPONSE` en toutes lettres à un modérateur le jour où un dossier porte
 * ce type, et le défaut ne se serait vu que ce jour-là. L'exhaustivité est tenue
 * par le type : `Record<ReportSubjectType, string>` ne compile pas s'il en manque
 * une, donc l'ajout d'un treizième type au schéma Prisma arrête la compilation
 * ici plutôt que de produire une étiquette brute à l'écran.
 *
 * Les quatre mots que la maquette écrit elle-même — « Publication »,
 * « Annonce », « Message », « Commentaire », « Story » — sont repris
 * À L'IDENTIQUE. Les autres suivent le vocabulaire des maquettes de leur module.
 */
const SUJET_FR: Record<ReportSubjectType, string> = {
  POST: 'Publication',
  COMMENT: 'Commentaire',
  TOPIC: 'Sujet',
  GUIDE: 'Guide',
  HELP_REQUEST: 'Demande d’entraide',
  HELP_RESPONSE: 'Réponse d’entraide',
  HOUSING: 'Annonce',
  JOB: 'Offre d’emploi',
  PRO: 'Fiche pro',
  EVENT: 'Événement',
  MESSAGE: 'Message',
  USER: 'Membre',
};

/**
 * L'état du SLA, dans les mots de la maquette.
 *
 * La maquette n'écrit que « dépassé », parce qu'elle ne dessine qu'un dossier en
 * retard. Les deux autres états existent au serveur (`slaState` : `OK`,
 * `WARNING`, `OVERDUE`) et il faut bien les écrire quelque part — les laisser
 * tomber sur « dépassé » afficherait « SLA dépassé » sur un dossier dans les
 * délais, ce qui ferait traiter en urgence ce qui n'en est pas une.
 *
 * Ces deux mots sont donc du TEXTE QUI NE VIENT PAS DE LA MAQUETTE, et c'est dit
 * ici plutôt que glissé : ils sont inévitables dès lors que l'état est servi.
 *
 * L'ÉTAT EST CALCULÉ PAR LE SERVEUR et jamais ici : l'horloge du navigateur est
 * réglable, et un modérateur dont la machine est en retard ne doit pas voir
 * « respecté » sur un dossier hors délai. C'est écrit en toutes lettres au-dessus
 * de `slaState` dans `@app/shared`, et cet écran s'y tient.
 */
const SLA_FR = {
  OK: 'respecté',
  WARNING: 'bientôt dépassé',
  OVERDUE: 'dépassé',
} as const;

/**
 * D05 — le sous-titre du dossier, et lui seul.
 *
 * Les trois valeurs sont servies ; tout le reste de la planche ne l'est pas, et
 * `data.ts` dit quoi à cause de quel champ manquant. Le manque qui compte est le
 * CONTENU VISÉ : aucune route d'équipe ne le joint au dossier, donc l'écran qui
 * sert à décider d'une sanction ne peut pas montrer ce qu'il sanctionne.
 */
export function vueD05(dossier: AdminModerationCaseDetail): D05Data {
  /**
   * LES DEUX LIBELLÉS SONT EXIGÉS, PAS REPLIÉS.
   *
   * `Record<ReportSubjectType, string>` garantit l'exhaustivité à la COMPILATION :
   * ajouter un treizième type de sujet au schéma Prisma arrête `tsc` ici. Mais
   * `noUncheckedIndexedAccess` est actif dans ce dépôt, donc un accès indexé est
   * typé `string | undefined` même sur un dictionnaire exhaustif.
   *
   * On ne le fait pas taire par un `?? dossier.subjectType`, qui afficherait
   * `HELP_RESPONSE` en toutes lettres à un modérateur, ni par un `!`, qui
   * mentirait au compilateur. On REFUSE, en nommant la valeur reçue : si le
   * serveur se met à rendre un type que ce dictionnaire ne connaît pas, l'écran
   * s'arrête au lieu d'afficher une constante d'énumération dans une phrase
   * française.
   */
  const sujet = SUJET_FR[dossier.subjectType];
  if (sujet === undefined) {
    throw new Error(
      `GET /admin/moderation/cases/:id rend le type de sujet « ${dossier.subjectType} », ` +
        `que D05 ne sait pas écrire en français. Ajouter son libellé à SUJET_FR plutôt ` +
        `que d’afficher la constante d’énumération à un modérateur.`,
    );
  }

  const slaEtat = SLA_FR[dossier.sla];
  if (slaEtat === undefined) {
    throw new Error(
      `GET /admin/moderation/cases/:id rend l’état de SLA « ${dossier.sla} », inconnu de ` +
        `D05. Un état de SLA mal écrit ferait traiter en urgence un dossier dans les ` +
        `délais, ou l’inverse.`,
    );
  }

  return {
    dossier: { sujet, priorite: String(dossier.priority), slaEtat },
  };
}

export async function chargerD05(id: string): Promise<D05Data> {
  /**
   * Le chemin est CALCULÉ, donc `assertStaffPath` le contrôle à l'exécution :
   * `id` vient de l'URL, et un segment `..` y ferait sortir l'appel de `/v1/admin`
   * — le navigateur normalise avant d'émettre. Le type seul ne voit pas un chemin
   * calculé ; c'est exactement le cas pour lequel le contrôle existe.
   *
   * `encodeURIComponent` en plus : un identifiant qui porterait un `?` couperait
   * le chemin et interrogerait la liste au lieu du dossier.
   */
  return vueD05(
    await staffApi.get(
      `/moderation/cases/${encodeURIComponent(id)}`,
      adminModerationCaseDetailSchema,
    ),
  );
}

// ─── D10 · /admin/services ───────────────────────────────────────────────────

/**
 * Le nombre de pages de fiches pro que l'on suit avant de REFUSER.
 *
 * Même raisonnement que `PAGES_VILLES_MAX`, et même refus d'une borne qui
 * tronquerait en silence : on suit le curseur jusqu'au bout, et l'atteinte de la
 * borne LÈVE en nommant ce qu'elle a lu. Vingt pages de cinquante font mille
 * justificatifs en attente ; si la file les dépasse, ce n'est plus un compteur
 * qu'il faut mais une file paginée à l'écran, que la maquette ne dessine pas.
 */
const PAGES_PRO_MAX = 20;

/**
 * D10 — les justificatifs pro en attente, COMPTÉS en entier.
 *
 * ─── CETTE ROUTE PAGINE HONNÊTEMENT, ET C'EST CE QUI REND LE COMPTE POSSIBLE ─
 *
 * `AdminService.listProProfiles` fait `take: query.limit + 1` puis `buildPage` :
 * `nextCursor` est non nul tant qu'il reste des pages. Suivre le curseur donne
 * donc un vrai total, en l'absence de `meta.count`.
 *
 * Ce n'est pas vrai de toutes les listes de ce module — voir la note au-dessus de
 * `lireToutesLesVilles` — et c'est pourquoi la vérification a été faite AVANT
 * d'écrire ce compteur plutôt qu'après. Un compteur bâti sur une route qui
 * tronque en affirmant la fin aurait affiché « 50 » pour toujours.
 */
export async function chargerD10(): Promise<D10Data> {
  let total = 0;
  let cursor: string | null = null;

  for (let page = 0; page < PAGES_PRO_MAX; page += 1) {
    /** Les annotations coupent la boucle d'inférence — voir `lireToutesLesVilles`. */
    const chemin: string =
      cursor === null
        ? `/pro-profiles?status=PENDING&limit=${MAX_PAGE_LIMIT}`
        : `/pro-profiles?status=PENDING&limit=${MAX_PAGE_LIMIT}&cursor=${encodeURIComponent(cursor)}`;
    const reponse = await staffApi.get(chemin, adminProProfilesResponseSchema);
    total += reponse.items.length;
    if (reponse.nextCursor === null) return { justificatifs: { enAttente: nombre(total) } };
    cursor = reponse.nextCursor;
  }

  throw new Error(
    `La file des justificatifs pro dépasse ${PAGES_PRO_MAX} pages de ${MAX_PAGE_LIMIT} ` +
      `(${total} fiches lues et il en reste). D10 affiche un compteur, pas une file ` +
      `paginée : à ce volume ce n’est plus la bonne forme. À trancher par le porteur — ` +
      `on refuse plutôt que d’afficher un compte incomplet qui aurait l’air normal.`,
  );
}
