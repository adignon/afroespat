import type { z } from 'zod';
import { API_BASE } from './base';

/**
 * LES LECTURES PUBLIQUES — sans compte, sans jeton, sans cookie.
 *
 * `memberApi` suppose une session (il tente un rafraîchissement sur un 401 et attend la reprise) ; un visiteur n'en a
 * pas, et une lecture ouverte n'en a pas besoin. Ce client-ci ne fait donc qu'un `fetch` et valide la réponse par le
 * schéma partagé : une réponse qui ne ressemble pas au contrat est une ERREUR, pas une page à moitié vide.
 *
 * Utilisable aussi côté serveur (la page d'accueil se rend sur le serveur et se met en cache avec `revalidate`).
 */
export class LecturePubliqueErreur extends Error {
  constructor(readonly statut: number) {
    super(`lecture publique refusée (${String(statut)})`);
    this.name = 'LecturePubliqueErreur';
  }
}

export async function lirePublic<S extends z.ZodTypeAny>(
  chemin: string,
  schema: S,
  init: RequestInit = {},
): Promise<z.infer<S>> {
  const reponse = await fetch(`${API_BASE}${chemin}`, { ...init, headers: { accept: 'application/json', ...init.headers } });
  if (!reponse.ok) throw new LecturePubliqueErreur(reponse.status);
  return schema.parse(await reponse.json()) as z.infer<S>;
}
