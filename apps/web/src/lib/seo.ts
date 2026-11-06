import type { MetadataRoute } from 'next';

/**
 * LE RÉFÉRENCEMENT DES PAGES PUBLIQUES — une seule source pour les métadonnées, le plan du site (`sitemap.ts`), le
 * fichier `robots.ts` et les données structurées de la page d'accueil.
 *
 * Règle : RIEN n'est indexable par défaut (le layout racine déclare `noindex`). Seules les pages publiques le
 * demandent, une à une : la page d'accueil et les pages statiques publiées (`/p/:slug`).
 */

/** Le nom affiché du produit (la constante partagée porte encore une faute de frappe : voir le rapport du lot F2). */
export const NOM_PUBLIC = 'DiasporyPlus';

export const DESCRIPTION_PUBLIQUE =
  'La communauté des diasporas africaines en France : préparer son départ, s’installer, s’intégrer. Parcours par étapes, entraide, guides écrits par des membres, réseaux par ville.';

/** L'adresse publique du site, sans barre finale. `NEXT_PUBLIC_SITE_URL` la fixe ; sinon le domaine de production. */
export function urlDuSite(env: { readonly siteUrl?: string | undefined; readonly production: boolean } = {
  siteUrl: process.env['NEXT_PUBLIC_SITE_URL'],
  production: process.env.NODE_ENV === 'production',
}): string {
  const fournie = env.siteUrl?.trim();
  if (fournie !== undefined && fournie !== '') return fournie.replace(/\/+$/, '');
  return env.production ? 'https://diasporyplus.com' : 'http://localhost:3000';
}

/** Le chemin (`/p/cgu`) rendu absolu. */
export const urlAbsolue = (chemin: string, base: string = urlDuSite()): string =>
  `${base}${chemin.startsWith('/') ? chemin : `/${chemin}`}`;

/** Les pages légales : le titre propre de chacune quand l'API n'en donne pas (page pas encore publiée). */
export const TITRES_PAGES_LEGALES: Readonly<Record<string, string>> = {
  cgu: 'Conditions générales d’utilisation',
  confidentialite: 'Politique de confidentialité',
  cookies: 'Politique relative aux cookies',
  'mentions-legales': 'Mentions légales',
};

/** Le titre d'une page statique : celui de l'API (le texte publié), sinon le titre propre d'une page légale connue. */
export function titrePageStatique(slug: string, titreApi?: string | null): string | null {
  const publie = titreApi?.trim();
  if (publie !== undefined && publie !== '') return publie;
  return TITRES_PAGES_LEGALES[slug] ?? null;
}

/** Ce que `robots.txt` interdit : l'administration, l'API et toutes les routes membres. Le reste (`/`, `/p/`) est ouvert. */
export const CHEMINS_INTERDITS = [
  '/admin',
  '/accueil',
  '/agenda',
  '/compte',
  '/entraide',
  '/guides',
  '/messages',
  '/notifications',
  '/parcours',
  '/parrainage',
  '/premium',
  '/publications',
  '/recherche',
  '/reseaux',
  '/services',
  '/stories',
  '/villes',
  '/bienvenue',
  '/connexion',
] as const;

export function reglesRobots(base: string = urlDuSite()): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/p/'], disallow: [...CHEMINS_INTERDITS] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

/** Le plan du site : la page d'accueil, et les seules pages statiques effectivement publiées. */
export function urlsDuSitemap(
  publiees: readonly { readonly slug: string; readonly publishedAt?: string | undefined }[],
  maintenant: Date,
  base: string = urlDuSite(),
): MetadataRoute.Sitemap {
  const pages = publiees.map((p) => {
    const date = p.publishedAt === undefined ? Number.NaN : Date.parse(p.publishedAt);
    return {
      url: urlAbsolue(`/p/${p.slug}`, base),
      lastModified: Number.isNaN(date) ? maintenant : new Date(date),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    };
  });
  return [{ url: urlAbsolue('/', base), lastModified: maintenant, changeFrequency: 'weekly', priority: 1 }, ...pages];
}

/** Les données structurées de la page d'accueil : l'organisation et le site (sans recherche interne indexable). */
export function jsonLdAccueil(base: string = urlDuSite()): readonly Record<string, unknown>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: NOM_PUBLIC,
      url: base,
      description: DESCRIPTION_PUBLIQUE,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: NOM_PUBLIC,
      url: base,
      inLanguage: 'fr-FR',
      description: DESCRIPTION_PUBLIQUE,
    },
  ];
}

/** Un JSON-LD sûr à insérer dans une balise `<script>` : `<` est échappé pour qu'aucune valeur ne referme la balise. */
export const serialiserJsonLd = (donnees: unknown): string => JSON.stringify(donnees).replace(/</g, '\\u003c');
