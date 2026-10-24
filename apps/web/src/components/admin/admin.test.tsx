import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QrCode } from './qr-code';
import { premierDefaut } from './ui';

/**
 * Deux pièces de l'application d'équipe qui ne se prouvent pas au navigateur seul.
 *
 *   · le code QR d'enrôlement TOTP est rendu LOCALEMENT : le secret ne doit sortir ni vers
 *     un service de génération de QR, ni vers un CDN. On vérifie donc que le rendu est un
 *     SVG en ligne, sans image ni lien externe, et que la matrice grandit avec le contenu ;
 *   · `premierDefaut` dit en français quel champ corriger (avant : « Une erreur est survenue »,
 *     relevé sur D13 et D15).
 */
const URI = 'otpauth://totp/Diaspora:equipe@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Diaspora';

describe('QrCode — rendu local du secret TOTP', () => {
  it('est un SVG en ligne, sans ressource externe', () => {
    const html = renderToStaticMarkup(<QrCode valeur={URI} libelle="Code QR de test" />);
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Code QR de test"');
    expect(html).toContain('<path');
    expect(html).not.toMatch(/<image|<img|href=|src=|https?:\/\//);
  });

  it('le secret ne figure PAS en clair dans le SVG (seulement des modules)', () => {
    const html = renderToStaticMarkup(<QrCode valeur={URI} libelle="x" />);
    expect(html).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('dessine plus de modules pour un contenu plus long, et reste déterministe', () => {
    const court = renderToStaticMarkup(<QrCode valeur="otpauth://totp/a?secret=AAAA" libelle="x" />);
    const long = renderToStaticMarkup(<QrCode valeur={URI.repeat(3)} libelle="x" />);
    const modules = (h: string) => (h.match(/h1v1h-1z/g) ?? []).length;
    expect(modules(long)).toBeGreaterThan(modules(court));
    expect(renderToStaticMarkup(<QrCode valeur={URI} libelle="x" />)).toBe(renderToStaticMarkup(<QrCode valeur={URI} libelle="x" />));
  });
});

describe('premierDefaut — le champ à corriger, en français', () => {
  const libelles = { name: 'Nom', affiliateUrlTemplate: 'Gabarit d’adresse' };

  it('nomme le champ et dit « hors des bornes » pour une valeur trop courte ou trop longue', () => {
    const t = premierDefaut([{ code: 'too_small', message: 'String must contain at least 2 character(s)', path: ['name'] }], libelles);
    expect(t).toBe('Nom : valeur hors des bornes autorisées.');
  });

  it('rend le message du schéma tel quel quand il en a écrit un (`custom`)', () => {
    const t = premierDefaut([{ code: 'custom', message: 'Le lien d’affiliation doit être en HTTPS.', path: ['affiliateUrlTemplate'] }], libelles);
    expect(t).toBe('Le lien d’affiliation doit être en HTTPS.');
  });

  it('ne laisse jamais passer un message anglais de Zod', () => {
    const t = premierDefaut([{ code: 'invalid_type', message: 'Expected string, received null', path: ['inconnu'] }], libelles);
    expect(t).not.toMatch(/Expected|received/);
    expect(t).toContain('Un champ');
  });

  it('a un repli quand aucun défaut n’est donné', () => {
    expect(premierDefaut([], libelles)).toBe('Formulaire incomplet.');
  });
});
