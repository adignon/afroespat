'use client';

import { useEffect, useState } from 'react';
import { SEARCH_MIN_QUERY_LENGTH } from '@app/shared';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { typedSearchResponseSchema } from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CHERCHER UN GUIDE À LIER — ET POURQUOI PAS PAR `GET /guides`              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Au niveau de lier un guide la recherche ne marche pas. »
 *
 * La barre n'était pas un champ — corrigé dans le générateur. Restait à lui
 * donner une source, et le choix mérite d'être écrit.
 *
 * `GET /guides` N'ACCEPTE AUCUNE RECHERCHE : `guideListQuerySchema` porte `tab`,
 * `category`, `countryId`, `cityId` — rien pour un texte. Filtrer la page déjà
 * chargée aurait donc cherché dans vingt guides sur plusieurs centaines, et le
 * membre aurait conclu que sa recherche ne marche pas — ce qui aurait été vrai
 * pour tout guide absent de la première page.
 *
 * `GET /search?type=GUIDE` CHERCHE DANS TOUT LE CORPUS, avec le classement du
 * serveur (`rank`). C'est la même route que la page de recherche, et elle rend
 * `subjectId` — l'identifiant du guide — qui est exactement ce que
 * `createPostSchema.guideIds` attend.
 *
 * ── LA BORNE DE DEUX CARACTÈRES EST CELLE DU SERVEUR ──────────────────────
 *
 * `SEARCH_MIN_QUERY_LENGTH` : en dessous, la route refuse. On ne l'appelle donc
 * pas — un `400` par frappe remplirait le journal sans rien apprendre à personne.
 * Sous la borne, la liste du moment reste affichée.
 *
 * ── 220 ms, ET LE REJET DES RÉPONSES PÉRIMÉES ─────────────────────────────
 *
 * Même recette que les suggestions de la barre haute : on attend que la frappe se
 * calme, et une réponse qui revient après une saisie plus récente est JETÉE. Sans
 * ce rejet, taper vite fait clignoter la liste entre deux états, et c'est parfois
 * l'ancien qui gagne.
 */
export interface GuideTrouve {
  readonly id: string;
  readonly titre: string;
  readonly meta: string;
}

export function useRechercheGuides(texte: string): {
  readonly resultats: readonly GuideTrouve[] | null;
  readonly cherche: boolean;
} {
  const [resultats, setResultats] = useState<readonly GuideTrouve[] | null>(null);
  const [cherche, setCherche] = useState(false);

  useEffect(() => {
    const q = texte.trim();
    if (q.length < SEARCH_MIN_QUERY_LENGTH) {
      setResultats(null);
      setCherche(false);
      return undefined;
    }

    let vivant = true;
    setCherche(true);
    const minuteur = setTimeout(() => {
      void (async () => {
        try {
          if (!hasAccessToken()) await resumeSession();
          const page = await memberApi.get(
            `/search?q=${encodeURIComponent(q)}&type=GUIDE`,
            typedSearchResponseSchema,
          );
          if (!vivant) return;
          setResultats(
            page.items.map((hit) => ({
              id: hit.subjectId,
              titre: hit.title,
              /**
               * L'EXTRAIT PLUTÔT QU'UNE LIGNE DE MÉTA RECOMPOSÉE. La recherche ne
               * rend ni catégorie, ni portée, ni compte d'utiles — seulement un
               * extrait. En inventer une ligne demanderait un second appel par
               * résultat ; l'extrait dit déjà de quoi parle le guide.
               */
              meta: hit.excerpt,
            })),
          );
        } catch {
          /**
           * UNE RECHERCHE QUI ÉCHOUE NE CRIE PAS. La fenêtre reste utilisable : la
           * liste du moment est toujours là, et le membre peut choisir dedans. Un
           * bandeau d'erreur sur une frappe ferait passer pour cassée une fenêtre
           * qui fonctionne.
           */
          if (vivant) setResultats([]);
        } finally {
          if (vivant) setCherche(false);
        }
      })();
    }, 220);

    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [texte]);

  return { resultats, cherche };
}
