import { EditeurGuideEcran } from '@/screens/guides/editeur-guide-ecran';

/**
 * A05 — l'éditeur de guide, ÉCRITURE D'UN GUIDE NEUF. `/guides/nouveau`
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUI A CHANGÉ ICI, ET CE QUI N'A PAS CHANGÉ DU TOUT                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Cette page portait tout l'écran : une trentaine de prises reliant
 * `use-editeur-guide` aux deux cadres transcodés, plus les deux aperçus et la
 * fenêtre de confirmation du retrait d'une page. Depuis que l'éditeur s'ouvre
 * AUSSI sur un guide existant (`/guides/:slug/modifier`), ce corps est descendu
 * dans `screens/guides/editeur-guide-ecran.tsx` : les deux adresses montent LE
 * MÊME écran, et une copie serait devenue fausse au premier changement de l'une.
 *
 * ⚠ LE COMPORTEMENT DE CETTE ADRESSE EST INCHANGÉ, et c'est la non-régression la
 * plus importante du lot : `{ kind: 'nouveau' }` est le mode par défaut du
 * crochet, les deux effets ajoutés pour la reprise sortent à leur première ligne
 * dans ce mode, et le dessin est le même objet transcodé. Rien n'est conditionné
 * ici : la page ne fait plus que nommer son mode.
 *
 * Elle reste un composant CLIENT par ce qu'elle monte — `EditeurGuideEcran` porte
 * son propre `'use client'` —, et elle n'a aucun paramètre d'adresse à lire.
 */
export default function NouveauGuidePage() {
  return <EditeurGuideEcran mode={{ kind: 'nouveau' }} />;
}
