import type { MetadataRoute } from 'next';
import { reglesRobots } from '@/lib/seo';

/** `robots.txt` : la page d'accueil et `/p/` sont ouverts ; l'administration et les routes membres, interdites. */
export default function robots(): MetadataRoute.Robots {
  return reglesRobots();
}
