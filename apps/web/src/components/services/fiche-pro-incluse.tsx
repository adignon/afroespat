/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — LA FICHE PRO, « INCLUSE » QUAND TOUT EST GRATUIT (S08) ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette S08 dessine trois paliers (Gratuite 0 €, Pro 9 €/mois, Pro+ 19 €/mois).
 * Tant que `monetisation_active` est faux (`GET /me` → `quotas.gratuit`), tous les
 * membres ont les droits Premium : afficher des prix ou un choix de palier serait
 * une incitation à payer pour ce qu'on a déjà. L'adaptation `S08_GRATUIT`
 * (`tools/adaptations/gratuit-vivant.mjs`) remplace donc les paliers par cette
 * carte, qui dit que la fiche et ses avantages sont inclus. Rien n'est supprimé du
 * dessin : le rallumage du réglage restitue les paliers tels que dessinés.
 *
 * Dessin repris de la carte « Pro » de la planche : fond #EFF7F3, liseré #16785E,
 * rayon 18, textes #16211D / #5D6B66. Aucune couleur nouvelle, aucun rouge.
 */
export function FicheProIncluse() {
  return (
    <div
      data-fiche-incluse=""
      style={{
        padding: '16px',
        borderRadius: '18px',
        background: '#EFF7F3',
        border: '2px solid #16785E',
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: 700 }}>Ma fiche pro est incluse</div>
      <div style={{ fontSize: '12px', color: '#5D6B66', marginTop: '8px', lineHeight: '1.5' }}>
        Fiche visible dans l’annuaire, badge Pro, plusieurs villes : tout est ouvert à tous les
        membres, sans abonnement ni paiement.
      </div>
    </div>
  );
}
