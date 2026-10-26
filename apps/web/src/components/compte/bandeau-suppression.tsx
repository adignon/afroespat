'use client';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — « SUPPRESSION PROGRAMMÉE LE … » (K08, LOT W5B)       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Après `POST /me/deletion`, le serveur révoque TOUTES les sessions (01 §2.8) : le membre est
 * ramené à `/connexion?suppression=<échéance>`, et cette bande lui dit où il en est — que sa
 * suppression est programmée, quel jour elle devient définitive, et comment l'annuler.
 *
 * « ANNULER LA SUPPRESSION », C'EST SE RECONNECTER. §2.8 : « pendant 7 jours, une connexion OTP
 * annule la demande » ; il n'existe pas de `DELETE /me/deletion` atteignable, la session étant
 * morte (voir `account.controller.ts`). Le bouton amène donc au champ du numéro : le serveur
 * annule à la vérification du code (`deletionCancelled`), et l'écran de connexion le dit ensuite.
 *
 * Langage visuel des fenêtres voisines : le fond d'alerte douce de l'accueil (#FDF0E7), l'encre
 * #B4581F, le bouton noir #16211D de la planche K08. Aucune couleur nouvelle, aucun rouge.
 */

/** « lundi 2 novembre 2026 » — le jour de l'échéance, à l'heure de Paris. */
export function jourDEcheance(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

export function BandeauSuppression({ echeance }: { readonly echeance: string }) {
  const jour = jourDEcheance(echeance);
  if (jour === null) return null;

  const vers = (): void => {
    const champ = document.querySelector<HTMLInputElement>('input[name="phone"]');
    champ?.scrollIntoView({ block: 'center' });
    champ?.focus();
  };

  return (
    <div
      role="status"
      data-suppression-programmee={echeance}
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(560px, calc(100vw - 32px))',
        boxSizing: 'border-box',
        zIndex: 40,
        background: '#FDF0E7',
        border: '1px solid #F2D2B8',
        borderRadius: '22px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#B4581F' }}>
        SUPPRESSION PROGRAMMÉE
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.45, color: '#16211D' }}>
        Votre compte sera supprimé le {jour}.
      </div>
      <div style={{ fontSize: '12.5px', lineHeight: 1.55, color: '#5D6B66' }}>
        Vous avez été déconnecté·e. D’ici là, vous pouvez changer d’avis : il suffit de vous
        reconnecter avec votre numéro, et la suppression s’arrête.
      </div>
      <button
        type="button"
        onClick={vers}
        data-suppression-annuler=""
        style={{
          height: '44px',
          padding: '0 18px',
          borderRadius: '14px',
          background: '#16211D',
          color: '#fff',
          border: 'none',
          font: 'inherit',
          fontSize: '13.5px',
          fontWeight: 700,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Annuler la suppression
      </button>
    </div>
  );
}
