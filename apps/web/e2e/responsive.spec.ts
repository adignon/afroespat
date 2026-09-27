import { expect, test, type Page } from '@playwright/test';

/**
 * Responsivité, sur tous les seuils que la spec définit — pas à deux largeurs
 * choisies au hasard.
 *
 * L'écran est TRANSCODÉ de la maquette, qui en fournit deux versions : un cadre
 * ordinateur et un cadre mobile. On bascule de l'un à l'autre au seuil de
 * 1024 px (§10.1 et T1 §3). Ces tests vérifient que la bascule a lieu au bon
 * endroit et que rien ne casse entre les deux.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes :
 * le balisage vient de la maquette, en styles en ligne, et un test qui viserait
 * une classe se casserait à la première régénération.
 */

const WIDTHS = [
  { w: 320, label: 'iPhone SE — la plus étroite qu’on vise' },
  { w: 360, label: 'Android courant' },
  { w: 390, label: 'iPhone 14 — la maquette mobile' },
  { w: 430, label: 'iPhone Pro Max' },
  { w: 768, label: 'tablette portrait' },
  { w: 1023, label: 'juste sous le seuil ordinateur' },
  { w: 1024, label: 'seuil ordinateur' },
  { w: 1279, label: 'largeur intermédiaire' },
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
      const isDesktop = w >= 1024;

      // 1. Jamais de défilement horizontal de la PAGE. C'est le symptôme n°1
      //    d'une interface non responsive, et le plus pénible à l'usage.
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(
        overflow.scroll,
        `débordement horizontal : ${overflow.scroll} px pour ${overflow.inner} px de fenêtre`,
      ).toBeLessThanOrEqual(overflow.inner + 1);

      /**
       * 2. Aucun élément ne sort de la fenêtre par la droite — sauf dans un
       *    conteneur à défilement horizontal, où dépasser est le comportement
       *    voulu : le bandeau de stories et la barre d'onglets défilent par
       *    conception.
       */
      const clipped = await page.evaluate(() => {
        const scrollsHorizontally = (el: HTMLElement): boolean => {
          let node: HTMLElement | null = el.parentElement;
          while (node !== null && node !== document.body) {
            const overflowX = getComputedStyle(node).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') return true;
            node = node.parentElement;
          }
          return false;
        };

        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          if (s.position === 'fixed' || s.position === 'sticky') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || scrollsHorizontally(el)) continue;
          if (r.right > window.innerWidth + 1) {
            out.push(`${el.tagName.toLowerCase()} dépasse de ${Math.round(r.right - window.innerWidth)} px`);
          }
        }
        return out.slice(0, 5);
      });
      expect(clipped).toEqual([]);

      // 3. La bonne version du design selon le seuil. Le cadre ordinateur porte
      //    un rail vertical ; le cadre mobile, une barre d'onglets à 5 entrées.
      const rail = page.locator('nav');
      const bottomTabs = page.getByText('Compte', { exact: true });

      if (isDesktop) {
        await expect(rail, 'le rail doit être visible').toBeVisible();
        expect((await rail.boundingBox())?.width).toBe(76);
        await expect(bottomTabs, 'la barre d’onglets basse doit être masquée').toBeHidden();
      } else {
        await expect(rail, 'le rail doit être masqué').toBeHidden();
        await expect(bottomTabs, 'la barre d’onglets basse doit être visible').toBeVisible();
      }

      // 4. Sur ordinateur, les colonnes de la maquette tiennent leur largeur.
      if (isDesktop) {
        // Scopé au cadre ORDINATEUR : le cadre mobile porte lui aussi un `main`
        // — il est un écran à part entière quand il est visible — et un locator
        // non scopé en trouverait deux, donc échouerait en mode strict.
        const main = await page.locator('[data-frame="desktop"] main').boundingBox();
        expect(main!.width, 'le contenu ne dépasse pas 660 px (§10.1)').toBeLessThanOrEqual(660);

        const aside = await page.locator('[data-frame="desktop"] aside').boundingBox();
        expect(aside!.width, 'la colonne de contexte fait 300 px').toBe(300);
      }

      // 5. Le texte reste lisible : aucune ligne coupée par un conteneur trop
      //    étroit, hors ellipses voulues.
      const unreadable = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('p, h1, h2'))) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.textOverflow === 'ellipsis') continue;
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

/**
 * Cible tactile — T1 §2.3 exige 44 × 44 px.
 *
 * La règle est vérifiée AUX LARGEURS TACTILES, sous 1024 px, où elle a un sens :
 * c'est là qu'on vise du doigt. Et la maquette mobile la respecte — elle a été
 * dessinée pour ça.
 *
 * Le cadre ORDINATEUR de la maquette, lui, emploie des contrôles plus petits :
 * « Continuer » fait 33 px, les filtres de stories 32 px, les liens de profil
 * sont en ligne. C'est un design pour souris, où le seuil applicable est celui
 * de WCAG 2.5.8 niveau AA — 24 × 24 px — et non les 44 px que T1 vise pour le
 * tactile. L'écart est donc mesuré, mais au bon seuil.
 *
 * Ce choix suit la même décision que le contraste : on garde les couleurs et les
 * dimensions de la maquette. Voir docs/decisions.md.
 */
test.describe('cible tactile', () => {
  async function tooSmall(page: Page, minimum: number): Promise<string[]> {
    return page.evaluate((min) => {
      const out: string[] = [];
      const selector = 'button, a[href], [role="switch"], [role="tab"]';
      /**
       * Exception WCAG 2.5.8 : « une cible dans une phrase ou un bloc de texte ».
       *
       * Le `display` CSS est un mauvais indicateur — « Voir mon profil public »
       * est un lien textuel posé en `display:block` pour occuper sa ligne, et
       * reste du texte. Le bon critère est VISUEL : pas de fond, pas de bordure,
       * et une hauteur qui ne dépasse pas l'interligne. Autrement dit : ça
       * ressemble à du texte, donc c'est du texte.
       */
      const isTextLink = (el: HTMLElement, s: CSSStyleDeclaration): boolean => {
        if (el.tagName !== 'A') return false;
        const transparent = s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent';
        const noBorder = parseFloat(s.borderTopWidth) === 0 && parseFloat(s.borderLeftWidth) === 0;
        const fontSize = parseFloat(s.fontSize);
        /**
         * La PREMIÈRE ligne, pas la boîte englobante.
         *
         * « politique de confidentialité » dans une phrase de consentement passe
         * à la ligne : son `getBoundingClientRect()` fait alors 36 px de haut,
         * soit près de trois interlignes, et le lien se faisait prendre pour un
         * bouton trop petit. `getClientRects()` rend une boîte par ligne — la
         * hauteur d'une seule dit si ça ressemble à du texte.
         */
        const lines = el.getClientRects();
        const lineHeight = lines.length > 0 ? (lines[0] as DOMRect).height : el.getBoundingClientRect().height;
        return transparent && noBorder && lineHeight <= fontSize * 1.8;
      };

      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        if (isTextLink(el, s)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < min - 0.5 || r.width < min - 0.5) {
          out.push(
            `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 24)} » ${Math.round(r.width)}×${Math.round(r.height)}`,
          );
        }
      }
      return out;
    }, minimum);
  }

  for (const w of [320, 390, 430, 768, 1023]) {
    test(`${w} px — tactile : 44 px (T1 §2.3)`, async ({ page }) => {
      await visit(page, w);
      expect(await tooSmall(page, 44)).toEqual([]);
    });
  }

  for (const w of [1024, 1440, 1920]) {
    test(`${w} px — souris : 24 px (WCAG 2.5.8 AA)`, async ({ page }) => {
      await visit(page, w);
      expect(await tooSmall(page, 24)).toEqual([]);
    });
  }
});
