'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  ApiShapeError,
  displayMessageFor,
  hasAccessToken,
  resumeSession,
} from '@/lib/api/index';
import type {
  GuideDetailResponse,
  GuideListResponse,
  GuideOutdatedResponse,
  GuideProposalsResponse,
  GuideVersionsResponse,
} from '@app/shared';
import {
  acceptProposal,
  amendProposal,
  fetchGuide,
  fetchGuides,
  fetchProposals,
  rejectProposal,
  fetchVersions,
  flagOutdated,
  removeOutdatedFlag,
  setCommunityMaintenance,
  unvoteGuide,
  voteGuide,
} from './api';
import {
  contributorsFrom,
  guideCardsFrom,
  guideHeadFrom,
  guidePlanFrom,
  PLAN_AVANT_REPONSE,
  propositionFrom,
  versionsFrom,
} from './from-api';

/**
 * L'ÉTAT DES ÉCRANS DE GUIDES — A03 et A04.
 *
 * ── CE QU'IL FAIT DU JETON : RIEN ───────────────────────────────────────────
 *
 * Il appelle `resumeSession()` une fois au montage, et c'est tout. Le jeton
 * d'accès vit en mémoire et meurt avec l'onglet ; le cookie de rafraîchissement,
 * lui, dure trente jours. Un rechargement laisse donc une session valide sans
 * jeton en main.
 *
 * Il ne LIT ni ne RANGE jamais le jeton, et rien n'entre dans `localStorage`.
 *
 * UNE NUANCE PROPRE À CE MODULE : `GET /guides` et `GET /guides/:slug` sont
 * `@PublicRead()`. La liste s'affiche donc même sans session — ce qui est voulu,
 * §2.3 tenant un guide publié pour de la documentation. La reprise de session
 * sert à obtenir `myVote`, `myOutdatedFlag` et `isAuthor`, qui n'arrivent qu'avec
 * un lecteur identifié. Son ÉCHEC n'est donc pas une erreur : on charge quand
 * même, en visiteur.
 *
 * ── CE QU'IL NE FAIT PAS AVEC LE NIVEAU ─────────────────────────────────────
 *
 * Aucun `if (level === 'L1')`. Les boutons « Proposer une correction »,
 * « L'information a changé » et le vote sont TOUJOURS affichés ; l'action est
 * tentée, et le serveur répond `403 LEVEL_REQUIRED`. `levelRequired` est exposé
 * tel quel pour que l'écran montre l'INVITATION de §7.3 — une invitation, jamais
 * une erreur sèche. Griser un bouton d'après un niveau gardé en mémoire, c'est la
 * faille de quinze minutes rejouée dans le front, et le membre n'apprendrait même
 * pas ce qui lui manque.
 *
 * ── LE DÉBIT LIMITÉ ─────────────────────────────────────────────────────────
 *
 * On ne rejoue JAMAIS un `429`, et on n'affiche jamais le message du serveur :
 * il dit « patientez un instant » pour une attente qui peut valoir une heure.
 * `displayMessageFor` compose la bonne phrase.
 */

/** Ce qu'un écran doit savoir d'un échec pour le montrer correctement. */
export interface GuideEchec {
  /** La phrase française, jamais le message brut du serveur sur un 429. */
  readonly message: string;
  /** §7.3 : de quoi composer l'INVITATION à monter de niveau. */
  readonly levelRequired: NonNullable<ApiError['levelRequired']> | null;
  /** Vrai quand le CONTRAT est cassé — un incident, pas une règle métier. */
  readonly incident: boolean;
  readonly retryAfterSeconds: number | null;
  /** Le code du serveur. On décide sur LUI, jamais sur le message (§5.2). */
  readonly code: string | null;
}

export function echecDe(error: unknown): GuideEchec {
  /**
   * `ApiShapeError` d'abord, et il n'hérite PAS d'`ApiError` — c'est voulu par le
   * socle : un `catch (e) { if (e instanceof ApiError) }` ne peut pas transformer
   * une rupture de contrat en message métier rassurant.
   */
  if (error instanceof ApiShapeError) {
    return {
      message: displayMessageFor(error),
      levelRequired: null,
      incident: true,
      retryAfterSeconds: null,
      code: null,
    };
  }
  if (error instanceof ApiError) {
    return {
      message: displayMessageFor(error),
      levelRequired: error.levelRequired,
      incident: false,
      retryAfterSeconds: error.retryAfterSeconds,
      code: error.code,
    };
  }
  return {
    message: displayMessageFor(error),
    levelRequired: null,
    incident: false,
    retryAfterSeconds: null,
    code: null,
  };
}

const TAB_PAR_RANG = ['helpful', 'recent', 'review'] as const;

export interface ListeEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: GuideEchec | null;
  readonly page: GuideListResponse | null;
}

/**
 * A03 — la liste.
 *
 * `tab` est le RANG de l'onglet dans la maquette (0 utiles, 1 récents,
 * 2 à vérifier), pas la valeur de l'API. La traduction est ici, en un seul
 * endroit, parce que le bandeau transcodé pose ces rangs et rien d'autre.
 */
export function useGuides(
  tab: number,
  actif: boolean = true,
  /**
   * LES TROIS FILTRES DE LA PLANCHE — catégorie, pays, ville.
   *
   * Le porteur : « rends aussi la page, les filtres etc. dynamique ». Ils
   * étaient des `<span>` ; `guideListQuerySchema` les accepte depuis le premier
   * jour. Ils entrent dans les dépendances de `charger`, donc en changer refait
   * la requête — comme l'onglet.
   */
  filtres: {
    readonly category?: string;
    readonly countryId?: string;
    readonly cityId?: string;
  } = {},
) {
  const [etat, setEtat] = useState<ListeEtat>({
    pret: false,
    chargement: true,
    echec: null,
    page: null,
  });

  /**
   * La reprise de session ne doit partir QU'UNE FOIS.
   *
   * En développement, React monte deux fois sous `StrictMode`. Deux
   * `resumeSession()` concurrents, c'est deux `POST /auth/refresh` — et le jeton
   * de rafraîchissement TOURNE à chaque usage : le second présenterait un jeton
   * déjà consommé, ce que la détection de rejeu traite en coupant la chaîne.
   */
  const reprise = useRef<Promise<boolean> | null>(null);

  const onglet = TAB_PAR_RANG[tab] ?? 'helpful';
  /**
   * LES TROIS VALEURS SONT DÉPLIÉES, et non l'objet : un littéral passé en prise
   * change d'identité à chaque rendu, et `charger` se refabriquerait en boucle.
   */
  const category = filtres.category ?? '';
  const countryId = filtres.countryId ?? '';
  const cityId = filtres.cityId ?? '';

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        /**
         * La reprise est TENTÉE, jamais exigée : la liste est publique. Son échec
         * ne doit pas vider l'écran d'un visiteur qui n'a simplement pas de
         * session — il verrait « connectez-vous » sur de la documentation ouverte.
         */
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession().catch(() => false);
          await reprise.current;
        }

        const page = await fetchGuides(
          {
            tab: onglet,
            ...(category === '' ? {} : { category }),
            ...(countryId === '' ? {} : { countryId }),
            ...(cityId === '' ? {} : { cityId }),
          },
          signal,
        );
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: null, page });
      } catch (error) {
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: echecDe(error), page: null });
      }
    },
    [category, cityId, countryId, onglet],
  );

  /**
   * `actif` — NE PAS APPELER UNE LISTE QU'AUCUN ÉCRAN NE MONTRE.
   *
   * A03 est une page : sa liste se charge à l'ouverture, et `actif` vaut `true`
   * par défaut pour que rien ne change chez elle. A01G est une FENÊTRE : la
   * charger au rendu de `/accueil` ferait un `GET /guides` à chaque affichage du
   * fil pour un panneau que le membre n'ouvrira peut-être jamais.
   *
   * Le crochet reste monté et garde son état : c'est la REQUÊTE qui attend, pas le
   * composant. Un `useGuides` appelé conditionnellement serait un appel de crochet
   * conditionnel, que React refuse.
   */
  useEffect(() => {
    if (!actif) return;
    const ac = new AbortController();
    setEtat((p) => ({ ...p, chargement: true }));
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger, actif]);

  const donnees = useMemo(
    () => ({
      guides: etat.page === null ? [] : guideCardsFrom(etat.page),
      /** §2.3 — le seuil du bandeau vient du SERVEUR, jamais d'une constante du front. */
      staleAfterMonths: etat.page?.meta.staleAfterMonths ?? null,
      nextCursor: etat.page?.nextCursor ?? null,
    }),
    [etat.page],
  );

  return { ...etat, ...donnees };
}

export interface GuideEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: GuideEchec | null;
  readonly detail: GuideDetailResponse | null;
  readonly versions: GuideVersionsResponse | null;
  readonly propositions: GuideProposalsResponse | null;
}

/**
 * A04 — la lecture d'un guide, et A06 pour ses propositions.
 *
 * Les propositions sont chargées APRÈS le détail et non en parallèle, et c'est la
 * seule dépendance réelle de ce module : `GET /guides/:id/proposals` prend
 * l'IDENTIFIANT, que seul le détail donne — l'URL, elle, porte le slug. Les
 * lancer ensemble demanderait de deviner l'identifiant.
 *
 * L'historique, lui, prend le slug : il part donc EN PARALLÈLE du détail.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `pageSlug` — LA PAGE LUE, ET CE QU'ELLE CHANGE DANS CE CROCHET             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Un guide peut avoir plusieurs pages. Les commentaires concernent
 * donc une page du guide. »
 *
 * ELLE ENTRE DANS LES DÉPENDANCES DE `charger`, donc changer de page REFAIT la
 * requête — comme changer d'onglet sur la liste. C'est obligatoire et pas une
 * commodité : `currentVersion` (le corps), `guide.commentCount` (le compte de la
 * page lue) et `currentPage.id` (le sujet des commentaires) viennent TOUS les
 * trois de `GET /guides/:slug?page=…`. Garder la réponse d'une autre page
 * afficherait le corps d'une page sous le titre d'une autre.
 *
 * ⚠ `undefined` ET NON LA CHAÎNE VIDE : le paramètre est omis de l'adresse quand
 * il n'y a pas de page demandée, et c'est ce qui rend `/guides/:slug` identique à
 * ce qu'il était avant les pages. Un `?page=` nu donnerait un `400`.
 *
 * L'HISTORIQUE, lui, NE DÉPEND PAS DE LA PAGE : `GET /guides/:slug/versions` prend
 * le slug du guide et rend ses versions — toutes pages confondues. Il est donc
 * rejoué inutilement à chaque changement de page, et c'est un ÉCART ASSUMÉ : le
 * séparer demanderait un second crochet, et la requête est servie par la même
 * route que le détail. REMONTÉ.
 */
export function useGuide(slug: string, pageSlug?: string) {
  const [etat, setEtat] = useState<GuideEtat>({
    pret: false,
    chargement: true,
    echec: null,
    detail: null,
    versions: null,
    propositions: null,
  });

  const reprise = useRef<Promise<boolean> | null>(null);

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession().catch(() => false);
          await reprise.current;
        }

        /**
         * `allSettled` et non `all` : si l'HISTORIQUE échoue, le guide doit
         * quand même s'afficher. `all` ferait disparaître la page entière pour un
         * encart latéral.
         */
        const [detail, versions] = await Promise.allSettled([
          fetchGuide(slug, pageSlug, signal),
          fetchVersions(slug, signal),
        ]);

        if (signal.aborted) return;

        /** Le GUIDE est la page : s'il échoue, l'écran doit le dire. */
        if (detail.status === 'rejected') {
          setEtat({
            pret: true,
            chargement: false,
            echec: echecDe(detail.reason),
            detail: null,
            versions: versions.status === 'fulfilled' ? versions.value : null,
            propositions: null,
          });
          return;
        }

        const propositions = await fetchProposals(detail.value.guide.id, signal).catch(
          () => null,
        );
        if (signal.aborted) return;

        setEtat({
          pret: true,
          chargement: false,
          echec: null,
          detail: detail.value,
          versions: versions.status === 'fulfilled' ? versions.value : null,
          propositions,
        });
      } catch (error) {
        if (signal.aborted) return;
        setEtat((p) => ({ ...p, pret: true, chargement: false, echec: echecDe(error) }));
      }
    },
    [slug, pageSlug],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  /**
   * Voter. On envoie, PUIS on recale sur ce que le serveur renvoie.
   *
   * Pas de mise à jour optimiste du compteur : `helpfulCount` est RELU, et une
   * incrémentation locale divergerait dès qu'un autre membre vote. Surtout,
   * `NOT_HELPFUL` ne bouge PAS le compteur (règle dure §9) — un front qui
   * incrémenterait « de son côté » inventerait le seul chiffre que la règle
   * interdit de bouger.
   *
   * Un `429` n'est PAS rejoué.
   */
  const voter = useCallback(
    async (value: 'HELPFUL' | 'NOT_HELPFUL'): Promise<GuideEchec | null> => {
      const detail = etat.detail;
      if (detail === null) return null;
      try {
        const dejaVote = detail.myVote === value;
        const r = dejaVote
          ? await unvoteGuide(detail.guide.id)
          : await voteGuide(detail.guide.id, value);
        setEtat((p) =>
          p.detail === null
            ? p
            : {
                ...p,
                detail: {
                  ...p.detail,
                  guide: { ...p.detail.guide, helpfulCount: r.helpfulCount },
                  myVote: r.value,
                },
              },
        );
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.detail],
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ APRÈS UN SIGNALEMENT D'OBSOLESCENCE, ON RELIT LE GUIDE                 ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * ── CE QUE CE BLOC FAISAIT, ET POURQUOI ÇA NE SUFFISAIT PLUS ────────────
   *
   * Il recalait DEUX champs sur la réponse de la route — `outdatedFlagCount` et
   * `status` — et c'est tout ce que `guideOutdatedResponseSchema` porte. Mesuré :
   * l'état gardait alors un `status: 'FLAGGED'` à côté d'un `banners` vide, d'un
   * `unpublishDeadlineAt` resté `null` et d'un `myOutdatedFlag` resté `null`.
   * Autrement dit, les trois choses que l'écran a maintenant à montrer — le
   * bandeau, l'échéance de dépublication et la BASCULE « retirer » — étaient
   * toutes les trois absentes de la réponse, chacune pour une bonne raison : la
   * route répond ce qu'elle a changé, pas le guide entier.
   *
   * ── POURQUOI UNE RELECTURE, ET PAS TROIS RÈGLES RECOMPOSÉES ─────────────
   *
   * On aurait pu, à partir du `status` renvoyé, POSER le bandeau
   * `OUTDATED_REPORTED` et CALCULER l'échéance à trente jours. Ce sont exactement
   * les deux règles que le serveur tient (`bannersFor`, `GUIDE_UNPUBLISH_DELAY_
   * DAYS`), et le dépôt en interdit la seconde implémentation — « deux
   * implémentations de la même règle divergent toujours », ce que `guideCardFrom`
   * et `texteBandeau` répètent chacun pour sa part. Le `myOutdatedFlag`, lui,
   * n'était même pas recomposable : son `id` est un `uuid` que la réponse ne donne
   * pas, et en inventer un aurait mis une valeur fausse dans un état que l'écran
   * lit.
   *
   * UN `GET` DE PLUS EST LE PRIX, ET IL EST PETIT : le geste n'arrive qu'UNE FOIS
   * par membre et par guide (§2.6, contrainte d'unicité en base), donc cette
   * relecture n'est pas dans un chemin répété.
   *
   * ── LE REPLI, QUAND LA RELECTURE ÉCHOUE ─────────────────────────────────
   *
   * L'ÉCRITURE A RÉUSSI : on ne la présente pas comme un échec. On recale alors
   * les deux champs que la réponse porte, comme avant.
   *
   * ⚠ ET L'ÉCART EST NOMMÉ : sur ce repli, `myOutdatedFlag` reste celui de la
   * dernière lecture, donc le libellé de l'action peut encore dire « Signaler »
   * après un signalement accepté. Un second envoi ne passe pas pour autant —
   * c'est le SERVEUR qui refuse en `ALREADY_FLAGGED` (§2.6), et c'est lui qui doit
   * refuser : le front prévient, il n'autorise pas.
   */
  const recalerApresObsolescence = useCallback(
    async (reponse: GuideOutdatedResponse): Promise<void> => {
      const frais = await fetchGuide(slug, pageSlug).catch(() => null);
      setEtat((p) => {
        if (p.detail === null) return p;
        if (frais !== null) return { ...p, detail: frais };
        return {
          ...p,
          detail: {
            ...p.detail,
            guide: {
              ...p.detail.guide,
              outdatedFlagCount: reponse.outdatedFlagCount,
              status: reponse.status,
            },
          },
        };
      });
    },
    [slug, pageSlug],
  );

  /** « L'information a changé » (§2.6). Distinct du signalement d'abus. */
  const signalerObsolete = useCallback(
    async (comment?: string): Promise<GuideEchec | null> => {
      const detail = etat.detail;
      if (detail === null) return null;
      try {
        const r = await flagOutdated(detail.guide.id, comment);
        await recalerApresObsolescence(r);
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.detail, recalerApresObsolescence],
  );

  /**
   * RETIRER SON SIGNALEMENT — `DELETE /guides/:id/outdated`.
   *
   * Mesuré avant ce lot : la route et son appel (`removeOutdatedFlag`) existaient,
   * `GET /guides/:slug` rendait déjà `myOutdatedFlag`, ce crochet en dérivait déjà
   * `aSignale`, et AUCUN cadre ne lisait rien de tout cela. Un membre qui s'était
   * trompé — trois signalements suffisent à ouvrir une dépublication — ne pouvait
   * pas se défaire.
   *
   * C'est la MÊME entrée d'écran que « L'information a changé », en bascule, et
   * non une quatrième action : le service le dit pour le serveur (« §2.6 ne dit
   * pas ce qu'un retrait produit […] un signalement posé par erreur doit pouvoir
   * être défait »), et la maquette ne dessine pas d'entrée de plus.
   */
  const retirerSignalement = useCallback(async (): Promise<GuideEchec | null> => {
    const detail = etat.detail;
    if (detail === null) return null;
    try {
      const r = await removeOutdatedFlag(detail.guide.id);
      await recalerApresObsolescence(r);
      return null;
    } catch (error) {
      return echecDe(error);
    }
  }, [etat.detail, recalerApresObsolescence]);

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ « OUVRIR À LA COMMUNAUTÉ », ET REPRENDRE LA MAIN                       ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » MESURÉ : un
   * `<a href="#">` mort sur le seul cadre `auteurdesktop` (zéro occurrence sur
   * `desktop`, `mobile` et `auteurmobile`), et aucune route derrière.
   *
   * UNE SEULE FONCTION POUR LES DEUX SENS, parce que la route n'en a qu'un
   * chemin : §2.5 veut le geste « réversible », et `PUT` avec `{ maintained }`
   * porte l'intention dans la valeur. Deux fonctions auraient été deux endroits
   * où recaler l'état.
   *
   * ── ON RELIT LE GUIDE, ET IL LE FAUT ───────────────────────────────────
   *
   * La route répond `{ maintainedByCommunity }` — ce qu'elle a changé, et rien de
   * plus. Or l'écran montre AUSSI le bandeau « Maintenu par la communauté », que
   * le SERVEUR compose (`bannersFor`, §2.3 et §2.6) et dont le front n'a pas le
   * droit de tenir une seconde implémentation : un guide peut être maintenu par
   * la communauté ET périmé, et dans ce cas c'est l'avertissement qui s'affiche.
   * Poser le bandeau à partir du booléen aurait donc affiché le bandeau VERT sur
   * un guide que trois membres signalent. C'est le même arbitrage, et la même
   * relecture, que `recalerApresObsolescence` écrit au long.
   *
   * LE REPLI, QUAND LA RELECTURE ÉCHOUE : l'écriture a réussi, on ne la présente
   * pas comme un échec. On recale le seul champ que la réponse porte. ⚠ L'ÉCART
   * EST NOMMÉ : sur ce repli, `banners` reste celui de la dernière lecture, donc
   * le bandeau peut mettre un instant à paraître.
   */
  const basculerCommunaute = useCallback(
    async (maintained: boolean): Promise<GuideEchec | null> => {
      const detail = etat.detail;
      if (detail === null) return null;
      try {
        const r = await setCommunityMaintenance(detail.guide.id, maintained);
        const frais = await fetchGuide(slug, pageSlug).catch(() => null);
        setEtat((p) => {
          if (p.detail === null) return p;
          if (frais !== null) return { ...p, detail: frais };
          return {
            ...p,
            detail: {
              ...p.detail,
              guide: { ...p.detail.guide, maintainedByCommunity: r.maintainedByCommunity },
            },
          };
        });
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.detail, slug, pageSlug],
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ DÉCIDER D'UNE PROPOSITION — ACCEPTER, AMENDER, REFUSER                 ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ avant ce lot : les trois appels existaient (`acceptProposal`,
   * `amendProposal`, `rejectProposal`), les trois routes aussi, la page chargeait
   * les vraies propositions — et `grep -o "onClick"` sur le cadre de 1 440 px
   * rendait ZÉRO. Rien, dans tout le front, n'appelait ces trois fonctions.
   *
   * ── UNE SEULE FONCTION POUR TROIS DÉCISIONS ─────────────────────────────
   *
   * Parce que les trois font la même chose du point de vue de l'état : elles
   * décident d'une proposition, puis l'écran doit être relu. Trois fonctions
   * auraient été trois endroits où recaler le même état, et c'est l'arbitrage que
   * `basculerCommunaute` écrit déjà pour ses deux sens. L'union discriminée porte
   * ce que chaque décision demande de plus — le remplacement amendé, le motif du
   * refus — et le type empêche d'appeler `REJECT` sans motif.
   *
   * ── ON RELIT LE GUIDE *ET* LA LISTE, ET IL LE FAUT ──────────────────────
   *
   * La route rend `proposalView` — la proposition décidée, et rien d'autre
   * (`guideProposalDetailSchema`). Or une acceptation ÉCRIT DANS LE GUIDE : §2.4
   * crée une nouvelle version, crédite le proposant comme contributeur et déplace
   * `lastContentUpdateAt`. Recaler la seule proposition aurait laissé à l'écran un
   * corps, un compte de contributeurs et une date d'avant la décision — donc un
   * guide qui ne porte pas le remplacement qu'on vient d'accepter.
   *
   * Les deux relectures partent ENSEMBLE (`Promise.all`) : elles ne dépendent pas
   * l'une de l'autre, l'identifiant du guide est déjà connu.
   *
   * LE REPLI, QUAND UNE RELECTURE ÉCHOUE : l'écriture a RÉUSSI, on ne la présente
   * pas comme un échec — on garde ce qu'on avait pour la partie qui n'est pas
   * revenue. ⚠ L'ÉCART EST NOMMÉ : sur ce repli, la liste peut encore montrer la
   * proposition comme en attente. Un second envoi ne passerait pas pour autant —
   * c'est le SERVEUR qui refuse une proposition déjà décidée.
   *
   * ── `decisionEnVol` : UN SEUL APPEL À LA FOIS, ET C'EST LE POINT ────────
   *
   * Il porte l'IDENTIFIANT de la proposition en cours, pas un booléen : l'écran a
   * DEUX emplacements, et c'est lui qui dit lequel des deux attend. Sans ce verrou,
   * un double clic sur « Accepter » enverrait deux écritures dans le corps du
   * guide — la seule des trois décisions qui ne soit pas idempotente à
   * l'affichage.
   */
  const [decisionEnVol, setDecisionEnVol] = useState<string | null>(null);

  const deciderProposition = useCallback(
    async (
      proposalId: string,
      decision:
        | { readonly kind: 'ACCEPT' }
        | { readonly kind: 'AMEND'; readonly replacement: string }
        | { readonly kind: 'REJECT'; readonly reason: string },
    ): Promise<GuideEchec | null> => {
      const detail = etat.detail;
      if (detail === null) return null;
      /** Un appel en vol : on ne part pas deux fois. Voir l'en-tête. */
      if (decisionEnVol !== null) return null;
      setDecisionEnVol(proposalId);
      try {
        if (decision.kind === 'ACCEPT') await acceptProposal(proposalId);
        else if (decision.kind === 'AMEND') await amendProposal(proposalId, decision.replacement);
        else await rejectProposal(proposalId, decision.reason);

        const [frais, liste] = await Promise.all([
          fetchGuide(slug, pageSlug).catch(() => null),
          fetchProposals(detail.guide.id).catch(() => null),
        ]);
        setEtat((p) => ({
          ...p,
          detail: frais ?? p.detail,
          propositions: liste ?? p.propositions,
        }));
        return null;
      } catch (error) {
        return echecDe(error);
      } finally {
        setDecisionEnVol(null);
      }
    },
    [etat.detail, slug, pageSlug, decisionEnVol],
  );

  const donnees = useMemo(
    () => ({
      contributors: etat.detail === null ? [] : contributorsFrom(etat.detail),
      /**
       * L'en-tête du guide. `null` tant que le détail n'est pas là : la page
       * garde alors celui de la maquette, comme elle le fait déjà pour
       * l'historique, plutôt que d'afficher un titre vide le temps d'un aller-retour.
       */
      enTete:
        etat.detail === null
          ? null
          : guideHeadFrom(
              etat.detail,
              etat.propositions === null
                ? 0
                : etat.propositions.items.filter(
                    (p) => p.status === 'PENDING' || p.status === 'ESCALATED',
                  ).length,
            ),
      versionRows: etat.versions === null ? [] : versionsFrom(etat.versions),
      /**
       * LE PLAN DES PAGES. `PLAN_AVANT_REPONSE` tant que le détail n'est pas là —
       * `visible: false`, donc ni panneau, ni chevrons, ni feuille : avant la
       * réponse on ne sait pas combien le guide a de pages, et une navigation qui
       * ne mène nulle part n'est pas un espace réservé.
       *
       * ⚠ IL NE PORTE PAS SES GESTES : ils demandent le routeur et l'état
       * d'ouverture de la feuille, qui vivent dans la page. Voir `guidePlanFrom`.
       */
      plan: etat.detail === null ? PLAN_AVANT_REPONSE : guidePlanFrom(etat.detail),
      propositionsVues:
        etat.propositions === null ? [] : etat.propositions.items.map((p) => propositionFrom(p)),
      /** §5 — l'écran de l'AUTEUR, décidé par le serveur à chaque requête. */
      isAuthor: etat.detail?.guide.isAuthor ?? false,
      monVote: etat.detail?.myVote ?? null,
      /**
       * ⚠ CE BOOLÉEN A ÉTÉ DÉFINI SANS JAMAIS ÊTRE LU, et c'était le défaut :
       * `grep -rn aSignale apps/web/src` ne trouvait que cette ligne. A04 le lit
       * maintenant, et c'est lui qui fait la BASCULE de l'entrée « L'information a
       * changé » vers « Retirer mon signalement », sur les deux planches.
       *
       * `undefined` ET `null` comptent tous deux pour « non » : `null` est la
       * réponse du serveur quand le lecteur n'a rien signalé OU qu'il n'y a pas de
       * lecteur (la route est `@PublicRead()`), `undefined` est l'absence de
       * détail avant la réponse. Dans les deux cas l'entrée garde le libellé de la
       * maquette : proposer « retirer » à qui n'a rien signalé serait pire que
       * d'attendre un aller-retour.
       */
      aSignale: etat.detail?.myOutdatedFlag !== null && etat.detail?.myOutdatedFlag !== undefined,
      bandeaux: etat.detail?.guide.banners ?? [],
    }),
    [etat.detail, etat.versions, etat.propositions],
  );

  return {
    ...etat,
    ...donnees,
    voter,
    signalerObsolete,
    retirerSignalement,
    basculerCommunaute,
    /** §2.4 — les trois décisions de l'auteur sur une proposition reçue. */
    deciderProposition,
    /** L'identifiant de la proposition dont la décision est en vol, ou `null`. */
    decisionEnVol,
  };
}
