'use client';

/**
 * Le message d'erreur du parcours d'inscription.
 *
 * ── CE QU'ELLE N'AFFICHE PLUS ───────────────────────────────────────────────
 *
 * Tous les refus SURVENUS pendant le parcours passent désormais par
 * `react-hot-toast` — décision du porteur, voir `components/notifications.tsx`,
 * qui explique aussi pourquoi le dessin reste le nôtre. Il lui reste UN SEUL
 * emploi, et il ne peut pas être une notification : le motif de reprise rendu par
 * le SERVEUR (`/connexion?reprise=…`). Une notification est montée côté client,
 * donc elle arriverait APRÈS le premier octet de HTML — et un test de bout en
 * bout exige ce texte dans la réponse HTTP elle-même.
 *
 * La bannière porte donc la raison d'être revenu là ; les notifications portent ce
 * qui échoue ensuite. Les deux gardent `data-flow-error`, pour que les tests ne
 * dépendent pas de laquelle des deux a parlé.
 *
 * La maquette dessine bien des états d'erreur — le panneau « PAYS NON COUVERT »
 * et « CODE INVALIDE » de 340 px — mais dans son cadre de documentation, pas
 * dans les écrans. Cette bannière est donc écrite, et non transcodée : elle
 * emprunte les couleurs de ces panneaux.
 *
 * `role="alert"` : le message est annoncé dès qu'il apparaît, sans que le membre
 * ait à le chercher. C'est le cas d'usage exact de ce rôle, et l'un des rares
 * où il est justifié.
 *
 * D'où aussi `data-flow-error`. Next pose son PROPRE `role="alert"` — l'annonceur
 * de route, qui lit le titre de la page aux lecteurs d'écran — et il est vide au
 * chargement. Un test qui cherche `[role="alert"]` tombe donc une fois sur deux
 * sur lui, et échoue en accusant l'application. L'attribut donne une prise sans
 * ambiguïté, sans rien changer à ce que le membre entend.
 */
export function FlowError({ message }: { readonly message: string | null }) {
  if (message === null) return null;

  return (
    <div
      role="alert"
      data-flow-error=""
      style={{
        position: 'fixed',
        // En bas : sur mobile le haut de l'écran est occupé, et le pouce est ici.
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        left: '16px',
        right: '16px',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '14px 16px',
        borderRadius: '14px',
        background: '#FFF4EF',
        border: '1px solid #E0733A',
        color: '#16211D',
        fontSize: '14px',
        lineHeight: 1.5,
        zIndex: 50,
      }}
    >
      {message}
    </div>
  );
}
