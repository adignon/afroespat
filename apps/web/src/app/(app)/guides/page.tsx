import { GuidesScreen } from './guides-screen';

/**
 * A03 — Guides et Démarches, la liste. `/guides`
 *
 * Composant SERVEUR qui n'enveloppe qu'un composant client : c'est la forme qui
 * laisse Next rendre la coquille de la page sur le serveur. L'état des onglets et
 * l'appel à `GET /guides` vivent dans `guides-screen.tsx`.
 *
 * Aucun `useSearchParams()` ici ni là-bas : l'onglet est un état de page, pas une
 * ressource, et ce crochet force le rendu client — il a déjà servi VIDES cinq
 * pages de ce projet, sans aucune erreur visible.
 *
 * LE CADRE MOBILE VIENT DE LA PLANCHE « Versions mobiles » (MOB), première
 * position, que la maquette annonce « A03 · Guides — liste ». A03 n'a pas de
 * cadre de 390 px dans sa propre section : voir `tools/screens/03-accueil.mjs`.
 */
export default function GuidesPage() {
  return <GuidesScreen />;
}
