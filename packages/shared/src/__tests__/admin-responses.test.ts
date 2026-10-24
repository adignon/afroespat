import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IMPACT_METRICS,
  adminAuditResponseSchema,
  adminCitiesResponseSchema,
  adminCitySchema,
  adminDashboardResponseSchema,
  adminImpactResponseSchema,
  adminMemberDetailSchema,
  adminMembersResponseSchema,
  adminModerationCaseDetailSchema,
  adminModerationCasesResponseSchema,
  adminModerationStatsResponseSchema,
  adminPlansResponseSchema,
  adminProProfilesResponseSchema,
  adminStaffResponseSchema,
  metricPointSchema,
} from '../index.js';

/**
 * ─── LES SCHÉMAS DU MODULE ÉQUIPE, ÉPROUVÉS SUR DES CHARGES RÉELLES ─────────
 *
 * Les deux fixtures ont été RELEVÉES sur l'API qui tourne, avec une VRAIE session
 * d'équipe — compte créé en argon2id au coût de production, TOTP enrôlé, puis
 * `POST /admin/auth/login` suivi de `POST /admin/auth/totp`. Aucun champ n'est
 * déduit du code d'un service.
 *
 * ── POURQUOI LA FIXTURE ÉTAIT INDISPENSABLE ICI, PLUS QU'AILLEURS ───────────
 *
 * AUCUN des handlers des six contrôleurs d'équipe ne déclare de DTO de réponse ni
 * de type de retour explicite : tout est inféré de l'appel au service. Lire le
 * service aurait donc donné sa forme INTERNE, pas celle du JSON — et c'est
 * exactement l'erreur que `myBlocksResponseSchema` a commise dans le module Compte
 * (un tableau nu là où le contrôleur posait `{ items }` une ligne plus haut),
 * trouvée seulement au navigateur.
 *
 * Deux surprises mesurées, qu'aucune lecture de service n'aurait données :
 *
 *   · `dimension` est une CHAÎNE VIDE quand la mesure n'est pas ventilée, pas
 *     `null` ni absente. Un schéma écrit « au mieux » l'aurait déclarée nullable, et
 *     tout `?? 'tous'` dans un écran n'aurait JAMAIS déclenché ;
 *   · `isPilot` est bien là, à `true` sur Paris. Il était servi depuis le début et
 *     affiché par personne — c'est le point de départ de ce lot.
 */

const FIXTURES = join(__dirname, 'fixtures');
const lire = (nom: string): unknown => JSON.parse(readFileSync(join(FIXTURES, nom), 'utf8'));

describe('GET /v1/admin/ref/cities — la vue d’équipe d’une ville (D08)', () => {
  const charge = lire('admin_ref_cities.json');

  it('la charge réelle est acceptée', () => {
    const r = adminCitiesResponseSchema.safeParse(charge);
    expect(r.success ? null : r.error.issues).toBeNull();
  });

  /**
   * LE CHAMP QUI A MOTIVÉ LE LOT, affirmé nommément.
   *
   * `isPilot` est dérivé par le serveur de `PILOT_CITY_SLUG` (« paris ») et non
   * stocké. Ce test ne garde pas une curiosité : il garde le fait que la réponse le
   * PORTE, donc qu'un écran peut l'afficher. Le jour où la route cesse de le
   * joindre, D08 afficherait « Active » là où il affiche « Pilote », sans erreur.
   */
  it('[LE REPÈRE QUI N’ÉTAIT AFFICHÉ PAR PERSONNE] `isPilot` est présent, et vrai sur Paris', () => {
    const r = adminCitiesResponseSchema.parse(charge);
    const pilotes = r.items.filter((v) => v.isPilot);
    expect(pilotes).toHaveLength(1);
    expect(pilotes[0]?.slug).toBe('paris');
    // Et les autres villes le portent à `false`, pas `undefined` : c'est un booléen
    // servi pour toutes, pas une clé posée seulement sur la pilote.
    for (const v of r.items) expect(typeof v.isPilot).toBe('boolean');
  });

  it('la charge couvre les trois cas de 02 §4.2 — ouverte, à ouvrir, et la pilote', () => {
    const r = adminCitiesResponseSchema.parse(charge);
    expect(r.items.some((v) => v.isActive)).toBe(true);
    expect(r.items.some((v) => !v.isActive)).toBe(true);
    expect(r.items.some((v) => v.isPilot)).toBe(true);
  });

  /**
   * ── CHARGE AMPUTÉE → REFUSÉE ───────────────────────────────────────────────
   *
   * Un champ retiré doit faire LEVER à la frontière, et non propager `undefined`
   * jusqu'à un tableau qui affiche des cases vides. Chaque cas retire un champ
   * différent, parce qu'un seul cas ne prouve que le champ qu'il retire.
   */
  it('[FRONTIÈRE] une ville amputée d’un champ est REFUSÉE, et le champ est nommé', () => {
    const r = adminCitiesResponseSchema.parse(charge);
    for (const champ of ['name', 'isActive', 'memberCount', 'isPilot', 'country'] as const) {
      const ville: Record<string, unknown> = { ...r.items[0] };
      delete ville[champ];
      const essai = adminCitySchema.safeParse(ville);
      expect(essai.success, `« ${champ} » retiré est passé : la frontière ne tient pas`).toBe(false);
      if (!essai.success) {
        expect(essai.error.issues.some((i) => i.path.join('.') === champ)).toBe(true);
      }
    }
  });

  /**
   * ── `.strict()` : UN CHAMP GREFFÉ EST REFUSÉ, PAS DÉPOUILLÉ ────────────────
   *
   * Sans `.strict()`, zod retire les clés inconnues EN SILENCE. C'est précisément
   * comment `isPilot` a pu être servi et ignoré pendant tout ce temps : une couche
   * permissive l'aurait fait disparaître sans un mot.
   *
   * Le comportement voulu est l'inverse : une colonne ajoutée à cette route ARRÊTE
   * l'écran, ce qui est bruyant, donc corrigé.
   */
  it('[STRICT] un champ greffé est REFUSÉ plutôt que dépouillé en silence', () => {
    const r = adminCitiesResponseSchema.parse(charge);
    const greffee = { ...r.items[0], quotable: true, phoneE164: '+33612345678' };
    expect(adminCitySchema.safeParse(greffee).success).toBe(false);

    // Et la preuve que le refus vient bien de `.strict()` : sans la greffe, ça passe.
    expect(adminCitySchema.safeParse({ ...r.items[0] }).success).toBe(true);
  });

  /**
   * `region` EST NULLABLE, et le test le dit même si l'échantillon n'en montre
   * aucune à `null`.
   *
   * On suit le CONTRAT (`region String?` au schéma Prisma) et non l'échantillon :
   * les vingt villes relevées en portaient toutes une, et un schéma calqué sur
   * l'échantillon aurait refusé la première ville sans région — en production, un
   * mardi.
   */
  it('`region` nulle est acceptée : le schéma suit le contrat, pas l’échantillon', () => {
    const r = adminCitiesResponseSchema.parse(charge);
    expect(adminCitySchema.safeParse({ ...r.items[0], region: null }).success).toBe(true);
  });
});

describe('GET /v1/admin/impact — le rapport d’impact (D16, 15 §5.3)', () => {
  const charge = lire('admin_impact.json');

  it('la charge réelle est acceptée', () => {
    const r = adminImpactResponseSchema.safeParse(charge);
    expect(r.success ? null : r.error.issues).toBeNull();
  });

  /**
   * LES CINQ MESURES QUE D16 AFFICHE SONT BIEN SERVIES.
   *
   * Ce test contredit une affirmation que ce dépôt portait par écrit : « D02 et D16
   * reposent sur `metric_snapshots`, table que §6 ajoute et qui manque au schéma ».
   * La route répond 200 et ces cinq mesures y sont. L'affirmation était fausse, et
   * elle avait servi de raison de ne pas brancher l'écran.
   */
  it('les cinq mesures de la première planche sont présentes, non ventilées', () => {
    const r = adminImpactResponseSchema.parse(charge);
    for (const nom of [
      IMPACT_METRICS.membresAccompagnes,
      IMPACT_METRICS.parcoursAboutis,
      IMPACT_METRICS.presences,
      IMPACT_METRICS.entraidesResolues,
      IMPACT_METRICS.parrainagesAboutis,
    ]) {
      const point = r.items.find((p) => p.metric === nom && p.dimension === '');
      expect(point, `la mesure « ${nom} » manque à la charge réelle`).toBeDefined();
    }
  });

  /**
   * `dimension` EST UNE CHAÎNE VIDE, PAS `null` — mesuré, et la nuance décide.
   *
   * Les mesures ventilées (`impact.members_by_city`) portent un UUID ; les autres
   * portent `''`. Un écran qui filtrerait sur `dimension === null` ne trouverait
   * jamais rien, et afficherait zéro partout sans erreur.
   */
  it('`dimension` vaut «» pour un total et un UUID pour une ventilation', () => {
    const r = adminImpactResponseSchema.parse(charge);
    const total = r.items.find((p) => p.metric === IMPACT_METRICS.membresAccompagnes);
    expect(total?.dimension).toBe('');
    const ventile = r.items.filter((p) => p.metric === IMPACT_METRICS.membresParVille);
    expect(ventile.length).toBeGreaterThan(0);
    for (const p of ventile) expect(p.dimension).not.toBe('');
  });

  /** Le trimestre vient du SERVEUR, et sa forme est « AAAA-TN ». */
  it('le trimestre est nommé par le serveur, au format AAAA-TN', () => {
    const r = adminImpactResponseSchema.parse(charge);
    expect(r.trimestre).toMatch(/^\d{4}-T[1-4]$/);
  });

  it('[FRONTIÈRE] une charge amputée de `trimestre` ou d’`items` est REFUSÉE', () => {
    const sansTrimestre: Record<string, unknown> = { ...(charge as object) };
    delete sansTrimestre['trimestre'];
    expect(adminImpactResponseSchema.safeParse(sansTrimestre).success).toBe(false);

    const sansItems: Record<string, unknown> = { ...(charge as object) };
    delete sansItems['items'];
    expect(adminImpactResponseSchema.safeParse(sansItems).success).toBe(false);
  });

  it('[FRONTIÈRE] un point de mesure amputé est REFUSÉ', () => {
    const r = adminImpactResponseSchema.parse(charge);
    for (const champ of ['metric', 'dimension', 'value', 'periodStart'] as const) {
      const point: Record<string, unknown> = { ...r.items[0] };
      delete point[champ];
      expect(
        metricPointSchema.safeParse(point).success,
        `« ${champ} » retiré est passé`,
      ).toBe(false);
    }
  });

  /**
   * ── LE MUR DES TÉMOIGNAGES, AFFIRMÉ COMME UNE ABSENCE ─────────────────────
   *
   * D16 dessine « Témoignages citables ». L'accord de l'auteur se lirait dans
   * `guides.quotable` et `city_tips.quotable`, DEUX COLONNES QUI N'EXISTENT PAS au
   * schéma — et `GET /admin/impact` ne rend donc aucun témoignage.
   *
   * Ce test garde l'ABSENCE, et ce n'est pas un test vide : si quelqu'un se met un
   * jour à joindre des citations à cette route sans que les colonnes d'accord
   * existent, `.strict()` refuse la réponse et ce test le dit en nommant la règle.
   * Citer un membre sans son accord est exactement ce que ces colonnes manquantes
   * existent pour empêcher.
   */
  it('[RÈGLE DURE] aucun témoignage n’est servi : l’accord de l’auteur n’existe pas au schéma', () => {
    const avecCitation = {
      ...(charge as { trimestre: string; items: unknown[] }),
      temoignages: [{ texte: 'Le parrainage change tout.', prenom: 'Kofi', ville: 'Lyon' }],
    };
    expect(
      adminImpactResponseSchema.safeParse(avecCitation).success,
      'un témoignage joint à cette route serait publié sans accord vérifiable : ' +
        '`guides.quotable` et `city_tips.quotable` n’existent pas au schéma.',
    ).toBe(false);
  });
});

/**
 * ─── LA FICHE MEMBRE — ET LA RÈGLE DURE DU §3.1 ────────────────────────────
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ « L'application admin n'affiche JAMAIS un numéro de téléphone en clair.» │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La route la tient : la charge relevée porte `masked` (« +229 •• •• •• 31 ») et
 * aucun autre champ de numéro. Les tests ci-dessous gardent cette propriété À LA
 * FRONTIÈRE DU FRONT, et il faut dire pourquoi c'est le bon endroit.
 *
 * Le JSX n'affiche que ce qu'on lui passe : un écran qui n'afficherait pas le
 * numéro ne prouve rien, parce que la RÉPONSE, elle, aurait déjà traversé le
 * réseau et serait dans le navigateur d'un membre de l'équipe — dans l'onglet
 * réseau, dans un journal d'erreur, dans une copie d'écran de support. La seule
 * place où le front peut REFUSER cette donnée est le schéma qui la valide.
 *
 * C'est aussi pourquoi `.strict()` est le mécanisme et non une liste de champs
 * interdits : la façon dont cela arrivera n'est pas « quelqu'un ajoute
 * `phoneClear` », c'est « quelqu'un élargit d'une ligne le `select` Prisma de la
 * jointure `phones` ». Un schéma permissif dépouillerait le champ EN SILENCE et
 * la fuite serait invisible ; `.strict()` arrête l'écran.
 */
describe('GET /v1/admin/users/:id — la fiche membre (D03, 15 §3.1)', () => {
  const charge = lire('admin_member_detail.json');

  it('la charge réelle est acceptée', () => {
    const r = adminMemberDetailSchema.safeParse(charge);
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[RÈGLE DURE] le numéro n’arrive que MASQUÉ, et le masque est bien un masque', () => {
    const fiche = adminMemberDetailSchema.parse(charge);
    expect(fiche.phones.length).toBeGreaterThan(0);
    for (const tel of fiche.phones) {
      /**
       * Le masque de `CryptoService.maskPhone` : indicatif, des paires de points
       * médians, les DEUX derniers chiffres. On vérifie qu'il en porte — un champ
       * nommé `masked` qui contiendrait le numéro entier passerait n'importe quel
       * test de présence, et c'est précisément le défaut qu'on veut exclure.
       */
      expect(tel.masked, 'un numéro « masqué » sans masque n’est pas masqué').toContain('••');
      /** Au plus deux chiffres à la suite : jamais un bloc national complet. */
      expect(
        /\d{3,}/.test(tel.masked.replace(/^\+\d{1,4}/, '')),
        `« ${tel.masked} » laisse voir trois chiffres consécutifs hors indicatif — ` +
          'la règle dure §3.1 interdit le numéro en clair.',
      ).toBe(false);
    }
  });

  it('[RÈGLE DURE] un champ de numéro GREFFÉ sur la jointure est REFUSÉ, pas dépouillé', () => {
    /**
     * LA MUTATION QUI COMPTE. Elle imite la façon dont la fuite arriverait pour de
     * vrai : un `select` Prisma élargi d'une ligne, qui ajoute le champ chiffré ou
     * l'empreinte à côté du masque. Les deux doivent être REFUSÉS.
     */
    for (const greffe of ['phoneEncrypted', 'phoneHmac', 'e164', 'phone']) {
      const fiche = charge as { phones: Record<string, unknown>[] };
      const altere = {
        ...fiche,
        phones: fiche.phones.map((t) => ({ ...t, [greffe]: '+229 97 00 00 31' })),
      };
      expect(
        adminMemberDetailSchema.safeParse(altere).success,
        `« ${greffe} » greffé sur la jointure des numéros a traversé le schéma. ` +
          'Sans `.strict()`, zod le dépouille EN SILENCE et le numéro est déjà ' +
          'arrivé dans le navigateur (règle dure 15 §3.1).',
      ).toBe(false);
    }
  });

  it('[RÈGLE DURE] la RECHERCHE de membres ne porte aucun numéro, même masqué', () => {
    /**
     * La liste est un endroit plus dangereux que la fiche : on y voit cinquante
     * membres d'un coup, alors que la fiche se consulte un membre à la fois et
     * laisse une trace d'audit. La route n'en rend aucun — ce test garde l'absence.
     */
    const liste = adminMembersResponseSchema.parse(lire('admin_members_search.json'));
    for (const ligne of liste.items) {
      expect(Object.keys(ligne)).not.toContain('phones');
      expect(JSON.stringify(ligne)).not.toContain('••');
    }
  });

  it('[STRICT] un champ greffé sur la LIGNE de recherche est refusé', () => {
    const liste = lire('admin_members_search.json') as { items: Record<string, unknown>[] };
    const altere = {
      ...liste,
      items: liste.items.map((l) => ({ ...l, phones: [{ masked: '+33 6 •• •• •• 18' }] })),
    };
    expect(
      adminMembersResponseSchema.safeParse(altere).success,
      'un numéro, même masqué, greffé sur la LIGNE de recherche élargirait ce qu’un ' +
        'rôle voit de cinquante dossiers à la fois.',
    ).toBe(false);
  });
});

/**
 * ─── LES COMPTES D'ÉQUIPE — LE SECRET TOTP N'EST JAMAIS RENDU ──────────────
 *
 * Un test d'intégration du module vérifie déjà que la réponse ne contient pas la
 * chaîne « totpSecret ». Celui-ci garde la même propriété à la frontière du front,
 * et pour la raison habituelle : c'est là que le champ arriverait sans bruit.
 */
describe('GET /v1/admin/staff — les comptes d’équipe (D15, 15 §2.2)', () => {
  const charge = lire('admin_staff.json');

  it('la charge réelle est acceptée', () => {
    const r = adminStaffResponseSchema.safeParse(charge);
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[RÈGLE DURE] l’enrôlement TOTP est un BOOLÉEN, et le secret n’est pas là', () => {
    const liste = adminStaffResponseSchema.parse(charge);
    expect(liste.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(liste)).not.toContain('totpSecret');
    for (const compte of liste.items) expect(typeof compte.totpEnrolled).toBe('boolean');
  });

  it('[STRICT] un secret greffé sur un compte d’équipe est REFUSÉ', () => {
    const liste = charge as { items: Record<string, unknown>[] };
    for (const greffe of ['totpSecret', 'totpSecretEncrypted', 'passwordHash']) {
      const altere = { ...liste, items: liste.items.map((c) => ({ ...c, [greffe]: 'ABCDEF' })) };
      expect(
        adminStaffResponseSchema.safeParse(altere).success,
        `« ${greffe} » a traversé le schéma des comptes d’équipe.`,
      ).toBe(false);
    }
  });
});

/**
 * ─── LA FILE ET LE DOSSIER DE MODÉRATION ───────────────────────────────────
 *
 * Ce qui est gardé ici n'est pas une règle dure mais deux faits mesurés que
 * l'échantillon seul aurait fait manquer, et dont le second est un piège
 * d'affichage.
 */
describe('GET /v1/admin/moderation — la file et le dossier (D04, D05)', () => {
  it('[RELEVÉ AU NAVIGATEUR] accepte un dossier sans passage IA (`aiVerdict` nul)', () => {
    const base = adminModerationCasesResponseSchema.parse(lire('admin_moderation_cases.json'));
    const ligne = { ...(base.items[0] ?? {}), aiVerdict: null, aiScore: null, aiLabels: [] };
    const r = adminModerationCasesResponseSchema.safeParse({ items: [ligne], nextCursor: null });
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('la charge réelle de la file est acceptée', () => {
    const r = adminModerationCasesResponseSchema.safeParse(lire('admin_moderation_cases.json'));
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('la charge réelle d’un dossier est acceptée', () => {
    const r = adminModerationCaseDetailSchema.safeParse(lire('admin_moderation_case.json'));
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[MESURÉ] la file ne porte NI nom d’auteur NI nombre de signalements', () => {
    /**
     * Ce test garde une ABSENCE, et c'est utile : il documente pourquoi le tableau
     * de D04 reste dessiné. Si la route gagne un jour ces deux champs, `.strict()`
     * le fait rougir, et ce message dit quoi en faire — lier la file.
     */
    const file = adminModerationCasesResponseSchema.parse(lire('admin_moderation_cases.json'));
    for (const ligne of file.items) {
      const cles = Object.keys(ligne);
      expect(cles).not.toContain('reportCount');
      expect(cles).not.toContain('subjectAuthor');
      expect(cles).not.toContain('author');
    }
  });

  it('[MESURÉ] `aiScore` est une confiance dans [0,1], jamais un pourcentage', () => {
    const file = adminModerationCasesResponseSchema.parse(lire('admin_moderation_cases.json'));
    for (const ligne of file.items) {
      if (ligne.aiScore === null) continue;
      expect(ligne.aiScore).toBeLessThanOrEqual(1);
    }
    /** Un score servi en pourcentage doit ARRÊTER l'écran, pas s'afficher. */
    const brut = lire('admin_moderation_cases.json') as { items: Record<string, unknown>[] };
    const altere = { ...brut, items: brut.items.map((l) => ({ ...l, aiScore: 95 })) };
    expect(adminModerationCasesResponseSchema.safeParse(altere).success).toBe(false);
  });
});

/**
 * ─── LES COMPTEURS DE LA FILE, ET DEUX CHAMPS NULLABLES ────────────────────
 *
 * Le test qui suit est celui que l'échantillon SEUL n'aurait pas écrit, et c'est
 * sa seule raison d'être : la charge relevée portait `slaComplianceRate` et
 * `averageResolutionMs` non nuls, parce que la base de développement a des
 * dossiers résolus. `ModerationService.stats` rend `null` pour les deux quand il
 * n'y en a aucun. Un schéma écrit sur l'échantillon les aurait déclarés requis, et
 * l'écran se serait cassé sur une file NEUVE — c'est-à-dire le premier jour.
 */
describe('GET /v1/admin/moderation/stats — les compteurs (D04)', () => {
  const charge = lire('admin_moderation_stats.json');

  it('la charge réelle est acceptée', () => {
    const r = adminModerationStatsResponseSchema.safeParse(charge);
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[NULLABILITÉ] une file sans dossier résolu est acceptée', () => {
    const neuve = {
      ...(charge as Record<string, unknown>),
      slaComplianceRate: null,
      averageResolutionMs: null,
      resolvedSampleSize: 0,
    };
    const r = adminModerationStatsResponseSchema.safeParse(neuve);
    expect(
      r.success ? '' : JSON.stringify(r.error.issues),
      'le jour du lancement, aucun dossier n’est résolu et ces deux champs sont ' +
        'nuls. Les déclarer requis aurait cassé l’écran précisément ce jour-là.',
    ).toBe('');
  });

  it('[MESURÉ] le taux de respect du SLA est une PROPORTION, pas un pourcentage', () => {
    const stats = adminModerationStatsResponseSchema.parse(charge);
    if (stats.slaComplianceRate !== null) expect(stats.slaComplianceRate).toBeLessThanOrEqual(1);
    const altere = { ...(charge as Record<string, unknown>), slaComplianceRate: 93 };
    expect(
      adminModerationStatsResponseSchema.safeParse(altere).success,
      'un taux servi en pourcentage doit arrêter l’écran : affiché tel quel il ' +
        'donnerait « 9 300 % ».',
    ).toBe(false);
  });

  it('[MESURÉ] la file compte OPEN + IN_REVIEW, et c’est plus que le seul OPEN', () => {
    /**
     * Les deux nombres du produit ne comptent pas la même chose, et ce test fige la
     * différence pour qu'elle ne soit pas prise pour un défaut : `openByPriority`
     * est un `GROUP BY` sur `status IN ('OPEN','IN_REVIEW')`, tandis que
     * `moderation.cases_by_status/OPEN` du tableau de bord ne retient qu'`OPEN`.
     */
    const stats = adminModerationStatsResponseSchema.parse(charge);
    const file = Object.values(stats.openByPriority).reduce((t, n) => t + n, 0);
    const ouverts = (
      adminDashboardResponseSchema.parse(lire('admin_dashboard.json')).blocks['moderation'] ?? []
    ).find((p) => p.metric === 'moderation.cases_by_status' && p.dimension === 'OPEN');
    expect(ouverts).toBeDefined();
    expect(
      file,
      'la file (OPEN + IN_REVIEW) ne peut pas être plus PETITE que les seuls OPEN.',
    ).toBeGreaterThanOrEqual(ouverts?.value ?? 0);
  });
});

/**
 * ─── LES FICHES PRO ET LES PLANS ───────────────────────────────────────────
 */
describe('GET /v1/admin/pro-profiles et /billing/plans (D10, D14)', () => {
  it('la charge réelle d’une fiche pro est acceptée', () => {
    const r = adminProProfilesResponseSchema.safeParse(lire('admin_pro_profiles.json'));
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[RÈGLE DURE] une fiche pro ne porte aucun numéro : `contactMethod` est un CHOIX', () => {
    /**
     * `PHONE_ON_REQUEST` dit que le membre accepte d'être appelé — ce n'est pas un
     * numéro, et la route n'en rend aucun. Un écran de validation de justificatif
     * n'a pas besoin du numéro, et §3.1 ne lui en donne pas le droit.
     */
    const liste = adminProProfilesResponseSchema.parse(lire('admin_pro_profiles.json'));
    for (const fiche of liste.items) {
      expect(['PLATFORM_MESSAGE', 'EMAIL', 'PHONE_ON_REQUEST']).toContain(fiche.contactMethod);
      expect(JSON.stringify(fiche)).not.toContain('••');
      expect(Object.keys(fiche)).not.toContain('phone');
    }
  });

  it('[MESURÉ] l’enveloppe des plans N’A PAS de `nextCursor`, contrairement au §5.3', () => {
    /**
     * Mesuré, et c'est un écart réel : `/billing/plans`, `/billing/revenue` et
     * `/billing/affiliate` rendent `{ items }` tout court, là où les onze autres
     * listes d'équipe rendent `{ items, nextCursor }`. Le schéma décrit ce qui est
     * SERVI ; l'écart est remonté. Ce test fige la mesure pour que, le jour où la
     * route se met en conformité, on l'apprenne ici plutôt qu'à l'écran.
     */
    const brut = lire('admin_plans.json') as Record<string, unknown>;
    expect(Object.keys(brut)).toEqual(['items']);
    const r = adminPlansResponseSchema.safeParse(brut);
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[MESURÉ] les plans ne sont servis qu’en EUR : la colonne XOF de D14 n’a pas de source', () => {
    const plans = adminPlansResponseSchema.parse(lire('admin_plans.json'));
    expect(plans.items.length).toBeGreaterThan(0);
    for (const plan of plans.items) expect(plan.currency).toBe('EUR');
  });
});

/**
 * ─── LE JOURNAL D'AUDIT ────────────────────────────────────────────────────
 */
describe('GET /v1/admin/audit — le journal (D15, 15 §2.3, §8.4)', () => {
  const charge = lire('admin_audit.json');

  it('la charge réelle est acceptée', () => {
    const r = adminAuditResponseSchema.safeParse(charge);
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[RELEVÉ AU NAVIGATEUR] accepte une action système (sans acteur) et sans cible', () => {
    const ligne = { id: '01a16d0c-241d-7000-a951-7163c608f668', createdAt: '2026-10-24T08:34:34.654Z', actorType: 'SYSTEM', actorId: null, action: 'metrics.refresh', targetType: 'system', targetId: null, metadata: null, ip: null };
    const r = adminAuditResponseSchema.safeParse({ items: [ligne], nextCursor: null });
    expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('');
  });

  it('[MESURÉ] l’acteur est un IDENTIFIANT, jamais un nom — la colonne ACTEUR de D15', () => {
    /**
     * Ce test garde l'absence qui explique pourquoi le journal de D15 reste
     * dessiné. La maquette écrit « R. Adjovi » ; la route rend un UUID et un type.
     * Le nom ne se résout que par `GET /admin/staff`, QUI EXIGE SUPER_ADMIN alors
     * que le journal est ouvert aux quatre rôles — l'appeler rendrait les Réglages
     * 403 pour trois rôles sur quatre.
     */
    const journal = adminAuditResponseSchema.parse(charge);
    expect(journal.items.length).toBeGreaterThan(0);
    for (const ligne of journal.items) {
      expect(['STAFF', 'SYSTEM', 'MEMBER']).toContain(ligne.actorType);
      expect(Object.keys(ligne)).not.toContain('actorName');
      expect(Object.keys(ligne)).not.toContain('actorDisplayName');
    }
  });
});
