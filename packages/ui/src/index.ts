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
 */
export { cn } from './cn';
export * from './icons/paths';
export * from './icons/Icon';
export * from './primitives/primitives';
export * from './states/states';
export * from './navigation/navigation';
export * from './feed/PostCard';
export * from './feed/StoryStrip';
export * from './feed/Composer';
export * from './feed/aside';
