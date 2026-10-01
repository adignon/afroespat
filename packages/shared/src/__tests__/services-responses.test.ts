import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HOUSING_L2_EXPLANATION,
  HOUSING_SAFETY_BANNER,
  PRO_PHONE_ON_REQUEST_HINT,
  housingCardSchema,
  housingDetailResponseSchema,
  housingListResponseSchema,
  jobDetailResponseSchema,
  jobSeekersListResponseSchema,
  jobsListResponseSchema,
  myAlertsResponseSchema,
  myJobSeekerProfileResponseSchema,
  myProProfileResponseSchema,
  proCardSchema,
  proDetailResponseSchema,
  prosListResponseSchema,
  savedAlertSchema,
} from '../index.js';

/**
 * ─── LES SCHÉMAS DU MODULE SERVICES, ÉPROUVÉS SUR DES CHARGES RÉELLES ───────
 *
 * Les douze fixtures de ce fichier ont été RELEVÉES OCTET POUR OCTET sur l'API qui
 * tourne : deux membres créés par `POST /auth/otp/*`, une annonce publiée par
 * `POST /housing`, une offre par `POST /jobs` puis mise en avant par
 * `/sponsor`, une fiche pro par `PUT /me/pro-profile`, deux alertes par
 * `POST /me/alerts`. Aucun champ n'est déduit du code d'un service.
 *
 * ── POURQUOI PAS « EN LISANT LE SERVICE » ───────────────────────────────────
 *
 * Parce que la leçon est déjà payée. `myBlocksResponseSchema` avait été écrit sur
 * `BlocksService.list()`, qui rend un tableau nu : c'est le CONTRÔLEUR qui pose
 * l'enveloppe, une ligne plus haut. Le défaut n'est apparu qu'au navigateur, sur un
 * écran resté en attente, et aucun test ne nommait la cause.
 *
 * Ce module en portait DEUX de la même famille, et les charges les ont nommés :
 *
 *   1. `GET /jobs` et `GET /pros` rendent leur TÊTE (`sponsored`, `featured`) dans
 *      un champ À PART de `items`, qui les exclut. Un schéma écrit sur
 *      `pageSchema(card)` seul aurait accepté la réponse — `pageSchema` ignore les
 *      clés inconnues — et l'écran aurait perdu la pastille « Sponsorisée » et la
 *      mention « Fiche mise en avant », c'est-à-dire DEUX RÈGLES DURES, en silence.
 *   2. les dates arrivent en CHAÎNES ISO. Le service manipule des `Date` ;
 *      `z.date()` aurait refusé la vraie réponse.
 *
 * ── CE QUE CHAQUE CAS AFFIRME ───────────────────────────────────────────────
 *
 * Deux choses, et la seconde compte autant que la première :
 *   1. le schéma ACCEPTE la charge réelle — sans quoi l'écran ne s'affiche pas ;
 *   2. il REFUSE une charge amputée d'un champ que l'écran lit — sans quoi il ne
 *      protège de rien et laisserait passer un `undefined` jusqu'au JSX.
 */

const FIXTURES = join(import.meta.dirname, 'fixtures');

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8'));

/**
 * Les douze routes que les dix écrans du module lisent.
 *
 * `ampute` nomme le chemin d'un champ que l'ÉCRAN affiche : le retirer doit faire
 * refuser la charge. Sans cette colonne, le fichier ne prouverait que la moitié
 * facile — un schéma qui n'exigerait plus rien accepterait toujours la vraie
 * réponse, et passerait ces cas sans protéger personne.
 */
const ROUTES = [
  {
    nom: 'services_housing_list',
    route: 'GET /housing',
    schema: housingListResponseSchema,
    ampute: ['meta'],
  },
  {
    nom: 'services_housing_mine',
    route: 'GET /housing?scope=mine',
    schema: housingListResponseSchema,
    ampute: ['items'],
  },
  {
    nom: 'services_housing_detail',
    route: 'GET /housing/:id',
    schema: housingDetailResponseSchema,
    ampute: ['safetyBanner'],
  },
  {
    nom: 'services_jobs_list',
    route: 'GET /jobs',
    schema: jobsListResponseSchema,
    ampute: ['sponsored'],
  },
  {
    nom: 'services_job_detail',
    route: 'GET /jobs/:id',
    schema: jobDetailResponseSchema,
    ampute: ['sharedBy'],
  },
  {
    nom: 'services_job_seekers',
    route: 'GET /job-seekers',
    schema: jobSeekersListResponseSchema,
    ampute: ['items'],
  },
  {
    nom: 'services_my_job_seeker_profile',
    route: 'GET /me/job-seeker-profile',
    schema: myJobSeekerProfileResponseSchema,
    ampute: ['headline'],
  },
  {
    nom: 'services_pros_list',
    route: 'GET /pros',
    schema: prosListResponseSchema,
    ampute: ['featured'],
  },
  {
    nom: 'services_pro_detail',
    route: 'GET /pros/:id',
    schema: proDetailResponseSchema,
    ampute: ['contactQuota'],
  },
  {
    nom: 'services_my_pro_profile',
    route: 'GET /me/pro-profile',
    schema: myProProfileResponseSchema,
    ampute: ['hasProof'],
  },
  {
    nom: 'services_my_alerts',
    route: 'GET /me/alerts (Premium)',
    schema: myAlertsResponseSchema,
    ampute: ['meta'],
  },
  {
    nom: 'services_alerts_free',
    route: 'GET /me/alerts (gratuit)',
    schema: myAlertsResponseSchema,
    ampute: ['nextCursor'],
  },
] as const;

describe('les schémas du module Services acceptent les charges RÉELLES de l’API', () => {
  for (const { nom, route, schema } of ROUTES) {
    it(`${route} — la charge relevée est acceptée`, () => {
      const resultat = schema.safeParse(charge(nom));
      const detail = resultat.success
        ? ''
        : JSON.stringify(resultat.error.issues.slice(0, 4), null, 2);
      expect(resultat.success, `${route} refuse sa propre réponse :\n${detail}`).toBe(true);
    });
  }

  for (const { nom, route, schema, ampute } of ROUTES) {
    it(`${route} — une charge privée de « ${ampute.join('.')} » est REFUSÉE`, () => {
      const copie = structuredClone(charge(nom)) as Record<string, unknown>;
      delete copie[ampute[0]];
      expect(
        schema.safeParse(copie).success,
        `${route} accepte une réponse sans « ${ampute.join('.')} » : le schéma ne protège rien`,
      ).toBe(false);
    });
  }
});

/**
 * ─── CE QUE LES CHARGES RELEVÉES ONT APPRIS ─────────────────────────────────
 *
 * Trois faits de ces réponses ne se lisent dans aucun service, et chacun aurait
 * produit un schéma faux — ou un écran muet — s'il avait été déduit du code.
 */
describe('ce que les charges relevées ont appris', () => {
  it('`GET /jobs` met sa TÊTE SPONSORISÉE hors de `items` — et `items` l’exclut', () => {
    const corps = charge('services_jobs_list') as {
      items: { id: string }[];
      sponsored: { id: string; isSponsored: boolean; sponsoredLabel: string | null }[];
    };
    expect(corps.sponsored.length).toBeGreaterThan(0);
    const dansItems = new Set(corps.items.map((o) => o.id));
    for (const tete of corps.sponsored) {
      expect(dansItems.has(tete.id), 'la tête ne doit pas être répétée dans items').toBe(false);
      // RÈGLE DURE §11 : la pastille accompagne TOUJOURS l'offre mise en avant.
      expect(tete.isSponsored).toBe(true);
      expect(tete.sponsoredLabel).toBe('Sponsorisée');
    }
    /**
     * LA PREUVE QUE LE SCHÉMA SERT À QUELQUE CHOSE : `pageSchema(jobCardSchema)`
     * seul — ce qu'on écrit naturellement en lisant `Page<JobCard>` — ACCEPTE une
     * réponse à laquelle on a retiré la tête. Le nôtre la refuse.
     */
    const sansTete = structuredClone(corps) as Record<string, unknown>;
    delete sansTete['sponsored'];
    expect(jobsListResponseSchema.safeParse(sansTete).success).toBe(false);
  });

  it('`GET /pros` met sa TÊTE MISE EN AVANT hors de `items`, avec son libellé', () => {
    const corps = charge('services_pros_list') as {
      featured: { isFeatured: boolean; featuredLabel: string | null }[];
      meta: { featuredSlots: number };
    };
    expect(corps.featured.length).toBeGreaterThan(0);
    for (const fiche of corps.featured) {
      // §4.2 : « clairement signalé ».
      expect(fiche.isFeatured).toBe(true);
      expect(fiche.featuredLabel).toBe('Fiche mise en avant');
    }
    // §4.2 : « AU PLUS 2 fiches mises en avant en tête ».
    expect(corps.featured.length).toBeLessThanOrEqual(corps.meta.featuredSlots);
    expect(corps.meta.featuredSlots).toBe(2);
  });

  it('les dates arrivent en CHAÎNES ISO : un `z.date()` aurait refusé la vraie réponse', () => {
    const corps = charge('services_housing_detail') as { createdAt: unknown; expiresAt: unknown };
    expect(typeof corps.createdAt).toBe('string');
    expect(housingCardSchema.shape.createdAt.safeParse(new Date()).success).toBe(false);
    expect(housingCardSchema.shape.createdAt.safeParse(corps.createdAt).success).toBe(true);
  });

  it('`GET /me/alerts` d’un membre gratuit dit `isPremium: false` plutôt que de refuser', () => {
    const gratuit = charge('services_alerts_free') as {
      items: unknown[];
      meta: { isPremium: boolean };
    };
    expect(gratuit.items).toHaveLength(0);
    expect(gratuit.meta.isPremium).toBe(false);
    /**
     * §2.4 fait des alertes une fonction Premium, et c'est le SERVEUR qui le dit.
     * L'écran S10 lit `meta.isPremium` — jamais `users.plan` relu dans le front,
     * qui se tromperait le jour où un essai ou une grâce Mobile Money change la
     * réponse.
     */
    const premium = charge('services_my_alerts') as { meta: { isPremium: boolean } };
    expect(premium.meta.isPremium).toBe(true);
  });
});

/**
 * ─── RÈGLE DURE 10 §7, SUR LA CHARGE RÉELLE ────────────────────────────────
 *
 * « Publier un logement : aperçu du score de risque NON AFFICHÉ (interne). »
 *
 * La règle se tenait par le DESSIN tant que les écrans lisaient la maquette. Avec
 * l'API, elle se tient par le CONTRAT, et à deux étages : la charge relevée ne
 * porte aucun score, et le schéma REFUSE celle qui en porterait un.
 *
 * Le second étage est le seul qui survive au temps. Sans lui, un `riskScore` ajouté
 * au service un jour serait DÉPOUILLÉ EN SILENCE par zod : rien ne casserait, rien
 * ne s'afficherait, et personne n'apprendrait que le serveur l'envoie.
 */
describe('10 §7 — aucun score de risque, ni dans la charge ni dans le contrat', () => {
  const CHAMPS = /risk_?score|riskScore|risk_?flags|riskFlags|"flags"|moderationStatus/i;

  for (const nom of ['services_housing_list', 'services_housing_detail', 'services_housing_mine']) {
    it(`${nom}.json ne porte aucun champ de score ni de drapeau`, () => {
      expect(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8')).not.toMatch(CHAMPS);
    });
  }

  it('la charge ne dit du risque que sa TRANCHE, et elle vient d’une énumération à deux valeurs', () => {
    const detail = charge('services_housing_detail') as { cautionLevel: string };
    expect(['STANDARD', 'REINFORCED']).toContain(detail.cautionLevel);
    // Un niveau inventé est refusé : l'écran ne peut pas recevoir un troisième état.
    expect(housingCardSchema.shape.cautionLevel.safeParse('0.65').success).toBe(false);
  });

  it('greffer « riskScore » sur une annonce réelle la fait REFUSER', () => {
    const detail = charge('services_housing_detail') as Record<string, unknown>;
    expect(housingDetailResponseSchema.safeParse(detail).success).toBe(true);
    expect(
      housingDetailResponseSchema.safeParse({ ...detail, riskScore: 0.65 }).success,
      'un score greffé est accepté : il aurait atteint l’écran de publication (10 §7)',
    ).toBe(false);
    expect(
      housingDetailResponseSchema.safeParse({ ...detail, riskFlags: ['SCAM_TERMS'] }).success,
      'les drapeaux greffés sont acceptés : ils disent comment contourner le score',
    ).toBe(false);
  });

  it('greffer « riskScore » sur une CARTE de liste la fait REFUSER aussi', () => {
    const liste = charge('services_housing_list') as { items: Record<string, unknown>[] };
    const carte = liste.items[0];
    expect(carte).toBeDefined();
    if (carte === undefined) return;
    expect(housingCardSchema.safeParse(carte).success).toBe(true);
    expect(housingCardSchema.safeParse({ ...carte, riskScore: 0.65 }).success).toBe(false);
    /**
     * LA LISTE ENTIÈRE TOMBE, et c'est le but : la validation est faite à la
     * frontière, donc une seule annonce porteuse d'un score empêche l'écran de se
     * peindre, au lieu de le laisser afficher dix-neuf annonces propres et une qui
     * fuit.
     */
    const salie = structuredClone(liste);
    const premiere = salie.items[0];
    if (premiere !== undefined) premiere['riskScore'] = 0.65;
    expect(housingListResponseSchema.safeParse(salie).success).toBe(false);
  });
});

/**
 * ─── RÈGLE DURE 10 §4.1, SUR LA CHARGE RÉELLE ──────────────────────────────
 *
 * « Le téléphone n'est JAMAIS stocké ici ni affiché ; "sur demande" signifie que le
 * pro le communique lui-même en message. »
 *
 * Même structure de preuve, et même raison : le dessin ne protège plus rien dès que
 * les champs viennent du réseau.
 */
describe('10 §4.1 — aucun numéro de téléphone, ni dans la charge ni dans le contrat', () => {
  /**
   * Un numéro, dans les deux formes que le produit rencontre : l'international
   * (`+229 97 00 00 43`) et le français à dix chiffres. Le même détecteur que
   * `e2e/services.spec.ts` emploie sur le texte affiché, appliqué ici aux octets.
   */
  const NUMERO = /\+\d[\d\s.-]{7,}|\b0[1-9](?:[\s.-]?\d{2}){4}\b/;
  const CHAMPS = /"phone"|"phoneE164"|"e164"|"mobile"|"telephone"|"phoneNumber"/i;

  for (const nom of ['services_pros_list', 'services_pro_detail', 'services_my_pro_profile']) {
    it(`${nom}.json ne porte ni champ de numéro ni numéro`, () => {
      const octets = readFileSync(join(FIXTURES, `${nom}.json`), 'utf8');
      expect(octets).not.toMatch(CHAMPS);
      expect(octets).not.toMatch(NUMERO);
    });
  }

  /**
   * LA PREUVE DE NON-VACUITÉ DU DÉTECTEUR : le MÊME motif, appliqué à la charge de
   * `GET /me` — le seul endroit du produit où un numéro circule, et encore, masqué
   * — doit en TROUVER un. S'il se taisait là aussi, c'est le détecteur qui serait
   * cassé, pas l'annuaire qui serait propre.
   */
  it('le même détecteur TROUVE le masque de `GET /me` — il n’est donc pas aveugle', () => {
    const octets = readFileSync(join(FIXTURES, 'compte_me.json'), 'utf8');
    expect(octets).toMatch(/\+\d/);
    expect(octets).toMatch(/•/);
  });

  it('greffer un numéro sur une fiche pro réelle la fait REFUSER', () => {
    const fiche = charge('services_pro_detail') as Record<string, unknown>;
    expect(proDetailResponseSchema.safeParse(fiche).success).toBe(true);
    for (const champ of ['phone', 'phoneE164', 'mobile'] as const) {
      expect(
        proDetailResponseSchema.safeParse({ ...fiche, [champ]: '+33612345678' }).success,
        `« ${champ} » greffé sur une fiche pro est accepté : il aurait été affichable (10 §4.1)`,
      ).toBe(false);
    }
  });

  it('greffer un numéro sur une CARTE d’annuaire la fait REFUSER, et la liste avec', () => {
    const liste = charge('services_pros_list') as { featured: Record<string, unknown>[] };
    const carte = liste.featured[0];
    expect(carte).toBeDefined();
    if (carte === undefined) return;
    expect(proCardSchema.safeParse(carte).success).toBe(true);
    expect(proCardSchema.safeParse({ ...carte, phone: '+33612345678' }).success).toBe(false);

    const salie = structuredClone(liste);
    const premiere = salie.featured[0];
    if (premiere !== undefined) premiere['phone'] = '+33612345678';
    expect(prosListResponseSchema.safeParse(salie).success).toBe(false);
  });

  /**
   * `contactHint` N'EST PAS UNE PORTE DÉROBÉE, et il faut le dire plutôt que de
   * le supposer : c'est le seul champ de la fiche dont le nom pourrait abriter un
   * numéro. La charge relevée le rend `null` pour `PLATFORM_MESSAGE`, et la
   * constante que le serveur y met pour `PHONE_ON_REQUEST` dit explicitement que la
   * plateforme ne stocke pas le numéro.
   */
  it('`contactHint` ne porte aucun numéro : c’est la phrase de §4.1, pas un numéro caché', () => {
    const fiche = charge('services_pro_detail') as { contactHint: string | null };
    expect(fiche.contactHint).toBeNull();
    expect(PRO_PHONE_ON_REQUEST_HINT).not.toMatch(NUMERO);
    expect(PRO_PHONE_ON_REQUEST_HINT).toMatch(/ne le stocke pas/);
  });

  /**
   * LE JUSTIFICATIF NON PLUS : §4.1 en réserve l'accès à l'équipe. `PRO_SELECT` ne
   * le sélectionne pas, le contrôleur n'en rend qu'un booléen, et le `.strict()`
   * interdit qu'un identifiant réapparaisse.
   */
  it('`GET /me/pro-profile` ne rend qu’un booléen de justificatif, jamais son identifiant', () => {
    const fiche = charge('services_my_pro_profile') as Record<string, unknown>;
    expect(fiche).toHaveProperty('hasProof');
    expect(fiche).not.toHaveProperty('proofAssetId');
    expect(
      myProProfileResponseSchema.safeParse({
        ...fiche,
        proofAssetId: '01a0f136-fa93-7000-af7b-2cf7a8808a8d',
      }).success,
      'un identifiant de justificatif greffé est accepté : accès équipe seulement (10 §4.1)',
    ).toBe(false);
  });
});

/**
 * ─── 00 §49, SUR LA CHARGE RÉELLE ──────────────────────────────────────────
 *
 * « Aucun compteur de vues n'est exposé à personne, sur aucun contenu. »
 *
 * Le service INCRÉMENTE bien `viewCount` à chaque lecture de fiche et d'annonce —
 * c'est un compteur interne de modération — et c'est précisément pourquoi la
 * vérifier ici a du sens : la colonne existe, elle est écrite à chaque appel, et
 * rien d'autre que le `select` ne l'empêche de sortir.
 */
describe('00 §49 — aucun compteur de vues dans aucune charge du module', () => {
  const VUES = /view_?count|viewCount|"views"/i;

  for (const { nom } of ROUTES) {
    it(`${nom}.json n’expose aucun compteur de vues`, () => {
      expect(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8')).not.toMatch(VUES);
    });
  }

  it('greffer « viewCount » sur une annonce réelle la fait REFUSER', () => {
    const detail = charge('services_housing_detail') as Record<string, unknown>;
    expect(housingDetailResponseSchema.safeParse({ ...detail, viewCount: 412 }).success).toBe(false);
  });

  /**
   * CE QUE LA RÈGLE AUTORISE, ET QUE L'API N'ENVOIE PAS : la planche S09 écrit
   * « 6 contacts · expire dans 12 jours ». `expiresAt` est là ; le COMPTEUR DE
   * CONTACTS n'existe dans aucun champ de `HousingCard`. Écart signalé au porteur —
   * l'écran affiche donc l'expiration seule, et on ne compose pas un nombre de
   * contacts que personne n'a envoyé.
   */
  it('le compteur de CONTACTS de S09 n’existe dans aucun champ — écart signalé', () => {
    const mine = charge('services_housing_mine') as { items: Record<string, unknown>[] };
    const premiere = mine.items[0];
    expect(premiere).toBeDefined();
    if (premiere === undefined) return;
    expect(Object.keys(premiere)).toContain('expiresAt');
    expect(Object.keys(premiere)).not.toContain('contactCount');
    expect(Object.keys(premiere)).not.toContain('contactsCount');
  });
});

/**
 * ─── LE BANDEAU DE §2.2 VIENT DU SERVEUR, ET IL EST REQUIS ─────────────────
 *
 * RÈGLE DURE : « renvoyé par l'API sur chaque liste et chaque annonce, et affiché
 * en permanence. » Le champ est donc REQUIS dans les deux schémas — une réponse
 * sans bandeau est une réponse cassée, et l'accepter laisserait l'écran se peindre
 * sans l'avertissement.
 */
describe('10 §2.2 — le bandeau de non-paiement voyage avec chaque réponse', () => {
  it('il est là sur la liste ET sur l’annonce, avec le texte de la spec', () => {
    const liste = charge('services_housing_list') as { meta: { safetyBanner: string } };
    const detail = charge('services_housing_detail') as { safetyBanner: string };
    expect(liste.meta.safetyBanner).toBe(HOUSING_SAFETY_BANNER);
    expect(detail.safetyBanner).toBe(HOUSING_SAFETY_BANNER);
    expect(HOUSING_SAFETY_BANNER).toMatch(/^Aucun versement avant visite/);
  });

  it('une liste sans bandeau est REFUSÉE, et une annonce sans bandeau aussi', () => {
    const liste = charge('services_housing_list') as { meta: Record<string, unknown> };
    const sansBandeau = structuredClone(liste);
    delete sansBandeau.meta['safetyBanner'];
    expect(housingListResponseSchema.safeParse(sansBandeau).success).toBe(false);

    const detail = charge('services_housing_detail') as Record<string, unknown>;
    const nu = structuredClone(detail);
    delete nu['safetyBanner'];
    expect(housingDetailResponseSchema.safeParse(nu).success).toBe(false);
  });

  /**
   * 10 §2.1 — LE FORMULAIRE GRISÉ A SA DONNÉE, ET IL LUI MANQUE UN ENDROIT.
   *
   * `meta.canPublish` et `meta.publishRequirement` sont exactement ce que la carte
   * « PUBLIER · SOUS L2 » de la planche « ÉTATS » de S01 décrit mot pour mot. La
   * charge le prouve : relevée avec un membre L0, elle dit `false` et porte la
   * phrase. Ce qui manque n'est pas la donnée, c'est l'emplacement dans la maquette.
   * Signalé au porteur, pas comblé.
   */
  it('la donnée du formulaire grisé de §2.1 EXISTE dans `meta` — c’est l’emplacement qui manque', () => {
    const vueL0 = charge('services_housing_list') as {
      meta: { canPublish: boolean; publishRequirement: string };
    };
    const vueL2 = charge('services_housing_mine') as { meta: { canPublish: boolean } };
    expect(vueL0.meta.canPublish, 'relevée avec un membre L0').toBe(false);
    expect(vueL2.meta.canPublish, 'relevée avec le membre L2 auteur').toBe(true);
    expect(vueL0.meta.publishRequirement).toBe(HOUSING_L2_EXPLANATION);
  });
});

/**
 * ─── UNE ALERTE RELIT SES PROPRES CRITÈRES ─────────────────────────────────
 *
 * `criteria` est relu par `alertCriteriaSchema` plutôt que laissé en `unknown` : il
 * a été ÉCRIT par ce même schéma à la création. Un `z.record(z.unknown())` aurait
 * accepté n'importe quoi, et l'écran S10 aurait lu des critères inexistants.
 */
describe('une alerte relit ses critères avec le schéma qui les a écrits', () => {
  it('les deux alertes relevées passent, et un critère inventé est refusé', () => {
    const corps = charge('services_my_alerts') as { items: unknown[] };
    expect(corps.items).toHaveLength(2);
    for (const alerte of corps.items) expect(savedAlertSchema.safeParse(alerte).success).toBe(true);

    const premiere = structuredClone(corps.items[0]) as { criteria: Record<string, unknown> };
    premiere.criteria['cityName'] = 'Lyon';
    expect(
      savedAlertSchema.safeParse(premiere).success,
      'un critère que la création n’accepte pas est accepté à la lecture : les deux vocabulaires divergent',
    ).toBe(false);
  });
});
