import { beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { CryptoService } from '../crypto.service';
import { resetEnvCache } from '../../config/env';

/**
 * Chiffrement au repos — §8.1.
 *
 * RÈGLE DURE (01 §2.1) : le numéro n'est jamais renvoyé en clair par l'API après
 * sa saisie ; seul un masque est exposé, et seulement à son propriétaire.
 */
describe('chiffrement', () => {
  let crypto: CryptoService;

  beforeAll(() => {
    try {
      process.loadEnvFile(resolve(__dirname, '..', '..', '..', '..', '..', '.env'));
    } catch {
      /* déjà chargé */
    }
    resetEnvCache();
    crypto = new CryptoService();
  });

  const PHONE = '+22997000042';

  it('chiffre et déchiffre un numéro sans perte', () => {
    const sealed = crypto.encryptPhone(PHONE);
    expect(crypto.decryptPhone(sealed)).toBe(PHONE);
  });

  it('ne laisse jamais le numéro lisible dans les octets stockés', () => {
    const sealed = crypto.encryptPhone(PHONE);
    expect(sealed.toString('utf8')).not.toContain('97000042');
    expect(sealed.toString('hex')).not.toContain(Buffer.from(PHONE).toString('hex'));
  });

  it('produit un texte chiffré différent à chaque appel — d’où le besoin d’une empreinte', () => {
    const a = crypto.encryptPhone(PHONE);
    const b = crypto.encryptPhone(PHONE);
    expect(a.equals(b)).toBe(false);
    // …mais l'empreinte, elle, est stable : c'est ce qui rend l'unicité possible.
    expect(crypto.phoneFingerprint(PHONE)).toBe(crypto.phoneFingerprint(PHONE));
  });

  it('donne des empreintes distinctes à des numéros distincts', () => {
    expect(crypto.phoneFingerprint(PHONE)).not.toBe(crypto.phoneFingerprint('+22997000043'));
  });

  // AES-GCM est authentifié : une altération est DÉTECTÉE, pas silencieuse.
  it('refuse un texte chiffré altéré au lieu de renvoyer des octets faux', () => {
    const sealed = crypto.encryptPhone(PHONE);
    // On altère le dernier octet. `writeUInt8` plutôt qu'une indexation : avec
    // noUncheckedIndexedAccess, `sealed[i]` vaut `number | undefined`.
    const last = sealed.length - 1;
    sealed.writeUInt8(sealed.readUInt8(last) ^ 0xff, last);
    expect(() => crypto.decryptPhone(sealed)).toThrow();
  });

  it('refuse un texte chiffré tronqué', () => {
    expect(() => crypto.decryptPhone(Buffer.alloc(8))).toThrow(/tronqué/);
  });

  it('masque le numéro en ne laissant que les deux derniers chiffres', () => {
    const masked = crypto.maskPhone(PHONE, '+229');
    expect(masked).toContain('+229');
    expect(masked).toContain('42');
    expect(masked).toContain('••');
    // Le reste du numéro ne doit apparaître nulle part dans le masque.
    expect(masked).not.toContain('970000');
  });

  it('chiffre les contenus avec une clé distincte de celle des numéros', () => {
    const note = 'Rendez-vous préfecture le 12 mars, dossier incomplet.';
    const sealed = crypto.encryptContent(note);
    expect(crypto.decryptContent(sealed)).toBe(note);
    // La clé des contenus est rotée tous les 12 mois, celle des numéros jamais :
    // les confondre rendrait la rotation impossible.
    expect(() => crypto.decryptPhone(sealed)).toThrow();
  });

  it('stocke une empreinte de jeton, jamais le jeton', () => {
    const token = 'jeton-de-rafraichissement-secret';
    const hash = crypto.hashToken(token);
    expect(hash).not.toContain('secret');
    expect(crypto.verifyToken(token, hash)).toBe(true);
    expect(crypto.verifyToken('autre-jeton', hash)).toBe(false);
  });

  it('gère un texte long et les caractères accentués', () => {
    const long = 'Démarches à la préfecture — éàüç '.repeat(200);
    expect(crypto.decryptContent(crypto.encryptContent(long))).toBe(long);
  });
});
