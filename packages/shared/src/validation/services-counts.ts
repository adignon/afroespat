import { z } from 'zod';

/**
 * `GET /services/counts` — les trois compteurs du panneau de gauche des écrans
 * Services (lot E2).
 *
 * La maquette dessine « Annonces logement · 12 », « Bourses et emploi · 8 » et
 * « Mes annonces · 2 » sur les dix cadres d'ordinateur, et la bande d'onglets de
 * 390 px « Logement · 12 · Emploi · 8 ». Ils étaient peints en dur.
 *
 * Chaque nombre est celui de la LISTE correspondante (`meta.total` de `GET /housing`
 * et de `GET /jobs`), calculé avec les mêmes règles de visibilité : un compteur qui
 * ne retrouverait pas ce que la liste affiche mentirait. `mine` additionne les
 * annonces de logement et les offres du membre (expirées et en pause comprises, hors
 * retirées — comme « Mes annonces ») ; il vaut `null` hors session, où il n'a pas de
 * sens. `.strict()` : un champ qui apparaîtrait un jour fait refuser la charge.
 */
export const servicesCountsResponseSchema = z
  .object({
    housing: z.number().int().nonnegative(),
    jobs: z.number().int().nonnegative(),
    mine: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type ServicesCountsResponse = z.infer<typeof servicesCountsResponseSchema>;
