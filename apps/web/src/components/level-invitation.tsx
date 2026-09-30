'use client';

import type { LevelRequiredDetailsParsed } from '@app/shared';

/**
 * L'INVITATION À MONTER DE NIVEAU — 00 §7.3, dernière ligne : « Le front affiche
 * alors une invitation à monter de niveau, JAMAIS UNE SIMPLE ERREUR. »
 *
 * ── POURQUOI CE COMPOSANT EXISTE, ET POURQUOI IL N'EST PAS UNE BANNIÈRE ──────
 *
 * `FlowError` sait afficher un refus. Passer un `403 LEVEL_REQUIRED` par elle
 * respecterait la lettre — le membre lit quelque chose — et manquerait le fond :
 * « Cette action demande de vérifier votre compte » est une PORTE FERMÉE. Le
 * membre ne sait ni ce qui manque, ni quoi faire, ni que c'est faisable en cinq
 * minutes. C'est exactement le moment où une inscription s'abandonne.
 *
 * L'invitation dit donc les trois choses que le serveur a envoyées dans `details`
 * et qu'une erreur sèche jette : CE QU'IL VOULAIT FAIRE (`labelFr`), CE QUI
 * MANQUE (`requiredLevel` face à `currentLevel`), et OÙ ALLER pour l'obtenir.
 *
 * ── LE NIVEAU N'EST PAS LU POUR DÉCIDER ─────────────────────────────────────
 *
 * Ce composant ne s'affiche qu'à partir d'un refus DÉJÀ REÇU. Il ne consulte
 * jamais `fetchMe().verificationLevel` pour masquer un bouton par avance : c'est
 * la règle du socle (`api/session.ts`), et sa raison est l'histoire du projet —
 * un niveau lu une fois et gardé laisse une interface de niveau supérieur à un
 * membre rétrogradé. Ici, la seule source du niveau est la réponse du serveur au
 * geste que le membre vient de faire.
 *
 * ── LES TEXTES ──────────────────────────────────────────────────────────────
 *
 * `labelFr` vient de la matrice des capacités de `packages/shared`, donc le
 * serveur et cet écran nomment l'action avec les mêmes mots. Les conditions des
 * niveaux, elles, sont celles de 00 §7.2, à la lettre : L1 = identité vérifiée,
 * L2 = un numéro d'un pays de destination.
 */

/** Ce qu'il faut faire pour atteindre le niveau, selon 00 §7.2. */
const ACTIONS: Readonly<Record<string, { readonly what: string; readonly href: string }>> = {
  L1: {
    what: 'vérifier votre identité',
    href: '/compte/verification',
  },
  // §2.5 : le numéro de destination s'ajoute depuis un compte DÉJÀ L1, et c'est
  // `phone_numbers.is_destination` qui fait le niveau — jamais une valeur recopiée.
  L2: {
    what: 'ajouter un numéro de téléphone français',
    href: '/compte/securite',
  },
};

export function LevelInvitation({
  details,
  onClose,
}: {
  /** `null` quand le dernier refus n'était pas un `LEVEL_REQUIRED`. */
  readonly details: LevelRequiredDetailsParsed | null;
  readonly onClose: () => void;
}) {
  if (details === null) return null;

  const required = details.requiredLevel ?? 'L1';
  const action = ACTIONS[required] ?? ACTIONS['L1'];
  const label = details.labelFr;

  return (
    <div
      // `status` et non `alert` : une invitation n'est pas une alerte. Le lecteur
      // d'écran l'annonce sans couper ce qu'il était en train de lire.
      role="status"
      data-level-invitation={required}
      style={{
        position: 'fixed',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        left: '16px',
        right: '16px',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '18px 20px',
        borderRadius: '18px',
        // Les couleurs de l'encart d'accompagnement de la maquette (#E3F0EB /
        // #0F5C48), pas celles d'une erreur : ce n'en est pas une.
        background: '#E3F0EB',
        border: '1px solid #16785E',
        color: '#0F5C48',
        fontSize: '14px',
        lineHeight: 1.55,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <strong style={{ fontSize: '15px', fontWeight: 700 }}>
        {label === undefined
          ? 'Encore une étape avant de continuer'
          : `Pour ${label}, il reste une étape`}
      </strong>
      <span>
        {`Il vous faut un compte ${required}. `}
        {`Le vôtre est ${details.currentLevel ?? 'L0'}. `}
        {`Il suffit de ${action?.what ?? 'vérifier votre identité'} — cela prend quelques minutes.`}
      </span>
      <span style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <a
          href={action?.href ?? '/compte/verification'}
          style={{
            height: '44px',
            padding: '0 18px',
            borderRadius: '14px',
            background: '#16785E',
            color: '#fff',
            fontSize: '13.5px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          Vérifier mon compte
        </a>
        <button
          type="button"
          onClick={onClose}
          style={{
            height: '44px',
            padding: '0 18px',
            borderRadius: '14px',
            background: '#fff',
            color: '#16211D',
            border: 'none',
            font: 'inherit',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Plus tard
        </button>
      </span>
    </div>
  );
}
