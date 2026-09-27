import { describe, expect, it } from 'vitest';
import { assertRedacted, redactForModeration } from '../redact';

/**
 * RÈGLE DURE (13-moderation.md §2) :
 * « Un test vérifie qu'un numéro de téléphone et un email ne quittent pas le serveur. »
 *
 * Voici ce test. Il porte sur des textes réalistes, tels qu'un membre les écrit —
 * pas sur des chaînes de laboratoire.
 */
describe('masquage avant analyse IA (règle dure 13 §2)', () => {
  const PHONES = [
    '+229 97 00 00 42',
    '+33 6 12 34 56 78',
    '+33612345678',
    '06 12 34 56 78',
    '0612345678',
    '06.12.34.56.78',
    '06-12-34-56-78',
    '+225 07 00 00 00 00',
  ];

  it('masque tous les formats de numéro rencontrés', () => {
    for (const phone of PHONES) {
      const { text } = redactForModeration(`Appelle-moi au ${phone} stp`);
      expect(text, `format non masqué : ${phone}`).not.toContain(phone.replace(/\s/g, ''));
      expect(text).toContain('[TEL]');
    }
  });

  it('masque les adresses email', () => {
    for (const email of ['amina@example.com', 'a.diallo+test@sous.domaine.fr', 'X_9@b.co']) {
      const { text } = redactForModeration(`écris à ${email}`);
      expect(text).not.toContain(email);
      expect(text).toContain('[EMAIL]');
    }
  });

  it('masque l’email AVANT le numéro, sinon le masquage se chevauche', () => {
    const { text } = redactForModeration('contact: jean2024@mail.com ou 0612345678');
    expect(text).toContain('[EMAIL]');
    expect(text).toContain('[TEL]');
    expect(text).not.toMatch(/\[TEL\]@/);
  });

  it('masque les identifiants de messagerie et les liens', () => {
    const { text } = redactForModeration('mon whatsapp @amina_diallo, ou https://wa.me/22997000042');
    expect(text).not.toContain('amina_diallo');
    expect(text).not.toContain('22997000042');
  });

  it('masque les noms propres', () => {
    const { text } = redactForModeration('Demandez à Amina, elle connaît Kossi.');
    expect(text).not.toContain('Amina');
    expect(text).not.toContain('Kossi');
    expect(text).toContain('[NOM]');
  });

  // Un masquage qui détruit le sens rend l'analyse IA inutile : l'équilibre compte.
  it('préserve les institutions et les démarches, qui portent le sens du texte', () => {
    const { text } = redactForModeration(
      'Je dois aller à la préfecture de Lyon pour mon titre de séjour, rendez-vous en septembre.',
    );
    for (const term of ['préfecture', 'Lyon', 'titre de séjour', 'septembre']) {
      expect(text, `terme du domaine perdu : ${term}`).toContain(term);
    }
  });

  it('ne massacre pas les débuts de phrase', () => {
    const { text } = redactForModeration('Bonjour. Merci beaucoup. Comment faire ?');
    expect(text).not.toContain('[NOM]');
  });

  it('compte ce qui a été masqué, sans conserver les valeurs', () => {
    const { counts } = redactForModeration('06 12 34 56 78 et a@b.fr et 0700000000');
    expect(counts.phones).toBe(2);
    expect(counts.emails).toBe(1);
  });
});

/**
 * Le garde-fou de dernier recours. C'est lui qui fait qu'une régression du
 * masquage bloque l'envoi au lieu de le laisser passer.
 */
describe('garde-fou avant envoi réseau', () => {
  it('laisse passer un texte correctement masqué', () => {
    const { text } = redactForModeration('Appelle au 0612345678 ou écris à a@b.fr');
    expect(() => assertRedacted(text)).not.toThrow();
  });

  it('REFUSE un texte qui contient encore un numéro', () => {
    expect(() => assertRedacted('appelle au 06 12 34 56 78')).toThrow(/téléphone/);
  });

  it('REFUSE un texte qui contient encore un email', () => {
    expect(() => assertRedacted('écris à amina@example.com')).toThrow(/email/);
  });

  // Un test réentrant : les regex globales portent un `lastIndex` qui, mal remis
  // à zéro, fait passer un appel sur deux. Erreur classique, donc testée.
  it('donne le même verdict à chaque appel', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(() => assertRedacted('amina@example.com')).toThrow();
    }
  });
});
