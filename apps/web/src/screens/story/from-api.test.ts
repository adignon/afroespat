import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createStorySchema,
  FEED_LIMITS,
  storyDetailResponseSchema,
} from '@app/shared';
import { storyLueFrom } from './from-api';

/**
 * LA STORY EN LECTURE, ÉPROUVÉE SUR UNE CHARGE RÉELLE, ET LES DEUX RÈGLES DURES.
 *
 * La fixture est relevée OCTET POUR OCTET sur une API qui tournait, et elle est
 * PARSÉE par le schéma partagé avant d'entrer dans le convertisseur : c'est la
 * chaîne complète qui est éprouvée, pas le convertisseur seul contre un objet
 * façonné à sa mesure.
 *
 * Les deux règles dures de §2.6 sont gardées ici, et il faut dire OÙ chacune est
 * tenue, sinon le test ne veut rien dire :
 *
 *   · « AUCUN COMPTEUR DE VUES » est tenu À LA FRONTIÈRE, par le `.strict()` de
 *     `storyBubbleSchema`. Ce fichier vérifie que la frontière refuse vraiment, et
 *     que le convertisseur n'en fabrique pas un de son côté ;
 *   · « 280 CARACTÈRES » est tenu par `createStorySchema` à l'écriture. Ce fichier
 *     vérifie que la borne est bien celle-là, et qu'elle refuse le 281e.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

const brut = JSON.parse(
  readFileSync(resolve(FIXTURES, 'story_detail.json'), 'utf8'),
) as Record<string, unknown>;

const detail = storyDetailResponseSchema.parse(brut);
const vue = storyLueFrom(detail);

describe('la story lue, convertie pour A13', () => {
  it('la fixture porte de quoi éprouver — sinon tout ce qui suit est creux', () => {
    expect(detail.story.body.length).toBeGreaterThan(0);
    expect(detail.story.votes.positiveLabel.length).toBeGreaterThan(0);
    expect(detail.story.stateLine.length).toBeGreaterThan(0);
  });

  /**
   * LE VOCABULAIRE DE VOTE VIENT DU SERVEUR, jamais d'une table recopiée ici.
   *
   * §2.6 accepte DEUX `kind` par type, et le serveur refuse
   * `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré 422) si l'on se trompe. Une seconde table
   * dans le front ferait proposer « Je confirme » sur une découverte.
   *
   * Le test MUTE la charge — il change les deux libellés — et vérifie que la vue
   * suit. S'il existait une table locale, les libellés d'origine réapparaîtraient.
   */
  it('les deux libellés de vote sont ceux du serveur, et le convertisseur les suit', () => {
    expect(vue.a1).toBe(detail.story.votes.positiveLabel);
    expect(vue.a2).toBe(detail.story.votes.negativeLabel);

    const autre = storyDetailResponseSchema.parse({
      ...(brut as { story: Record<string, unknown>; meta: unknown }),
      story: {
        ...(brut['story'] as Record<string, unknown>),
        votes: {
          ...((brut['story'] as Record<string, unknown>)['votes'] as Record<string, unknown>),
          positiveLabel: 'Ça aide',
          negativeLabel: 'Ça n’aide pas',
        },
      },
    });
    const vue2 = storyLueFrom(autre);
    expect(vue2.a1).toBe('Ça aide');
    expect(vue2.a2).toBe('Ça n’aide pas');
  });

  /**
   * LE BOUTON EST ACTIF QUAND C'EST MON VOTE, jamais quand le compteur est haut.
   * Déduire l'état du compteur allumerait le bouton de tout le monde dès qu'une
   * story marche bien.
   */
  it('« utile » est allumé par MON vote, pas par le compteur', () => {
    expect(vue.useful).toBe(detail.story.myReaction === detail.story.votes.positiveKind);
    expect(vue.mine).toBe(detail.story.myReaction);
  });

  /** §2.6 : les deux seuls `kind` acceptés voyagent AVEC la story. */
  it('la vue porte les deux kinds que le serveur acceptera pour CETTE story', () => {
    expect(vue.positiveKind).toBe(detail.story.votes.positiveKind);
    expect(vue.negativeKind).toBe(detail.story.votes.negativeKind);
  });

  /** §2.6 : la ligne d'état et la ligne de contexte sont COMPOSÉES PAR LE SERVEUR. */
  it('la ligne d’état et le contexte ne sont pas recomposés ici', () => {
    expect(vue.state).toBe(detail.story.stateLine);
    expect(vue.sub).toBe(detail.story.context.text);
  });

  /**
   * LE MUR CONNU : `backgroundUrl` vaut TOUJOURS `null`, le service ne résolvant
   * jamais `backgroundAssetId` en URL. Une story à fond image est donc
   * indessinable. Ce test ne le répare pas — c'est du back — il le CONSTATE, pour
   * que le jour où le back le branche, quelqu'un vienne lire ce commentaire.
   */
  it('le fond image n’est pas résolu par l’API — constat, pas correction', () => {
    expect(detail.story.backgroundUrl).toBeNull();
    expect(vue.photo).toBe(false);
    expect(vue.bg).toBe(detail.story.backgroundColor);
  });

  /**
   * UN SEUL SEGMENT DE PROGRESSION. `GET /stories/:id` rend UNE story, pas la série
   * de son auteur. En dessiner trois — comme la planche, qui illustre une série —
   * laisserait croire qu'il y en a deux de plus à faire défiler.
   */
  it('un seul segment de progression, parce qu’une seule story est servie', () => {
    expect(vue.bars).toEqual(['100%']);
  });

  /**
   * LES VISAGES DE CEUX QUI CONFIRMENT : aucune route ne les donne. Le serveur rend
   * le NOMBRE, jamais la liste. On n'invente pas de visages.
   */
  it('aucun visage de confirmation n’est fabriqué', () => {
    expect(vue.confirmers).toBeNull();
  });
});

describe('RÈGLE DURE — aucun compteur de vues sur une story', () => {
  /**
   * La règle est structurelle, et c'est là qu'elle vaut : un objet PERMISSIF
   * accepterait `viewCount` en silence, et un écran pourrait l'afficher sans
   * qu'aucun test de schéma ne le voie. Mesuré avant le `.strict()` : `viewCount:
   * 412` greffé sur une bulle passait la validation sans un mot.
   */
  it('une charge portant `viewCount` est REFUSÉE à la frontière', () => {
    const greffe = {
      ...(brut as { story: Record<string, unknown>; meta: unknown }),
      story: { ...(brut['story'] as Record<string, unknown>), viewCount: 412 },
    };
    expect(() => storyDetailResponseSchema.parse(greffe)).toThrow();
  });

  it('et la même charge SANS le greffon passe — sinon le test ci-dessus ne prouve rien', () => {
    expect(() => storyDetailResponseSchema.parse(brut)).not.toThrow();
  });

  it('le convertisseur n’en fabrique aucun de son côté', () => {
    const clefs = Object.keys(vue);
    for (const interdite of ['viewCount', 'views', 'vues', 'seenCount']) {
      expect(clefs).not.toContain(interdite);
    }
  });
});

describe('RÈGLE DURE — une story est bornée à 280 caractères', () => {
  const corps = (n: number) => 'a'.repeat(n);
  const base = {
    type: 'CONSEIL' as const,
    backgroundColor: '#1B4332' as const,
    textStyle: 'BOLD' as const,
    audience: 'ALL' as const,
    allowMessages: true,
  };

  it('la borne est bien 280, et elle est déclarée une seule fois', () => {
    expect(FEED_LIMITS.storyBodyMax).toBe(280);
  });

  it('280 passe', () => {
    expect(() => createStorySchema.parse({ ...base, body: corps(280) })).not.toThrow();
  });

  it('281 est REFUSÉ', () => {
    expect(() => createStorySchema.parse({ ...base, body: corps(281) })).toThrow();
  });

  /**
   * La charge relevée le montre aussi : la story de la fixture tient dans la borne.
   * Sans cette vérification, le couple de tests ci-dessus pourrait garder une borne
   * que l'API réelle ne respecte pas.
   */
  it('la story relevée sur l’API tient dans la borne', () => {
    expect(detail.story.body.length).toBeLessThanOrEqual(FEED_LIMITS.storyBodyMax);
  });

  /**
   * §2.6 : « une couleur de fond OU une image de fond, pas les deux ». C'est la
   * même règle qui rend `backgroundUrl` indessinable aujourd'hui — elle est tenue
   * par un `refine`, donc par le schéma, pas par un écran.
   */
  it('une story ne peut pas avoir deux fonds à la fois', () => {
    expect(() =>
      createStorySchema.parse({
        ...base,
        body: corps(10),
        backgroundAssetId: '01a0f10d-da8f-7000-a91a-a0c6efe0b1d3',
      }),
    ).toThrow();
  });
});
