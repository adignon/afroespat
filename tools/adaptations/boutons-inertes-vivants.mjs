/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ VAGUE 1 / PHASE 1 — « BOUTONS, LIENS ET SECTIONS INERTES »                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Source des constats : l'audit du front (RAPPORT-FRONT). Chaque élément dessiné
 * qui ne faisait rien reçoit son vrai geste ici, ou disparaît. Appliquées avant
 * « l'en-tête global » (voir `tools/generate-screens.mjs`), comme les adaptations
 * des autres lots : elles lisent des cadres déjà branchés.
 *
 * Règles (AMORCAGE §3) : un motif est ancré sur la STRUCTURE, jamais sur une
 * mesure ; une coupe COMPTE ses balises ; aucune couleur n'est inventée.
 */
import { NU, changerBalise, ouvranteAvant } from './outils-lot-e.mjs';

// ─── J11 · « Créer un parcours » ─────────────────────────────────────────────

/**
 * J11 (`/parcours`) dessinait DEUX gestes pour la même chose : le lien « Nouveau
 * parcours » (vivant) et, dans le bandeau, un `<button>` « Créer un parcours »
 * sans gestionnaire. Les cadres 390 px (J11 mobile, mobilevide) et les variantes
 * J01E n'ont pas ce bouton (relevé : une seule occurrence, 1440 px).
 */
const BI_J11_CREER = {
  screens: ['J11'],
  nom: 'BI_J11_CREER',
  why: 'Le bouton « Créer un parcours » du bandeau de /parcours n’avait aucun gestionnaire : il mène à /parcours/nouveau, comme « Nouveau parcours ».',
  provides: [],
  apply(jsx) {
    const at = jsx.indexOf('Créer un parcours</button>');
    if (at === -1) return { jsx, applied: false };
    const debut = ouvranteAvant(jsx, at, 'button');
    const neuf = changerBalise(
      jsx,
      debut,
      'Link',
      'href="/parcours/nouveau" data-parcours-creer=""',
      'textDecoration: "none", cursor: "pointer"',
    );
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

export const ADAPTATIONS_BOUTONS_INERTES = [BI_J11_CREER];
export const AJOUTS_BOUTONS_INERTES = {};
void NU;
