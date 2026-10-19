/**
 * LA DIFFÉRENCE ENTRE DEUX TEXTES, MOT À MOT (A06 — « AVANT / APRÈS », lot G).
 *
 * L'API rend deux chaînes nues (`targetExcerpt`, `replacement`) ; la planche dessine
 * un DIFF : les mots retirés barrés à gauche, les mots ajoutés surlignés à droite.
 * Lier les deux chaînes telles quelles aurait fait disparaître la seule chose que
 * ces blocs montrent.
 *
 * Plus longue sous-suite commune sur les MOTS (les espaces voyagent avec le mot qui
 * les précède, pour que le texte se relise à l'identique). Les extraits d'une
 * proposition sont courts (quelques lignes) : le coût quadratique est sans objet, et
 * un garde plafonne tout de même la taille — au-delà, on rend les deux textes entiers
 * comme remplacés plutôt que de geler l'onglet.
 *
 * Pure et sans dépendance : elle a son test.
 */
export interface SegmentDiff {
  readonly texte: string;
  /** Vrai : retiré (côté « avant ») ou ajouté (côté « après »). */
  readonly change: boolean;
}

export interface DiffMots {
  readonly avant: readonly SegmentDiff[];
  readonly apres: readonly SegmentDiff[];
}

const MOTS_MAX = 600;

function mots(texte: string): string[] {
  return texte.match(/\S+\s*/g) ?? [];
}

function fusionner(segments: SegmentDiff[]): SegmentDiff[] {
  const out: SegmentDiff[] = [];
  for (const s of segments) {
    const dernier = out[out.length - 1];
    if (dernier !== undefined && dernier.change === s.change) {
      out[out.length - 1] = { texte: dernier.texte + s.texte, change: s.change };
    } else {
      out.push(s);
    }
  }
  return out;
}

export function diffMots(avant: string, apres: string): DiffMots {
  const a = mots(avant);
  const b = mots(apres);
  if (a.length > MOTS_MAX || b.length > MOTS_MAX) {
    return {
      avant: avant === '' ? [] : [{ texte: avant, change: true }],
      apres: apres === '' ? [] : [{ texte: apres, change: true }],
    };
  }
  // Comparer les mots SANS leur espace final : « le » et « le  » sont le même mot.
  const cle = (m: string): string => m.trim();
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const ligne = table[i] as number[];
      const dessous = table[i + 1] as number[];
      ligne[j] =
        cle(a[i] as string) === cle(b[j] as string)
          ? (dessous[j + 1] as number) + 1
          : Math.max(dessous[j] as number, ligne[j + 1] as number);
    }
  }
  const sa: SegmentDiff[] = [];
  const sb: SegmentDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (cle(a[i] as string) === cle(b[j] as string)) {
      sa.push({ texte: a[i] as string, change: false });
      sb.push({ texte: b[j] as string, change: false });
      i += 1;
      j += 1;
    } else if (((table[i + 1] as number[])[j] as number) >= ((table[i] as number[])[j + 1] as number)) {
      sa.push({ texte: a[i] as string, change: true });
      i += 1;
    } else {
      sb.push({ texte: b[j] as string, change: true });
      j += 1;
    }
  }
  for (; i < n; i += 1) sa.push({ texte: a[i] as string, change: true });
  for (; j < m; j += 1) sb.push({ texte: b[j] as string, change: true });
  return { avant: fusionner(sa), apres: fusionner(sb) };
}
