import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  NEVER_PAID_CAPABILITIES,
  containsForbiddenWord,
  levelSatisfies,
} from '../index.js';

describe('matrice des capacités (§7.3)', () => {
  /**
   * LE CUMUL, éprouvé sur une capacité qui exige ENCORE un niveau.
   *
   * Il l'était sur `post.create`, qui est depuis ouverte à L0 — arbitrage du
   * porteur, écart nommé dans `capabilities.ts`. Une capacité ouverte à tous ne
   * prouve plus rien sur le cumul : les trois niveaux y répondent « oui ».
   * `housing.publish` (L2) le montre, et le fichier en garde la trace.
   */
  it('les niveaux sont cumulatifs', () => {
    expect(levelSatisfies('L2', 'housing.publish')).toBe(true);
    expect(levelSatisfies('L1', 'housing.publish')).toBe(false);
    expect(levelSatisfies('L0', 'housing.publish')).toBe(false);
    /** `help.offer` est la capacité de palier intermédiaire depuis la refonte N0/N1/N2. */
    expect(levelSatisfies('L2', 'help.offer')).toBe(true);
    expect(levelSatisfies('L1', 'help.offer')).toBe(true);
    expect(levelSatisfies('L0', 'help.offer')).toBe(false);
  });

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS NIVEAUX, TELS QUE LE PORTEUR LES A REDÉFINIS — 2026-10-09    ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * « N0 : commenter des publications, créer des demandes d'entraide, ajouter
   * des contacts et discuter avec eux, créer et gérer les parcours. N1 : publier
   * dans le fil d'actualité et stories, répondre à l'entraide, demander un
   * parrain. N2 : faire tout le reste. »
   *
   * Ce cas énumère la liste DANS SES MOTS, capacité par capacité : c'est le seul
   * moyen qu'un déplacement futur se voie, et qu'on sache lequel des deux — la
   * table ou la demande — a changé.
   */
  it('N0 fait exactement ce que le porteur y range', () => {
    for (const cap of [
      'comment.create',
      'help.ask',
      'connection.request',
      'message.send',
      'journey.create',
      'journey.manage',
    ] as const) {
      expect(levelSatisfies('L0', cap), cap).toBe(true);
    }
  });

  it('N1 ajoute la publication, l’offre d’entraide et la demande de parrain', () => {
    for (const cap of ['post.create', 'help.offer', 'mentorship.request'] as const) {
      expect(levelSatisfies('L0', cap), `${cap} ne doit PAS être ouvert à L0`).toBe(false);
      expect(levelSatisfies('L1', cap), cap).toBe(true);
    }
  });

  /**
   * ⚠ DEUX EXCEPTIONS À « TOUT LE RESTE », et elles sont voulues : signaler et
   * contester une sanction sont des DROITS, pas des fonctionnalités. Les ranger
   * en L2 fermerait l'alerte aux comptes les plus exposés (13 §1) et rendrait
   * une sanction incontestable. ÉCART REMONTÉ au porteur.
   */
  it('« tout le reste » exige N2, sauf la lecture, le signalement et la contestation', () => {
    const l2 = CAPABILITY_KEYS.filter((k) => CAPABILITIES[k].minLevel === 'L2');
    expect(l2.sort()).toEqual([
      'community.create',
      'event.attend',
      'event.create',
      'guide.propose_revision',
      'guide.vote',
      'guide.write',
      'housing.publish',
      'job.publish',
      'mentor.become',
      'pro.contact',
      'pro.register',
    ]);
    for (const droit of ['content.read', 'report.create', 'sanction.appeal'] as const) {
      expect(levelSatisfies('L0', droit), droit).toBe(true);
    }
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
