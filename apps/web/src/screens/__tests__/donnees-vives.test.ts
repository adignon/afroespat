import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ GARDE-FOU DURABLE — AUCUNE VALEUR DE MAQUETTE SUR UN ÉCRAN MONTÉ           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Lot W2A, phase 2. L'audit du front avait relevé vingt-deux endroits où un écran
 * transcodé montrait à tout le monde ce que la maquette dessine pour l'exemple :
 * « ÉVÉNEMENTS À LYON », « 58 % », « 1 400 membres », « Sandra M. · Lyon 3e »,
 * « Mis à jour le 12 mars »… Les corriger une fois ne suffit pas : la prochaine
 * planche retranscodée les ramènerait sans qu'un test ne rougisse.
 *
 * CE TEST LIT LES `*.generated.tsx` MONTÉS — ceux que l'application importe, de
 * près ou de loin — et échoue si l'un des littéraux de la LISTE NOIRE y réapparaît.
 * Un cadre généré mais jamais monté (planche de documentation) n'est pas lu : il ne
 * s'affiche à personne, et le retirer est l'affaire du générateur.
 *
 * ── LA LISTE BLANCHE EST COURTE, COMMENTÉE, ET NOMME QUI LA LÈVE ────────────
 *
 * Chaque entrée dit POURQUOI le littéral est toléré à cet endroit et QUAND elle
 * disparaît. Ajouter une ligne ici, c'est assumer qu'un écran montre une valeur de
 * maquette : ça se discute, ça ne se fait pas pour faire passer un test.
 *
 * ── CE QUI NE SE LIT PAS ICI ───────────────────────────────────────────────
 *
 * Seuls les TEXTES et les attributs rendus sont examinés : « 58% » en largeur CSS
 * (`width: "58%"`) est un dessin, pas une valeur. Les commentaires de l'en-tête de
 * chaque fichier généré sont retirés avant la lecture.
 */

const SRC = resolve(__dirname, '..', '..');

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules' || nom === '.next') continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie);
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/** `./x`, `../x`, `@/x` → un chemin de fichier du dépôt, ou `null` (paquet externe). */
function resoudre(depuis: string, cible: string): string | null {
  let base: string;
  if (cible.startsWith('@/')) base = join(SRC, cible.slice(2));
  else if (cible.startsWith('.')) base = resolve(dirname(depuis), cible);
  else return null;
  for (const candidat of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if (statSync(candidat).isFile()) return candidat;
    } catch {
      // essai suivant
    }
  }
  return null;
}

const IMPORT = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** Les `*.generated.tsx` atteints depuis un fichier qui n'est pas généré. */
function cadresMontes(): string[] {
  const tous = fichiers(SRC);
  const vus = new Set<string>();
  const pile: string[] = [];
  for (const f of tous) {
    if (f.includes('.test.') || f.includes('__tests__')) continue;
    if (f.endsWith('.generated.tsx')) continue;
    pile.push(f);
  }
  const visites = new Set<string>(pile);
  while (pile.length > 0) {
    const f = pile.pop() as string;
    const texte = readFileSync(f, 'utf8');
    for (const m of texte.matchAll(IMPORT)) {
      const cible = resoudre(f, m[1] as string);
      if (cible === null || visites.has(cible)) continue;
      visites.add(cible);
      if (cible.endsWith('.generated.tsx')) {
        vus.add(cible);
        pile.push(cible);
      } else if (!cible.includes('.test.')) pile.push(cible);
    }
  }
  return [...vus].sort();
}

/** Sans l'en-tête de commentaires : on lit ce qui s'affiche, pas ce qui s'explique. */
function rendu(fichier: string): string {
  return readFileSync(fichier, 'utf8').replace(/^(\/\/[^\n]*\n)+/, '');
}

/**
 * LA LISTE NOIRE — des littéraux de maquette qu'aucun écran monté ne doit contenir.
 * Chaque motif porte la raison pour laquelle il est interdit.
 */
const LISTE_NOIRE: readonly { readonly nom: string; readonly motif: RegExp }[] = [
  { nom: 'Lyon (ville d’exemple de la maquette)', motif: /\bLyon\b|\bLYON\b/ },
  { nom: 'Rhône', motif: /Rh[ôo]ne/ },
  { nom: 'Paris / Marseille / Nantes / Rennes en dur', motif: />[^<>{}]*\b(?:Paris|Marseille|Nantes|Rennes)\b[^<>{}]*</ },
  { nom: 'prénoms et noms de la maquette', motif: /\b(?:Fatou|Aïcha|Aicha|Marc Koudou|Sandra|Moussa|Fanta|Kofi|Yasmine|Théo Adjovi|Amina|Diallo|Ndiaye|Boateng)\b/ },
  { nom: '« 58 % » (avancement d’exemple) dans un texte', motif: />[^<>{}]*\b58 ?%[^<>{}]*</ },
  { nom: '« 1 400 membres » / « 890 membres »', motif: /\b(?:1 400|890|210) membres/ },
  { nom: 'dates d’exemple', motif: />[^<>{}]*\b(?:12 mars|2 janvier|2 avril|3 mars|24 FÉV|02 MAR|09 MAR)\b[^<>{}]*</ },
  { nom: '« Étape 7 : Logement »', motif: /Étape 7 : Logement/ },
  { nom: 'chiffres d’exemple de K08 / A06 / K01', motif: /Sous 48 h|Pendant 3 mois|Réversible 6 mois|\b84 ont trouvé|Mis à jour le 12/ },
];

/**
 * LA LISTE BLANCHE. Une entrée = un fichier (ou un motif de chemin) + un littéral
 * toléré + la raison + quand elle tombe.
 */
const LISTE_BLANCHE: readonly {
  readonly fichier: RegExp;
  readonly nom: string;
  readonly pourquoi: string;
}[] = [
  {
    fichier: /^screens\/j03\//,
    nom: 'Lyon (ville d’exemple de la maquette)',
    pourquoi:
      'Les cadres J03 (partage de parcours) sont retirés du générateur par le lot W2B ; tant que ce retrait n’est pas fusionné ils restent importés. Tombe avec lui.',
  },
  {
    fichier: /^screens\/j03\//,
    nom: 'prénoms et noms de la maquette',
    pourquoi: 'Idem : « Aïcha, Moussa et Fanta recevront votre message » est le texte de ces mêmes cadres J03 (lot W2B).',
  },
];

const montes = cadresMontes();

describe('aucune valeur de maquette sur un écran monté (lot W2A, phase 2)', () => {
  it('le balayage trouve bien les cadres montés (sinon il ne garde rien)', () => {
    expect(montes.length).toBeGreaterThan(150);
    expect(montes.some((f) => f.endsWith('a01/desktop.generated.tsx'))).toBe(true);
    expect(montes.some((f) => f.endsWith('k08/mobile.generated.tsx'))).toBe(true);
  });

  for (const { nom, motif } of LISTE_NOIRE) {
    it(`aucun cadre monté n'écrit : ${nom}`, () => {
      const fautifs: string[] = [];
      for (const f of montes) {
        const chemin = relative(SRC, f);
        if (LISTE_BLANCHE.some((b) => b.nom === nom && b.fichier.test(chemin))) continue;
        const texte = rendu(f);
        const m = motif.exec(texte);
        if (m !== null) {
          const i = m.index;
          fautifs.push(`${chemin} … ${texte.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ')}`);
        }
      }
      expect(fautifs, fautifs.join('\n')).toEqual([]);
    });
  }

  it('chaque entrée de la liste blanche vise un littéral qui existe, et se justifie', () => {
    for (const b of LISTE_BLANCHE) {
      expect(LISTE_NOIRE.some((n) => n.nom === b.nom), b.nom).toBe(true);
      expect(b.pourquoi.length).toBeGreaterThan(30);
      // Une entrée qui ne sert plus doit être retirée : sinon la liste blanche enfle en silence.
      const sert = montes.some((f) => {
        const chemin = relative(SRC, f);
        if (!b.fichier.test(chemin)) return false;
        const noire = LISTE_NOIRE.find((n) => n.nom === b.nom);
        return noire !== undefined && noire.motif.test(rendu(f));
      });
      expect(sert, `entrée blanche inutile : ${b.nom} (${String(b.fichier)})`).toBe(true);
    }
  });
});
