import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IMPACT_METRICS,
  adminCitiesResponseSchema,
  adminCitySchema,
  adminImpactResponseSchema,
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
