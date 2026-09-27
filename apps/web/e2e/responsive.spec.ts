import { expect, test, type Page } from '@playwright/test';

/**
 * Responsivité, sur tous les seuils que la spec définit — pas à deux largeurs
 * choisies au hasard.
 *
 * Seuils de §10.1 et T1 §3 :
 *   · < 1024 px  → coquille mobile : panneau masqué, barre d'onglets basse
 *   · ≥ 1024 px  → coquille ordinateur : rail 76 px + panneau 264 px
 *   · < 1280 px  → colonne de contexte masquée, repliée sous le contenu
 *
 * Les largeurs testées couvrent les appareils réels ET les pixels de part et
 * d'autre de chaque seuil : c'est juste au seuil que les régressions passent.
 */

const WIDTHS = [
  { w: 320, label: 'iPhone SE — la plus étroite qu’on vise' },
  { w: 360, label: 'Android courant' },
  { w: 390, label: 'iPhone 14 — la maquette mobile' },
  { w: 430, label: 'iPhone Pro Max' },
  { w: 768, label: 'tablette portrait' },
  { w: 1023, label: 'juste sous le seuil ordinateur' },
  { w: 1024, label: 'seuil ordinateur' },
  { w: 1279, label: 'juste sous le seuil de la colonne de contexte' },
  { w: 1280, label: 'seuil de la colonne de contexte' },
  { w: 1440, label: 'la maquette ordinateur' },
  { w: 1920, label: 'grand écran' },
] as const;

/** Ce test pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

async function visit(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/accueil', { waitUntil: 'networkidle' });
}

test.describe('aucune régression de mise en page selon la largeur', () => {
  for (const { w, label } of WIDTHS) {
    test(`${w} px — ${label}`, async ({ page }) => {
      await visit(page, w);

      // 1. Jamais de défilement horizontal. C'est le symptôme n°1 d'une
      //    interface non responsive, et le plus pénible à l'usage.
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(
        overflow.scroll,
        `débordement horizontal : ${overflow.scroll} px pour ${overflow.inner} px de fenêtre`,
      ).toBeLessThanOrEqual(overflow.inner + 1);

      // 2. Aucun élément ne sort de la fenêtre par la droite.
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > window.innerWidth + 1) {
            out.push(
              `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} dépasse de ${Math.round(r.right - window.innerWidth)} px`,
            );
          }
        }
        return out.slice(0, 5);
      });
      expect(clipped).toEqual([]);

      // 3. La bonne coquille selon le seuil.
      const isDesktop = w >= 1024;
      const panel = page.locator('div.w-\\[400px\\]').first();
      if (isDesktop) {
        await expect(panel, 'le panneau de section doit être visible').toBeVisible();
        expect((await panel.boundingBox())?.width).toBe(400);
      } else {
        await expect(panel, 'le panneau de section doit être masqué').toBeHidden();
        // La barre d'onglets prend le relais.
        const tabs = page.getByRole('navigation', { name: 'Navigation principale' }).first();
        await expect(tabs).toBeVisible();
        await expect(tabs.locator('a')).toHaveCount(5);
      }

      // 4. La colonne de contexte : à côté au-dessus de 1280 px, dessous en deçà.
      const main = await page.locator('main').first().boundingBox();
      const aside = await page.locator('aside').first().boundingBox();
      expect(main).not.toBeNull();
      expect(aside).not.toBeNull();
      if (w >= 1280) {
        expect(aside!.width, 'la colonne de contexte fait 300 px').toBe(300);
        expect(aside!.y, 'elle est à côté du contenu').toBeLessThan(main!.y + 40);
      } else {
        expect(aside!.y, 'elle passe sous le contenu').toBeGreaterThan(main!.y);
      }

      // 5. Le contenu ne dépasse jamais 660 px sur ordinateur (§10.1).
      if (isDesktop) {
        expect(main!.width).toBeLessThanOrEqual(660);
      }

      // 6. Le texte reste lisible : aucune ligne tronquée par un conteneur trop
      //    étroit sur les blocs de contenu.
      const unreadable = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('p, h1, h2, span'))) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.overflow === 'hidden') continue;
          if (el.scrollWidth > el.clientWidth + 2 && s.whiteSpace === 'nowrap') {
            out.push(`${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 24)} »`);
          }
        }
        return out.slice(0, 5);
      });
      expect(unreadable).toEqual([]);
    });
  }
});

test.describe('cible tactile tenue à toutes les largeurs', () => {
  // Un contrôle peut passer à 1440 px et se rétrécir à 320 px : la règle dure
  // T1 §2.3 doit tenir partout, pas seulement sur la maquette.
  for (const { w } of [{ w: 320 }, { w: 390 }, { w: 768 }, { w: 1024 }, { w: 1440 }]) {
    test(`${w} px — tout contrôle atteint 44 px`, async ({ page }) => {
      await visit(page, w);
      const tooSmall = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>('button, a[href], [role="switch"], [role="tab"]'),
        )) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          if (el.tagName === 'A' && s.display.startsWith('inline')) continue; // WCAG 2.5.8
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.height < 43.5 || r.width < 43.5) {
            out.push(
              `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 24)} » ${Math.round(r.width)}×${Math.round(r.height)}`,
            );
          }
        }
        return out;
      });
      expect(tooSmall).toEqual([]);
    });
  }
});
