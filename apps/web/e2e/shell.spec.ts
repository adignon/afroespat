import { expect, test, type Page } from '@playwright/test';

/**
 * Les règles dures, mesurées sur l'écran rendu.
 *
 * Le balisage est TRANSCODÉ de `docs/template/03 Accueil v2.dc.html` : styles en
 * ligne, pas de classes. Les assertions portent donc sur des valeurs CALCULÉES —
 * couleurs, dimensions, texte — et jamais sur un sélecteur de classe, qui se
 * casserait à la première régénération.
 *
 * La responsivité et les cibles tactiles vivent dans responsive.spec.ts, qui les
 * vérifie largeur par largeur, au seuil qui convient à chacune.
 */

const TOKENS = {
  bg: 'rgb(246, 248, 247)', // #F6F8F7
  primaryStrong: 'rgb(15, 92, 72)', // #0F5C48
  journey: 'rgb(224, 115, 58)', // #E0733A
} as const;

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
  test('le fond de page est celui de la maquette', async ({ page }) => {
    expect(await computed(page, '[data-screen="A01"]', 'background-color')).toBe(TOKENS.bg);
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
        if ((m[4] === undefined ? 1 : Number(m[4])) < 0.05) return false;

        // Teinte en HSL : le rouge est vers 0°, le terre cuite vers 23°.
        const rr = r / 255;
        const gg = g / 255;
        const bb = b / 255;
        const max = Math.max(rr, gg, bb);
        const d = max - Math.min(rr, gg, bb);
        if (d < 0.1) return false;
        let h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
        return h >= 345 || h <= 15;
      };

      const found: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const s = getComputedStyle(el);
        for (const prop of ['color', 'background-color', 'border-top-color', 'fill'] as const) {
          if (isRed(s.getPropertyValue(prop))) found.push(`${el.tagName.toLowerCase()} ${prop}`);
        }
      }
      return [...new Set(found)];
    });
    expect(reds).toEqual([]);
  });

  /**
   * RÈGLE DURE T1 §2.3 — jamais d'ombre portée.
   * L'anneau de focus est implémenté en box-shadow par Tailwind ; c'est lui que
   * T1 §6 exige, il ne compte pas comme ombre.
   */
  test('aucune ombre portée, hors anneau de focus', async ({ page }) => {
    const shadows = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((el) => getComputedStyle(el).boxShadow)
        .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
    );
    expect(shadows).toEqual([]);
  });
});

test.describe('cadre ordinateur', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'cadre ordinateur uniquement');

  test('le rail fait 76 px, en carte arrondie 22 px sur vert fort', async ({ page }) => {
    const rail = page.locator('nav').first();
    expect((await rail.boundingBox())?.width).toBe(76);
    expect(await rail.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      TOKENS.primaryStrong,
    );
    expect(await rail.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('22px');
  });

  // RÈGLE DURE §10.1 et T1 §3.1 — jamais une barre d'icônes horizontale en haut.
  test('la navigation principale est verticale, pas une barre horizontale', async ({ page }) => {
    const box = await page.locator('nav').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(box!.width * 3);
    expect(box!.x, 'elle commence au bord gauche').toBeLessThan(60);
  });

  test('la colonne de gauche porte 352 px de contenu dans 400 px', async ({ page }) => {
    // On remonte depuis le rail : le balisage de la maquette n'offre pas de
    // classe à viser, mais sa structure est stable.
    const panel = page.locator('nav').locator('xpath=../..').first();
    expect((await panel.boundingBox())?.width).toBe(400);

    const inner = await panel.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    });
    expect(inner).toBe(352);
  });

  test('le contenu ne dépasse pas 660 px et la colonne de contexte fait 300 px', async ({
    page,
  }) => {
    // Scopé au cadre ORDINATEUR : le cadre mobile porte aussi un `main`.
    expect((await page.locator('[data-frame="desktop"] main').boundingBox())!.width).toBeLessThanOrEqual(660);
    expect((await page.locator('[data-frame="desktop"] aside').boundingBox())!.width).toBe(300);
  });

  /**
   * Les deux colonnes restent à l'écran pendant que le fil défile.
   *
   * La maquette ne l'exprime pas — c'est une image, rien n'y défile. C'est donc
   * une adaptation, faite dans le générateur et non à la main, pour qu'elle
   * survive à la prochaine régénération. Ce test la tient.
   */
  test('la barre haute et les deux colonnes restent à l’écran au défilement', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(250);

    const positions = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="desktop"]')!;
      const top = (el: Element | null) => (el === null ? null : Math.round(el.getBoundingClientRect().top));

      const bar = Array.from(frame.querySelectorAll('div')).find(
        (d) => getComputedStyle(d).position === 'sticky' && d.offsetHeight === 64,
      );
      const rail = frame.querySelector('nav');
      const panel = rail?.parentElement?.parentElement ?? null;

      return {
        barreHaute: top(bar ?? null),
        colonneGauche: top(panel),
        colonneDroite: top(frame.querySelector('aside')),
        defile: Math.round(window.scrollY),
      };
    });

    expect(positions.defile, 'la page doit avoir défilé').toBeGreaterThan(800);

    // Sans `sticky`, les trois seraient remontées de 1200 px hors de l'écran.
    expect(positions.barreHaute, 'la barre haute a suivi le défilement').toBe(0);
    expect(positions.colonneGauche, 'la colonne de gauche a suivi').toBe(0);
    // La colonne de contexte s'arrête SOUS la barre haute, pas dessous elle.
    expect(positions.colonneDroite, 'la colonne de contexte a suivi').toBe(76);
  });

  /**
   * Une barre collante sans fond laisse voir le contenu défiler au travers.
   * La maquette n'en a pas besoin — rien n'y défile — donc l'oubli est facile.
   */
  test('la barre haute collante porte un fond opaque', async ({ page }) => {
    const bg = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="desktop"]')!;
      const bar = Array.from(frame.querySelectorAll('div')).find(
        (d) => getComputedStyle(d).position === 'sticky' && d.offsetHeight === 64,
      );
      return bar === undefined ? null : getComputedStyle(bar).backgroundColor;
    });
    expect(bg).toBe(TOKENS.bg);
  });

  /**
   * La maquette est dessinée à 1440 px. Au-delà, on centre plutôt que d'étirer :
   * le contenu est déjà borné à 660 px, et l'étirement ne ferait qu'éloigner
   * les colonnes l'une de l'autre.
   */
  test('au-delà de 1440 px, la mise en page est centrée', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.goto('/accueil', { waitUntil: 'networkidle' });

    const frame = (await page.locator('[data-frame="desktop"]').boundingBox())!;
    expect(frame.width).toBe(1440);
    // Marges égales de part et d'autre, à un pixel près.
    expect(Math.abs(frame.x - (1800 - frame.width - frame.x))).toBeLessThanOrEqual(1);
  });

  /**
   * La barre de progression de parcours est le seul aplat terre cuite du fil
   * (T1 §2.1). La maquette la dessine en div, sans rôle ARIA : on vérifie donc
   * la couleur. L'absence de sémantique est un constat à part, consigné dans
   * docs/decisions.md.
   */
  test('la carte parcours porte sa barre de progression terre cuite', async ({ page }) => {
    const found = await page.evaluate((journey) => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('div'))) {
        const r = el.getBoundingClientRect();
        if (getComputedStyle(el).backgroundColor === journey && r.height > 0 && r.height <= 10) {
          return true;
        }
      }
      return false;
    }, TOKENS.journey);
    expect(found, 'aucune barre terre cuite trouvée').toBe(true);
  });
});

/**
 * Les DEUX cadres sont dans le DOM, l'un masqué par CSS — Next rend côté
 * serveur et ne connaît pas la largeur. Les assertions mobiles se limitent donc
 * au cadre visible, faute de quoi elles trouveraient l'autre.
 */
test.describe('cadre mobile', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'cadre mobile uniquement');

  const frame = (page: Page) => page.locator('[data-frame="mobile"]');

  test('le rail d’ordinateur est absent', async ({ page }) => {
    await expect(page.locator('[data-frame="desktop"]')).toBeHidden();
    await expect(frame(page).locator('nav')).toHaveCount(0);
  });

  test('la barre d’onglets basse porte cinq entrées, Compte à la place d’Agenda', async ({
    page,
  }) => {
    for (const label of ['Accueil', 'Parcours', 'Entraide', 'Services', 'Compte']) {
      await expect(frame(page).getByText(label, { exact: true }).last()).toBeVisible();
    }
    // §10.1 : Agenda cède sa place à Compte et reste atteignable depuis Accueil.
    await expect(frame(page).getByText('Agenda', { exact: true })).toHaveCount(0);
  });

  test('la page défile, et la barre d’onglets reste visible', async ({ page }) => {
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(scrollable, 'le contenu doit défiler — la maquette le fige à 844 px').toBe(true);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(frame(page).getByText('Compte', { exact: true }).last()).toBeInViewport();
  });

  /**
   * Le cadre mobile de la maquette n'a PAS de colonne de contexte : c'est un
   * design distinct, pas un repli du design ordinateur.
   */
  test('pas de colonne de contexte, mais le fil est bien là', async ({ page }) => {
    await expect(frame(page).locator('aside')).toHaveCount(0);
    await expect(frame(page).getByText(/repas partagé pour les nouveaux/)).toBeVisible();
  });
});

test.describe('règles dures visibles à l’écran', () => {
  /**
   * RÈGLE DURE §1.2 — le mot « certifié » n'apparaît pas dans l'interface.
   *
   * Portée exacte (05-guides.md §2) : « rejetés dans le titre et dans les
   * libellés d'interface (pas dans le corps, qui peut citer un document
   * officiel) ». Un membre doit pouvoir écrire « le certificat Visale ».
   */
  test('aucun libellé d’interface n’emploie « certifié »', async ({ page }) => {
    const offenders = await page.evaluate(() => {
      const selector = 'button, a[href], h1, h2, h3, label, [role="tab"]';
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (/certifi(?!cats?\b)/i.test(el.innerText)) {
          out.push(`${el.tagName.toLowerCase()} « ${el.innerText.trim().slice(0, 40)} »`);
        }
      }
      return out;
    });
    expect(offenders).toEqual([]);
  });

  // RÈGLE DURE §1.2 — aucun compteur de vues, sur aucun contenu, pour personne.
  test('aucun compteur de vues n’est affiché', async ({ page }) => {
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toMatch(/\bvues?\b|\bvisualisations?\b/);
  });

  // T1 §2.4 — aucun emoji dans l'interface. Le contenu d'un membre peut en avoir.
  test('aucun emoji dans l’interface', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  /**
   * RÈGLE DURE (04 §2) : le titre personnel d'un parcours n'est jamais exposé
   * dans le fil ; seul le nom du type l'est.
   *
   * « Mes études à Lyon » vit dans la carte du panneau. Il ne doit apparaître
   * dans AUCUNE publication — leurs lignes de contexte disent « Parcours Études ».
   */
  test('le titre personnel du parcours n’apparaît pas dans le fil', async ({ page }) => {
    const leaked = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('article')).some((el) =>
        el.innerText.includes('Mes études à Lyon'),
      ),
    );
    expect(leaked, 'le titre personnel a fuité dans une publication').toBe(false);
  });
});
