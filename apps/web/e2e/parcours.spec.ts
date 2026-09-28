import { expect, test, type Page } from '@playwright/test';

/**
 * Les douze écrans du module Parcours — J01 à J11.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé de
 * `docs/template/04 Parcours.dc.html`, donc il est celui de la maquette par
 * construction. Ils éprouvent ce qu'une image ne peut pas contenir — la bascule
 * de forme au bon seuil, les états que l'URL choisit, et les règles du dossier
 * que l'écran doit rendre visibles.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes :
 * le balisage vient de la maquette en styles en ligne, et viser une classe se
 * casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `load` et non `networkidle` : ces écrans n'émettent AUCUNE requête — la
 * maquette est statique et ce lot ne branche pas l'API. `networkidle` ajoutait
 * une demi-seconde d'attente par navigation pour une file vide, et les tests qui
 * parcourent dix largeurs finissaient par dépasser leur délai sur une machine
 * chargée. Ce qu'on mesure est de la GÉOMÉTRIE : elle est acquise dès que la
 * feuille de style est appliquée.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
}

/**
 * Les douze routes de T5 §5, avec le titre que la maquette écrit sur chacune.
 *
 * Le titre est celui que le transcodeur a promu en `<h1>` : c'est le texte
 * VISIBLE de la maquette, pas un titre inventé pour la route. C'est exactement
 * la faute qu'avait commise la réécriture manuelle d'A01 — « un titre de page
 * inventé » — et ce tableau est ce qui l'empêche de revenir ici.
 */
const ROUTES = [
  { url: '/parcours', titre: 'Mes parcours', ecran: 'J11' },
  { url: '/parcours/nouveau', titre: 'Créer un parcours', ecran: 'J02' },
  { url: '/parcours/1', titre: 'Mes études à Lyon', ecran: 'J01' },
  { url: '/parcours/1/etapes/7', titre: 'Trouver un logement pérenne', ecran: 'J01S' },
  { url: '/parcours/1/discussion', titre: 'Discussion du parcours', ecran: 'J01D' },
  { url: '/parcours/1/equipe', titre: 'Équipe', ecran: 'J05' },
  { url: '/parcours/1/documents', titre: 'Checklist de documents', ecran: 'J06' },
  { url: '/parcours/1/historique', titre: 'Historique', ecran: 'J07' },
  { url: '/parcours/1/reglages', titre: 'Réglages du parcours', ecran: 'J08' },
  { url: '/parcours/1/abouti', titre: 'Vous y êtes arrivé·e !', ecran: 'J10' },
  { url: '/parcours/publics', titre: 'Parcours publics', ecran: 'J09' },
  { url: '/parcours/publics/1', titre: 'Parcours de Fatou', ecran: 'J09F' },
] as const;

test.describe('les douze routes du module', () => {
  for (const { url, titre, ecran } of ROUTES) {
    test(`${url} rend ${ecran} et porte SON titre`, async ({ page }) => {
      await visiter(page, url);
      await expect(page.locator(`[data-screen="${ecran}"]`)).toHaveCount(1);

      /**
       * Le titre est cherché par RÔLE, dans le cadre VISIBLE.
       *
       * `ScreenFrames` rend les deux cadres et en masque un par CSS : les deux
       * portent donc un `<h1>`, et un locator non scopé en trouverait deux. Le
       * scoper au cadre visible mesure ce que le membre voit.
       */
      const h1 = page.locator('[data-frame="desktop"]').getByRole('heading', { level: 1 });
      await expect(h1).toHaveText(titre);
    });
  }
});

test.describe('la bascule ordinateur / mobile au seuil de 1024 px (§10.1)', () => {
  /**
   * Le rail vertical de 76 px est la signature du cadre ORDINATEUR (T5 §0 :
   * « rail vertical 76 px à gauche »). La barre d'onglets à cinq entrées est
   * celle du cadre MOBILE. Les deux sont dans le document ; c'est la VISIBILITÉ
   * qui bascule, pas le rendu.
   */
  for (const { w, rail } of [
    { w: 1023, rail: false },
    { w: 1024, rail: true },
  ] as const) {
    test(`${w} px — rail ${rail ? 'visible' : 'masqué'}`, async ({ page }) => {
      await visiter(page, '/parcours/1', w);
      const nav = page.locator('nav');
      if (rail) {
        await expect(nav).toBeVisible();
        expect((await nav.boundingBox())?.width).toBe(76);
        await expect(page.getByText('Compte', { exact: true })).toBeHidden();
      } else {
        await expect(nav).toBeHidden();
        await expect(page.getByText('Compte', { exact: true })).toBeVisible();
      }
    });
  }

  test('la colonne de contenu ne dépasse pas 660 px et la colonne de contexte fait 300 px', async ({
    page,
  }) => {
    await visiter(page, '/parcours/1', 1440);
    const main = await page.locator('[data-frame="desktop"] main').boundingBox();
    expect(main?.width, 'le contenu ne dépasse pas 660 px (§10.1)').toBeLessThanOrEqual(660);
    const aside = await page.locator('[data-frame="desktop"] aside').boundingBox();
    expect(aside?.width, 'la colonne de contexte fait 300 px').toBe(300);
  });
});

/**
 * LES ÉTATS QUE LA MAQUETTE DESSINE.
 *
 * Chacun est une PLANCHE à part — « aucun parcours », « parcours abouti »,
 * « plan atteint », « variante Régulariser », « modifier les étapes ». Un état
 * que l'URL ne saurait pas atteindre serait une planche transcodée pour rien.
 */
test.describe('les états de §6 sont atteignables', () => {
  test('?etat=vide — « aucun parcours » (§6, états communs)', async ({ page }) => {
    await visiter(page, '/parcours/1?etat=vide');
    await expect(
      page.locator('[data-frame="desktop"]').getByRole('heading', { level: 1 }),
    ).toHaveText('Commencez votre parcours');
  });

  test('?etat=abouti — le parcours abouti (§3.9)', async ({ page }) => {
    await visiter(page, '/parcours/1?etat=abouti');
    // La progression est à 100 % : c'est ce qui distingue cette planche de J01.
    await expect(page.locator('[data-frame="desktop"]').getByText('12 / 12 étapes')).toBeVisible();
  });

  test('?etat=parcours — le sélecteur ouvert, page complète sur ordinateur', async ({ page }) => {
    await visiter(page, '/parcours/1?etat=parcours', 1440);
    // La liste des trois parcours est DANS la page, pas dans une fenêtre :
    // `mobileOnly` interdit la feuille au-dessus de 1024 px.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-frame="desktop"]').getByText('Changer de statut')).toBeVisible();
  });

  test('?etat=parcours — la même chose devient une FEUILLE sous 1024 px', async ({ page }) => {
    await visiter(page, '/parcours/1?etat=parcours', 390);
    const dialogue = page.getByRole('dialog', { name: /Mes parcours/ });
    await expect(dialogue).toBeVisible();

    const boite = await dialogue.locator('[data-modal-panel]').boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;
    // Toute la largeur, posée sur le bord bas : c'est ce qui fait une feuille.
    expect(Math.round(boite.width)).toBe(390);
    expect(Math.round(boite.y + boite.height)).toBeGreaterThanOrEqual(898);
  });

  /**
   * LA FEUILLE NE REDESSINE PAS L'ÉCRAN DE DESSOUS.
   *
   * `04 Parcours` dessine le décor de ses modales EN CLAIR, pas en fantôme
   * `opacity:.5` comme `03 Accueil` : la planche mobile de J01M porte l'en-tête
   * « Mes études à Lyon » au-dessus du voile, dans l'ordre du document. Transcodé
   * tel quel, cet en-tête se retrouvait DANS la boîte de dialogue — qui affichait
   * donc deux fois le titre, l'un par-dessus l'écran qui le porte déjà.
   *
   * Le titre reste présent UNE fois : c'est la ligne du parcours courant dans la
   * liste. Deux signifieraient que le décor est revenu.
   */
  test('?etat=parcours — la feuille ne contient pas l’en-tête de l’écran de dessous', async ({
    page,
  }) => {
    await visiter(page, '/parcours/1?etat=parcours', 390);
    const dialogue = page.getByRole('dialog', { name: /Mes parcours/ });
    await expect(dialogue.getByText('Mes études à Lyon', { exact: true })).toHaveCount(1);
  });

  test('?etat=edition — « Modifier les étapes », mobile seulement', async ({ page }) => {
    await visiter(page, '/parcours/1?etat=edition', 390);
    await expect(
      page.locator('[data-frame="mobile"]').getByRole('heading', { level: 1 }),
    ).toHaveText('Modifier les étapes');

    // Sur ordinateur la maquette ne dessine PAS ce mode : on garde la vue
    // d'ensemble plutôt que d'inventer l'écran manquant.
    await visiter(page, '/parcours/1?etat=edition', 1440);
    await expect(
      page.locator('[data-frame="desktop"]').getByRole('heading', { level: 1 }),
    ).toHaveText('Mes études à Lyon');
  });

  test('?etape=plan — « plan atteint » SANS bloquer la lecture (§3.1)', async ({ page }) => {
    await visiter(page, '/parcours/nouveau?etape=plan', 390);
    const cadre = page.locator('[data-frame="mobile"]');
    await expect(cadre.getByText('Vous avez déjà un parcours actif')).toBeVisible();
    /**
     * §3.1 : « encart avec bouton Premium, SANS BLOQUER LA LECTURE ». Les types
     * de parcours doivent rester lisibles SOUS l'encart — c'est la moitié de la
     * règle qu'on oublie, et la seule qu'un écran puisse trahir.
     */
    await expect(cadre.getByText('Étudier · 12 étapes')).toBeVisible();
  });

  test('?etape=regulariser — les trois sous-situations (§3.1)', async ({ page }) => {
    await visiter(page, '/parcours/nouveau?etape=regulariser', 390);
    const cadre = page.locator('[data-frame="mobile"]');
    for (const choix of ['Régularisation', 'Changement de statut', 'Renouvellement']) {
      await expect(cadre.getByText(choix, { exact: true })).toBeVisible();
    }
  });

  test('un état inconnu ne casse pas la page', async ({ page }) => {
    // L'URL est publique : une valeur fantaisiste est IGNORÉE, pas affichée.
    await visiter(page, '/parcours/1?etat=nimporte-quoi');
    await expect(
      page.locator('[data-frame="desktop"]').getByRole('heading', { level: 1 }),
    ).toHaveText('Mes études à Lyon');
  });
});

/**
 * §3.7 — LA VUE PUBLIQUE, règle dure.
 *
 * « Ce que voit un membre connecté sur un parcours public : … **Jamais** : titre
 * personnel, notes, checklist, équipe, discussion, motifs de pause, dates
 * cibles. »
 *
 * Le serveur la tient (il ne renvoie pas les champs). L'ÉCRAN doit la tenir
 * aussi : s'il affichait « Mes études à Lyon » sur la fiche de Fatou, la règle
 * serait trahie côté client alors que l'API est juste.
 */
test.describe('§3.7 — la vue publique ne montre pas ce qu’elle ne doit pas', () => {
  test('aucun titre personnel de parcours sur la fiche publique', async ({ page }) => {
    await visiter(page, '/parcours/publics/1');
    const corps = page.locator('[data-screen="J09F"]');

    // Le type et la ville, oui. Le titre que le membre a donné, jamais.
    await expect(corps.getByText('Parcours Études · Lyon')).toBeVisible();
    // « Mes études à Lyon » est le titre personnel du parcours d'Amina ; aucun
    // titre personnel n'a sa place ici, pas même le sien.
    await expect(corps.getByText('Mes études à Lyon')).toHaveCount(0);
  });

  test('la fiche annonce elle-même ce qu’elle ne montre pas', async ({ page }) => {
    await visiter(page, '/parcours/publics/1');
    await expect(
      page.getByText('Lecture seule · aucune note, checklist, équipe ni discussion'),
    ).toBeVisible();
  });
});

/**
 * AUCUN DÉBORDEMENT HORIZONTAL, À AUCUNE LARGEUR.
 *
 * C'est le symptôme n°1 d'une interface non responsive, et celui que les
 * adaptations de cadre du générateur risquent le plus d'introduire : elles
 * rendent des colonnes collantes, ouvrent des bandes à défilement horizontal et
 * retirent les bornes de hauteur du cadre mobile. Chacune peut faire dépasser
 * quelque chose par la droite, et rien dans la maquette ne peut le révéler —
 * une image de 1440 px de large ne déborde jamais.
 */
const LARGEURS = [320, 360, 390, 430, 768, 1023, 1024, 1279, 1440, 1920] as const;

/**
 * TROIS ÉCRANS, choisis pour leurs FORMES et non pour faire nombre.
 *
 *   · `/parcours/1`  — la page à trois colonnes : rail, panneau collant de
 *     400 px, contenu borné à 660, colonne de contexte collante de 300. C'est
 *     elle qui porte le plus d'adaptations de cadre, donc le plus de risque ;
 *   · `/parcours/1/etapes/7` — la même charpente avec la timeline dépliée, le
 *     cadre le plus haut de la maquette (1720 px) ;
 *   · `/parcours/publics` — des cartes en grille, la seule mise en page du
 *     module qui ne soit pas une colonne.
 *
 * Les neuf autres routes partagent l'une de ces trois charpentes. Les parcourir
 * toutes aux dix largeurs ferait cinquante navigations par exécution, et ce sont
 * elles qui ont rendu la suite instable sur une machine chargée.
 */
const ROUTES_MESUREES = ['/parcours/1', '/parcours/1/etapes/7', '/parcours/publics'] as const;

/**
 * UN TEST PAR LARGEUR, comme `responsive.spec.ts`, et pas un test par route qui
 * les parcourrait toutes : cinq navigations tiennent dans le délai d'un test,
 * cinquante non. Écrit d'abord dans l'autre sens, le test expirait sur
 * `setViewportSize` — un message qui ne dit rien de la cause.
 */
test.describe('aucun débordement horizontal', () => {
  for (const w of LARGEURS) {
    test(`${w} px — les trois charpentes du module`, async ({ page }) => {
      for (const url of ROUTES_MESUREES) {
        await visiter(page, url, w);
        const mesure = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(
          mesure.scroll,
          `${url} à ${w} px : ${mesure.scroll} px pour ${mesure.inner} px de fenêtre`,
        ).toBeLessThanOrEqual(mesure.inner + 1);

        /**
         * Et rien ne sort par la droite — sauf dans un conteneur à défilement
         * horizontal, où dépasser est le comportement voulu (les barres
         * d'onglets du module défilent par conception).
         */
        const coupes = await page.evaluate(() => {
          const defileH = (el: HTMLElement): boolean => {
            let n: HTMLElement | null = el.parentElement;
            while (n !== null && n !== document.body) {
              const ox = getComputedStyle(n).overflowX;
              if (ox === 'auto' || ox === 'scroll') return true;
              n = n.parentElement;
            }
            return false;
          };
          const out: string[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            if (s.position === 'fixed' || s.position === 'sticky') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || defileH(el)) continue;
            if (r.right > window.innerWidth + 1) {
              out.push(
                `${el.tagName.toLowerCase()} dépasse de ${Math.round(r.right - window.innerWidth)} px`,
              );
            }
          }
          return out.slice(0, 5);
        });
        expect(coupes, `${url} à ${w} px`).toEqual([]);
      }
    });
  }
});

/**
 * CIBLES TACTILES — LA LISTE DES ÉCARTS EST FIGÉE, PAS LE SEUIL.
 *
 * `T1` §2.3 demande 44 px au doigt. Quatre contrôles du module ne l'atteignent
 * pas, et ils sont nommés ici un par un, avec leur mesure. Ce n'est pas une
 * tolérance : c'est la même discipline que `check-contrast.mjs`, qui liste ses
 * huit paires sous le seuil AA avec leur ratio et échoue sur toute paire
 * NOUVELLE. Un écart nommé reste sous les yeux ; un seuil abaissé disparaît.
 *
 * Les quatre viennent de la maquette elle-même, qui dessine ces contrôles à 40
 * ou 24 px. Les modifier déplacerait des pixels, ce que le transcodage refuse.
 * Ils tiennent WCAG 2.5.8 AA (24 px), pas la règle du dossier. Au porteur de
 * trancher — voir `docs/decisions.md`.
 *
 * Le « + » de l'en-tête Équipe N'Y FIGURE PAS, et c'est voulu : c'est le seul
 * contrôle que le TRANSCODEUR crée de toutes pièces, donc le seul dont la taille
 * nous appartient. Il est porté à 44 px sans qu'un pixel peint ne bouge.
 */
const ECARTS_TACTILES: Readonly<Record<string, readonly string[]>> = {
  '/parcours/1': ['a « Nouveau parcours » 40 px de haut — lien pointillé de l’en-tête'],
  '/parcours/1/historique': ['button « Découvrir » 24 px de haut — encart Premium'],
  '/parcours/1/reglages': ['button « Arrêter ce parcours » 24 px de haut — ligne de la carte'],
  // Deux cartes de parcours public, donc DEUX « Écrire ». Le compte est
  // volontairement exact : c'est lui qui signale un écart de plus.
  '/parcours/publics': [
    'button « Écrire » 40 px de haut',
    'button « Proposer comme parrain » 40 px de haut',
    'button « Écrire » 40 px de haut',
  ],
};

test.describe('cible tactile — les écarts connus, et AUCUN autre', () => {
  for (const url of Object.keys(ECARTS_TACTILES)) {
    test(`${url} à 390 px`, async ({ page }) => {
      await visiter(page, url, 390);
      const trop = await page.evaluate(() => {
        /** Exception WCAG 2.5.8 : « une cible dans une phrase ou un bloc de texte ». */
        const estLienTexte = (el: HTMLElement, s: CSSStyleDeclaration): boolean => {
          if (el.tagName !== 'A') return false;
          const transparent =
            s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent';
          const sansBordure =
            parseFloat(s.borderTopWidth) === 0 && parseFloat(s.borderLeftWidth) === 0;
          const lignes = el.getClientRects();
          const hauteur =
            lignes.length > 0
              ? (lignes[0] as DOMRect).height
              : el.getBoundingClientRect().height;
          return transparent && sansBordure && hauteur <= parseFloat(s.fontSize) * 1.8;
        };
        const out: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>('button, a[href], [role="switch"], [role="tab"]'),
        )) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          if (estLienTexte(el, s)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.height < 43.5 || r.width < 43.5) {
            out.push(
              `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 30)} » ${Math.round(r.height)} px de haut`,
            );
          }
        }
        return out;
      });

      const attendus = ECARTS_TACTILES[url] ?? [];
      // Le NOMBRE d'abord : un écart de plus se lit tout de suite, là où une
      // comparaison de listes noierait la nouveauté dans le texte des anciennes.
      expect(trop.length, `écarts mesurés :\n  ${trop.join('\n  ')}`).toBe(attendus.length);
      for (const mesure of trop) {
        const nom = mesure.split(' »')[0];
        expect(
          attendus.some((a) => a.startsWith(`${nom ?? ''} »`)),
          `écart NON RÉPERTORIÉ : ${mesure}`,
        ).toBe(true);
      }
    });
  }

  test('le « + » de l’en-tête Équipe atteint 44 px sans repeindre un pixel', async ({ page }) => {
    await visiter(page, '/parcours/1/equipe', 390);
    const bouton = page.locator('[data-frame="mobile"] [data-modal-open="J05I"]').first();

    const boite = await bouton.boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;
    expect(Math.round(boite.width), 'la cible fait 44 px').toBe(44);
    expect(Math.round(boite.height), 'la cible fait 44 px').toBe(44);

    /**
     * ET LA PASTILLE PEINTE GARDE SES 40 px.
     *
     * C'est la moitié qui empêche la « correction » facile : grossir le rond à
     * 44 px ferait passer ce test de taille et changerait le design. On mesure
     * donc les DEUX — la boîte de contenu reste à 40, le fond n'est peint que
     * là, et le remplissage ne fait que porter la cible.
     */
    const peint = await bouton.evaluate((n) => {
      const c = getComputedStyle(n);
      return { w: c.width, h: c.height, clip: c.backgroundClip, box: c.boxSizing };
    });
    expect(peint.w).toBe('40px');
    expect(peint.h).toBe('40px');
    expect(peint.clip).toBe('content-box');
    expect(peint.box).toBe('content-box');
  });
});

/**
 * §3.3 — LA CHECKLIST NE PREND AUCUN FICHIER EN V1.
 *
 * « Aucun fichier attaché en V1 — l'interface le dit clairement : "Cochez ce que
 * vous avez réuni. Les documents restent chez vous." » Un dépôt de fichier
 * ajouté par inadvertance serait une fuite de documents d'identité.
 */
test.describe('§3.3 — aucun dépôt de fichier sur la checklist', () => {
  test('la page documents ne contient aucun champ de fichier', async ({ page }) => {
    await visiter(page, '/parcours/1/documents');
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByText('Les documents restent chez vous').first()).toBeVisible();
  });
});
