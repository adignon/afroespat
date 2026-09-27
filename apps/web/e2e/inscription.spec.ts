import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * L'inscription, de bout en bout, dans un vrai navigateur — 01-identite.md §5.
 *
 * Le code OTP est lu dans le journal de l'API, où le fournisseur de SMS fictif
 * l'écrit. C'est le SEUL raccourci : tout le reste passe par l'interface, comme
 * un membre le ferait.
 *
 * Ces tests demandent l'API en marche. Ils se sautent proprement sinon, avec un
 * message qui dit quoi lancer — plutôt que d'échouer en accusant le code.
 */

const API = process.env['API_URL'] ?? 'http://localhost:3001/v1';

/**
 * La bannière d'erreur du parcours, et elle seule.
 *
 * `[role="alert"]` ne suffit PAS : Next pose son annonceur de route avec le même
 * rôle, vide au chargement. Trois tests d'ici échouaient dessus, en accusant
 * l'application — c'est le sélecteur qui était trop large.
 */
const BANNER = '[data-flow-error]';
const API_LOG = process.env['API_LOG'] ?? '';

async function apiUp(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Les codes envoyés à un numéro donné, dans l'ordre.
 *
 * CORRÉLÉS au numéro, et non « le dernier du journal » : les deux projets
 * Playwright tournent en parallèle et demandent chacun un code. Prendre le
 * dernier écrit renvoyait celui de l'autre projet, et le test échouait sur
 * « ce code n'est pas le bon » — en accusant l'application d'un défaut qui était
 * dans le test. Le journal masque le numéro mais garde ses quatre derniers
 * chiffres : c'est assez pour ne pas se tromper.
 *
 * Lu en `latin1` : le journal contient des séquences de couleur et un masque `•`
 * qui le font passer pour du binaire. Un `grep` ordinaire s'y tait complètement —
 * le premier outil d'inspection que j'ai écrit est tombé exactement là.
 */
function codesSentTo(phone: string): string[] {
  if (API_LOG === '') return [];
  const tail = phone.slice(-4);
  try {
    const text = readFileSync(API_LOG, 'latin1');
    const pattern = new RegExp(`SMS fictif vers [^:]*${tail} : Votre code de connexion : (\\d{6})`, 'g');
    return [...text.matchAll(pattern)].map((m) => m[1] as string);
  } catch {
    return [];
  }
}

test.describe('inscription complète', () => {
  test.skip(
    async () => !(await apiUp()) || API_LOG === '',
    'API ou journal absents : lancer `pnpm dev` dans apps/api et passer API_LOG',
  );

  test('numéro, code, phase — et l’avancement suit', async ({ page }) => {
    /**
     * Un numéro VRAIMENT unique.
     *
     * `Date.now()` tronqué à quatre chiffres se répète toutes les dix secondes,
     * et les deux projets Playwright démarrent à la même milliseconde : deux
     * exécutions rapprochées consommaient la limite de trois envois par heure et
     * par numéro. Le test échouait alors sur un vrai refus du serveur, ce qui
     * ressemblait à un bogue de l'application.
     */
    const phone = `97${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100)}`;

    await page.goto('/connexion');

    // Le champ dessiné en `<div>` par la maquette est bien devenu saisissable.
    const field = page.locator('input[name="phone"]:visible');
    await field.fill(phone);
    await expect(field).toHaveValue(phone);

    await page.getByRole('button', { name: 'Recevoir le code' }).click();
    await page.waitForURL('**/connexion/code');

    // Le SMS fictif est parti, VERS CE NUMÉRO.
    await expect.poll(() => codesSentTo(phone).length, { timeout: 15_000 }).toBe(1);
    const code = codesSentTo(phone)[0] as string;

    // UN SEUL champ, masqué : les six cases ne font qu'afficher.
    await page.locator('input[autocomplete="one-time-code"]').fill(code);

    // La vérification part au sixième chiffre, sans bouton — comme la maquette.
    await page.waitForURL('**/bienvenue/phase', { timeout: 20_000 });

    // Troisième carte, puis « Continuer » : la phase doit être enregistrée avant
    // d'avancer, sinon l'écran suivant travaille sur un compte incomplet.
    // Ciblé par son TEXTE, pas par son rang : les deux cadres n'ont pas le même
    // nombre de boutons, et un `nth(2)` désignait une flèche de retour sur mobile.
    await page.locator('main:visible button').filter({ hasText: 'Je suis installé·e' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/lieu', { timeout: 20_000 });

    // Aucune bannière d'erreur sur le chemin heureux.
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('refuse un numéro vide sans appeler l’API', async ({ page }) => {
    let called = false;
    await page.route('**/auth/otp/request', (route) => {
      called = true;
      return route.continue();
    });

    await page.goto('/connexion');
    await page.getByRole('button', { name: 'Recevoir le code' }).click();

    await expect(page.locator(BANNER)).toContainText('Entrez votre numéro');
    // Un SMS coûte : la vérification locale doit précéder l'appel.
    expect(called).toBe(false);
  });

  test('refuse les lettres à la frappe', async ({ page }) => {
    await page.goto('/connexion');
    const field = page.locator('input[name="phone"]:visible');

    await field.fill('06ab12cd');
    // Refusé À LA FRAPPE, et non signalé après envoi : un champ qui accepte des
    // lettres laisse croire qu'elles comptent.
    await expect(field).toHaveValue('0612');
  });

  test('renvoie au numéro AVEC son motif quand le défi est perdu', async ({ page }) => {
    await page.goto('/connexion/code');
    // Aucun défi en session : c'est le cas d'un onglet rouvert, ou d'un lien
    // suivi directement.
    await page.locator('input[autocomplete="one-time-code"]').fill('123456');

    await page.waitForURL('**/connexion?reprise=**', { timeout: 20_000 });
    /**
     * Le motif voyage dans l'URL, pas dans l'état React.
     *
     * Posé dans l'état, il était effacé par la navigation : le membre
     * atterrissait sur l'écran du numéro SANS SAVOIR POURQUOI — le pire moment
     * pour abandonner une inscription. Trouvé en exerçant ce cas, pas en relisant.
     */
    await expect(page.locator(BANNER)).toContainText('expiré');
  });

  test('affiche le motif de reprise rendu par le SERVEUR', async ({ page }) => {
    // Le message vient du HTML initial, pas d'un rendu client : les constantes
    // partagées ne vivent donc pas dans un module `'use client'`, où un composant
    // serveur n'obtiendrait qu'une référence client et une recherche vide.
    const response = await page.goto('/connexion?reprise=defi-expire');
    expect(await response?.text()).toContain('Votre demande a expiré');
  });

  test('ignore un motif de reprise inconnu au lieu de l’afficher', async ({ page }) => {
    // L'URL est publique : n'importe qui peut y écrire ce qu'il veut. Afficher la
    // valeur telle quelle ferait de cet écran un panneau d'affichage.
    await page.goto('/connexion?reprise=<script>alert(1)</script>');
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});
