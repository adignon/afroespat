/**
 * D16 — le libellé d'un trimestre et de sa révision, SANS appel (éprouvé dans `impact.test.tsx`).
 *
 * Le serveur écrit « 2026-T3 » ; l'équipe lit « T3 2026 · juillet – septembre ». Le libellé ne
 * se déduit JAMAIS de l'horloge du navigateur : un rapport trimestriel daté par la machine du
 * lecteur changerait de titre selon qui l'ouvre.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function libelleTrimestre(q: string): string {
  const m = /^(\d{4})-T([1-4])$/.exec(q);
  if (m === null) return q;
  const debut = (Number(m[2]) - 1) * 3;
  return `T${m[2]} ${m[1]} · ${MOIS[debut]} – ${MOIS[debut + 2]}`;
}

export const nomFichierCsv = (q: string): string => `rapport-impact-${q}.csv`;

/** Les options du sélecteur : chaque trimestre CONSERVÉ avec sa dernière révision, plus le trimestre affiché s'il n'est pas calculé. */
export function optionsTrimestres(
  quarters: readonly { readonly quarter: string; readonly revision: number }[],
  affiche: string,
): { valeur: string; libelle: string }[] {
  const options = quarters.map((q) => ({
    valeur: q.quarter,
    libelle: `${libelleTrimestre(q.quarter)}${q.revision > 1 ? ` · révision ${q.revision}` : ''}`,
  }));
  if (!quarters.some((q) => q.quarter === affiche)) {
    options.unshift({ valeur: affiche, libelle: `${libelleTrimestre(affiche)} · pas encore calculé` });
  }
  return options;
}

/** L'extrait proposé comme citation : la phrase de tête, plafonnée à `max` caractères, sans coupure au milieu d'un mot. */
export function extraitProposable(texte: string, max: number): string {
  // Les titres (« ## Le guichet ») ne sont pas des phrases : on cite le texte, pas l'intitulé de section.
  const sansTitres = texte
    .split('\n')
    .filter((ligne) => !/^\s*#{1,6}\s/.test(ligne))
    .join(' ');
  const net = sansTitres.replace(/[*_>`]/g, '').replace(/\s+/g, ' ').trim();
  if (net.length <= max) return net;
  const coupe = net.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe.slice(0, max - 1)).trimEnd()}…`.slice(0, max);
}

export const TYPE_CITATION: Record<'GUIDE' | 'CITY_TIP', string> = {
  GUIDE: 'Extrait de guide',
  CITY_TIP: 'Conseil de ville',
};
