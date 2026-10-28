import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL2 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LA CONVERSATION SERA VISIBLE DES MODÉRATEURS » — SIGNALER UN MESSAGE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Vague 6. Cette mention (08 §5.2) n'est affichée que pour le signalement d'UN MESSAGE :
 * le modérateur y lit la conversation. Signaler le membre (menu de la conversation), une
 * publication ou un guide reçoit la phrase neutre — la dire à tort serait une fausse
 * promesse de transparence. `messages-transverse.spec.ts` n'éprouvait que l'ABSENCE
 * (feuille ouverte par l'URL, donc sans message visé) ; ce test éprouve la PRÉSENCE par le
 * vrai geste : « Signaler » sous le message d'un autre, avec un compte N2 (signaler est
 * réservé au niveau 2, `capabilities.ts`).
 *
 * Les deux largeurs : les projets Playwright `ordinateur` (1440) et `mobile` (390) jouent
 * ce même fichier ; la largeur est relevée et dite dans chaque message d'échec.
 */
test.describe('signaler un MESSAGE annonce la lecture par les modérateurs', () => {
  test('la mention n’apparaît que pour un message (feuille ouverte depuis la bulle)', async ({
    page,
    request,
    browser,
  }) => {
    const largeur = page.viewportSize()?.width ?? 0;

    // L'autre membre écrit en premier : son message est celui que je signalerai.
    const ctxAutre = await browser.newContext();
    const autre = await connecter(ctxAutre, request, { displayName: 'Fatim Sow' });
    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const moi = await monterEnL2(page.context(), request, ouvert.accessToken);

    const depart = await request.post(`${API}/conversations/direct`, {
      headers: { authorization: `Bearer ${autre.accessToken}` },
      data: { toHandle: ouvert.handle, firstMessage: 'Bonjour, une question sur le logement.' },
    });
    expect(depart.status(), await depart.text()).toBe(201);
    const corps = (await depart.json()) as { conversationId?: string; id?: string };
    const id = corps.conversationId ?? corps.id;
    await ctxAutre.close();
    expect(id, 'conversation non créée').toBeDefined();
    expect(moi.accessToken).toBeTruthy();

    await page.goto(`/messages/${id}`, { waitUntil: 'load' });
    const signaler = page.locator('[data-bulle-signaler]:visible').first();
    await expect(signaler, `bouton « Signaler » du message à ${largeur} px`).toBeVisible({ timeout: 25_000 });

    const dialogue = page.getByRole('dialog', { name: 'Signaler' });
    // Le bouton est rendu avant l'hydratation : un clic trop tôt ne fait rien. On le rejoue
    // jusqu'à ce que la feuille s'ouvre (le geste est idempotent tant qu'elle est fermée).
    await expect(async () => {
      if (!(await dialogue.isVisible())) await signaler.click();
      await expect(dialogue).toBeVisible({ timeout: 1_500 });
    }, `feuille de signalement à ${largeur} px`).toPass({ timeout: 20_000 });
    await expect(
      dialogue.getByText('La conversation sera visible des modérateurs.'),
      `la mention d'un MESSAGE à ${largeur} px`,
    ).toBeVisible();
    await expect(
      dialogue.getByText('Votre signalement sera examiné par l’équipe de modération.'),
      `la phrase neutre ne doit pas la doubler à ${largeur} px`,
    ).toHaveCount(0);

    // Refermée, puis rouverte par le MENU (signaler le MEMBRE) : la mention disparaît.
    await dialogue.getByRole('button', { name: 'Fermer' }).first().click();
    await expect(dialogue).toBeHidden();
    await page.goto(`/messages/${id}?feuille=signaler`, { waitUntil: 'load' });
    const membre = page.getByRole('dialog', { name: 'Signaler' });
    await expect(membre).toBeVisible({ timeout: 25_000 });
    await expect(membre.getByText('La conversation sera visible des modérateurs.')).toHaveCount(0);
    await expect(
      membre.getByText('Votre signalement sera examiné par l’équipe de modération.'),
    ).toBeVisible();
  });
});
