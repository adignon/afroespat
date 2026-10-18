/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'EN-TÊTE GLOBAL — SORTIR LA BARRE DE SES DEUX COLONNES                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le header doit être en fullwidth sur tout l'écran et ne pas être
 * lié à une section du contenu […] pour que tout soit bien positionné et la
 * search bar centrée. Ensuite il y a le max width, c'est uniquement le contenu de
 * la page qui doit avoir un max width et non le header. »
 *
 * CE QUE LA MAQUETTE DESSINE, mesuré sur les 53 cadres d'ordinateur qui portent
 * la barre : DEUX rangées de 64 px, dans deux colonnes différentes —
 *
 *   · le LOGO, première rangée de la colonne de gauche (`gap: "10px"`, une pastille
 *     de 38 px et le mot « Diaspora ») ;
 *   · la RECHERCHE et les contrôles, première rangée de la colonne centrale
 *     (`gap: "8px"` : la boîte de 420 px, un espaceur, puis les ronds).
 *
 * Le tout dans le cadre borné à 1440 px. La barre n'est donc pas une barre : ce
 * sont deux moitiés collées à leur colonne, qui rétrécissent avec la page.
 *
 * CE QUE FAIT L'ADAPTATION : elle EXTRAIT les deux rangées — telles que dessinées,
 * le même JSX, les mêmes styles — et les pose dans un `<header>` `position: fixed`
 * sur toute la largeur de la fenêtre, à trois zones (logo · recherche centrée ·
 * contrôles). Un élément ordinaire, pas un composant : la région « BarreHaute » de
 * A08 se découpe sur des balises, et des props qui portent du JSX l'auraient
 * trompée. À leur place, dans les colonnes,
 * elle laisse un ESPACE de 64 px : le rail et le contenu commencent exactement où
 * ils commençaient, rien d'autre ne bouge, et seul le contenu garde sa borne.
 *
 * ── CE QUI EST TOUCHÉ EN PASSANT ──────────────────────────────────────────
 *
 *   · la boîte de recherche perd sa borne de 420 px : elle remplit la zone
 *     centrale de la grille (560 px au plus). Elle y est CENTRÉE par la grille,
 *     et non plus calée contre le logo par un `flex: 1` ;
 *   · quand la boîte n'est qu'un dessin — la barre de huit écrans (A02, A03,
 *     A07 à A12…) n'était PAS devenue un champ : `BARRE_HAUTE` ne retrouvait pas
 *     son texte — elle devient `<ChampRecherche>`, comme sur le fil. La recherche
 *     de la barre marche maintenant partout où la barre existe ;
 *   · l'espaceur `flex: 1` entre la recherche et les ronds disparaît : la grille
 *     range les ronds à droite.
 *
 * ── CE QUI N'EST PAS TOUCHÉ ───────────────────────────────────────────────
 *
 *   · les écrans d'administration (D02 à D16) : leur colonne de gauche porte le
 *     logo « Admin » et aucune recherche — ce n'est pas la barre de l'application ;
 *   · les cadres de téléphone : ils n'ont pas cette barre.
 *   · un cadre où l'une des deux rangées manque : l'adaptation refuse, et le
 *     cadre garde son dessin d'origine plutôt qu'une barre à moitié extraite.
 *
 * Un marqueur (`FIN_ENTETE`) signale la fin de la barre : le générateur la sort du
 * `<main>` qu'il pose autour du contenu, parce qu'une barre n'est pas le contenu
 * principal.
 */
import { finElement } from './reseau-vivant.mjs';

/**
 * LA BARRE, telle qu'elle se pose. `z-index: 30` : au-dessus des éléments collants
 * de la page (10 à 25), sous les fenêtres et leurs voiles (40 et plus) ; les
 * suggestions de la recherche et les menus des contrôles sont des enfants de la
 * barre, ils héritent de son niveau. Le fond est celui de la page, pour que le
 * contenu qui défile passe SOUS la barre sans se lire à travers.
 *
 * La grille `1fr · 560px · 1fr` est ce qui centre la recherche sur la FENÊTRE,
 * quelles que soient les largeurs de ses voisins : en flex, entre un logo et des
 * ronds, elle se décalerait dès que l'un des deux change de largeur.
 */
const BARRE =
  'position: "fixed", top: "0", left: "0", right: "0", height: "64px", zIndex: 30, background: "#F6F8F7", ' +
  'display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 560px) minmax(0, 1fr)", alignItems: "center", ' +
  'columnGap: "16px", padding: "0 24px"';

/** Le marqueur que le générateur cherche pour sortir la barre du repère `main`. */
export const FIN_ENTETE = '{/*ENTETE_FIN*/}';

const ESPACE = '<div style={{ height: "64px", flexShrink: "0" }}></div>';

/** Les enfants DIRECTS d'un élément — leur texte JSX — ou `null` si un texte s'y mêle. */
function enfants(jsx, debut, fin) {
  const ouverture = jsx.indexOf('>', debut) + 1;
  const fermeture = fin - '</div>'.length;
  const liste = [];
  let i = ouverture;
  while (i < fermeture) {
    while (i < fermeture && /\s/.test(jsx[i])) i += 1;
    if (i >= fermeture) break;
    if (jsx[i] !== '<') return null;
    const f = finElement(jsx, i);
    if (f === -1 || f > fermeture) return null;
    liste.push(jsx.slice(i, f));
    i = f;
  }
  return liste;
}

export const ADAPTATIONS_ENTETE_GLOBAL = [
  {
    screens: ['*'],
    nom: 'ENTETE_GLOBAL',
    why: 'La barre haute passe en pleine largeur, hors des colonnes : logo à gauche, recherche centrée, contrôles à droite ; seul le contenu garde sa borne.',
    provides: [],
    apply(jsx) {
      if (jsx.includes('data-entete-globale')) return { jsx, applied: false };

      // ── Le logo : première rangée de la colonne de gauche ───────────────
      const motifLogo =
        /<div style=\{\{ height: "64px", display: "flex", alignItems: "center", gap: "10px"(?:, flexShrink: "0")? \}\}><div style=\{\{ width: "38px"/;
      const mLogo = motifLogo.exec(jsx);
      if (mLogo === null) return { jsx, applied: false };
      const finLogo = finElement(jsx, mLogo.index);
      if (finLogo === -1) return { jsx, applied: false };
      const logo = jsx.slice(mLogo.index, finLogo);
      // Le logo d'administration porte « Admin » : ce n'est pas la barre de l'application.
      if (!logo.includes('Diaspora')) return { jsx, applied: false };

      // ── La recherche et les contrôles : première rangée de la colonne centrale ──
      const motifBarre =
        /<div style=\{\{ height: "64px", display: "flex", alignItems: "center", gap: "8px"[^}]*\}\}>/;
      const mBarre = motifBarre.exec(jsx);
      if (mBarre === null) return { jsx, applied: false };
      const finBarre = finElement(jsx, mBarre.index);
      if (finBarre === -1) return { jsx, applied: false };
      const fils = enfants(jsx, mBarre.index, finBarre);
      if (fils === null || fils.length < 3) return { jsx, applied: false };

      let [recherche, ...reste] = fils;
      // L'espaceur `flex: 1` : la grille range les ronds à droite, il n'a plus d'objet.
      reste = reste.filter((e) => e !== '<span style={{ flex: "1" }}></span>');
      if (reste.length === 0) return { jsx, applied: false };

      // La boîte de recherche : un champ, ou un dessin à rendre champ.
      if (recherche.startsWith('<ChampRecherche')) {
        recherche = recherche.replace('maxWidth: "420px"', 'maxWidth: "none", width: "100%"');
      } else if (recherche.includes('Rechercher dans la diaspora')) {
        const style = /^<div style=\{\{ ([^}]*) \}\}>/.exec(recherche);
        if (style === null) return { jsx, applied: false };
        const pose = style[1].replace('maxWidth: "420px"', 'maxWidth: "none", width: "100%"');
        recherche = `<ChampRecherche style={{ ${pose} }} />`;
      } else {
        return { jsx, applied: false };
      }

      // Les deux rangées deviennent deux espaces — du plus tard au plus tôt, pour
      // que les indices du premier remplacement restent valables.
      const segments = [
        { debut: mLogo.index, fin: finLogo },
        { debut: mBarre.index, fin: finBarre },
      ].sort((a, b) => b.debut - a.debut);
      let out = jsx;
      for (const s of segments) out = out.slice(0, s.debut) + ESPACE + out.slice(s.fin);

      const barre =
        `<header data-entete-globale="" style={{ ${BARRE} }}>` +
        `<div style={{ display: "flex", alignItems: "center", justifySelf: "start", minWidth: "0" }}>${logo}</div>` +
        `<div style={{ display: "flex", alignItems: "center", minWidth: "0" }}>${recherche}</div>` +
        `<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", minWidth: "0" }}>${reste.join('')}</div>` +
        `</header>${FIN_ENTETE}\n`;
      return { jsx: barre + out, applied: true };
    },
  },
];
