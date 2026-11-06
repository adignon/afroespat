import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STAFF_SCOPES } from '@app/shared';
import { MatriceRoles, lignesMatrice } from './matrice-roles';

describe('matrice des rôles', () => {
  it('a une ligne par périmètre de STAFF_SCOPES et reprend ses rôles', () => {
    const l = lignesMatrice();
    expect(l.map((x) => x.scope).sort()).toEqual(Object.keys(STAFF_SCOPES).sort());
    expect([...(l.find((x) => x.scope === 'staffAdmin')?.roles ?? [])]).toEqual(['SUPER_ADMIN']);
    expect(l.find((x) => x.scope === 'rgpd')?.roles.has('SUPPORT')).toBe(true);
    expect(l.find((x) => x.scope === 'rgpd')?.roles.has('MODERATOR')).toBe(false);
  });
  it('se rend avec un tableau accessible', () => {
    const html = renderToStaticMarkup(<MatriceRoles />);
    expect(html).toContain('<caption');
    expect(html).toContain('scope="row"');
  });
});
