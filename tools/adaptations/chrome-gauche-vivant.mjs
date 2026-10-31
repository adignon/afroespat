/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA COLONNE DE GAUCHE, VIVANTE SUR TOUTES LES PAGES                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « la sidebar n'est pas dynamique ? Aussi sur toutes les autres
 * pages c'est pas réglé aussi ? »
 *
 * MESURÉ sur les 67 cadres d'ordinateur qui portent la colonne de gauche — en
 * relevant, cadre par cadre, tout texte et toute largeur écrits en clair — il
 * reste DEUX valeurs de maquette que personne n'avait liées :
 *
 *   1. LA BARRE DE PROGRESSION DE « PARCOURS » : `width: "58%"` dans les treize
 *      cadres du module, à côté d'un `{panneau.avancement}%` bien lié. Le chiffre
 *      disait 0 % pendant que la barre en remplissait 58 — c'est la capture du
 *      porteur. La largeur lit maintenant le même `avancement` que le chiffre.
 *
 *   2. LA CARTE « VOS RACCOURCIS » (quinze cadres) : trois réseaux inventés,
 *      identiques pour tout le monde, et un « Modifier » en `href="#"`. Elle devient
 *      `<RaccourcisReseaux />` — mes réseaux, lus sur l'API — et « Modifier » mène
 *      à la page « Réseaux ».
 *
 * Tout le reste de la colonne est de la NAVIGATION (les cinq rubriques du rail, les
 * cartes de section) ou déjà branché (le membre, « Mon parcours », la réputation, le
 * panneau et les rappels du module Parcours).
 */

import { finElement } from './reseau-vivant.mjs';

const BARRE_58 =
  /(\{panneau\.avancement\}%<\/span><\/div>\s*<div style=\{\{ marginTop: "8px" \}\}><div style=\{\{ height: "8px"[^}]*\}\}><div style=\{\{ )width: "58%"/;

const RACCOURCIS_MODIFIER =
  /(VOS RACCOURCIS<\/span>)<a href="#" (style=\{\{ fontSize: "12px", fontWeight: "700" \}\}>Modifier<\/a>)/;

const BOUCLE_RACCOURCIS =
  '<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{(shortcuts ?? []).map(';

export const ADAPTATIONS_CHROME_GAUCHE = [
  {
    screens: ['*'],
    nom: 'PARCOURS_BARRE_AVANCEMENT',
    why: 'La barre de progression du panneau « Parcours » lit l’avancement du parcours, comme le chiffre à côté d’elle, au lieu de remplir 58 % pour tout le monde.',
    provides: [],
    apply(jsx) {
      const m = BARRE_58.exec(jsx);
      if (m === null) return { jsx, applied: false };
      const out = jsx.replace(BARRE_58, '$1width: `${String(panneau.avancement)}%`');
      return { jsx: out, applied: true };
    },
  },
  {
    screens: ['*'],
    nom: 'RACCOURCIS_RESEAUX',
    why: '« Vos raccourcis » montre MES réseaux (lus sur l’API) au lieu de trois noms écrits en dur ; « Modifier » mène à la page Réseaux.',
    provides: [],
    apply(jsx) {
      const debut = jsx.indexOf(BOUCLE_RACCOURCIS);
      if (debut === -1) return { jsx, applied: false };
      const fin = finElement(jsx, debut);
      if (fin === -1) return { jsx, applied: false };
      let out = jsx.slice(0, debut) + '<RaccourcisReseaux />' + jsx.slice(fin);
      out = out.replace(RACCOURCIS_MODIFIER, '$1<a href="/reseaux" $2');
      return { jsx: out, applied: true };
    },
  },
  {
    screens: ['*'],
    nom: 'ACCUEIL_CARTE_RETIREE',
    why: 'Le porteur : « retire la section Accueil au niveau des messages, l’utilisateur fera le hover ». La carte « ACCUEIL » des pages Messages et Notifications est retirée ; la navigation vit dans le menu qui se déplie au survol du rail (comme sur la page de recherche).',
    provides: [],
    apply(jsx) {
      const titre = '>ACCUEIL</div></div>';
      const i = jsx.indexOf(titre);
      if (i === -1) return { jsx, applied: false };
      // La carte : le <div> blanc qui précède le titre.
      const debut = jsx.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9"', i);
      if (debut === -1) return { jsx, applied: false };
      const fin = finElement(jsx, debut);
      if (fin === -1) return { jsx, applied: false };
      // Garde-fou : on ne retire que la liste d'entrées de la maquette (« Fil d’entraide »), rien d'autre.
      if (!jsx.slice(i, fin).includes('Fil d’entraide')) return { jsx, applied: false };
      return { jsx: jsx.slice(0, debut) + jsx.slice(fin), applied: true };
    },
  },
];

export const AJOUTS_CHROME_GAUCHE = {
  RaccourcisReseaux: '@/components/raccourcis-reseaux',
  MenuAccueil: '@/components/rail/menu-accueil',
};
