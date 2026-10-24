/**
 * Les ONGLETS du module Services (bande défilante des cadres de 390 px).
 *
 * La maquette dessine, sur S01, S04 et S06, une bande « Logement · 12 · Emploi · 8 ·
 * Annuaire · Mes annonces · Alertes » en `<span>` : ni lien, ni compteur vrai. Elle
 * devient une liste de liens ; l'onglet actif est celui de la page.
 *
 * Les compteurs : « Logement » a un TOTAL (`GET /housing` → `meta.total`), pas
 * « Emploi » (`GET /jobs` n'en rend aucun : écart déjà signalé dans
 * `tools/screens/06-services.mjs`). Un compteur qu'aucune route ne donne est retiré
 * plutôt qu'inventé : seul « Logement » en porte un, quand la page l'a lu.
 */
export interface Onglet {
  readonly libelle: string;
  readonly href: string;
  readonly actif: boolean;
}

export type Rubrique = 'logement' | 'emploi' | 'annuaire' | 'mes-annonces' | 'alertes';

const RUBRIQUES: readonly { readonly rubrique: Rubrique; readonly libelle: string; readonly href: string }[] = [
  { rubrique: 'logement', libelle: 'Logement', href: '/services/logement' },
  { rubrique: 'emploi', libelle: 'Emploi', href: '/services/emploi' },
  { rubrique: 'annuaire', libelle: 'Annuaire', href: '/services/annuaire' },
  { rubrique: 'mes-annonces', libelle: 'Mes annonces', href: '/services/mes-annonces' },
  { rubrique: 'alertes', libelle: 'Alertes', href: '/services/alertes' },
];

export function ongletsServices(actif: Rubrique, totalLogement: number | null = null): readonly Onglet[] {
  return RUBRIQUES.map((r) => ({
    libelle:
      r.rubrique === 'logement' && totalLogement !== null ? `${r.libelle} · ${totalLogement}` : r.libelle,
    href: r.href,
    actif: r.rubrique === actif,
  }));
}

/** Les puces de genre de S01 : « Tout » puis les trois genres d'offre de logement. */
export const FILTRES_LOGEMENT = [
  { kind: null, libelle: 'Tout' },
  { kind: 'FLATSHARE', libelle: 'Colocation' },
  { kind: 'RENT', libelle: 'Location' },
  { kind: 'TEMPORARY', libelle: 'Temporaire' },
] as const;

export type FiltreLogement = (typeof FILTRES_LOGEMENT)[number]['kind'];

/** Le genre demandé par `?kind=`, ou `null` quand il est absent ou inconnu. */
export function filtreLogement(valeur: string | string[] | undefined): FiltreLogement {
  if (typeof valeur !== 'string') return null;
  const trouve = FILTRES_LOGEMENT.find((f) => f.kind === valeur);
  return trouve === undefined ? null : trouve.kind;
}

export function filtresLogement(courant: FiltreLogement): readonly Onglet[] {
  return FILTRES_LOGEMENT.map((f) => ({
    libelle: f.libelle,
    href: f.kind === null ? '/services/logement' : `/services/logement?kind=${f.kind}`,
    actif: f.kind === courant,
  }));
}
