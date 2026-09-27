import { expect, test, type Page } from '@playwright/test';

/**
 * La coquille de navigation, mesurée.
 *
 * Ces assertions portent sur des valeurs exactes : largeurs, hauteurs, couleurs
 * calculées. Elles ne dépendent ni de la police, ni du système, ni de la version
 * du navigateur — elles échouent quand le DESIGN dérive, et à ce moment-là
 * seulement. C'est ce qui les rend lisibles au bout de douze lots.
 *
 * Références : docs/template/Fil d'actualité v2.dc.html et gen-helpers.js.
 */

const TOKENS = {
  bg: 'rgb(246, 248, 247)', // #F6F8F7
  surface: 'rgb(255, 255, 255)',
  border: 'rgb(230, 235, 233)', // #E6EBE9
  primary: 'rgb(22, 120, 94)', // #16785E
  primaryStrong: 'rgb(15, 92, 72)', // #0F5C48
  primarySoft: 'rgb(227, 240, 235)', // #E3F0EB
  journey: 'rgb(224, 115, 58)', // #E0733A
  text: 'rgb(22, 33, 29)', // #16211D
} as const;

/** Mesure une propriété CSS calculée — la seule source fiable. */
async function computed(page: Page, selector: string, prop: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/accueil', { waitUntil: 'networkidle' });
});

test.describe('jetons de design', () => {
  test('le fond de page est #F6F8F7 et le texte #16211D', async ({ page }) => {
    expect(await computed(page, 'body', 'background-color')).toBe(TOKENS.bg);
    expect(await computed(page, 'body', 'color')).toBe(TOKENS.text);
  });

  test('la police est Plus Jakarta Sans', async ({ page }) => {
    expect(await computed(page, 'body', 'font-family')).toContain('Jakarta');
  });

  // RÈGLE DURE §1.2 — aucun rouge dans l'interface.
  test('aucun élément de la page n’est rouge', async ({ page }) => {
    const reds = await page.evaluate(() => {
      const isRed = (value: string): boolean => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(value);
        if (m === null) return false;
        const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const alpha = m[4] === undefined ? 1 : Number(m[4]);
        if (alpha < 0.05) return false;
        // Teinte en HSL : le rouge est autour de 0°, le terre cuite autour de 23°.
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const d = max - min;
        if (d < 0.1) return false;
        let h = 0;
        const rr = r / 255;
        const gg = g / 255;
        const bb = b / 255;
        if (max === rr) h = (((gg - bb) / d) % 6) * 60;
        else if (max === gg) h = ((bb - rr) / d + 2) * 60;
        else h = ((rr - gg) / d + 4) * 60;
        if (h < 0) h += 360;
        return h >= 345 || h <= 15;
      };

      const found: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const s = getComputedStyle(el);
        for (const prop of ['color', 'background-color', 'border-top-color', 'fill'] as const) {
          const v = s.getPropertyValue(prop);
          if (isRed(v)) found.push(`${el.tagName.toLowerCase()} ${prop}=${v}`);
        }
      }
      return found;
    });
    expect(reds).toEqual([]);
  });

  // RÈGLE DURE T1 §2.3 — jamais d'ombre portée.
  // L'anneau de focus de Tailwind est implémenté en box-shadow : c'est lui que
  // T1 §6 exige, il ne compte pas comme ombre portée.
  test('aucune ombre portée, hors anneau de focus', async ({ page }) => {
    const shadows = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((el) => getComputedStyle(el).boxShadow)
        .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
    );
    expect(shadows).toEqual([]);
  });
});

test.describe('coquille ordinateur', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'coquille ordinateur uniquement');

  test('le rail fait 76 px de large, en carte arrondie 22 px sur vert fort', async ({ page }) => {
    const rail = page.getByRole('navigation', { name: 'Navigation principale' }).first();
    expect((await rail.boundingBox())?.width).toBe(76);
    expect(await rail.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      TOKENS.primaryStrong,
    );
    expect(await rail.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('22px');
  });

  // RÈGLE DURE §10.1 et T1 §3.1 — jamais une barre d'icônes horizontale en haut.
  test('la navigation principale est verticale, pas une barre horizontale', async ({ page }) => {
    const rail = page.getByRole('navigation', { name: 'Navigation principale' }).first();
    const box = await rail.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(box!.width * 3);
    // Et elle commence au bord gauche, pas en haut.
    expect(box!.x).toBeLessThan(60);
  });

  test('la colonne de gauche fait 352 px de contenu dans 400 px de gouttières', async ({
    page,
  }) => {
    const panel = page.locator('div.w-\\[400px\\]').first();
    expect((await panel.boundingBox())?.width).toBe(400);
    const inner = await panel.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    });
    expect(inner).toBe(352);
  });

  test('le contenu ne dépasse pas 660 px', async ({ page }) => {
    const width = (await page.locator('main').first().boundingBox())?.width ?? 0;
    expect(width).toBeLessThanOrEqual(660);
  });

  test('la colonne de contexte fait 300 px et est visible au-dessus de 1280 px', async ({
    page,
  }) => {
    const aside = page.locator('aside').first();
    await expect(aside).toBeVisible();
    expect((await aside.boundingBox())?.width).toBe(300);
  });

  test('la section active du rail est marquée pour les lecteurs d’écran', async ({ page }) => {
    const current = page.getByRole('link', { current: 'page' }).first();
    await expect(current).toContainText('Accueil');
  });

  test('la carte parcours porte sa barre de progression terre cuite', async ({ page }) => {
    const bar = page.getByRole('progressbar').first();
    await expect(bar).toBeVisible();
    const fillColor = await bar
      .locator('div')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fillColor).toBe(TOKENS.journey);
    // La progression est annoncée, pas seulement dessinée.
    await expect(bar).toHaveAttribute('aria-valuenow', /^\d+$/);
  });
});

test.describe('coquille mobile', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'coquille mobile uniquement');

  test('le panneau de section est masqué', async ({ page }) => {
    await expect(page.locator('div.w-\\[400px\\]').first()).toBeHidden();
  });

  test('la barre d’onglets a cinq entrées, Compte à la place d’Agenda', async ({ page }) => {
    const tabs = page.getByRole('navigation', { name: 'Navigation principale' }).first();
    await expect(tabs).toBeVisible();
    await expect(tabs.locator('a')).toHaveText([
      'Accueil',
      'Parcours',
      'Entraide',
      'Services',
      'Compte',
    ]);
  });

  test('aucun débordement horizontal', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test('la colonne de contexte passe sous le contenu, sans être dupliquée', async ({ page }) => {
    const banner = page.getByText(/Aucun versement entre membres/);
    // Un seul rendu dans le DOM : pas de copie mobile et de copie ordinateur.
    await expect(banner).toHaveCount(1);
    await expect(banner).toBeVisible();

    const main = await page.locator('main').first().boundingBox();
    const aside = await page.locator('aside').first().boundingBox();
    expect(aside!.y).toBeGreaterThan(main!.y);
  });
});

test.describe('règles dures visibles à l’écran', () => {
  // RÈGLE DURE §1.2 — le mot « certifié » n'apparaît nulle part dans l'interface.
  test('le mot « certifié » est absent', async ({ page }) => {
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toContain('certifi');
  });

  // RÈGLE DURE §1.2 — aucun compteur de vues, sur aucun contenu, pour personne.
  test('aucun compteur de vues n’est affiché', async ({ page }) => {
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toMatch(/\bvues?\b|\bvisualisations?\b/);
  });

  /**
   * T1 §2.3 — cible tactile 44 × 44 px minimum.
   *
   * Portée volontairement limitée aux CONTRÔLES : boutons, onglets,
   * interrupteurs, et liens présentés comme des blocs cliquables. Les liens en
   * ligne dans un flux de texte en sont exclus — WCAG 2.5.8 les exempte
   * explicitement, et leur imposer 44 px disloquerait la typographie sans
   * bénéfice pour personne.
   */
  test('tout contrôle visible atteint 44 px', async ({ page }) => {
    const tooSmall = await page.evaluate(() => {
      const out: string[] = [];
      const selector = 'button, a[href], [role="switch"], [role="tab"]';
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;

        // Exception WCAG 2.5.8 : un lien en ligne dans du texte.
        const isInlineLink = el.tagName === 'A' && style.display.startsWith('inline');
        if (isInlineLink) continue;

        if (r.height < 44 - 0.5 || r.width < 44 - 0.5) {
          out.push(
            `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 28)} » ${Math.round(r.width)}×${Math.round(r.height)}`,
          );
        }
      }
      return out;
    });
    expect(tooSmall).toEqual([]);
  });

  // T1 §2.4 — aucun emoji dans l'interface. Le contenu d'un membre peut en avoir.
  test('aucun emoji dans l’interface', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
