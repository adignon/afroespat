import type { MetadataRoute } from 'next';
import { LEGAL_PAGE_SLUGS, staticPagePublicSchema } from '@app/shared';
import { API_BASE } from '@/lib/api/base';
import { urlsDuSitemap } from '@/lib/seo';

/**
 * Le plan du site : la page d'accueil et les pages légales EFFECTIVEMENT PUBLIÉES (l'API répond 404 tant qu'aucune
 * version n'est en vigueur : une page « bientôt disponible » n'entre pas dans le plan).
 *
 * Les guides et les villes n'y figurent pas : ils n'ont aujourd'hui aucune adresse publique (ils se lisent dans
 * l'application, ou dans une fenêtre de la page d'accueil). Le jour où une route publique existera, c'est ici qu'on
 * les ajoutera.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lectures = await Promise.all(
    LEGAL_PAGE_SLUGS.map(async (slug) => {
      try {
        const reponse = await fetch(`${API_BASE}/pages/${slug}`, { next: { revalidate: 3600 } });
        if (!reponse.ok) return null;
        const page = staticPagePublicSchema.safeParse(await reponse.json());
        return page.success ? { slug, publishedAt: page.data.publishedAt } : null;
      } catch {
        return null;
      }
    }),
  );
  return urlsDuSitemap(
    lectures.flatMap((p) => (p === null ? [] : [p])),
    new Date(),
  );
}
