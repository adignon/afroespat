import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  NEVER_PAID_CAPABILITIES,
  containsForbiddenWord,
  levelSatisfies,
} from '../index.js';

describe('matrice des capacités (§7.3)', () => {
  it('les niveaux sont cumulatifs', () => {
    expect(levelSatisfies('L2', 'post.create')).toBe(true);
    expect(levelSatisfies('L1', 'post.create')).toBe(true);
    expect(levelSatisfies('L0', 'post.create')).toBe(false);
    expect(levelSatisfies('L1', 'housing.publish')).toBe(false);
    expect(levelSatisfies('L2', 'housing.publish')).toBe(true);
  });

  it('le parcours et la demande d’aide sont ouverts dès L0 — un pré-départ doit pouvoir démarrer', () => {
    for (const cap of ['journey.create', 'journey.manage', 'help.ask', 'mentorship.request'] as const) {
      expect(levelSatisfies('L0', cap)).toBe(true);
    }
  });

  it('seul le logement, le parrainage et la fiche pro exigent L2', () => {
    const l2 = CAPABILITY_KEYS.filter((k) => CAPABILITIES[k].minLevel === 'L2');
    expect(l2.sort()).toEqual(['housing.publish', 'mentor.become', 'pro.register']);
  });

  // RÈGLE DURE 14 §2 — rien de ce qui relève de l'aide n'est jamais payant.
  it('l’entraide, les guides, le parrainage et les réseaux ne dépendent jamais d’un plan', () => {
    for (const cap of [
      'help.ask',
      'help.offer',
      'guide.write',
      'guide.vote',
      'guide.propose_revision',
      'mentorship.request',
      'mentor.become',
      'community.create',
      'event.attend',
    ] as const) {
      expect(CAPABILITIES[cap].planLimit).toBeNull();
      expect(NEVER_PAID_CAPABILITIES).toContain(cap);
    }
  });

  it('toute capacité porte un libellé français non vide, pour l’invitation à monter de niveau', () => {
    for (const key of CAPABILITY_KEYS) {
      expect(CAPABILITIES[key].labelFr.length).toBeGreaterThan(3);
    }
  });
});

// RÈGLE DURE §1.2 — le mot « certifié » n'apparaît nulle part dans l'interface.
describe('mots interdits (T2)', () => {
  it('détecte « certifié » sous toutes ses formes, accents et casse compris', () => {
    for (const s of ['Certifié', 'certifiee', 'CERTIFICATION', 'profil certifié par']) {
      expect(containsForbiddenWord(s)).toBe(true);
    }
  });

  it('ne produit pas de faux positif sur du texte ordinaire', () => {
    for (const s of ['identité vérifiée', 'Titre de séjour', 'attestation bancaire']) {
      expect(containsForbiddenWord(s)).toBe(false);
    }
  });

  // 05-guides.md §2 : « pas dans le corps, qui peut citer un document officiel ».
  // « Le certificat Visale » est un document réel que les membres doivent
  // pouvoir nommer ; l'interdire rendrait la plateforme incapable de parler des
  // démarches qu'elle accompagne.
  it('épargne « certificat », qui est un document administratif', () => {
    for (const s of [
      'Le certificat Visale est accepté d’office.',
      'Joindre les certificats de scolarité',
      'CERTIFICAT de naissance',
    ]) {
      expect(containsForbiddenWord(s)).toBe(false);
    }
  });

  it('rejette bien « certification », qui est l’acte de certifier', () => {
    expect(containsForbiddenWord('certification de compétences')).toBe(true);
    expect(containsForbiddenWord('profil certifiant')).toBe(true);
  });
});
