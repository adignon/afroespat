/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ K08 — « CONFIRMER LA SUPPRESSION » EST BRANCHÉ (LOT W5B, MISSION B)        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La confirmation de suppression (K08S, fenêtre de 440 px, et sa feuille basse dérivée à
 * 390 px) dessine un bloc d'information, six cases de code SMS « 4 8 2 » et un bouton noir
 * « Confirmer la suppression » — qui était volontairement INERTE depuis plusieurs lots : la
 * suppression est irréversible après sept jours (01 §2.8). Décision du porteur : on le branche.
 *
 * Cette adaptation remplace, DANS les deux cadres de la confirmation, les six cases dessinées
 * et le bouton par `<ConfirmationSuppression />` (`components/compte/confirmation-suppression.tsx`,
 * AJOUT marqué dans son en-tête) : saisie du pseudo, envoi du code au numéro principal, six cases
 * (celles de la maquette, à la même mesure), puis le bouton noir de la planche — branché sur
 * `POST /me/deletion/code` et `POST /me/deletion`.
 *
 * ── CE QUI EST GARDÉ, À L'IDENTIQUE ─────────────────────────────────────────
 * Le titre, la croix, « Supprimé », « Conservé sans votre nom » et la phrase du délai
 * (`Texte id="suppressionRepit"`, que `K08_DELAIS` a déjà liée à `ACCOUNT_LIMITS`) ne bougent pas.
 *
 * ── LA COUPE EST BORNÉE ET COMPTÉE (piège 3 de AMORCAGE-AGENT.md) ───────────
 * Le bloc remplacé est lu par structure : un libellé « Code reçu par SMS », l'élément qui le suit
 * (la grille des cases, bornée par `finElement` donc équilibrée), la fermeture du contenu, puis un
 * `<button>` « Confirmer la suppression ». Si l'un des quatre manque, rien n'est coupé et
 * l'adaptation se déclare non appliquée — jamais un JSX déséquilibré.
 */
import { finElement } from './reseau-vivant.mjs';

const LIBELLE = '>Code reçu par SMS</div>';
const BOUTON = 'Confirmer la suppression</button>';

export const ADAPTATIONS_COMPTE_SUPPRESSION = [
  {
    screens: ['K08'],
    nom: 'K08_CONFIRMATION_VIVANTE',
    why: 'Le bouton « Confirmer la suppression » (et ses six cases de code) était inerte : il porte maintenant le pseudo à retaper, l’envoi du code et la demande de suppression, dans le langage visuel de la planche.',
    provides: [],
    apply(jsx) {
      const marque = jsx.indexOf(LIBELLE);
      if (marque === -1) return { jsx, applied: false };
      const debut = jsx.lastIndexOf('<div style=', marque);
      if (debut === -1) return { jsx, applied: false };
      const finLibelle = marque + LIBELLE.length;
      // La grille des six cases : l'élément qui suit immédiatement le libellé.
      if (!jsx.startsWith('<div style=', finLibelle)) return { jsx, applied: false };
      const finGrille = finElement(jsx, finLibelle);
      if (finGrille === -1) return { jsx, applied: false };
      // Puis la fermeture du contenu défilant, et le bouton noir de la planche.
      const apres = '</div><button';
      if (!jsx.startsWith(apres, finGrille)) return { jsx, applied: false };
      const debutBouton = finGrille + '</div>'.length;
      const finBouton = jsx.indexOf(BOUTON, debutBouton);
      if (finBouton === -1 || finBouton - debutBouton > 1500) return { jsx, applied: false };
      const fin = finBouton + BOUTON.length;
      const neuf = '<ConfirmationSuppression /></div>';
      return { jsx: jsx.slice(0, debut) + neuf + jsx.slice(fin), applied: true };
    },
  },
];

export const AJOUTS_COMPTE_SUPPRESSION = {
  ConfirmationSuppression: '@/components/compte/confirmation-suppression',
};
