'use client';

import { Modal } from '@/components/modal';
import { ScreenFrames } from '@/screens/frames';
import { A01NMobile } from '@/screens/a01n/mobile.generated';
import { A01SMobile } from '@/screens/a01s/mobile.generated';
import { A01GMobile } from '@/screens/a01g/mobile.generated';
import { useComposeurMobile } from '@/screens/accueil/composeur-mobile';
import { GardeNiveau } from '@/components/garde-niveau';

/**
 * A01N — « Nouvelle publication », le composeur en plein écran. MOBILE SEUL.
 *
 * Second cadre de 390 px de la section A01S de `docs/template/03 Accueil v2.dc.html`.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ELLE MONTAIT LA FABRIQUE DE DÉMONSTRATION                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui : « La page pour la publication d'une actualité
 * sur mobile n'est pas dynamique, pas d'input, l'ajout de sondage ne marche pas,
 * etc. »
 *
 * MESURÉ : ZÉRO `<input>`, ZÉRO `<textarea>`, UN seul bouton — et tout le corps
 * était l'exemple de la maquette. La page rendait `accueilData()`, qui est la
 * fabrique des cadres de DOCUMENTATION. « On organise un repas partagé pour les
 * nouveaux arrivants », « Photo 1 », « Samedi 22 mars », « Repas pas cher à
 * Lyon » : quatre textes de planche, servis à qui venait écrire.
 *
 * Elle monte maintenant `useComposeurMobile`, qui tient le brouillon et appelle
 * `createPost` / `uploadPostImage` — les mêmes fonctions que le composeur du fil.
 *
 * ⚠ LE SONDAGE ET LES GUIDES LIÉS NE SONT PAS ENCORE COMPOSABLES D'ICI : leurs
 * deux fenêtres vivent dans `(app)/accueil/page.tsx` avec leur propre état, et
 * les rouvrir demande d'en extraire le composeur — un lot à part. La carte de
 * sondage ne s'affiche donc plus du tout, au lieu d'afficher celle de la
 * maquette. REMONTÉ au porteur.
 *
 * ── POURQUOI CETTE ROUTE, ET PAS `?composeur=` SUR `/accueil` ────────────────
 *
 * L'état par paramètre d'URL suppose une page SERVEUR qui lit `searchParams`.
 * `(app)/accueil/page.tsx` est un composant CLIENT de bout en bout : y lire l'URL
 * demanderait `useSearchParams()`, et la page du fil arriverait alors VIDE au
 * premier rendu.
 *
 * ── CE CADRE N'A AUCUN PENDANT D'ORDINATEUR ─────────────────────────────────
 *
 * Côté web, la maquette ne dessine le composeur rempli que dans une COLONNE DE
 * DOCUMENTATION de 760 px, avec ses légendes « COMPOSANTS » et « ÉTAT VIDE ». La
 * maquette fait loi : elle a décidé que cet écran est mobile.
 */
export default function NouvellePublicationPage() {
  const { donnees, fenetreSondage, fenetreGuides, fenetre, setFenetre } = useComposeurMobile();

  /**
   * LES DEUX FENÊTRES S'OUVRENT PAR `data-modal-open`, comme partout ailleurs :
   * les boutons du pied du composeur portent l'attribut, et ce gestionnaire
   * délégué le lit. Faire voyager deux fonctions à travers le JSX transcodé est
   * précisément ce que ce dépôt évite.
   */
  const onOuvrir = (event: { target: unknown }): void => {
    const cible = event.target;
    if (!(cible instanceof Element)) return;
    const declencheur = cible.closest('[data-modal-open]');
    if (declencheur === null) return;
    const quoi = declencheur.getAttribute('data-modal-open');
    if (quoi === 'A01S' || quoi === 'A01G') setFenetre(quoi);
  };

  return (
    <>
    <div onClick={onOuvrir}>
      <ScreenFrames screen="A01N" mobile={<A01NMobile {...donnees} />} />
      <Modal
        open={fenetre === 'A01S'}
        onClose={() => {
          setFenetre(null);
        }}
        titleId="a01s-titre"
        name="A01S"
        mobile={<A01SMobile {...fenetreSondage} />}
      />
      <Modal
        open={fenetre === 'A01G'}
        onClose={() => {
          setFenetre(null);
        }}
        titleId="a01g-titre"
        name="A01G"
        mobile={<A01GMobile {...fenetreGuides} />}
      />
    </div>
      <GardeNiveau capacite="post.create" />
    </>
  );
}
