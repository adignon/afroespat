import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  helpCanHelpResponseSchema,
  helpCardSchema,
  helpDetailResponseSchema,
  helpListResponseSchema,
  helpMemberSchema,
  helpMineResponseSchema,
  helpMyResponsesResponseSchema,
  helpPrivateReplyResponseSchema,
  helpResponseCreatedSchema,
  mentorCardResponseSchema,
  mentorCardSchema,
  mentorProfileResponseSchema,
  mentorshipAcceptedSchema,
  mentorshipCreatedSchema,
  mentorsResponseSchema,
  myMentorshipsResponseSchema,
} from '../index.js';

/**
 * ─── LES SCHÉMAS DE L'ENTRAIDE ET DU PARRAINAGE, SUR DES CHARGES RÉELLES ────
 *
 * Les dix-huit fixtures de ce fichier ont été RELEVÉES sur l'API qui tourne, avec
 * des membres créés pour l'occasion : une demande publiée, une réponse écrite, un
 * marquage « ça m'a aidé », un profil de parrain posé, un parrainage demandé,
 * accepté, terminé et évalué des deux côtés. Aucun champ n'est déduit du code d'un
 * service.
 *
 * ── CE QUE CHAQUE ROUTE AFFIRME, EN DEUX MOITIÉS ────────────────────────────
 *
 *   1. le schéma ACCEPTE la charge réelle — sans quoi l'écran reste en attente ;
 *   2. il REFUSE une charge amputée d'un champ que l'écran LIT — sans quoi il ne
 *      protège de rien et laisse passer un `undefined` jusqu'au JSX.
 *
 * La seconde moitié n'est pas du zèle : un schéma dont tous les champs seraient
 * facultatifs accepterait toujours la vraie réponse, et passerait la première
 * moitié sans protéger qui que ce soit.
 *
 * ── TROIS PIÈGES QUE SEULE LA CHARGE RELEVÉE POUVAIT MONTRER ────────────────
 *
 * Ils ont chacun leur cas nommé, plus bas. Résumé : `POST /help` rend le détail
 * complet et non `{ id }` ; `dueDate` est une colonne `@db.Date` qui se sérialise
 * en horodatage complet ; `GET /me/mentorships` n'a pas de `nextCursor`.
 */

const FIXTURES = join(import.meta.dirname, 'fixtures');

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8'));

/**
 * Les routes que les dix écrans H01 à H10 lisent et écrivent.
 *
 * `ampute` nomme le chemin d'un champ que l'ÉCRAN affiche. Le retirer doit faire
 * refuser la charge.
 */
const ROUTES = [
  /**
   * L'AMPUTATION DE `GET /help` DESCEND JUSQU'À `meta.safetyBanner`, ET PAS
   * SEULEMENT JUSQU'À `meta`. C'est une MUTATION qui l'a imposé.
   *
   * Elle visait `meta` entier, et le test passait. Puis le harnais de mutation a
   * rendu `safetyBanner` FACULTATIF dans `helpMetaSchema` — c'est-à-dire a cassé
   * la règle dure de §2.7, « chaque page de la section affiche cette phrase en
   * permanence » — et AUCUN test n'est mort. Le verdict était « CREUX », au mot
   * près : le schéma annonçait garder le bandeau, et rien ne le vérifiait.
   *
   * Retirer `meta` entier ne pouvait pas l'attraper : un `meta` absent échoue de
   * toute façon, quelle que soit la facultativité de ses champs. Il faut viser LE
   * CHAMP que la règle nomme.
   */
  {
    nom: 'entraide_liste',
    route: 'GET /help',
    schema: helpListResponseSchema,
    ampute: ['meta', 'safetyBanner'],
    ecran: 'H01',
  },
  {
    nom: 'entraide_can_help',
    route: 'GET /help/can-help',
    schema: helpCanHelpResponseSchema,
    ampute: ['nextCursor'],
    ecran: 'H04',
  },
  {
    nom: 'entraide_mes_demandes',
    route: 'GET /help/mine',
    schema: helpMineResponseSchema,
    ampute: ['items'],
    ecran: 'H09',
  },
  {
    nom: 'entraide_mes_reponses',
    route: 'GET /help/my-responses',
    schema: helpMyResponsesResponseSchema,
    ampute: ['items'],
    ecran: 'H10',
  },
  {
    nom: 'entraide_detail_auteur',
    route: 'GET /help/:id (auteur)',
    schema: helpDetailResponseSchema,
    ampute: ['responses'],
    ecran: 'H02',
  },
  {
    nom: 'entraide_detail_autre',
    route: 'GET /help/:id (autre membre)',
    schema: helpDetailResponseSchema,
    ampute: ['request'],
    ecran: 'H02',
  },
  {
    nom: 'entraide_publiee',
    route: 'POST /help',
    schema: helpDetailResponseSchema,
    ampute: ['journeyContext'],
    ecran: 'H03',
  },
  {
    nom: 'entraide_publiee_echeance',
    route: 'POST /help (avec échéance)',
    schema: helpDetailResponseSchema,
    ampute: ['meta', 'useServicesHint'],
    ecran: 'H03',
  },
  {
    nom: 'entraide_reponse_creee',
    route: 'POST /help/:id/responses',
    schema: helpResponseCreatedSchema,
    ampute: ['id'],
    ecran: 'H02',
  },
  /**
   * MÊME LEÇON QUE `meta.safetyBanner` ci-dessus, côté parrainage : §2.4 fait
   * voyager `moneyBanner` avec chaque réponse — « un parrainage est gratuit et
   * bénévole » — et c'est LE CHAMP qu'il faut viser, pas son `meta`.
   */
  {
    nom: 'parrainage_mentors',
    route: 'GET /mentors',
    schema: mentorsResponseSchema,
    ampute: ['meta', 'moneyBanner'],
    ecran: 'H05',
  },
  {
    nom: 'parrainage_fiche',
    route: 'GET /mentors/:handle',
    schema: mentorCardResponseSchema,
    ampute: ['reviews'],
    ecran: 'H06',
  },
  {
    nom: 'parrainage_fiche_evaluee',
    route: 'GET /mentors/:handle (évaluée)',
    schema: mentorCardResponseSchema,
    ampute: ['availability'],
    ecran: 'H06',
  },
  {
    nom: 'parrainage_profil_pose',
    route: 'PUT /me/mentor-profile',
    schema: mentorProfileResponseSchema,
    ampute: ['maxMentees'],
    ecran: 'H08',
  },
  {
    nom: 'parrainage_demande',
    route: 'POST /mentorships',
    schema: mentorshipCreatedSchema,
    ampute: ['expiresAt'],
    ecran: 'H06',
  },
  {
    nom: 'parrainage_acceptation',
    route: 'POST /mentorships/:id/accept',
    schema: mentorshipAcceptedSchema,
    ampute: ['conversationId'],
    ecran: 'H07',
  },
  {
    nom: 'parrainage_mes_parrainages_attente',
    route: 'GET /me/mentorships (attente)',
    schema: myMentorshipsResponseSchema,
    ampute: ['items'],
    ecran: 'H07',
  },
  {
    nom: 'parrainage_mes_parrainages_actif',
    route: 'GET /me/mentorships (actif)',
    schema: myMentorshipsResponseSchema,
    ampute: ['meta', 'moneyBanner'],
    ecran: 'H07',
  },
  {
    nom: 'parrainage_mes_parrainages_passes',
    route: 'GET /me/mentorships (passés)',
    schema: myMentorshipsResponseSchema,
    ampute: ['items'],
    ecran: 'H07',
  },
] as const;

describe('les schémas de l’entraide acceptent les charges RÉELLES de l’API', () => {
  for (const { nom, route, schema, ecran } of ROUTES) {
    it(`${route} — la charge relevée est acceptée (${ecran})`, () => {
      const resultat = schema.safeParse(charge(nom));
      const detail = resultat.success
        ? ''
        : JSON.stringify(resultat.error.issues.slice(0, 4), null, 2);
      expect(resultat.success, `${route} refuse sa propre réponse :\n${detail}`).toBe(true);
    });
  }

  /**
   * L'AMPUTATION DESCEND DANS LE CHEMIN, et son échec est NOMMÉ.
   *
   * Les dix-huit chemins de `ROUTES` sont tous d'un seul niveau aujourd'hui, et une
   * première version en avait tiré un raccourci : `delete copie[chemin[0]]`, point.
   * C'est la borne écrite à la main qui devient fausse par accumulation — le jour où
   * quelqu'un ajoute `['request', 'title']`, le raccourci supprimerait `request`
   * ENTIER, le schéma refuserait pour la mauvaise raison, et le test passerait au
   * vert en ne prouvant plus ce qu'il annonce.
   *
   * La descente est donc écrite, et un chemin qui ne mène nulle part ÉCHOUE en se
   * nommant plutôt que de ne rien supprimer en silence.
   */
  for (const { nom, route, schema, ampute } of ROUTES) {
    it(`${route} — une charge privée de « ${ampute.join('.')} » est REFUSÉE`, () => {
      const copie = structuredClone(charge(nom));
      const chemin = [...ampute] as string[];
      const feuille = chemin.pop();
      expect(feuille, 'un chemin d’amputation vide ne retire rien').toBeDefined();

      let parent: Record<string, unknown> = copie as Record<string, unknown>;
      for (const pas of chemin) {
        const suivant = parent[pas];
        expect(
          typeof suivant === 'object' && suivant !== null,
          `${route} : « ${ampute.join('.')} » traverse « ${pas} », qui n’est pas un objet dans la charge relevée`,
        ).toBe(true);
        parent = suivant as Record<string, unknown>;
      }
      expect(
        feuille !== undefined && feuille in parent,
        `${route} : « ${ampute.join('.')} » n’existe pas dans la charge relevée — l’amputation ne retirerait rien`,
      ).toBe(true);
      if (feuille !== undefined) delete parent[feuille];

      expect(
        schema.safeParse(copie).success,
        `${route} accepte une réponse sans « ${ampute.join('.')} » : le schéma ne protège rien`,
      ).toBe(false);
    });
  }
});

/**
 * ─── RÈGLE DURE (01 §2.1) : AUCUN NUMÉRO DE TÉLÉPHONE EN CLAIR ──────────────
 *
 * `08 Compte` tenait cette règle PAR LE DESSIN sur K04 — « +229 •• •• •• 42 » —
 * et le transcodage la conservait par construction. `05 Entraide` ne la tient par
 * rien : elle n'écrit AUCUN numéro, masqué ou non, sur aucun de ses vingt cadres.
 * Le dessin ne protège donc rien ici, et la règle n'a qu'un rempart : le schéma de
 * réponse.
 *
 * Les formes de ce module portent l'identité de MEMBRES TIERS — l'auteur d'une
 * demande, l'auteur d'une réponse, un parrain qu'on ne connaît pas. C'est
 * exactement la surface où un numéro joint par erreur serait le plus grave : il
 * atteindrait un membre qui n'a aucune relation avec son propriétaire.
 */
describe('aucun numéro de téléphone ne peut transiter par l’entraide', () => {
  const auteur = (charge('entraide_liste') as { items: { author: unknown }[] }).items[0]
    ?.author as Record<string, unknown>;
  const fiche = charge('parrainage_fiche') as Record<string, unknown>;

  it('aucune charge relevée ne contient de numéro, masqué ou non', () => {
    for (const { nom } of ROUTES) {
      const texte = JSON.stringify(charge(nom));
      expect(/\+\d{6,}/.test(texte), `${nom} contient une suite qui ressemble à un numéro`).toBe(
        false,
      );
      expect(/"(phone|phoneE164|masked|phoneNumber)"/.test(texte), `${nom} porte un champ de numéro`).toBe(
        false,
      );
    }
  });

  it('greffer un numéro sur l’auteur d’une demande fait REFUSER la réponse', () => {
    expect(helpMemberSchema.safeParse(auteur).success).toBe(true);
    expect(
      helpMemberSchema.safeParse({ ...auteur, phone: '+22997000042' }).success,
      'un numéro greffé sur l’auteur est accepté : il aurait transité (01 §2.1)',
    ).toBe(false);
    expect(
      helpMemberSchema.safeParse({ ...auteur, masked: '+229 •• •• •• 42' }).success,
      'même MASQUÉ, un numéro n’a rien à faire sur l’auteur d’une demande publique',
    ).toBe(false);
  });

  it('greffer un numéro sur la fiche d’un parrain fait REFUSER la réponse', () => {
    expect(mentorCardSchema.safeParse(fiche).success).toBe(false); // la fiche porte `reviews` et `meta`
    expect(mentorCardResponseSchema.safeParse(fiche).success).toBe(true);
    expect(
      mentorCardResponseSchema.safeParse({ ...fiche, phone: '+33600000018' }).success,
      'un numéro greffé sur la fiche d’un parrain est accepté : il aurait transité',
    ).toBe(false);
  });

  /**
   * §3.2, RÈGLE DURE : « aucun compteur de contacts » sur la fiche d'un parrain.
   * Sans `.strict()`, un `connectionCount` ajouté côté serveur serait dépouillé EN
   * SILENCE — la donnée aurait traversé le réseau, et la règle serait fausse sans
   * que rien ne l'indique.
   */
  it('greffer un compteur de contacts sur la fiche d’un parrain fait REFUSER (§3.2)', () => {
    expect(
      mentorCardResponseSchema.safeParse({ ...fiche, connectionCount: 42 }).success,
      'un compteur de contacts est accepté sur la fiche : 08 §3.2 l’interdit',
    ).toBe(false);
  });
});

/**
 * ─── RÈGLE DURE (§2.5, 04 §2) : LE TYPE DE PARCOURS, JAMAIS SON TITRE ───────
 *
 * Le contexte de parcours d'une demande nomme l'ÉTAPE et le TYPE de parcours. Le
 * titre personnel — « Mes études à Lyon » — n'est même pas lu en base par le
 * service, et il ne doit pas réapparaître par une clé greffée.
 */
describe('le contexte de parcours ne porte jamais le titre personnel', () => {
  it('greffer un `journeyTitle` sur le contexte fait REFUSER la réponse', () => {
    const detail = structuredClone(charge('entraide_detail_auteur')) as Record<string, unknown>;
    detail['journeyContext'] = {
      stepName: 'Logement',
      journeyTypeName: 'Études',
      dueDate: null,
      dueInDays: null,
    };
    expect(helpDetailResponseSchema.safeParse(detail).success).toBe(true);

    detail['journeyContext'] = {
      stepName: 'Logement',
      journeyTypeName: 'Études',
      dueDate: null,
      dueInDays: null,
      journeyTitle: 'Mes études à Lyon',
    };
    expect(
      helpDetailResponseSchema.safeParse(detail).success,
      'le titre personnel du parcours est accepté : 04 §2 l’interdit',
    ).toBe(false);
  });
});

/**
 * ─── RÈGLE DURE DU MODULE : AUCUNE MISE EN RELATION QUI CONTOURNE UN BLOCAGE ─
 *
 * Elle se tient d'abord dans l'API, et elle y tient : mesuré sur la base réelle,
 * un membre bloqué prend `404` sur le détail, `404` sur la réponse publique et
 * `404` sur la réponse privée, et la demande sort des deux listes, dans les deux
 * sens. Le rapport de lot porte le tableau.
 *
 * Ce que le SCHÉMA ajoute est la moitié que l'API ne peut pas tenir seule : la
 * forme d'une mise en relation est `.strict()`, donc une réponse qui porterait un
 * identifiant de conversation là où la règle veut un refus ne peut pas se glisser
 * à côté des champs attendus.
 *
 * ET `other: null` EST LA FORME DU BLOCAGE. `GET /me/mentorships` met `other` à
 * `null` dès qu'un blocage sépare les deux membres : le parrainage reste listé — il
 * a existé — mais sans nom, sans pseudo et sans identifiant. Un schéma qui
 * exigerait `other` ferait échouer la page ENTIÈRE de H07 au premier blocage, et
 * l'écran afficherait son bandeau d'erreur au lieu de la ligne muette.
 */
describe('aucune mise en relation ne contourne un blocage', () => {
  it('H07 accepte une ligne dont `other` est nul — c’est la forme d’un blocage (§4)', () => {
    const corps = structuredClone(charge('parrainage_mes_parrainages_actif')) as {
      items: Record<string, unknown>[];
    };
    const ligne = corps.items[0];
    expect(ligne, 'la fixture doit porter au moins un parrainage').toBeDefined();
    if (ligne === undefined) return;

    expect(myMentorshipsResponseSchema.safeParse(corps).success).toBe(true);
    ligne['other'] = null;
    expect(
      myMentorshipsResponseSchema.safeParse(corps).success,
      '`other: null` est refusé : H07 afficherait une erreur dès qu’un membre est bloqué',
    ).toBe(true);
  });

  it('`other` ne peut pas porter un champ greffé : ce serait un contournement', () => {
    const corps = structuredClone(charge('parrainage_mes_parrainages_actif')) as {
      items: Record<string, unknown>[];
    };
    const ligne = corps.items[0];
    if (ligne === undefined) return;
    ligne['other'] = {
      ...(ligne['other'] as Record<string, unknown>),
      phone: '+22997000042',
    };
    expect(
      myMentorshipsResponseSchema.safeParse(corps).success,
      'un numéro greffé sur le membre d’un parrainage est accepté',
    ).toBe(false);
  });

  it('la réponse privée est une forme FERMÉE : rien ne s’y greffe', () => {
    const vrai = { conversationId: '01a0f4db-6815-7000-9de9-191cf19de0bd', created: true };
    expect(helpPrivateReplyResponseSchema.safeParse(vrai).success).toBe(true);
    expect(
      helpPrivateReplyResponseSchema.safeParse({ ...vrai, bypassedBlock: true }).success,
      'un champ greffé sur une mise en relation est accepté',
    ).toBe(false);
    expect(
      helpPrivateReplyResponseSchema.safeParse({ conversationId: vrai.conversationId }).success,
      '`created` manquant est accepté : l’écran ne saurait plus si la conversation est neuve',
    ).toBe(false);
  });
});

/**
 * ─── CE QUE LES CHARGES RELEVÉES ONT APPRIS ─────────────────────────────────
 *
 * Trois faits qui ne se lisent dans aucun service, et qui auraient chacun produit
 * un schéma faux s'il avait été déduit du code.
 */
describe('ce que les charges relevées ont appris', () => {
  it('`POST /help` rend le DÉTAIL COMPLET, pas `{ id }`', () => {
    const corps = charge('entraide_publiee') as Record<string, unknown>;
    expect(corps['id'], 'un client qui lirait `corps.id` aurait `undefined`').toBeUndefined();
    expect(Object.keys(corps).sort()).toEqual(['journeyContext', 'meta', 'request', 'responses']);
    expect(helpDetailResponseSchema.safeParse(corps).success).toBe(true);
    // Et la forme qu'on aurait écrite en lisant le nom de la route est refusée.
    expect(helpResponseCreatedSchema.safeParse(corps).success).toBe(false);
  });

  it('`dueDate` est une colonne `@db.Date` qui se sérialise en HORODATAGE COMPLET', () => {
    const corps = charge('entraide_publiee_echeance') as {
      request: { dueDate: string | null };
    };
    expect(corps.request.dueDate).toBe('2026-10-09T00:00:00.000Z');
    /**
     * Le réflexe, en lisant `@db.Date` dans le schéma Prisma, est d'écrire
     * `z.string().date()`. Il REFUSE cette valeur — c'est le piège, et il est
     * figé ici pour qu'une « simplification » future le rencontre.
     */
    expect(helpCardSchema.shape.dueDate.safeParse('2026-10-09').success).toBe(false);
    expect(helpCardSchema.shape.dueDate.safeParse(corps.request.dueDate).success).toBe(true);
  });

  it('`GET /me/mentorships` n’a PAS de `nextCursor` : il borne à cent lignes', () => {
    const corps = charge('parrainage_mes_parrainages_actif') as Record<string, unknown>;
    expect(Object.keys(corps).sort()).toEqual(['items', 'meta']);
    expect(corps['nextCursor']).toBeUndefined();
    /**
     * `pageSchema` ici ferait REFUSER la réponse réelle — c'est l'erreur que
     * `myBlocksResponseSchema` a commise une fois, et qui n'a été trouvée qu'au
     * navigateur, sur un écran resté en attente.
     */
    expect(myMentorshipsResponseSchema.safeParse({ ...corps, nextCursor: null }).success).toBe(
      false,
    );
  });

  /**
   * ÉCART MESURÉ, REMONTÉ AU PORTEUR : la première branche de §2.4 est morte.
   *
   * « Visibles seulement une fois les deux évaluations déposées OU après 14 jours ».
   * `visibleReviewsFor()` ne lit que les évaluations dont le membre est le SUJET,
   * puis exige `>= 2` sur le même parrainage — or il n'y en a jamais plus d'UNE par
   * sujet. La fiche d'un parrain reste donc muette quatorze jours après chaque
   * parrainage, alors que les deux évaluations sont bien déposées.
   *
   * Les deux fixtures le montrent : `parrainage_fiche` (deux évaluations en base,
   * `reviews: []`) et `parrainage_fiche_evaluee` (même fiche, `ended_at` reculé de
   * vingt jours, l'évaluation paraît).
   */
  it('les évaluations d’une fiche parrain n’apparaissent qu’après 14 jours (écart §2.4)', () => {
    const muette = charge('parrainage_fiche') as { reviews: unknown[] };
    const parlante = charge('parrainage_fiche_evaluee') as { reviews: unknown[] };
    expect(muette.reviews).toHaveLength(0);
    expect(parlante.reviews.length).toBeGreaterThan(0);
    // Les deux formes sont acceptées : l'écart est un défaut d'AFFICHAGE côté API,
    // pas une forme à refuser. Le schéma le décrit, le rapport le signale.
    expect(mentorCardResponseSchema.safeParse(muette).success).toBe(true);
    expect(mentorCardResponseSchema.safeParse(parlante).success).toBe(true);
  });

  /**
   * ÉCART MESURÉ : deux modules rendent `avatarUrl` différemment sous le même nom.
   * `helpMemberSchema` reçoit `/media/<clé>` composé par `HelpService.summary()` ;
   * `mentorCardSchema` reçoit la CLÉ DE STOCKAGE BRUTE. Un écran qui poserait les
   * deux dans un même `<img src>` en afficherait un sur deux.
   */
  it('`avatarUrl` n’a pas la même forme dans l’entraide et dans le parrainage', () => {
    const service = helpMemberSchema.shape.avatarUrl;
    const parrain = mentorCardSchema.shape.avatarUrl;
    // Les deux acceptent une chaîne : le schéma ne peut pas trancher pour l'API.
    expect(service.safeParse('/media/abc').success).toBe(true);
    expect(parrain.safeParse('abc').success).toBe(true);
    // Ce qui est figé, c'est que les deux soient nullables — un avatar manque souvent.
    expect(service.safeParse(null).success).toBe(true);
    expect(parrain.safeParse(null).success).toBe(true);
  });
});
