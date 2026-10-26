import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * AIDES PARTAGÉES DE LA VAGUE 5 (lot w5a) — décors que les specs ne trouvaient
 * pas dans une base fraîche.
 *
 * Tout passe par les VRAIES routes du produit ; la seule écriture directe en base
 * est la création du compte d'équipe, parce qu'aucune route ne crée le premier
 * compte (le CLI d'amorçage refuse de se rejouer — voir `staff-e2e.cli.ts`).
 */

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/** Les compteurs TOTP (RFC 6238) : SHA-1, 6 chiffres, pas de 30 s — comme `totp.ts` de l'API. */
function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function codeTotp(secret: string, at = Date.now()): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const digest = createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

/** Un compte d'équipe NEUF (jamais enrôlé), créé par le CLI de test de l'API. */
export function creerCompteEquipe(): { readonly email: string; readonly password: string } {
  const api = resolve(__dirname, '../../api');
  const sortie = execFileSync(
    'node',
    ['-r', '@swc-node/register', 'src/modules/admin/staff-e2e.cli.ts'],
    { cwd: api, encoding: 'utf8', env: process.env },
  );
  return JSON.parse(sortie.trim().split('\n').pop() ?? '{}') as { email: string; password: string };
}

/**
 * Ouvre une session d'ÉQUIPE dans le navigateur : crée un compte jetable (CLI de
 * test de l'API), puis déroule connexion → enrôlement TOTP → confirmation par les
 * routes du produit, et installe le cookie `dp_staff` dans le contexte.
 *
 * Un compte par appel : l'enrôlement ne se rejoue pas, et un code TOTP ne sert
 * qu'une fois.
 */
export async function ouvrirSessionEquipe(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<{ readonly email: string }> {
  const { email, password } = creerCompteEquipe();

  const login = await request.post(`${API}/admin/auth/login`, { data: { email, password } });
  if (!login.ok()) throw new Error(`admin/auth/login ${login.status()} : ${await login.text()}`);
  const { challenge } = (await login.json()) as { challenge: string };

  const enrol = await request.post(`${API}/admin/auth/totp/enroll`, { data: { challenge } });
  if (!enrol.ok()) throw new Error(`totp/enroll ${enrol.status()} : ${await enrol.text()}`);
  const { secret, challenge: defi } = (await enrol.json()) as { secret: string; challenge: string };

  const confirm = await request.post(`${API}/admin/auth/totp/confirm`, {
    data: { challenge: defi, code: codeTotp(secret) },
  });
  if (!confirm.ok()) throw new Error(`totp/confirm ${confirm.status()} : ${await confirm.text()}`);

  const cookies = await request.storageState();
  const equipe = cookies.cookies.find((c) => c.name === 'dp_staff');
  if (equipe === undefined) throw new Error('le cookie dp_staff n’a pas été posé.');
  await context.addCookies([equipe]);
  return { email };
}

/**
 * Ouvre un VRAI dossier de modération : un membre L2 signale le profil d'un autre
 * (`POST /reports`, sujet `USER`) ; le dossier naît côté serveur, puis on lit son
 * identifiant par la file d'équipe. Rend l'identifiant du dossier.
 *
 * Employer un contexte d'API NEUF : `monterEnL2` efface les cookies du contexte
 * qu'on lui donne, ce qui emporterait `dp_staff`.
 */
export async function ouvrirDossierModeration(
  browser: import('@playwright/test').Browser,
  equipe: APIRequestContext,
): Promise<{ readonly dossierId: string; readonly sujet: string }> {
  const { connecter } = await import('./session');
  const { monterEnL2 } = await import('./niveau');
  const { request: moteur } = await import('@playwright/test');

  const ctxA = await browser.newContext();
  const apiA = await moteur.newContext();
  const ctxB = await browser.newContext();
  const apiB = await moteur.newContext();
  try {
    const cible = await connecter(ctxB, apiB, { displayName: 'Membre Signalé' });
    const auteur = await connecter(ctxA, apiA, { displayName: 'Membre Vigilant' });
    const { accessToken } = await monterEnL2(ctxA, apiA, auteur.accessToken);
    const signalement = await apiA.post(`${API}/reports`, {
      headers: { authorization: `Bearer ${accessToken}` },
      data: { subjectType: 'USER', subjectId: cible.id, reason: 'SPAM' },
    });
    if (!signalement.ok()) {
      throw new Error(`POST /reports ${signalement.status()} : ${await signalement.text()}`);
    }
    // La file est triée par priorité : le dossier neuf peut être loin. On pagine
    // jusqu'à trouver celui dont le sujet est le membre signalé.
    let curseur: string | null = null;
    let dossier: { id: string } | undefined;
    for (let page = 0; page < 40 && dossier === undefined; page += 1) {
      const file = await equipe.get(
        `${API}/admin/moderation/cases?subjectType=USER&limit=50${curseur === null ? '' : `&cursor=${encodeURIComponent(curseur)}`}`,
      );
      if (!file.ok()) throw new Error(`GET /admin/moderation/cases ${file.status()}`);
      const corps = (await file.json()) as {
        items: { id: string; subjectId: string }[];
        nextCursor: string | null;
      };
      dossier = corps.items.find((d) => d.subjectId === cible.id);
      curseur = corps.nextCursor;
      if (curseur === null) break;
    }
    if (dossier === undefined) throw new Error('aucun dossier de modération après le signalement.');
    return { dossierId: dossier.id, sujet: cible.displayName };
  } finally {
    await Promise.all([ctxA.close(), apiA.dispose(), ctxB.close(), apiB.dispose()]);
  }
}
