/**
 * UN GÉNÉRATEUR PSEUDO-ALÉATOIRE À GRAINE (mulberry32) — le même seed donne les mêmes données, à l'horodatage près.
 * Déterministe : un jeu de données qu'on a regardé (et corrigé) se reproduit à l'identique.
 */
export interface Rng {
  /** Un réel dans [0, 1). */
  next(): number;
  /** Un entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number;
  /** Vrai avec la probabilité `p`. */
  chance(p: number): boolean;
  pick<T>(liste: readonly T[]): T;
  /** Un tirage pondéré : `[valeur, poids]`. */
  weighted<T>(liste: readonly (readonly [T, number])[]): T;
  /** `n` éléments distincts. */
  sample<T>(liste: readonly T[], n: number): T[];
  shuffle<T>(liste: readonly T[]): T[];
}

export function creerRng(graine: number): Rng {
  let a = graine >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(liste: readonly T[]): T => {
    if (liste.length === 0) throw new Error('pick : liste vide');
    return liste[Math.floor(next() * liste.length)] as T;
  };
  const shuffle = <T>(liste: readonly T[]): T[] => {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copie[i], copie[j]] = [copie[j] as T, copie[i] as T];
    }
    return copie;
  };
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick,
    weighted: (liste) => {
      const total = liste.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of liste) {
        r -= w;
        if (r < 0) return v;
      }
      return (liste[liste.length - 1] as readonly [never, number])[0];
    },
    sample: (liste, n) => shuffle(liste).slice(0, Math.min(n, liste.length)),
    shuffle,
  };
}

/** « il y a X » : une date `now − jours` avec une heure plausible (8 h – 22 h, heure de Paris approchée). */
export function ilYa(now: Date, jours: number, rng: Rng): Date {
  const d = new Date(now.getTime() - jours * 86_400_000);
  d.setUTCHours(rng.int(7, 21), rng.int(0, 59), rng.int(0, 59), 0);
  return d;
}

/** Une date future `now + jours`, à une heure ronde de la journée. */
export function dansJours(now: Date, jours: number, heure: number, minute = 0): Date {
  const d = new Date(now.getTime() + jours * 86_400_000);
  d.setUTCHours(heure, minute, 0, 0);
  return d;
}
