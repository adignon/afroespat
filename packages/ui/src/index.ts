/**
 * @app/ui — le design system, porté depuis docs/template.
 *
 * SOURCE DE VÉRITÉ de l'interface. Les composants viennent de
 * `Bibliothèque UI v2.dc.html`, la coquille de `Fil d'actualité v2.dc.html`, et le
 * jeu d'icônes de `gen-helpers.js`. Voir docs/decisions.md : les specs T1 §2 et
 * T5 §0 portent le brief d'origine, pas l'état courant.
 *
 * Aucune logique métier ici : les composants reçoivent des données, ils n'en
 * cherchent pas (§4).
 *
 * Les ÉCRANS, eux, ne vivent pas ici : ils sont transcodés des maquettes par
 * tools/dc-to-jsx.mjs et gardent leurs styles en ligne. Ce paquet ne porte que
 * ce qui se partage entre écrans — jetons, icônes, états obligatoires.
 */
export { cn } from './cn';
export * from './icons/paths';
export * from './icons/Icon';
export * from './primitives/primitives';
export * from './states/states';
export * from './navigation/navigation';
