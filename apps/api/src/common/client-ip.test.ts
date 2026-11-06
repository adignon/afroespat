import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

// `express` n'est pas une dépendance directe : on le prend là où @nestjs/platform-express le trouve.
const express = createRequire(createRequire(__filename).resolve('@nestjs/platform-express'))('express') as typeof import('express');

describe('clientIp', () => {
  it('valide l’adresse et rend null sinon', () => {
    expect(clientIp({ ip: '203.0.113.7' })).toBe('203.0.113.7');
    expect(clientIp({ ip: '2001:db8::1' })).toBe('2001:db8::1');
    expect(clientIp({ ip: 'pas-une-ip' })).toBeNull();
    expect(clientIp({ ip: '1.2.3.4, 5.6.7.8' })).toBeNull();
    expect(clientIp({ ip: undefined })).toBeNull();
  });
  it('ramène une IPv4 mappée en IPv4', () => {
    expect(clientIp({ ip: '::ffff:10.0.0.5' })).toBe('10.0.0.5');
  });

  describe('avec trust proxy = 1 (Caddy)', () => {
    let server: Server | undefined;
    afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

    async function ipVue(forwarded: string): Promise<string | null> {
      const app = express();
      app.set('trust proxy', 1);
      app.get('/', (req, res) => {
        res.json({ ip: clientIp(req) });
      });
      server = createServer(app);
      await new Promise<void>((ok) => server!.listen(0, '127.0.0.1', ok));
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/`, { headers: { 'x-forwarded-for': forwarded } });
      return ((await res.json()) as { ip: string | null }).ip;
    }

    it('prend l’entrée posée par le relais (à droite), pas celle forgée par le client (à gauche)', async () => {
      expect(await ipVue('9.9.9.9, 198.51.100.4')).toBe('198.51.100.4');
    });
    it('un en-tête sans adresse valide ne donne jamais une valeur arbitraire', async () => {
      expect(await ipVue('<script>')).toBeNull();
    });
  });
});
