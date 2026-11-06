/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « VOIR PLUS » — LA SUITE DES LISTES QUE LE SERVEUR COUPE À 20               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * (lot E2) Le serveur rend au plus 20 éléments par défaut et un `nextCursor`
 * (`packages/shared/src/validation/pagination.ts`). Les planches dessinent une
 * liste et jamais la suite : sans geste, la vingt-et-unième ligne n'existait pas
 * pour le membre, et rien ne lui disait qu'il en manquait.
 *
 * ── UNE ADAPTATION PAR LISTE, UNE SEULE FORME ────────────────────────────────
 *
 * Chaque entrée de `SUITES` pose `<VoirPlus plus={…} />` (`components/voir-plus.tsx`)
 * JUSTE APRÈS la boucle `{(liste ?? []).map(…)}` de la planche, dans le même
 * conteneur : le bouton prend la place de la « page suivante » qui manquait, au
 * pied de la liste, avec le dessin d'un bouton secondaire de la maquette (fond
 * `#F2F5F4`, 44 px, rayon 14 px). La donnée (`prop`) est une `PlusListe` que
 * l'écran branche sur `useSuiteCurseur` ; absente, le composant ne rend rien — la
 * planche reste telle qu'elle est dessinée.
 *
 * ⚠ Une adaptation qui ne trouve pas sa boucle ne s'applique pas EN SILENCE : le
 * générateur compte les adaptations jamais appliquées. Ajouter une liste ici, c'est
 * aussi ajouter la propriété à l'interface `…Data` de l'écran.
 */

/** L'indice qui suit l'accolade fermante qui ferme celle ouverte à `debut` ; `-1` sinon. */
function finAccolade(jsx, debut) {
  let profondeur = 0;
  for (let i = debut; i < jsx.length; i += 1) {
    const c = jsx[i];
    if (c === '{') profondeur += 1;
    else if (c === '}') {
      profondeur -= 1;
      if (profondeur === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Construit l'adaptation qui pose le « Voir plus » derrière `{(liste ?? []).map(…)}`.
 * `occurrence` : « derniere » (défaut) pose le bouton après la DERNIÈRE boucle de ce nom
 * dans le cadre ; « toutes » après chacune.
 */
function suiteApres({ screens, nom, why, liste, prop, libelle }) {
  return {
    screens,
    nom,
    why,
    provides: [prop.split('.')[0]],
    apply(jsx) {
      const motif = `{(${liste} ?? []).map(`;
      let curseur = 0;
      let sortie = '';
      let applied = false;
      for (;;) {
        const debut = jsx.indexOf(motif, curseur);
        if (debut < 0) break;
        const fin = finAccolade(jsx, debut);
        if (fin < 0) break;
        const attribut = libelle === undefined ? '' : ` libelle=${JSON.stringify(libelle)}`;
        sortie += jsx.slice(curseur, fin) + `<VoirPlus plus={${prop}}${attribut} />`;
        curseur = fin;
        applied = true;
      }
      if (!applied) return { jsx, applied: false };
      return { jsx: sortie + jsx.slice(curseur), applied: true };
    },
  };
}

const SUITES = [
  suiteApres({
    screens: ['A03'],
    nom: 'A03_VOIR_PLUS',
    why: 'La liste des guides ne montrait que la première page (20) : « Voir plus » suit `nextCursor`, avec « 20 sur N » quand le total est connu.',
    liste: 'guides',
    prop: 'plusGuides',
  }),
  suiteApres({
    screens: ['S01'],
    nom: 'S01_VOIR_PLUS',
    why: 'Les annonces de logement ne montraient que la première page (20) : « Voir plus » suit `nextCursor` de `GET /housing`, avec « 20 sur N » (`meta.total`).',
    liste: 'liste.annonces',
    prop: 'liste.plus',
  }),
  suiteApres({
    screens: ['S04'],
    nom: 'S04_VOIR_PLUS_OFFRES',
    why: 'Les offres d’emploi ne montraient que la première page (20) : « Voir plus » suit `nextCursor` de `GET /jobs`. Les profils disponibles ont déjà le leur.',
    liste: 'offres.liste',
    prop: 'offres.plus',
  }),
  suiteApres({
    screens: ['S06'],
    nom: 'S06_VOIR_PLUS',
    why: 'L’annuaire professionnel ne montrait que la première page (20) : « Voir plus » suit `nextCursor` de `GET /pros`, avec les mêmes filtres.',
    liste: 'annuaire.fiches',
    prop: 'annuaire.plus',
  }),
  suiteApres({
    screens: ['H01'],
    nom: 'H01_VOIR_PLUS',
    why: 'Le fil d’entraide ne montrait que la première page (20) : « Voir plus » suit `nextCursor` de `GET /help`. Absent sous « Vous pouvez aider » (`/help/can-help` a un curseur toujours nul).',
    liste: 'demandes',
    prop: 'plusDemandes',
  }),
];

export const ADAPTATIONS_VOIR_PLUS = SUITES;

/** Le composant que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_VOIR_PLUS = {
  VoirPlus: '@/components/voir-plus',
};
