import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accessibilité — §10.6 : « contrôle automatisé (axe-core) sur chaque page
 * principale ». Exigence de la définition de « terminé » (§12.2) : une
 * fonctionnalité n'est pas finie tant qu'une violation subsiste.
 *
 * axe-core ne remplace pas une relecture humaine : il attrape le contraste, les
 * noms accessibles manquants, la structure de titres. Il ne dit rien de la
 * pertinence d'un libellé. C'est un plancher, pas un plafond.
 */

const PAGES = [{ path: '/accueil', name: 'A01 Fil d’actualité' }] as const;

for (const { path, name } of PAGES) {
  test(`${name} ne présente aucune violation d’accessibilité`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      // AA est la cible (§10.6). AAA n'est pas exigé et produirait du bruit.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // ÉCART ASSUMÉ — le contraste est exclu ICI, et ici seulement.
      //
      // Le porteur a choisi de conserver les couleurs de la maquette telles
      // quelles ; trois jetons n'atteignent pas le seuil AA. La liste exacte, avec
      // les ratios mesurés, vit dans packages/config/guardrails/check-contrast.mjs
      // et s'affiche à CHAQUE build : l'écart reste sous les yeux plutôt que de
      // disparaître. Voir docs/decisions.md.
      //
      // Tout le reste d'axe-core continue de bloquer : noms accessibles, rôles,
      // ordre des titres, libellés de formulaire, attributs ARIA.
      .disableRules(['color-contrast'])
      .analyze();

    // Message lisible : la liste brute d'axe est illisible en sortie de CI.
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact ?? 'n/a'}) — ${v.help}\n    ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n    ')}`,
    );

    expect(summary, `Violations sur ${path} :\n${summary.join('\n')}`).toEqual([]);
  });
}
