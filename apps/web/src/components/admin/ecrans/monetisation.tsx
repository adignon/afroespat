'use client';

import { adminSettingSchema } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { Bandeau, C, Carte, Etiquette, Lecture, Titre, useCharge } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D14 · LA MONÉTISATION EST DÉSACTIVÉE                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « On va laisser les paiements. Tout sera gratuit pour le moment. » La
 * maquette dessinait un tableau d'abonnements, un MRR et un répartiteur carte / Mobile
 * Money — des chiffres qui n'existent pas tant que rien n'est facturé. Les afficher,
 * même à zéro, laisserait croire qu'un paiement est possible.
 *
 * L'écran dit donc ce qui est VRAI, lu sur le réglage `monetisation_active` (faux par
 * défaut) : tout est gratuit, chaque membre a les droits Premium, aucun paiement n'est
 * pris. Il n'y a ici aucune action de paiement — ni prix, ni remboursement, ni facture :
 * le paiement est HORS PÉRIMÈTRE de ce chantier. Les partenaires d'affiliation, eux, sont
 * en D13.
 */
export function ContenuMonetisation() {
  const { etat, recharger } = useCharge(() => staffApi.get('/settings/monetisation_active', adminSettingSchema), 'monetisation');
  return (
    <>
      <Titre titre="Abonnements et revenus" />
      <Lecture etat={etat} recharger={recharger}>
        {(s) =>
          s.value === true ? (
            <Carte>
              <Bandeau ton="attention">La monétisation est marquée active, mais les écrans de facturation ne sont pas livrés : le paiement est hors périmètre de ce chantier.</Bandeau>
            </Carte>
          ) : (
            <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Etiquette>État</Etiquette>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>Monétisation désactivée</div>
              <div style={{ fontSize: '15px', lineHeight: 1.7, maxWidth: '680px' }}>
                Tout est gratuit pour le moment : tous les membres bénéficient des droits Premium, aucune limite de plan ne s’applique et aucun paiement n’est pris. Il n’y a donc ni abonnement, ni revenu, ni remboursement à suivre.
              </div>
              <div style={{ fontSize: '13px', color: C.gris }}>
                Réglage : <code>monetisation_active</code> = faux. {s.description}
              </div>
            </Carte>
          )
        }
      </Lecture>
    </>
  );
}
