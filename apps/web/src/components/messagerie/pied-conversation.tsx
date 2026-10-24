'use client';

/**
 * AJOUT HORS MAQUETTE — le pied du fil de messagerie : la demande de conversation,
 * l'attente de réponse, et l'indicateur « écrit… » (08 §5.2, §7.3).
 *
 * La maquette M01 décrit l'état « DEMANDE EN ATTENTE » en prose (« Premier message
 * envoyé. Vous pourrez continuer quand Marc aura répondu. », T5 M01) sans que
 * l'écran de la demande REÇUE soit dessiné : rien ne montre où l'on accepte ou
 * ignore. Il est construit ici avec le seul bandeau que la maquette dessine pour cet
 * état — `background:#F3F7F5; border-radius:14px; padding:12px; font-size:12.5px;
 * color:#0F5C48; line-height:1.5` — et les deux boutons de K05 (« Débloquer » :
 * `height:36px; border-radius:14px; font-size:13.5px; font-weight:700`, fond
 * `#F2F5F4`), le principal en vert `#16785E` comme tous les boutons d'action du
 * produit. Aucune couleur nouvelle.
 *
 * « Ignorer » ne dit RIEN à l'expéditeur : il reste « en attente de réponse » et ne
 * peut pas relancer (§5.2, « sans réponse, pas de second message »).
 */
const BANDEAU = {
  background: '#F3F7F5',
  borderRadius: '14px',
  padding: '12px',
  fontSize: '12.5px',
  color: '#0F5C48',
  lineHeight: 1.5,
} as const;

const BOUTON = {
  minHeight: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
} as const;

export function PiedConversation({
  demande,
  prenom,
  ecritPar,
  occupe,
  onAccepter,
  onIgnorer,
}: {
  readonly demande: 'recue' | 'envoyee' | null;
  readonly prenom: string | null;
  /** Le prénom de qui écrit en ce moment, ou `null`. */
  readonly ecritPar: string | null;
  readonly occupe: boolean;
  readonly onAccepter: () => void;
  readonly onIgnorer: () => void;
}) {
  const nom = prenom === null || prenom === '' ? 'Ce membre' : prenom;
  if (demande === null && ecritPar === null) return null;
  return (
    <div style={{ padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {demande === 'recue' ? (
        <div style={BANDEAU} role="status" data-demande-recue="">
          <div>
            {nom} souhaite vous écrire. Vous pourrez répondre si vous acceptez ; vous pouvez aussi ignorer
            cette demande, sans que {nom} en soit informé·e.
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onAccepter}
              disabled={occupe}
              data-demande-accepter=""
              style={{ ...BOUTON, background: '#16785E', color: '#fff', opacity: occupe ? 0.6 : 1 }}
            >
              Accepter
            </button>
            <button
              type="button"
              onClick={onIgnorer}
              disabled={occupe}
              data-demande-ignorer=""
              style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D', opacity: occupe ? 0.6 : 1 }}
            >
              Ignorer
            </button>
          </div>
        </div>
      ) : null}
      {demande === 'envoyee' ? (
        <div style={BANDEAU} role="status" data-demande-envoyee="">
          Premier message envoyé. Vous pourrez continuer quand {nom} aura répondu.
        </div>
      ) : null}
      {ecritPar !== null ? (
        <div role="status" aria-live="polite" data-frappe="" style={{ fontSize: '12px', color: '#8A958F' }}>
          {ecritPar} écrit…
        </div>
      ) : null}
    </div>
  );
}
