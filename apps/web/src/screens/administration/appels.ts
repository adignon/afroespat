'use client';

import {
  IMPACT_METRICS,
  MAX_PAGE_LIMIT,
  adminCitiesResponseSchema,
  adminImpactResponseSchema,
  type AdminCitiesResponse,
  type AdminCity,
  type MetricPoint,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import type { D08Data, D16Data, VilleD08 } from './data';

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
