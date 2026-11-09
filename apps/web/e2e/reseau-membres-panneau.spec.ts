import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';

/**
 * L'ONGLET « MEMBRES » D'UN RÉSEAU : LA LISTE À DROITE, L'APERÇU AU CLIC, LES PAGES.
 *
 * Le porteur : « Sur la page des membres je préfère que les membres s'affichent sur le côté droit sur PC et
 * le clic affiche leur profil avec l'option back. On peut ajouter une animation au changement. Aussi la liste
 * ne doit pas être aussi longue, il faut une pagination. »
 *
 * Un seul `test()` par projet (ordinateur, mobile) : `POST /auth/otp/request` est limité à 10 par heure, et une
 * session par cas épuiserait la limite pour une raison étrangère à ce qu'on éprouve.
 *
 * ── LE DÉCOR ─────────────────────────────────────────────────────────────────
 *
 * Une page de 12 ne se voit qu'avec plus de 12 membres. `connecter` fait entrer UN membre dans « pays-bj »
 * (réseau automatique) ; quatorze autres y sont posés par `psql`, comme `aide-w5b.ts` pose une sanction : la
 * route d'inscription ne se prête pas à quinze comptes en une heure. Ce sont de vraies lignes de `users` et de
 * `community_members` — la liste, la pagination et l'aperçu les lisent par les vraies routes.
 */

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
const SLUG = 'pays-bj';
const SUPPLEMENTAIRES = 14;

function adresseDeLaBase(): string {
  let url = process.env['DATABASE_URL'];
  if (url === undefined) {
    const env = readFileSync(resolve(__dirname, '../../../.env'), 'utf8');
    url = /^DATABASE_URL=(.+)$/m.exec(env)?.[1]?.trim().replace(/^"|"$/g, '');
  }
  if (url === undefined) throw new Error('DATABASE_URL introuvable : ni environnement ni .env');
  return url.replace(/\?.*$/, '');
}

/** Pose `n` membres actifs de plus dans le réseau, sur le modèle de l'utilisateur donné. */
function poserMembres(modeleId: string, marque: string, n: number): void {
  const sql = `
    WITH modele AS (SELECT * FROM users WHERE id = '${modeleId}'),
    reseau AS (SELECT id FROM communities WHERE slug = '${SLUG}'),
    nouveaux AS (
      INSERT INTO users (id, updated_at, handle, display_name, phase, verification_level, origin_country_id, city_id, plan, status)
      SELECT gen_random_uuid(), now(), '${marque}-' || g, 'Citoyen ${marque} ' || lpad(g::text, 2, '0'),
             m.phase, m.verification_level, m.origin_country_id, m.city_id, m.plan, m.status
      FROM modele m, generate_series(1, ${n}) g
      RETURNING id
    )
    INSERT INTO community_members (id, updated_at, community_id, user_id, role, status, joined_at)
    SELECT gen_random_uuid(), now(), r.id, n.id, 'MEMBER', 'ACTIVE', now() FROM nouveaux n, reseau r;
  `;
  execFileSync('psql', [adresseDeLaBase(), '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: 'pipe' });
}

/** Les rangées VISIBLES (le cadre masqué est dans le DOM, pas à l'écran). */
const rangees = (page: Page) => page.locator('[data-membre-ligne]:visible');
const panneau = (page: Page) => page.locator('[data-membres-panneau]:visible');

async function pseudosAffiches(page: Page): Promise<string[]> {
  return rangees(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-membre-ligne') ?? ''));
}

test('la liste des membres : à droite sur ordinateur, aperçu au clic, retour, pages de 12', async ({
  page,
  context,
  request,
}, testInfo) => {
  const ordinateur = testInfo.project.name === 'ordinateur';
  const marque = `pg${Date.now().toString(36)}`;
  const moi = await connecter(context, request, { displayName: `Éprouvée ${marque}` });
  // L'entrée dans « pays-bj » est automatique, mais faite à la première lecture des réseaux.
  const auth = { authorization: `Bearer ${moi.accessToken}` };
  expect((await request.get(`${API}/communities`, { headers: auth })).ok()).toBe(true);
  poserMembres(moi.id, marque, SUPPLEMENTAIRES);

  // Le nombre de membres que la route rend (le compteur `memberCount` de la fiche n'est pas celui de la liste).
  const attendu = await request.get(`${API}/communities/${SLUG}/members?limit=50`, {
    headers: auth,
  });
  expect(attendu.ok(), `GET members : ${attendu.status()} ${await attendu.text()}`).toBe(true);
  const total = ((await attendu.json()) as { items: unknown[] }).items.length;
  expect(total).toBeGreaterThan(12);

  await page.goto(`/reseaux/${SLUG}?onglet=membres`);

  // ── Pagination : douze rangées, puis « Voir plus » ────────────────────────
  await expect(rangees(page).first()).toBeVisible({ timeout: 30_000 });
  await expect(rangees(page)).toHaveCount(12);
  const plus = page.locator('[data-voir-plus-bouton]:visible');
  await expect(plus).toBeVisible();

  // ── Ordinateur : la liste est À DROITE de la colonne « RÔLES · À PROPOS » ─
  if (ordinateur) {
    const liste = await panneau(page).boundingBox();
    const roles = await page.getByText('RÔLES', { exact: true }).filter({ visible: true }).boundingBox();
    expect(liste, 'le panneau de la liste').not.toBeNull();
    expect(roles, 'la colonne « RÔLES »').not.toBeNull();
    expect(liste!.x).toBeGreaterThan(roles!.x + roles!.width / 2);
  } else {
    // Téléphone : la liste prend la largeur de la page.
    const liste = await panneau(page).boundingBox();
    expect(liste!.width).toBeGreaterThan(330);
  }

  await plus.click();
  await expect.poll(async () => (await pseudosAffiches(page)).length).toBeGreaterThan(12);
  const pseudos = await pseudosAffiches(page);
  expect(new Set(pseudos).size, 'aucun doublon d’une page à l’autre').toBe(pseudos.length);
  // Jusqu'au bout : « Voir plus » disparaît et tous les membres sont là.
  while (await plus.isVisible()) {
    const avant = (await pseudosAffiches(page)).length;
    await plus.click();
    await expect.poll(async () => (await pseudosAffiches(page)).length).toBeGreaterThan(avant);
  }
  expect((await pseudosAffiches(page)).length).toBeGreaterThanOrEqual(total);

  // ── Clic → l'aperçu, l'adresse porte ?membre= ─────────────────────────────
  await page.locator('[data-membres-recherche]:visible').fill(marque);
  // Quinze résultats : la recherche est paginée comme le reste (douze, puis « Voir plus »).
  await expect(rangees(page)).toHaveCount(12, { timeout: 15_000 });
  await expect(plus).toBeVisible();
  await page.locator('[data-membres-recherche]:visible').fill(`Éprouvée ${marque}`);
  await expect(rangees(page)).toHaveCount(1, { timeout: 15_000 });
  const ligne = rangees(page).first();
  await ligne.click();

  const apercu = page.locator('[data-membre-apercu]:visible');
  await expect(apercu).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`membre=${moi.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  await expect(apercu.locator('[data-membre-apercu-nom]')).toHaveText(`Éprouvée ${marque}`);
  // Le profil est LU (`GET /users/:handle`) : bio, phase, disponibilité, étudiant·e.
  await expect(apercu.getByText('Profil créé par la suite de tests.')).toBeVisible();
  await expect(apercu.getByText('Vient d’arriver')).toBeVisible();
  await expect(apercu.getByText('Disponible pour aider : Démarches, Relecture CV')).toBeVisible();
  await expect(apercu.getByText('Étudiant·e')).toBeVisible();
  await expect(apercu.locator('[data-membre-apercu-profil]')).toHaveAttribute('href', `/@${moi.handle}`);
  await expect(rangees(page)).toHaveCount(0);
  // Le focus est sur « Retour ».
  await expect(page.locator('[data-membres-retour]:visible')).toBeFocused();

  // Le mouvement : `panelAdvance`, 240 ms.
  const mouvement = await page
    .locator('[data-membres-vue="profil"]:visible')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { nom: s.animationName, duree: s.animationDuration };
    });
  expect(mouvement.nom).toBe('dp-panel-advance');
  expect(parseFloat(mouvement.duree)).toBeCloseTo(0.24, 2);

  if (ordinateur) {
    const profil = await apercu.boundingBox();
    const roles = await page.getByText('RÔLES', { exact: true }).filter({ visible: true }).boundingBox();
    expect(profil!.x, 'l’aperçu prend la place de la liste, à droite').toBeGreaterThan(roles!.x + roles!.width / 2);
  } else {
    expect((await apercu.boundingBox())!.width, 'téléphone : l’aperçu prend la page').toBeGreaterThan(330);
  }

  // ── Retour : la liste revient, le focus aussi, l'adresse est nettoyée ─────
  await page.locator('[data-membres-retour]:visible').click();
  await expect(apercu).toHaveCount(0);
  await expect(page).not.toHaveURL(/membre=/);
  await expect(rangees(page)).toHaveCount(1);
  await expect(rangees(page).first()).toBeFocused();
  const retour = await page
    .locator('[data-membres-vue="liste"]:visible')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(retour).toBe('membres-retour');

  // ── Échap = Retour ────────────────────────────────────────────────────────
  await rangees(page).first().click();
  await expect(apercu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(apercu).toHaveCount(0);
  await expect(rangees(page)).toHaveCount(1);

  // ── Le retour du NAVIGATEUR fait le même geste ────────────────────────────
  await rangees(page).first().click();
  await expect(apercu).toBeVisible();
  await page.goBack();
  await expect(apercu).toHaveCount(0);
  await expect(rangees(page)).toHaveCount(1);

  // ── Un lien direct rouvre l'aperçu ; « Retour » n'envoie pas hors du site ─
  await page.goto(`/reseaux/${SLUG}?onglet=membres&membre=${moi.handle}`);
  await expect(page.locator('[data-membre-apercu]:visible')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-membres-retour]:visible').click();
  await expect(page.locator('[data-membre-apercu]:visible')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/reseaux/${SLUG}\\?onglet=membres$`));

  // ── prefers-reduced-motion : le même changement, sans mouvement ───────────
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await rangees(page).first().click();
  const reduit = await page
    .locator('[data-membres-vue="profil"]:visible')
    .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(reduit, 'animation coupée sous prefers-reduced-motion').toBeLessThan(0.001);
  await expect(page.locator('[data-membre-apercu]:visible')).toBeVisible();
});
