import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blockerCancelledResponseSchema,
  blockerDraftResponseSchema,
  blockerPublishedResponseSchema,
  dismissShareResponseSchema,
  journeyDetailResponseSchema,
  journeyTemplatesResponseSchema,
  journeysListResponseSchema,
  levelRequiredDetailsSchema,
  onboardingAdvanceResponseSchema,
} from '../index.js';

/**
 * LES SCHÉMAS DE RÉPONSE DES PARCOURS, ÉPROUVÉS SUR DES CHARGES RÉELLES.
 *
 * ── CE QUE SONT CES FIXTURES ────────────────────────────────────────────────
 *
 * Aucune n'a été rédigée. Chaque fichier est la réponse OCTET POUR OCTET d'une API
 * qui tournait, sur la base de développement, membre ouvert par le vrai parcours
 * OTP (`POST /auth/otp/request` puis `verify`, code lu dans le journal — le
 * fournisseur fictif en tire un au hasard), ville posée par `PATCH /me`, parcours
 * créé par `POST /journeys`, blocage créé, publié et annulé par ses vraies routes.
 *
 * LA DIFFÉRENCE N'EST PAS DE PRINCIPE, ELLE A MORDU. Le schéma de `GET /journeys`
 * réutilisait celui du DÉTAIL, parce que les deux décrivent « un parcours ». La
 * charge dit autre chose : la liste rend `currentStep: { id, title }` là où le
 * détail rend `currentStepId`, `stepCount` là où le détail rend `totalCount`, et
 * `isOwner` / `memberCount` / `lastActivityAt` que le détail n'a pas.
 *
 * Et l'erreur était INVISIBLE, pour une raison qui vaut d'être retenue :
 * `z.array(item)` accepte `[]` quel que soit `item`. Le seul écran appelant — O05,
 * l'atterrissage — voyait donc son cas « aucun parcours » marcher parfaitement, et
 * son cas « un parcours » lever `ApiShapeError`, avalée, avec repli sur la valeur
 * par défaut. Laquelle était justement celle qu'on attendait. Un test de bout en
 * bout passait, un écran s'affichait, et rien n'était branché.
 *
 * ── CE QUE CE FICHIER GARDE ─────────────────────────────────────────────────
 *
 *   1. les schémas ACCEPTENT ce que l'API renvoie vraiment — sans quoi chaque
 *      écran branché lèverait `ApiShapeError` sur une charge valide ;
 *   2. les schémas REFUSENT une charge qui enfreint une règle dure — sans quoi ils
 *      ne garderaient rien et ce fichier serait décoratif.
 *
 * Le second bloc est écrit en MUTATIONS : on part de la charge réelle, on casse un
 * point précis, on exige le refus.
 *
 * ── LES TÉMOINS ─────────────────────────────────────────────────────────────
 *
 * Le dernier bloc mute des endroits qui ne DÉCIDENT de rien et exige que la
 * validation reste VERTE. Sans eux, un schéma accidentellement trop strict
 * passerait pour un schéma qui garde bien.
 */

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

type Noeud = Record<string, unknown>;

function charge(nom: string): Noeud {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8')) as Noeud;
}

/** Copie profonde : une mutation ne doit pas contaminer le cas suivant. */
const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Le premier élément d'une liste, typé sans `any`. */
function premier(c: Noeud): Noeud {
  const items = c['items'];
  if (!Array.isArray(items) || items.length === 0) throw new Error('liste vide');
  return items[0] as Noeud;
}

function sous(c: Noeud, cle: string): Noeud {
  const v = c[cle];
  if (typeof v !== 'object' || v === null) throw new Error(`${cle} absent`);
  return v as Noeud;
}

describe('les schémas ACCEPTENT les charges relevées sur l’API', () => {
  it('`GET /journey-templates` — les quatre modèles et leur version', () => {
    const c = charge('journey_templates');
    const parsed = journeyTemplatesResponseSchema.parse(c);

    expect(parsed.items.length).toBeGreaterThan(0);
    /**
     * LE NOMBRE D'ÉTAPES VIENT DE LA VERSION, ET IL N'EST PAS CELUI DE LA MAQUETTE.
     *
     * `01 Accès et Onboarding.dc.html` écrit « Étudier · 12 étapes ». La charge dit
     * autre chose, parce que le modèle `STUDIES` a été rechargé. On n'écrit pas le
     * nombre ici — ce serait recopier la donnée — on exige seulement qu'il soit
     * porté par la VERSION, donc qu'il suive le modèle et non le dessin.
     */
    expect(parsed.items[0]?.version.stepCount).toBeGreaterThan(0);
    // §2.1 : le champ `icon` existe et vaut `null` sur les quatre. C'est pour cela
    // que les tracés d'icône restent ceux de la maquette, appariés par `code`.
    expect(parsed.items[0]?.icon).toBeNull();
  });

  it('`GET /journeys` VIDE — et c’est le cas qui cachait tout', () => {
    // Il passe avec N'IMPORTE QUEL schéma d'élément : `z.array` accepte `[]`. On le
    // garde nommé pour que personne ne le prenne pour une preuve.
    const parsed = journeysListResponseSchema.parse(charge('journeys_vide'));
    expect(parsed.items).toHaveLength(0);
    expect(parsed.meta.maxMembers).toBe(10);
  });

  it('`GET /journeys` AVEC un parcours — la forme de la LISTE, pas celle du détail', () => {
    const parsed = journeysListResponseSchema.parse(charge('journeys_liste'));
    const item = parsed.items[0];
    expect(item).toBeDefined();
    expect(item?.currentStep?.title).toBeTruthy();
    expect(item?.stepCount).toBeGreaterThan(0);
    expect(item?.isOwner).toBe(true);
  });

  it('`POST /journeys` — le détail, avec `currentStepId` et `totalCount`', () => {
    const parsed = journeyDetailResponseSchema.parse(charge('journey_cree'));
    expect(parsed.journey.currentStepId).not.toBeNull();
    expect(parsed.journey.totalCount).toBeGreaterThan(0);
    expect(parsed.journey.doneCount).toBe(0);
    expect(parsed.viewerRole).toBe('OWNER');
  });

  it('`GET /journeys/:id` — LA MÊME forme que `POST /journeys`, vérifiée', () => {
    /**
     * LA QUESTION N'EST PAS RHÉTORIQUE : `create()` et `detail()` sont DEUX
     * méthodes de service distinctes dans `journeys.service.ts`. Rien dans le code
     * ne garantit qu'elles rendent la même forme — et le piège vient d'être payé un
     * cran à côté, sur `GET /journeys` contre `POST /journeys`.
     *
     * Partager `journeyDetailResponseSchema` entre les deux est donc un FAIT
     * mesuré, pas une économie : les deux charges relevées portent les mêmes cinq
     * clés de premier niveau et les mêmes dix-huit dans `journey`. C'est ce que ce
     * test fige, et c'est lui qui rougira le jour où l'une des deux divergera.
     *
     * J03 et J04 en dépendent : c'est `GET /journeys/:id` qui leur donne l'étape en
     * cours quand l'URL n'en nomme pas.
     */
    const detail = journeyDetailResponseSchema.parse(charge('journey_detail'));
    const cree = journeyDetailResponseSchema.parse(charge('journey_cree'));

    expect(Object.keys(charge('journey_detail')).sort()).toEqual(
      Object.keys(charge('journey_cree')).sort(),
    );
    expect(Object.keys(sous(charge('journey_detail'), 'journey')).sort()).toEqual(
      Object.keys(sous(charge('journey_cree'), 'journey')).sort(),
    );
    // Et l'étape en cours est bien là : sans elle, « Je suis bloqué·e » n'aurait
    // rien sur quoi ouvrir un brouillon.
    expect(detail.journey.currentStepId).not.toBeNull();
    expect(cree.journey.currentStepId).not.toBeNull();
  });

  it('`POST …/blocker` — le brouillon et son texte pré-rempli (§3.5)', () => {
    const parsed = blockerDraftResponseSchema.parse(charge('blocker_brouillon'));
    expect(parsed.blocker.status).toBe('DRAFT');
    /**
     * Le gabarit nomme le TYPE de parcours, jamais le titre personnel (§3.7, 06
     * §2.5). La charge le confirme : « mon parcours Étudier en France ».
     */
    expect(parsed.blocker.draftText.length).toBeGreaterThan(0);
  });

  it('`POST /blockers/:id/publish` — la promotion explicite (§3.5)', () => {
    const parsed = blockerPublishedResponseSchema.parse(charge('blocker_publie'));
    expect(parsed.blocker.status).toBe('PUBLISHED');
    // L'objet cible n'est créé qu'ici : la référence en est la preuve.
    expect(parsed.blocker.publishedRefType).toBe('help_request');
    expect(parsed.blocker.publishedRefId).not.toBeNull();
  });

  it('`POST /blockers/:id/cancel` — une forme PLATE, sans enveloppe', () => {
    /**
     * Le piège de cette route : la création et la publication enveloppent dans
     * `blocker`, l'annulation non. Supposer l'enveloppe ferait lever
     * `ApiShapeError` sur une annulation qui a pourtant réussi, et le membre
     * lirait « une erreur est survenue » après un geste qui a bien eu lieu.
     */
    const parsed = blockerCancelledResponseSchema.parse(charge('blocker_annule'));
    expect(parsed.status).toBe('CANCELLED');
  });

  it('`POST …/dismiss-share` et `POST /me/onboarding`', () => {
    expect(dismissShareResponseSchema.parse(charge('partage_decline')).dismissed).toBe(true);
    expect(onboardingAdvanceResponseSchema.parse(charge('onboarding_avance')).step).toBe(2);
  });

  it('`403 LEVEL_REQUIRED` porte de quoi INVITER, pas seulement refuser (§7.3)', () => {
    /**
     * 00 §7.3, dernière ligne : « le front affiche alors une invitation à monter de
     * niveau, jamais une simple erreur ». Une invitation demande trois choses, et
     * cette charge les porte : ce que le membre voulait faire, ce qui lui manque, et
     * ce qu'il a. Si l'une disparaît, l'écran retombe sur une porte fermée.
     */
    const erreur = sous(charge('partage_refus_niveau'), 'error');
    const details = levelRequiredDetailsSchema.parse(erreur['details']);
    expect(details.labelFr).toBe('publier dans le fil');
    expect(details.requiredLevel).toBe('L1');
    expect(details.currentLevel).toBe('L0');
  });

  it('`PLAN_LIMIT_REACHED` se décide sur le CODE, jamais sur le message (§5.2)', () => {
    const erreur = sous(charge('journey_refus_plan'), 'error');
    expect(erreur['code']).toBe('PLAN_LIMIT_REACHED');
    // Le message est du texte d'interface : il sera relu, retouché, traduit. Le
    // front n'a donc le droit de comparer que le code — c'est ce que
    // `TOLERATED_ON_CREATE` fait dans le parcours d'inscription.
    expect(typeof erreur['message']).toBe('string');
  });
});

describe('les schémas REFUSENT ce qui casserait une règle', () => {
  it('refuse une ligne de liste privée de son étape en cours', () => {
    const c = copie(charge('journeys_liste'));
    delete premier(c)['currentStep'];
    // ABSENT n'est pas `null` : `nullable()` accepte le second, pas le premier. La
    // distinction est exactement celle qui a mordu sur `greetingHint` au lot A01.
    expect(journeysListResponseSchema.safeParse(c).success).toBe(false);
  });

  it('refuse une ligne de liste à qui l’on donne la forme du DÉTAIL', () => {
    const c = copie(charge('journeys_liste'));
    const item = premier(c);
    item['currentStepId'] = item['currentStep'];
    delete item['currentStep'];
    item['totalCount'] = item['stepCount'];
    delete item['stepCount'];
    /**
     * LA MUTATION QUI DÉCRIT LE DÉFAUT TROUVÉ, à l'envers. Tant que ce test rougit,
     * personne ne peut refaire l'économie de réutiliser le schéma du détail pour la
     * liste — et la refaire coûtait un écran branché qui ne l'était pas.
     */
    expect(journeysListResponseSchema.safeParse(c).success).toBe(false);
  });

  it('refuse un modèle sans nombre d’étapes', () => {
    const c = copie(charge('journey_templates'));
    delete sous(premier(c), 'version')['stepCount'];
    // Sans lui, O03 retomberait sur le nombre de la maquette — une promesse fausse
    // au moment où le membre choisit son parcours.
    expect(journeyTemplatesResponseSchema.safeParse(c).success).toBe(false);
  });

  it('refuse un brouillon dont l’état n’est pas un état de blocage', () => {
    const c = copie(charge('blocker_brouillon'));
    sous(c, 'blocker')['status'] = 'PUBLIE';
    expect(blockerDraftResponseSchema.safeParse(c).success).toBe(false);
  });

  it('refuse une annulation enveloppée comme une création', () => {
    const c = { blocker: copie(charge('blocker_annule')) };
    expect(blockerCancelledResponseSchema.safeParse(c).success).toBe(false);
  });

  it('refuse un `dismissed` qui n’est pas un booléen', () => {
    const c = copie(charge('partage_decline'));
    c['dismissed'] = 'true';
    // Une chaîne « false » est vraie en JavaScript : accepter le texte ici ferait
    // reproposer le partage à qui vient de le décliner, ou l'inverse.
    expect(dismissShareResponseSchema.safeParse(c).success).toBe(false);
  });
});

describe('les témoins — ce qui ne décide rien doit rester VERT', () => {
  it('un champ AJOUTÉ par l’API ne casse pas le front', () => {
    /**
     * Ces schémas ne sont PAS `.strict()`, et c'est délibéré : zod retire les clés
     * qu'il ne nomme pas. Une route qui gagne un champ ne doit pas faire tomber les
     * écrans déjà branchés — c'est l'inverse du cas `viewCount` du fil, où un
     * compteur interdit devait être refusé. Ici aucune règle n'interdit un champ de
     * plus, donc en refuser un serait de la rigueur décorative.
     */
    const c = copie(charge('journeys_liste'));
    premier(c)['nouveauChampDeDemain'] = 42;
    expect(journeysListResponseSchema.safeParse(c).success).toBe(true);
  });

  it('un titre de parcours quelconque passe — le schéma ne lit pas le contenu', () => {
    const c = copie(charge('journeys_liste'));
    premier(c)['title'] = 'Mes études à Lyon';
    expect(journeysListResponseSchema.safeParse(c).success).toBe(true);
  });

  it('le libellé du bandeau de checklist n’est pas figé par le schéma', () => {
    // Le TEXTE appartient à l'équipe des textes (§3.3). Le figer ici ferait rougir
    // une relecture éditoriale, ce qui est exactement ce qu'un schéma ne doit pas
    // faire.
    const c = copie(charge('journeys_liste'));
    sous(c, 'meta')['checklistNotice'] = 'Un autre texte, tout aussi valide.';
    expect(journeysListResponseSchema.safeParse(c).success).toBe(true);
  });
});
