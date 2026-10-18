/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — « TOUT EST GRATUIT POUR LE MOMENT » (K06, lot A)     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « On va laisser les paiements. Tout sera gratuit pour le moment. »
 *
 * La maquette K06 dessine l'offre Premium (comparatif, prix, « Passer à Premium »,
 * fenêtre Mobile Money). Tant que `monetisation_active` est faux (réglage serveur,
 * lu par `GET /me`), tous les membres ont les droits Premium : afficher un prix ou
 * un bouton de paiement serait une incitation à payer pour ce qu'on a déjà. Ce
 * composant remplace donc le corps de la page, sur `/premium` ET
 * `/compte/abonnement`, par une phrase sobre. AUCUN flux de paiement ici ; le code
 * de paiement du dépôt est intact et reparaît quand le réglage est rallumé.
 *
 * Dessin repris des cartes voisines de K06 : carte blanche au liseré #E6EBE9
 * (rayon 22, marge 20), encart vert #F3F7F5 / #0F5C48 (rayon 14), bouton #16785E.
 * Aucune couleur nouvelle, aucun rouge. Même rendu aux deux largeurs : la carte
 * est fluide.
 */
export function PremiumGratuit() {
  return (
    <div
      data-premium-gratuit=""
      style={{
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: '22px',
        padding: '20px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '20px', fontWeight: 800 }}>Tout est gratuit pour le moment</div>
      <div style={{ fontSize: '13.5px', lineHeight: '1.55', color: '#5D6B66' }}>
        Toutes les fonctions sont ouvertes à tous les membres, sans abonnement : parcours
        illimités, alertes, événements et contacts avec les professionnels. Aucun paiement n’est
        demandé.
      </div>
      <div
        style={{
          background: '#F3F7F5',
          borderRadius: '14px',
          padding: '12px 14px',
          fontSize: '12.5px',
          color: '#0F5C48',
          lineHeight: '1.5',
        }}
      >
        Si une formule payante voit le jour, vous serez prévenu à l’avance et rien ne changera sans
        votre accord.
      </div>
      <a
        href="/accueil"
        style={{
          height: '46px',
          borderRadius: '14px',
          background: '#16785E',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
        }}
      >
        Retour à l’accueil
      </a>
    </div>
  );
}
