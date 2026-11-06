import { describe, expect, it } from 'vitest';
import {
  CHEMINS_INTERDITS,
  jsonLdAccueil,
  reglesRobots,
  serialiserJsonLd,
  titrePageStatique,
  urlAbsolue,
  urlDuSite,
  urlsDuSitemap,
} from '../seo';

const BASE = 'https://exemple.test';

describe('urlDuSite', () => {
  it('prend l’adresse fournie, sans barre finale', () => {
    expect(urlDuSite({ siteUrl: 'https://exemple.test/', production: true })).toBe(BASE);
  });
  it('retombe sur le domaine de production, ou sur le poste local', () => {
    expect(urlDuSite({ siteUrl: '  ', production: true })).toBe('https://diasporyplus.com');
    expect(urlDuSite({ siteUrl: undefined, production: false })).toBe('http://localhost:3000');
  });
  it('rend un chemin absolu', () => {
    expect(urlAbsolue('/p/cgu', BASE)).toBe(`${BASE}/p/cgu`);
    expect(urlAbsolue('p/cgu', BASE)).toBe(`${BASE}/p/cgu`);
  });
});

describe('titrePageStatique', () => {
  it('préfère le titre publié', () => {
    expect(titrePageStatique('cgu', 'CGU de la plateforme')).toBe('CGU de la plateforme');
  });
  it('donne un titre propre aux pages légales non encore publiées', () => {
    expect(titrePageStatique('cgu')).toBe('Conditions générales d’utilisation');
    expect(titrePageStatique('confidentialite', '  ')).toBe('Politique de confidentialité');
    expect(titrePageStatique('cookies')).toBe('Politique relative aux cookies');
    expect(titrePageStatique('mentions-legales')).toBe('Mentions légales');
  });
  it('ne devine rien pour une page inconnue', () => {
    expect(titrePageStatique('autre')).toBeNull();
  });
});

describe('robots', () => {
  const regles = reglesRobots(BASE);
  const regle = Array.isArray(regles.rules) ? regles.rules[0] : regles.rules;
  it('autorise la landing et /p/, interdit l’administration et les routes membres', () => {
    expect(regle?.allow).toEqual(['/', '/p/']);
    expect(regle?.disallow).toContain('/admin');
    for (const membre of ['/accueil', '/compte', '/messages', '/parcours', '/guides']) {
      expect(regle?.disallow).toContain(membre);
    }
  });
  it('n’interdit jamais la page d’accueil ni /p/', () => {
    expect(CHEMINS_INTERDITS).not.toContain('/');
    expect((CHEMINS_INTERDITS as readonly string[]).some((c) => c === '/p' || c.startsWith('/p/'))).toBe(false);
  });
  it('annonce le plan du site', () => {
    expect(regles.sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});

describe('sitemap', () => {
  const maintenant = new Date('2026-11-06T10:00:00Z');
  it('liste la landing seule quand aucune page n’est publiée', () => {
    expect(urlsDuSitemap([], maintenant, BASE).map((u) => u.url)).toEqual([`${BASE}/`]);
  });
  it('ajoute les pages publiées avec leur date de publication', () => {
    const plan = urlsDuSitemap([{ slug: 'cgu', publishedAt: '2026-10-01T08:00:00Z' }, { slug: 'cookies', publishedAt: 'n’importe quoi' }], maintenant, BASE);
    expect(plan.map((u) => u.url)).toEqual([`${BASE}/`, `${BASE}/p/cgu`, `${BASE}/p/cookies`]);
    expect(plan[1]?.lastModified).toEqual(new Date('2026-10-01T08:00:00Z'));
    expect(plan[2]?.lastModified).toEqual(maintenant);
  });
});

describe('données structurées', () => {
  it('déclare l’organisation et le site', () => {
    const types = jsonLdAccueil(BASE).map((d) => d['@type']);
    expect(types).toEqual(['Organization', 'WebSite']);
  });
  it('échappe < pour ne jamais refermer la balise script', () => {
    expect(serialiserJsonLd({ a: '</script><b>' })).not.toContain('<');
  });
});
