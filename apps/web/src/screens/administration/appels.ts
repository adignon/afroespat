'use client';

import {
  DASHBOARD_BLOCKS,
  DASHBOARD_METRICS,
  adminDashboardResponseSchema,
  type AdminDashboardResponse,
  type MetricPoint,
} from '@app/shared';
/**
 * Chemin RELATIF, et non l'alias `@/` : c'est ce qu'emploient tous les modules de
 * ce dépôt qui portent un test unitaire (`screens/reseaux/from-api.ts`,
 * `screens/accueil/…`). `apps/web/vitest.config.ts` ne déclare pas `resolve.alias`,
 * donc un import en `@/` se résout sous Next mais PAS sous Vitest — et la dérivation
 * de cet écran doit être éprouvable. Le relatif marche sous les deux.
 */
import { staffApi } from '../../lib/api/index';
import type { D02Data } from './data';

/**
 * LES APPELS DU TABLEAU DE BORD D02 — le domaine ÉQUIPE, et lui seul.
 *
 * (Lot « administration vivante » : D03 à D16 chargent désormais leurs données dans
 * `components/admin/ecrans/*`, avec le client `staffApi` et les schémas de `@app/shared`.
 * Seul D02, dont le contenu reste celui de la maquette, garde ses vues ici.)
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
 * ── D02 EST EN LECTURE SEULE, ET C'EST SA NATURE ────────────────────────────
 *
 * Un tableau de bord n'écrit rien. Les écritures d'équipe (15 §2.3 : toutes tracées par
 * `AuditService.record()` dans la même transaction) vivent dans les écrans D03 à D16.
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

