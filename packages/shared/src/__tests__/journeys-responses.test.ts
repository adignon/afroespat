import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blockerCancelledResponseSchema,
  blockerDraftResponseSchema,
  blockerPublishedResponseSchema,
  dismissShareResponseSchema,
  journeyActivitiesResponseSchema,
  journeyDetailResponseSchema,
  journeyFullResponseSchema,
  journeyTemplatesResponseSchema,
  journeysListResponseSchema,
  levelRequiredDetailsSchema,
  onboardingAdvanceResponseSchema,
  publicJourneyDetailResponseSchema,
  publicJourneysResponseSchema,
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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LE SECOND LOT — le parcours complet, l'équipe, les publics et le journal.
 *
 * Ce sont les charges dont J01 et J05 à J11 avaient besoin et qui n'étaient
 * décrites nulle part. Mêmes règles que ci-dessus : chaque fixture est une
 * réponse relevée, chaque refus est une MUTATION d'une charge réelle, et chaque
 * attendu est écrit EN DUR — jamais calculé depuis la donnée qu'il mesure.
 * ════════════════════════════════════════════════════════════════════════════
 */
describe('le parcours COMPLET — `GET /journeys/:id` avec étapes et équipe', () => {
  it('accepte la charge relevée : quinze étapes, deux membres, le propriétaire à part', () => {
    const parsed = journeyFullResponseSchema.parse(charge('journey_equipe'));

    /**
     * QUINZE ET DEUX SONT ÉCRITS EN DUR, et c'est le point.
     *
     * Un test de ce module calculait son attendu depuis la donnée qu'il testait —
     * `expect(parsed.steps.length).toBe(charge.steps.length)` — et ne pouvait donc
     * pas échouer. Ces deux nombres viennent du modèle `STUDIES` version 3 et de la
     * mise en scène du relevé : un parcours créé, un accompagnant invité PUIS
     * accepté, un observateur invité et pas encore accepté. Si le serveur se met à
     * rendre autre chose, ce test rougit, ce qui est tout ce qu'on lui demande.
     */
    expect(parsed.steps).toHaveLength(15);
    expect(parsed.members).toHaveLength(2);
    expect(parsed.viewerRole).toBe('OWNER');

    // §3.4 — le PROPRIÉTAIRE n'est pas dans `members`. L'écran J05 doit donc le
    // composer lui-même, sinon la première ligne de l'équipe manque.
    expect(parsed.members.map((m) => m.userId)).not.toContain(parsed.journey.owner.id);

    // Les deux états d'invitation, tels que le relevé les a produits.
    expect(parsed.members[0]?.role).toBe('SUPPORTER');
    expect(parsed.members[0]?.status).toBe('ACTIVE');
    expect(parsed.members[0]?.acceptedAt).not.toBeNull();
    expect(parsed.members[1]?.role).toBe('OBSERVER');
    expect(parsed.members[1]?.status).toBe('INVITED');
    expect(parsed.members[1]?.acceptedAt).toBeNull();

    // La ville et le pays sont NOMMÉS ici, contrairement à `GET /me` qui n'en rend
    // que les identifiants. C'est ce qui permet à J01 d'écrire « → Lyon ».
    expect(parsed.journey.destinationCity.name).toBe('Lyon');
    expect(parsed.journey.originCountry.nameFr).toBe('Bénin');
    expect(parsed.journey.template.nameFr).toBe('Étudier en France');
  });

  it('`totalCount` exclut l’étape FACULTATIVE — quatorze sur quinze (§3.2)', () => {
    /**
     * L'ÉCART EST UNE PROPRIÉTÉ, PAS UN BOGUE, et un écran qui l'ignore MENT.
     *
     * Le modèle `STUDIES` compte quinze étapes, dont une facultative (« Demander
     * l'aide au logement (CAF) »). Le serveur n'en met que QUATORZE dans
     * `totalCount`, parce que `countsForProgress` écarte les facultatives. J01
     * écrit « 7 / 12 étapes » : s'il prenait `steps.length` pour le dénominateur, un
     * membre qui franchit tout verrait « 14 / 15 » à 100 %.
     */
    const parsed = journeyFullResponseSchema.parse(charge('journey_equipe'));
    expect(parsed.steps).toHaveLength(15);
    expect(parsed.journey.totalCount).toBe(14);
    expect(parsed.steps.filter((s) => s.isOptional)).toHaveLength(1);
  });

  it('la projection de NAVIGATION accepte la même charge — une seule source', () => {
    // `journeyFullResponseSchema` ÉTEND `journeyDetailResponseSchema`. Les deux
    // doivent donc accepter la même charge : si l'une tombe, l'autre tombe.
    expect(journeyDetailResponseSchema.safeParse(charge('journey_equipe')).success).toBe(true);
    expect(journeyFullResponseSchema.safeParse(charge('journey_cree')).success).toBe(true);
  });

  it('la checklist et les notes arrivent au PROPRIÉTAIRE (§3.3)', () => {
    const parsed = journeyFullResponseSchema.parse(charge('journey_equipe'));
    const dossier = parsed.steps.find((s) => s.stepDefinitionCode === 'CAMPUS_FRANCE_FILE');
    expect(dossier).toBeDefined();
    // Six libellés, ceux du modèle. Écrits en dur : c'est le contenu du seed.
    expect(dossier?.checklist).toHaveLength(6);
    expect(dossier?.checklist?.[0]?.label).toBe('Passeport valide');
    expect(dossier?.checklist?.[0]?.isChecked).toBe(false);
    // `notes` est PRÉSENT et vaut `null` : l'écran a de quoi dessiner « Ajouter une
    // note » plutôt que de masquer le bloc.
    expect(dossier?.notes).toBeNull();
  });

  it('REFUSE une étape à qui l’on greffe un champ — §10, les notes ne fuient pas', () => {
    /**
     * `.strict()` sur l'étape, et voici ce qu'il garde. Sans lui, zod DÉPOUILLE en
     * silence : le serveur pourrait se mettre à envoyer `notesRaw` à un observateur,
     * la réponse HTTP le porterait, l'écran n'afficherait rien d'anormal et personne
     * ne le saurait. Ici la validation tombe et NOMME le champ.
     */
    const c = copie(charge('journey_equipe'));
    const steps = c['steps'] as Noeud[];
    (steps[0] as Noeud)['notesRaw'] = 'une note privée qui n’aurait pas dû sortir';
    const refus = journeyFullResponseSchema.safeParse(c);
    expect(refus.success).toBe(false);
    expect(JSON.stringify(refus.error?.issues)).toContain('notesRaw');
  });

  it('REFUSE un numéro de téléphone greffé sur un membre d’équipe — 01 §2.1', () => {
    const c = copie(charge('journey_equipe'));
    const membres = c['members'] as Noeud[];
    sous(membres[0] as Noeud, 'user')['phone'] = '+22990000042';
    const refus = journeyFullResponseSchema.safeParse(c);
    expect(refus.success).toBe(false);
    expect(JSON.stringify(refus.error?.issues)).toContain('phone');
  });

  it('REFUSE une étape privée de son rang — l’ordre du parcours en dépend', () => {
    const c = copie(charge('journey_equipe'));
    delete (c['steps'] as Noeud[])[0]?.['position'];
    expect(journeyFullResponseSchema.safeParse(c).success).toBe(false);
  });

  it('REFUSE un rôle d’équipe que l’énumération ne connaît pas', () => {
    const c = copie(charge('journey_equipe'));
    (c['members'] as Noeud[])[0]!['role'] = 'PARRAIN';
    /**
     * « Parrain » est un rôle du PARRAINAGE, pas de l'équipe d'un parcours :
     * `JourneyMemberRole` ne vaut que `OBSERVER` ou `SUPPORTER`. La maquette dessine
     * pourtant une pastille « Parraine » — écart signalé, et ce test interdit de le
     * combler en inventant une valeur côté front.
     */
    expect(journeyFullResponseSchema.safeParse(c).success).toBe(false);
  });
});

describe('les PARCOURS PUBLICS — la liste fermée de §3.7', () => {
  it('accepte la liste relevée : trois parcours d’autres membres, sans `currentStep`', () => {
    const parsed = publicJourneysResponseSchema.parse(charge('journeys_publics'));
    expect(parsed.items).toHaveLength(3);
    // Le membre est nommé par son HANDLE, et le parcours par son TYPE.
    expect(parsed.items[0]?.member.handle).toBeTruthy();
    expect(parsed.items[0]?.template.code).toBe('STUDIES');
    expect(parsed.items[0]?.completedSteps[0]?.title).toBe('Choisir sa formation');
    expect(parsed.items[0]?.completedSteps[0]?.durationDays).toBe(0);
  });

  it('LA LISTE N’A PAS `currentStep`, LA FICHE L’A — mesuré, pas supposé', () => {
    /**
     * LE PIÈGE DE `GET /journeys` CONTRE `GET /journeys/:id`, UNE SECONDE FOIS.
     *
     * Réutiliser le schéma de la fiche pour la liste paraît économe et lève sur
     * TOUTE liste non vide. Et comme `z.array(item)` accepte `[]`, un écran qui n'a
     * encore vu aucun parcours public passerait parfaitement. On fige donc l'écart
     * dans les deux sens : la fiche doit porter la clé, la liste ne doit pas.
     */
    const liste = charge('journeys_publics');
    const fiche = sous(charge('journey_public_fiche'), 'journey');
    expect(Object.keys(premier(liste))).not.toContain('currentStep');
    expect(Object.keys(fiche)).toContain('currentStep');

    // Et le schéma de la fiche REFUSE une ligne de liste, faute de cette clé.
    expect(
      publicJourneyDetailResponseSchema.safeParse({
        journey: premier(liste),
        meta: liste['meta'],
      }).success,
    ).toBe(false);
  });

  it('la FICHE porte l’étape en cours avec son RANG', () => {
    const parsed = publicJourneyDetailResponseSchema.parse(charge('journey_public_fiche'));
    expect(parsed.journey.currentStep?.title).toBe('Constituer le dossier Campus France');
    expect(parsed.journey.currentStep?.position).toBe(2);
    expect(parsed.journey.completedSteps).toHaveLength(1);
  });

  it('REFUSE le titre personnel dans une vue publique — RÈGLE DURE §3.7', () => {
    /**
     * C'EST LE CAS POUR LEQUEL `.strict()` EXISTE ICI.
     *
     * §3.7 : « jamais le titre personnel ». Sans `.strict()`, zod retirerait `title`
     * sans un mot — la fuite resterait DANS la réponse HTTP, lisible dans n'importe
     * quel onglet réseau, et aucun test ne la verrait. Avec, la validation tombe et
     * le nom du champ est dans le message.
     */
    const c = copie(charge('journeys_publics'));
    premier(c)['title'] = 'Mes études à Lyon';
    const refus = publicJourneysResponseSchema.safeParse(c);
    expect(refus.success).toBe(false);
    expect(JSON.stringify(refus.error?.issues)).toContain('title');
  });

  it('REFUSE une checklist, une équipe ou des notes dans une vue publique', () => {
    for (const fuite of ['checklist', 'members', 'notes', 'targetArrivalDate', 'visibility']) {
      const c = copie(charge('journeys_publics'));
      premier(c)[fuite] = 'peu importe la valeur : la clé ne doit pas être là';
      expect(publicJourneysResponseSchema.safeParse(c).success).toBe(false);
    }
  });

  it('REFUSE un identifiant interne de membre dans la vue publique', () => {
    const c = copie(charge('journeys_publics'));
    sous(premier(c), 'member')['id'] = '01a0f63c-0199-7000-b398-a7b201340e80';
    // §3.7 nomme le membre par son HANDLE. Un identifiant interne offert à tous les
    // membres connectés est une surface d'énumération, pas une donnée d'affichage.
    expect(publicJourneysResponseSchema.safeParse(c).success).toBe(false);
  });
});

describe('le JOURNAL — `GET /journeys/:id/activities` (§3.8)', () => {
  it('accepte la charge relevée : trois entrées, en chronologie INVERSÉE', () => {
    const parsed = journeyActivitiesResponseSchema.parse(charge('journey_journal'));
    expect(parsed.items).toHaveLength(3);
    // Le relevé a joué : démarrer l'étape 1, la franchir, démarrer l'étape 2. Le
    // journal rend donc l'inverse, et ces trois types sont écrits en dur.
    expect(parsed.items.map((a) => a.type)).toEqual([
      'STEP_STARTED',
      'STEP_DONE',
      'STEP_STARTED',
    ]);
    expect(parsed.items[0]?.stepTitle).toBe('Constituer le dossier Campus France');
    expect(parsed.items[1]?.stepTitle).toBe('Choisir sa formation');
    expect(parsed.nextCursor).toBeNull();
  });

  it('`payload` varie selon le type, et le schéma ne le figera pas', () => {
    const parsed = journeyActivitiesResponseSchema.parse(charge('journey_journal'));
    // `STEP_STARTED` → `null`. `STEP_DONE` → `{ durationDays }`. Les deux passent,
    // et c'est voulu : le front n'a besoin que du libellé et de la date.
    expect(parsed.items[0]?.payload).toBeNull();
    expect(parsed.items[1]?.payload).toEqual({ durationDays: 0 });
  });

  it('REFUSE un journal SANS `nextCursor` — la seule liste paginée du module', () => {
    const c = copie(charge('journey_journal'));
    delete c['nextCursor'];
    /**
     * §5.3 : « null en fin de liste ». Un journal sans la clé serait pris pour une
     * fin d'historique, et l'écran J07 s'arrêterait au premier lot sans raison
     * visible. C'est l'inverse de `GET /journeys`, qui n'a PAS cette clé parce que
     * sa liste est bornée — les deux formes sont dans ce fichier, exprès.
     */
    expect(journeyActivitiesResponseSchema.safeParse(c).success).toBe(false);
    expect(journeysListResponseSchema.safeParse(charge('journeys_liste')).success).toBe(true);
  });

  it('REFUSE un type d’activité inventé', () => {
    const c = copie(charge('journey_journal'));
    premier(c)['type'] = 'STEP_FAILED';
    // §3.2, règle dure : « aucun état d'échec ». Le vocabulaire de l'échec n'existe
    // pas dans ce produit, et il n'entrera pas par une énumération laissée ouverte.
    expect(journeyActivitiesResponseSchema.safeParse(c).success).toBe(false);
  });
});

describe('témoins du second lot — ce qui ne décide rien reste VERT', () => {
  it('témoin : un champ ajouté au PARCOURS (pas à l’étape) ne casse rien', () => {
    /**
     * MUTATION TÉMOIN, et elle a une raison d'être ici : les `.strict()` posés sur
     * l'étape, le membre et la vue publique auraient pu l'être par réflexe, partout.
     * Ils ne le sont pas. `journey` lui-même reste ouvert, parce qu'aucune règle dure
     * n'interdit un champ de plus sur l'enveloppe du parcours — et qu'un front qui
     * tombe au premier ajout du serveur est un front qu'on n'ose plus faire évoluer.
     */
    const c = copie(charge('journey_equipe'));
    sous(c, 'journey')['nouveauChampDeDemain'] = 42;
    expect(journeyFullResponseSchema.safeParse(c).success).toBe(true);
  });

  it('témoin : un libellé de checklist quelconque passe — le schéma ne lit pas le texte', () => {
    const c = copie(charge('journey_equipe'));
    const steps = c['steps'] as Noeud[];
    const dossier = steps.find((s) => s['stepDefinitionCode'] === 'CAMPUS_FRANCE_FILE');
    ((dossier?.['checklist'] as Noeud[])[0] as Noeud)['label'] = 'Pièce d’identité';
    expect(journeyFullResponseSchema.safeParse(c).success).toBe(true);
  });

  it('témoin : une étape SANS les champs du propriétaire passe — c’est la vue d’un tiers', () => {
    /**
     * Ce témoin décrit ce que voit un ACCOMPAGNANT, et il doit rester vert : les
     * cinq clés du propriétaire sont `.optional()`, pas requises. S'il rougissait, un
     * accompagnant verrait « une erreur est survenue » sur un parcours qu'il a le
     * droit de lire — et la cause serait un schéma trop strict, pas une fuite.
     */
    const c = copie(charge('journey_equipe'));
    for (const step of c['steps'] as Noeud[]) {
      for (const cle of ['dueDate', 'dueDateManual', 'sharePromptDismissedAt', 'notes', 'checklist']) {
        delete step[cle];
      }
    }
    c['viewerRole'] = 'SUPPORTER';
    expect(journeyFullResponseSchema.safeParse(c).success).toBe(true);
  });

  it('témoin : le journal d’un parcours SANS activité passe — et ne prouve rien', () => {
    // Gardé NOMMÉ comme le cas « liste vide » au-dessus : `z.array` accepte `[]`
    // quel que soit l'élément, donc ce cas ne mesure pas la forme d'une entrée.
    const vide = { items: [], nextCursor: null, meta: charge('journey_journal')['meta'] };
    expect(journeyActivitiesResponseSchema.safeParse(vide).success).toBe(true);
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
