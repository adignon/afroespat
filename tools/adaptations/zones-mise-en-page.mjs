/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS ZONES D'UNE PAGE — LES COLONNES AUX BORDS, LE CONTENU BORNÉ      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Je souhaite aussi que les sidebars soient laissées à gauche et à
 * droite sans l'application du max width. Du coup seul le contenu de la page
 * (contenu du milieu) est contenu. Cela doit être fait sur toutes les pages
 * (réutilisable donc). »
 *
 * MESURÉ : la maquette dessine un cadre de 1440 px que `ScreenFrames` borne et
 * CENTRE. Au-delà, les colonnes de gauche et de droite suivaient le contenu vers
 * le milieu de l'écran, à 240 px des bords à 1920 px.
 *
 * ── LE PRINCIPE : DES RÔLES, PAS DES MESURES ──────────────────────────────
 *
 * Soixante cadres d'ordinateur ont la même architecture — une colonne de gauche
 * (400 px : rail et panneau), puis une colonne centrale qui porte une rangée
 * « contenu · colonne de droite (`aside`) ». Cette adaptation NE CHANGE AUCUNE
 * VALEUR : elle NOMME les trois rôles, par `data-zone`.
 *
 *   `data-zone="gauche"`   la colonne de gauche ;
 *   `data-zone="centre"`   la colonne centrale (reste après la gauche) ;
 *   `data-zone="rangee"`   la rangée « contenu · droite », quand elle existe ;
 *   `data-zone="contenu"`  le contenu du milieu — la SEULE zone bornée ;
 *   `data-zone="droite"`   la colonne de droite (`aside`).
 *
 * C'est `app/globals.css` qui en fait une mise en page, UNE fois pour tous : le
 * cadre n'est plus borné ; la gauche reste au bord gauche et la droite au bord
 * droit ; le contenu, borné, se centre entre les deux. Une page nouvelle n'a rien
 * à écrire : elle porte ses rôles, et la règle s'applique.
 *
 * ── CE QUI N'EST PAS UNE COLONNE ──────────────────────────────────────────
 *
 * Le porteur : « ma correction concerne uniquement les sidebars pleine hauteur, juste
 * sous le header, qui occupent toute la colonne — et non celles qui sont une section
 * du contenu principal de la page. La page a trois parties : gauche, droite, contenu. »
 *
 * Sur une page de RÉSEAU, la colonne « À propos / Prochain événement / Sujets
 * épinglés » est une section du CONTENU : elle vit dans la planche d'onglet, sous
 * l'en-tête du réseau et sa barre d'onglets. Elle n'est donc PAS une colonne de
 * droite et n'est pas nommée : elle reste contre le contenu, comme avant. (Une
 * première version la portait au bord de l'écran par une translation : retirée.)
 *
 * ── CE QUI RESTE BORNÉ, FAUTE DE ROLES CLAIRS ─────────────────────────────
 *
 * Un cadre dont l'architecture n'est pas celle-là — deux colonnes de gauche
 * (J01M), pas de colonne centrale — n'est PAS marqué : il garde sa borne de
 * 1440 px, comme avant, plutôt qu'une mise en page à moitié comprise.
 */
import { finElement } from './reseau-vivant.mjs';

const GAUCHE =
  /<div style=\{\{ width: "400px", flexShrink: "0", display: "flex", flexDirection: "column", padding: "0 24px", position: "sticky"[^}]*\}\}>/;
const CENTRE = /^<div style=\{\{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column"/;

/** Les enfants DIRECTS d'un élément (texte JSX, début, fin), ou `null` si un texte s'y mêle. */
function enfants(jsx, debut, fin) {
  const ouverture = jsx.indexOf('>', debut) + 1;
  const fermeture = fin - (jsx.slice(0, fin).endsWith('</main>') ? '</main>'.length : '</div>'.length);
  const liste = [];
  let i = ouverture;
  while (i < fermeture) {
    while (i < fermeture && /\s/.test(jsx[i])) i += 1;
    if (i >= fermeture) break;
    if (jsx[i] === '{') return null;
    if (jsx[i] !== '<') return null;
    const f = finElement(jsx, i);
    if (f === -1 || f > fermeture) return null;
    liste.push({ jsx: jsx.slice(i, f), debut: i, fin: f });
    i = f;
  }
  return liste;
}

const balise = (el) => /^<([A-Za-z][\w.]*)/.exec(el.jsx)?.[1] ?? '';

export const ADAPTATIONS_ZONES = [
  {
    screens: ['*'],
    nom: 'ZONES_MISE_EN_PAGE',
    why: 'Nomme les trois rôles de la page — colonne de gauche, contenu du milieu, colonne de droite — pour que seule le contenu soit borné et que les colonnes restent aux bords de l’écran.',
    provides: [],
    apply(jsx) {
      if (jsx.includes('data-zone=')) return { jsx, applied: false };
      const mG = GAUCHE.exec(jsx);
      if (mG === null) return { jsx, applied: false };
      // Une seule colonne de gauche, précédée de rien d'autre que l'en-tête global.
      const avant = jsx.slice(0, mG.index).replace(/<header[\s\S]*<\/header>\{\/\*ENTETE_FIN\*\/\}/, '').trim();
      if (avant !== '' && avant !== '<>') return { jsx, applied: false };
      const finG = finElement(jsx, mG.index);
      if (finG === -1) return { jsx, applied: false };

      // La colonne centrale : le frère qui suit.
      let c = finG;
      while (c < jsx.length && /\s/.test(jsx[c])) c += 1;
      if (!CENTRE.test(jsx.slice(c))) return { jsx, applied: false };
      const finC = finElement(jsx, c);
      if (finC === -1) return { jsx, applied: false };
      const cs = enfants(jsx, c, finC);
      if (cs === null || cs.length < 2 || !cs[0].jsx.includes('height: "64px"')) return { jsx, applied: false };

      const corps = cs[1];
      const marques = [
        { at: mG.index, zone: 'gauche' },
        { at: c, zone: 'centre' },
      ];
      const fils = enfants(jsx, corps.debut, corps.fin);
      const aside = fils === null ? undefined : fils.find((f) => balise(f) === 'aside');
      if (fils !== null && aside !== undefined) {
        const contenu = fils.find((f) => f !== aside && ['main', 'article', 'div'].includes(balise(f)));
        if (contenu === undefined) return { jsx, applied: false };
        marques.push({ at: corps.debut, zone: 'rangee' }, { at: contenu.debut, zone: 'contenu' }, { at: aside.debut, zone: 'droite' });
      } else if (fils !== null && fils.length === 1 && ['main', 'article', 'div'].includes(balise(fils[0])) && jsx.slice(corps.debut, corps.debut + 200).includes('display: "flex"')) {
        marques.push({ at: corps.debut, zone: 'rangee' }, { at: fils[0].debut, zone: 'contenu' });
      } else {
        marques.push({ at: corps.debut, zone: 'contenu' });
      }

      // Du plus tard au plus tôt : les indices du début restent valables.
      let out = jsx;
      for (const m of marques.sort((a, b) => b.at - a.at)) {
        const nom = /^<([A-Za-z][\w.]*)/.exec(out.slice(m.at))[0];
        out = out.slice(0, m.at + nom.length) + ` data-zone="${m.zone}"` + out.slice(m.at + nom.length);
      }
      return { jsx: out, applied: true };
    },
  },
];
