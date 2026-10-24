import {
  SEARCH_PERIODS,
  SEARCH_STATES,
  uuidSchema,
} from '@app/shared';
import type { ValeursFiltresRecherche } from './data';

/**
 * Les filtres de la recherche (11 §2.3) : lus de l'URL, validés par les schémas
 * PARTAGÉS du serveur, et recomposés en adresse.
 *
 * Dans leur propre module, SANS `'use client'` : la page (composant serveur) les
 * lit, et une fonction exportée d'un module client n'arrive pas au serveur comme une
 * fonction (voir `screens/messages/feuilles.ts`). L'URL est publique — une valeur
 * inconnue est IGNORÉE, jamais envoyée au serveur pour y prendre un `400` que
 * l'écran afficherait comme une panne.
 */
export const FILTRES_VIDES: ValeursFiltresRecherche = {
  ville: null,
  rayon: null,
  pays: null,
  periode: 'all',
  etat: null,
};

function un(brut: string | string[] | undefined): string | null {
  return typeof brut === 'string' && brut !== '' ? brut : null;
}

export function filtresDeLUrl(
  params: Record<string, string | string[] | undefined>,
): ValeursFiltresRecherche {
  const ville = un(params['ville']);
  const pays = un(params['pays']);
  const periode = un(params['periode']);
  const etat = un(params['etat']);
  const rayon = Number(un(params['rayon']));
  const villeValide = ville !== null && uuidSchema.safeParse(ville).success ? ville : null;
  return {
    ville: villeValide,
    // Un rayon sans ville n'existe pas : il est ignoré.
    rayon:
      villeValide !== null && Number.isInteger(rayon) && rayon >= 1 && rayon <= 500 ? rayon : null,
    pays: pays !== null && uuidSchema.safeParse(pays).success ? pays : null,
    periode: periode !== null && (SEARCH_PERIODS as readonly string[]).includes(periode) ? periode : 'all',
    etat: (SEARCH_STATES as readonly string[]).includes(etat ?? '') ? etat : null,
  };
}

/** L'adresse `/recherche?…` qui porte la requête, le type et les filtres posés. */
export function adresseRecherche(entree: {
  readonly requete: string;
  readonly type: string | null;
  readonly valeurs: ValeursFiltresRecherche;
}): string {
  const p = new URLSearchParams();
  if (entree.requete !== '') p.set('q', entree.requete);
  if (entree.type !== null) p.set('type', entree.type);
  const v = entree.valeurs;
  if (v.ville !== null) p.set('ville', v.ville);
  if (v.ville !== null && v.rayon !== null) p.set('rayon', String(v.rayon));
  if (v.pays !== null) p.set('pays', v.pays);
  if (v.periode !== 'all') p.set('periode', v.periode);
  if (v.etat !== null) p.set('etat', v.etat);
  const texte = p.toString();
  return texte === '' ? '/recherche' : `/recherche?${texte}`;
}

/** Y a-t-il un filtre posé ? Sert à ne pas écrire « aucun résultat » comme si de rien n'était. */
export function aDesFiltres(v: ValeursFiltresRecherche): boolean {
  return v.ville !== null || v.pays !== null || v.periode !== 'all' || v.etat !== null;
}
