import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { feedResponseSchema } from '@app/shared';
import { A01Desktop } from '../a01/desktop.generated';
import { A01Mobile } from '../a01/mobile.generated';
import { mBottom, mTabs, panelFil, postTypesFor, rail, shortcuts, storyFiltersFor } from '../a01/data';
import { feedPostsFrom } from '../accueil/from-api';

/**
 * LE DÉFAUT QUE CE FICHIER GARDE : « TOUTES LES PUBLICATIONS OUVRAIENT LA MÊME
 * FENÊTRE DE COMMENTAIRES ».
 *
 * Ce n'était pas une limite théorique, c'était mesuré. Les boutons « Commenter » et
 * « Partager » sont DANS la boucle des publications — la maquette ne les écrit
 * qu'une fois — et le transcodeur n'y posait que le NOM de la fenêtre
 * (`data-modal-open="A01C"`). L'écouteur délégué de `/accueil`, qui ne voit que
 * l'élément cliqué, ne pouvait donc pas savoir LAQUELLE des cinq cartes avait été
 * touchée : il servait toujours le même fil, celui d'aucune d'entre elles.
 *
 * La correction est dans le GÉNÉRATEUR — `markTriggers` (`tools/dc-to-jsx.mjs`) et
 * la déclaration `subject: 'p.postId'` (`tools/screens/03-accueil.mjs`) — et pas
 * dans le JSX généré, que la régénération effacerait.
 *
 * ── CE QUE CE TEST ÉPROUVE, ET POURQUOI IL N'EST PAS CREUX ─────────────────
 *
 * Il REND les deux cadres transcodés sur des publications RÉELLES (la fixture du
 * fil, relevée octet pour octet), puis rejoue l'écouteur délégué de la page. Deux
 * conséquences :
 *
 *   · il meurt si l'attribut disparaît du générateur — vérifié en le retirant, les
 *     deux cadres rendent alors deux déclencheurs de sujet `null`, et l'écouteur
 *     rend le même fil pour les deux cartes ;
 *   · il meurt aussi si l'identifiant cesse d'être DIFFÉRENT d'une carte à l'autre,
 *     ce qu'un attribut posé à une valeur constante produirait.
 *
 * Il ne se contente PAS de chercher la chaîne dans le fichier généré : un attribut
 * présent mais posé hors de la boucle passerait un tel test, et c'est exactement le
 * défaut qu'on répare.
 */

const FIXTURES = resolve(import.meta.dirname, '../../../../../packages/shared/src/__tests__/fixtures');

const fil = feedResponseSchema.parse(
  JSON.parse(readFileSync(resolve(FIXTURES, 'feed.json'), 'utf8')),
);

const cartes = feedPostsFrom(fil);

const donnees = {
  rail,
  panelFil,
  shortcuts,
  stories: [],
  storyFilters: storyFiltersFor(-1, () => {}),
  postTypes: postTypesFor(0, () => {}),
  /**
   * LE COMPOSEUR A MAINTENANT UN ÉTAT, donc la prise du cadre le réclame.
   *
   * Ce cas mesure les DÉCLENCHEURS de fenêtre, pas le composeur : il lui donne donc
   * un composeur vide et des gestes qui ne font rien. C'est exactement ce qu'il
   * faut — un composeur branché ici ferait de ce cas un second test du composeur,
   * et un test qui mesure deux choses rougit pour la mauvaise.
   */
  composeurTexte: '',
  onComposeurTexte: () => {},
  onPublier: () => {},
  publierBloque: true,
  onAjouterImage: () => {},
  sondageQuestion: '',
  onSondageQuestion: () => {},
  sondageOptions: [],
  onAjouterOption: () => {},
  sondageDurees: [],
  onValiderSondage: () => {},
  onAnnulerSondage: () => {},
  sondageBloque: true,
  sondageMultiple: false,
  onSondageMultiple: () => {},
  sondageApresVote: true,
  onSondageApresVote: () => {},
  sondageAnonyme: true,
  onSondageAnonyme: () => {},
  /** Composeur VIDE : ce cas mesure les déclencheurs, pas les pièces jointes. */
  composeurGarni: false,
  composeurImages: [],
  composeurImagesCompte: '0 / 4',
  composeurAjoutBloque: false,
  composeurSondage: null,
  composeurGuides: [],
  composeurPastilles: {
    sondage: { garni: false, libelle: '', titre: 'Créer un sondage', encre: '#0F5C48' },
    guides: { garni: false, libelle: '', titre: 'Lier un guide', encre: '#0F5C48' },
    images: { garni: false, libelle: '', titre: 'Ajouter une image', encre: '#0F5C48' },
  },
  feedPosts: cartes,
  filEtat: { chargement: false, echec: null, vide: "Aucune publication." },
  events: [],
  arrivals: [],
  online: [],
  mTabs,
  mBottom,
};

/** Le document rendu, tel qu'un navigateur le verrait. */
function rendu(markup: string): Document {
  return new DOMParser().parseFromString(`<body>${markup}</body>`, 'text/html');
}

/**
 * L'ÉCOUTEUR DÉLÉGUÉ DE LA PAGE, REJOUÉ À L'IDENTIQUE.
 *
 * C'est la moitié qui compte : un attribut correct que la page lirait mal ne
 * réparerait rien. La logique est celle de `app/(app)/accueil/page.tsx` — remonter
 * par `closest()`, lire le nom, puis le sujet.
 */
function ouvertureDepuis(bouton: Element): { modale: string | null; sujet: string | null } {
  const declencheur = bouton.closest('[data-modal-open]');
  return {
    modale: declencheur?.getAttribute('data-modal-open') ?? null,
    sujet: declencheur?.getAttribute('data-modal-subject') ?? null,
  };
}

describe.each([
  ['cadre d’ordinateur', renderToStaticMarkup(<A01Desktop {...donnees} />)],
  ['cadre mobile', renderToStaticMarkup(<A01Mobile {...donnees} />)],
])('%s — le déclencheur porte la publication', (_nom, markup) => {
  const doc = rendu(markup);

  it('la fixture porte au moins deux publications — sinon tout ce qui suit est creux', () => {
    expect(cartes.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(cartes.map((c) => c.postId));
    expect(ids.size).toBe(cartes.length);
  });

  it('chaque carte a son bouton « Commenter », et un seul', () => {
    const boutons = doc.querySelectorAll('[data-modal-open="A01C"]');
    expect(boutons.length).toBe(cartes.length);
  });

  it('deux publications n’ouvrent PAS la même fenêtre de commentaires', () => {
    const sujets = [...doc.querySelectorAll('[data-modal-open="A01C"]')].map(
      (b) => ouvertureDepuis(b).sujet,
    );
    // Aucun sujet manquant : c'est l'état d'avant la correction.
    expect(sujets.every((s) => s !== null && s !== '')).toBe(true);
    // Et ils sont TOUS DIFFÉRENTS : un attribut constant ne suffirait pas.
    expect(new Set(sujets).size).toBe(sujets.length);
  });

  it('le sujet est l’identifiant de LA publication de la carte, dans son ordre', () => {
    const sujets = [...doc.querySelectorAll('[data-modal-open="A01C"]')].map(
      (b) => ouvertureDepuis(b).sujet,
    );
    expect(sujets).toEqual(cartes.map((c) => c.postId));
  });

  it('« Partager » désigne la même publication que « Commenter » de la même carte', () => {
    const commenter = [...doc.querySelectorAll('[data-modal-open="A01C"]')].map(
      (b) => ouvertureDepuis(b).sujet,
    );
    const partager = [...doc.querySelectorAll('[data-modal-open="A01P"]')].map(
      (b) => ouvertureDepuis(b).sujet,
    );
    expect(partager).toEqual(commenter);
  });

  it('un clic sur l’icône À L’INTÉRIEUR du bouton remonte au bon sujet', () => {
    /**
     * Le membre vise le pictogramme, pas le bouton. `closest()` doit remonter — si
     * la page lisait `event.target` directement, elle lirait le `<svg>`, qui ne
     * porte aucun attribut.
     */
    const boutons = [...doc.querySelectorAll('[data-modal-open="A01C"]')];
    const second = boutons[1];
    expect(second).toBeDefined();
    const icone = second?.querySelector('svg');
    expect(icone).not.toBeNull();
    expect(ouvertureDepuis(icone as Element)).toEqual({
      modale: 'A01C',
      sujet: cartes[1]?.postId,
    });
  });
});
