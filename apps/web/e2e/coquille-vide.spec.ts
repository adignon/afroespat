import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { motsVisibles } from './mots-visibles';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AUCUNE ROUTE QUI RÉPOND 200 NE DOIT RESSEMBLER À UN 404                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ce fichier balaie TOUTES les routes du produit, pas une liste choisie, et il
 * existe parce que la liste choisie a laissé passer deux défauts.
 *
 * `shell.spec.ts` tient déjà vingt-et-une routes repères avec le même détecteur,
 * et c'est précieux — mais vingt-et-une sur quatre-vingt-douze. Sondées une à
 * une au `curl`, DEUX routes servaient une coquille :
 *
 *   · `/reseaux/:slug?onglet=fil` — QUATRE MOTS, « DisaporyPlus Chargement du
 *     réseau… ». `reseau-screen.tsx` renvoyait un paquet d'attente À LA PLACE du
 *     cadre ; le serveur n'a jamais la donnée du réseau, donc c'était tout ce
 *     qu'il rendait. Corrigé : 203 mots, rail, panneau et onglets compris.
 *   · `/stories/:id` — UN SEUL MOT, le titre du document. Les deux cadres
 *     valaient `null` pendant le chargement. Une page noire et muette, qu'un
 *     lecteur d'écran ne pouvait pas annoncer et que rien ne distinguait d'un
 *     404. Corrigé : le cadre dit qu'il attend.
 *
 * Ce balayage-ci les aurait trouvés le jour où ils sont arrivés. C'est sa seule
 * raison d'être : il n'affirme rien sur le CONTENU d'aucune page — il refuse
 * qu'une route réponde 200 en ne disant rien.
 *
 * ── POURQUOI LES ROUTES SONT LUES SUR LE DISQUE, ET NON LISTÉES ICI ─────────
 *
 * Une liste écrite à la main ne couvre que ce que son auteur connaissait. Les
 * deux défauts ci-dessus sont arrivés APRÈS que la liste de `shell.spec.ts` ait
 * été écrite, et elle ne pouvait pas les voir. En énumérant `src/app`, une page
 * nouvelle est couverte LE JOUR OÙ ELLE EST POSÉE, sans que personne y pense —
 * et c'est le seul moyen que ce balayage ne vieillisse pas comme l'autre.
 */

/** La racine des routes. `(app)`, `(onboarding)` et `(admin)` sont des groupes : ils ne comptent pas dans l'URL. */
const RACINE = resolve(process.cwd(), 'src/app');

/**
 * Les paramètres reçoivent des valeurs qui EXISTENT quand c'est possible, et une
 * valeur inventée sinon. Une valeur inventée fait répondre 404, ce que le cas
 * accepte explicitement — un 404 n'est pas une coquille, c'est une réponse.
 */
const VALEURS: Readonly<Record<string, string>> = {
  '[handle]': '@amina',
  '[slug]': 'visale-sans-cdi',
  '[id]': '1',
  '[etape]': '1',
};

/** Les routes servies, lues sur le disque. */
function routes(dossier: string, prefixe = ''): readonly string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.isFile()) {
      if (entree.name === 'page.tsx') trouvees.push(prefixe === '' ? '/' : prefixe);
      continue;
    }
    if (!entree.isDirectory()) continue;
    // Un groupe de routes — `(app)` — n'apparaît pas dans l'URL.
    const groupe = entree.name.startsWith('(') && entree.name.endsWith(')');
    const segment = groupe ? '' : `/${VALEURS[entree.name] ?? entree.name}`;
    trouvees.push(...routes(resolve(dossier, entree.name), `${prefixe}${segment}`));
  }
  return trouvees;
}

/**
 * ── LE PLANCHER, ET SES DEUX PÔLES MESURÉS ─────────────────────────────────
 *
 * CINQ MOTS, et le nombre est pris entre deux mesures, pas choisi :
 *
 *   · le pôle CASSÉ est à UN mot — `/stories/:id` avant correction, qui ne
 *     servait que « DisaporyPlus », le titre du document. C'est exactement ce que
 *     servent les trois routes qui répondent 404 ;
 *   · le pôle SAIN LE PLUS PAUVRE est à NEUF — `/admin/connexion`, un formulaire
 *     de connexion : « Administration · Email professionnel · Mot de passe ». Il
 *     est pauvre à bon droit, et il doit rester vert.
 *
 * Le plancher de `shell.spec.ts` est à dix, entre quatre et quarante-et-un :
 * c'est le bon nombre POUR SES ROUTES, qui portent toutes un rail. Celui-ci
 * balaie aussi les formulaires et les planches d'inscription, donc il est plus
 * bas — et c'est pour cela qu'ils ne sont pas le même test.
 *
 * CE PLANCHER NE DÉCRIT AUCUNE RICHESSE ATTENDUE. Ce qui décrit le contenu d'une
 * page, ce sont les cas qui la nomment ; celui-ci ne refuse que le silence.
 */
const PLANCHER = 5;

test.describe('aucune route ne répond 200 en silence', () => {
  /**
   * SANS JAVASCRIPT, et c'est tout le propos : la coquille des réseaux était
   * INVISIBLE avec JavaScript. Le client reprenait la main, l'appel échouait, le
   * cadre se peignait depuis son repli — et la page avait l'air complète. Seul le
   * HTML servi disait la vérité, et c'est lui que lisent les moteurs de
   * recherche, les aperçus de lien, et le premier rendu de tout le monde.
   */
  test.use({ javaScriptEnabled: false });

  /**
   * UNE SEULE FOIS, ET NON UNE PAR LARGEUR.
   *
   * Ces cas lisent la RÉPONSE HTTP, par la prise `request` — aucun navigateur
   * n'est ouvert, aucune mise en page n'est calculée. Les jouer à 390 px puis à
   * 1440 px rendrait rigoureusement les mêmes nombres, et doublerait
   * quatre-vingt-neuf cas pour aucune information. Les autres fichiers sautent
   * par largeur parce qu'ils MESURENT la largeur ; celui-ci saute parce qu'elle
   * ne le concerne pas.
   */
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'mesure la réponse, pas la mise en page');

  const TOUTES = routes(RACINE);

  test('le disque porte bien des routes à sonder', () => {
    // Un `readdirSync` qui ne trouve rien rendrait TOUS les cas verts sans rien
    // mesurer : c'est la forme la plus courante de test creux.
    expect(TOUTES.length, 'aucune route trouvée sous src/app').toBeGreaterThan(50);
  });

  for (const route of routes(RACINE)) {
    test(route, async ({ request }) => {
      const reponse = await request.get(route);

      /**
       * UN 404 EST UNE RÉPONSE, PAS UNE COQUILLE. Trois routes en rendent un
       * parce que leur paramètre est inventé (`/entraide/1`, `/p/:slug`,
       * `/parrainage/:handle`) — on ne connaît pas d'identifiant réel sans base
       * semée, et en inventer un qui existe serait une autre nature de test.
       */
      if (reponse.status() !== 200) return;

      const { texte, nombre } = motsVisibles(await reponse.text());
      expect(
        nombre,
        `${route} répond 200 mais ne sert que ${nombre} mot(s) : « ${texte.slice(0, 120)} »`,
      ).toBeGreaterThan(PLANCHER);
    });
  }
});
