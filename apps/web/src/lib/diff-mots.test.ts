import { describe, expect, it } from 'vitest';
import { diffMots } from './diff-mots';

const texte = (segments: readonly { texte: string }[]): string => segments.map((s) => s.texte).join('');

describe('diffMots — l’avant/après d’une proposition de correction', () => {
  it('marque le mot remplacé des deux côtés, et rien d’autre', () => {
    const d = diffMots("dès l'obtention du VLS-TS", 'dès la validation du VLS-TS');
    expect(d.avant.filter((s) => s.change).map((s) => s.texte.trim())).toEqual(["l'obtention"]);
    expect(d.apres.filter((s) => s.change).map((s) => s.texte.trim())).toEqual(['la validation']);
  });

  it('un mot retiré est barré à gauche et n’ajoute rien à droite', () => {
    const d = diffMots('Déposer votre VLS-TS ou votre contrat de travail', 'Déposer votre VLS-TS');
    expect(d.avant.some((s) => s.change && s.texte.includes('contrat'))).toBe(true);
    expect(d.apres.every((s) => !s.change)).toBe(true);
  });

  it('relit chaque côté à l’identique (les espaces voyagent avec les mots)', () => {
    const avant = 'quel que soit leur pays, dès  l’obtention du titre';
    const apres = 'quel que soit leur pays, dès la validation du titre sur le site';
    const d = diffMots(avant, apres);
    expect(texte(d.avant).replace(/\s+/g, ' ').trim()).toBe(avant.replace(/\s+/g, ' ').trim());
    expect(texte(d.apres).replace(/\s+/g, ' ').trim()).toBe(apres.replace(/\s+/g, ' ').trim());
  });

  it('deux textes identiques ne marquent rien ; un côté vide marque l’autre en entier', () => {
    expect(diffMots('même texte', 'même texte').avant.every((s) => !s.change)).toBe(true);
    const ajout = diffMots('', 'un passage neuf');
    expect(ajout.avant).toEqual([]);
    expect(ajout.apres.every((s) => s.change)).toBe(true);
    const retrait = diffMots('un passage retiré', '');
    expect(retrait.avant.every((s) => s.change)).toBe(true);
    expect(retrait.apres).toEqual([]);
  });

  it('plafonne le travail : un texte démesuré est rendu en bloc plutôt que de geler l’écran', () => {
    const long = Array.from({ length: 700 }, (_, i) => `mot${String(i)}`).join(' ');
    const d = diffMots(long, `${long} fin`);
    expect(d.avant).toHaveLength(1);
    expect(d.apres).toHaveLength(1);
  });
});
