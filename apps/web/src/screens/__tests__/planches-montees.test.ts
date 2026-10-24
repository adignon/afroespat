import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * GARDE-FOU : AUCUNE PLANCHE GÉNÉRÉE N'EST LAISSÉE MORTE.
 *
 * ── LE DÉFAUT D'OÙ ÇA VIENT ─────────────────────────────────────────────────
 *
 * L'audit du front avait compté 268 fichiers `*.generated.tsx`, dont QUINZE qu'aucune
 * page n'importait : J03 « Je suis bloqué·e » (six cadres), J04 « Partager un jalon » (deux),
 * les feuilles mobiles J01M, J05, J07, J08, l'encart de refus X04 et deux cadres de D01. Le
 * générateur les produisait à chaque exécution, le compilateur les acceptait, le lint les
 * acceptait — et pendant ce temps des composants écrits à la main tenaient leur place, avec un
 * dessin qui n'était pas celui de la maquette. Rien ne rougissait : un fichier que personne
 * n'importe ne casse rien.
 *
 * Ce test rend le défaut VISIBLE. Il part de `src/app/` (les routes), suit les `import`
 * statiques et dynamiques (chemins relatifs et alias `@/`) et liste les `*.generated.tsx`
 * que le parcours n'atteint jamais. Chacun doit être dans la liste blanche ci-dessous, avec
 * sa raison ; sinon le test échoue en nommant le fichier.
 *
 * ── LA RÈGLE POUR LA LISTE BLANCHE ──────────────────────────────────────────
 *
 * Elle est COURTE à dessein. Une entrée n'est légitime que pour une planche que la maquette
 * dessine et que le produit n'a pas à rendre (écran de paiement hors périmètre, cadre
 * d'illustration…) — avec la phrase qui le dit. « On le montera plus tard » n'est pas une
 * raison : soit on monte la planche, soit on la retire du générateur.
 *
 * Un test symétrique vérifie que chaque entrée de la liste blanche désigne bien un fichier
 * encore non monté : une planche montée depuis doit sortir de la liste, sinon la liste
 * mentirait.
 */
const SRC = resolve(__dirname, '..', '..');

/** Planches générées volontairement non montées — chaque entrée dit POURQUOI. */
const LISTE_BLANCHE: Readonly<Record<string, string>> = {
  // (vide) — au lot « feuilles dessinées », les quinze planches mortes ont été soit montées
  // (J03, J04, J01M, J05, J07, J08, X04 dans FenetreNiveau), soit retirées du générateur (D01
  // « Totp » et « Enrolement », remplacés par ConnexionEquipe avec son QR code).
};

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (nom === 'node_modules' || nom === '.next') continue;
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie);
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/** Résout un spécifieur d'import vers un fichier source du dépôt, ou `null` (paquet npm…). */
function resoudre(depuis: string, spec: string): string | null {
  const base = spec.startsWith('@/')
    ? join(SRC, spec.slice(2))
    : spec.startsWith('.')
      ? resolve(dirname(depuis), spec)
      : null;
  if (base === null) return null;
  for (const candidat of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat;
  }
  return null;
}

const IMPORTS = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function atteints(): Set<string> {
  const vus = new Set<string>();
  const pile = fichiers(join(SRC, 'app'));
  while (pile.length > 0) {
    const courant = pile.pop() as string;
    if (vus.has(courant)) continue;
    vus.add(courant);
    const source = readFileSync(courant, 'utf8');
    for (const m of source.matchAll(IMPORTS)) {
      const cible = resoudre(courant, m[1] as string);
      if (cible !== null && !vus.has(cible)) pile.push(cible);
    }
  }
  return vus;
}

const GENERES = fichiers(SRC)
  .filter((f) => f.endsWith('.generated.tsx'))
  .map((f) => relative(SRC, f));

describe('les planches générées sont toutes montées', () => {
  const montes = atteints();
  const morts = GENERES.filter((f) => !montes.has(join(SRC, f)));

  it('le parcours des imports trouve les planches (le test ne regarde pas dans le vide)', () => {
    expect(GENERES.length).toBeGreaterThan(200);
    expect(montes.size).toBeGreaterThan(GENERES.length);
  });

  it('aucune planche générée n’est laissée sans importeur, hors liste blanche', () => {
    const nonDeclarees = morts.filter((f) => !(f in LISTE_BLANCHE));
    expect(
      nonDeclarees,
      `Planche(s) générée(s) qu’aucune route n’atteint : ${nonDeclarees.join(', ')}. ` +
        'Montez-les (adaptation du générateur), retirez-les de tools/screens/*.mjs, ou — si la ' +
        'maquette les dessine sans que le produit doive les rendre — ajoutez-les à LISTE_BLANCHE ' +
        'avec la raison.',
    ).toEqual([]);
  });

  it('la liste blanche ne garde que des planches réellement non montées', () => {
    const perimees = Object.keys(LISTE_BLANCHE).filter((f) => !morts.includes(f));
    expect(perimees, `Entrées périmées de la liste blanche : ${perimees.join(', ')}`).toEqual([]);
  });

  it('la liste blanche reste courte', () => {
    expect(Object.keys(LISTE_BLANCHE).length).toBeLessThanOrEqual(5);
  });
});
