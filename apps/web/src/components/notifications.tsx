'use client';

import toast, { Toaster } from 'react-hot-toast';

/**
 * LES RETOURS D'ERREUR DU PRODUIT, EN NOTIFICATIONS — `react-hot-toast`.
 *
 * Le porteur a regardé l'écran du code et tranché : « le tooltip qui dit "Ce code
 * n'est pas le bon. Vérifiez et réessayez." n'est pas présentable, il faut
 * utiliser des librairies dédiées ». La bibliothèque est SON choix, pas le mien.
 *
 * Ce que la bannière écrite à la main ne savait pas faire, et qui se voyait :
 *
 *   · DEUX messages de suite s'écrasaient. Un seul état `error | null` ne peut en
 *     porter qu'un ; le second effaçait le premier sans que personne le lise ;
 *   · elle ne partait JAMAIS. Un refus restait affiché pendant que le membre
 *     corrigeait sa saisie, donc en travers de l'écran, jusqu'au prochain appel ;
 *   · elle n'avait aucune transition : elle apparaissait d'un coup en travers du
 *     bas de l'écran, ce qui est exactement ce que le porteur appelle « pas
 *     présentable ».
 *
 * ── CE QU'ON NE LUI DÉLÈGUE PAS : LE DESSIN ─────────────────────────────────
 *
 * `toast.custom` plutôt que `toast.error`. La présentation par défaut de la
 * bibliothèque apporte sa propre carte blanche, son ombre portée et son
 * émoji — trois choses que `T1 §2.1` interdit (« aucune ombre portée », palette
 * fermée). On ne garde donc d'elle que la MÉCANIQUE — file d'attente, durée,
 * apparition, disparition, survol qui suspend — et le dessin reste celui de la
 * maquette.
 *
 * ── LES COULEURS SONT RELEVÉES, PAS CHOISIES ────────────────────────────────
 *
 * Le refus reprend les trois jetons que la maquette emploie pour son propre
 * message d'erreur, dans le panneau « CODE INVALIDE » de la section P02 :
 * `journey-softest` en fond (`#FFFBF8`), `journey-strong` en texte (`#B4581F`),
 * et `journey` en filet (`#E0733A`) — le pairage que `packages/config/tokens.js`
 * documente lui-même, « encart terre cuite très doux, avec bordure journey ».
 *
 * La confirmation reprend le trio vert équivalent : `primary-soft`,
 * `primary-strong`, `primary`. Les deux paires de texte sur fond figurent
 * nommément dans `guardrails/check-contrast.mjs` et tiennent le seuil AA.
 *
 * Aucun hexadécimal n'est inventé ni éclairci. La bannière précédente, elle,
 * peignait son fond en `#FFF4EF` — une couleur qui n'est dans aucun jeton.
 *
 * ── CE QU'UN LECTEUR D'ÉCRAN ENTEND ────────────────────────────────────────
 *
 * `role="alert"` sur le refus : il est annoncé dès qu'il apparaît, sans que le
 * membre ait à le chercher — c'est le cas d'usage exact de ce rôle. La
 * confirmation prend `role="status"`, qui est poli : « un nouveau code vous a été
 * envoyé » ne doit pas couper la phrase en cours de lecture.
 *
 * `data-flow-error` reste posé sur le refus, et ce n'est pas une décoration :
 * Next pose son PROPRE `role="alert"` — l'annonceur de route — et il est vide au
 * chargement. Un test qui cherche `[role="alert"]` tombe une fois sur deux sur
 * lui et échoue en accusant l'application. L'attribut donne une prise sans
 * ambiguïté, et trois fichiers de tests s'en servent déjà.
 */

/** La géométrie commune, héritée de la bannière qu'elle remplace. */
const CARTE = {
  maxWidth: '520px',
  padding: '14px 16px',
  // 14 px — `radius.lg`, le rayon des encarts de la maquette.
  borderRadius: '14px',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.5,
} as const;

/**
 * LE MOUVEMENT EST DÉJÀ DÉCLARÉ, et il s'appelle `toastIn`.
 *
 * `packages/config/motion.js` le porte depuis le début — « Toast : il vient du
 * bas, il repart de même », 200 ms, courbe `out`, douze pixels de translation,
 * fondu. C'est le SEUL mouvement de notification que le système autorise, et il
 * n'avait jamais eu d'emploi faute de notifications. On ne réinvente donc rien :
 * on branche enfin le moment prévu, et le commentaire le nomme pour qu'un `grep`
 * le retrouve, comme `motion.js` le demande.
 *
 * `t.visible` passe à faux quand la bibliothèque programme le retrait ; l'élément
 * est démonté une fois la transition finie. C'est elle qui donne la sortie, sans
 * qu'on écrive d'animation.
 */
const transition = (visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(12px)',
  // motion:toastIn — 200 ms, easing.out. Voir packages/config/motion.js.
  transition: 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
});

/**
 * Un refus.
 *
 * `id` est dérivé du MESSAGE : deux refus identiques qui se suivent — le membre
 * retape le même mauvais code — remplacent le premier au lieu d'empiler deux
 * cartes rigoureusement semblables. Deux refus DIFFÉRENTS, eux, s'affichent tous
 * les deux, ce que l'état unique de la bannière ne permettait pas.
 */
export function notifyError(message: string): void {
  toast.custom(
    (t) => (
      <div
        role="alert"
        data-flow-error=""
        style={{
          ...CARTE,
          ...transition(t.visible),
          background: '#FFFBF8',
          border: '1px solid #E0733A',
          color: '#B4581F',
        }}
      >
        {message}
      </div>
    ),
    // Assez long pour être lu, assez court pour ne pas rester en travers de la
    // correction que le membre est en train de faire.
    { id: `refus:${message}`, duration: 7000 },
  );
}

/** Une confirmation — « un nouveau code vous a été envoyé ». */
export function notifySuccess(message: string): void {
  toast.custom(
    (t) => (
      <div
        role="status"
        data-flow-ok=""
        style={{
          ...CARTE,
          ...transition(t.visible),
          background: '#E3F0EB',
          border: '1px solid #16785E',
          color: '#0F5C48',
        }}
      >
        {message}
      </div>
    ),
    { id: `ok:${message}`, duration: 4000 },
  );
}

/**
 * Le réceptacle, monté une fois dans le layout racine.
 *
 * ── POURQUOI LA RACINE, alors que `SessionBoot` a dû en DÉMÉNAGER ───────────
 *
 * `SessionBoot` ouvrait une session MEMBRE sur chaque page d'ÉQUIPE : il émettait
 * une requête. Celui-ci n'émet rien, ne lit aucune session et ne rend aucun nœud
 * tant qu'aucune notification n'existe. Il n'y a donc rien à cloisonner, et le
 * mettre par zone aurait donné trois réceptacles pour une seule file.
 *
 * ── EN BAS, et l'argument est le même que pour la bannière ──────────────────
 *
 * Sur un téléphone le haut de l'écran est occupé et le pouce est en bas. La
 * `containerStyle` reprend la marge de zone sûre que la bannière portait, sans
 * laquelle la carte passait sous la barre de gestes d'iOS.
 */
export function Notifications() {
  return (
    <Toaster
      position="bottom-center"
      containerStyle={{
        left: 16,
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
      // La bibliothèque n'impose aucun style aux cartes `custom` ; celle-ci
      // n'existe que pour l'espacement vertical entre deux cartes empilées.
      gutter={10}
    />
  );
}
