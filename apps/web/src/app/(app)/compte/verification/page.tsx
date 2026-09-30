'use client';

import { chargerK03 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K03Desktop } from '@/screens/k03/desktop.generated';
import { K03Mobile } from '@/screens/k03/mobile.generated';

/**
 * K03 — « Vérification et niveaux » (`/compte/verification`, 01 §3).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html`. Rien n'est
 * réécrit ; la page sert les deux cadres et leur passe les données.
 *
 * CE QUI EST BRANCHÉ : les trois pastilles d'état des niveaux, leur libellé ET
 * leurs deux couleurs, depuis `verificationLevel` de `GET /me`. Lier le seul
 * libellé aurait laissé un « À faire » sur le fond vert d'un niveau acquis — pire
 * que la maquette figée.
 *
 * LE NIVEAU N'AUTORISE RIEN ICI, et cette page est l'endroit où la tentation était
 * la plus forte. Il est AFFICHÉ, point. La règle du socle est sans exception, et
 * son histoire est écrite dans `lib/api/session.ts` : un niveau lu une fois et
 * gardé, c'est la faille de quinze minutes du projet rejouée dans le front. On
 * tente l'action, et c'est `403 LEVEL_REQUIRED` qui fait afficher l'invitation du
 * §7.3.
 *
 * CE QUI NE PEUT PAS ÊTRE BRANCHÉ : la colonne « ÉTATS KYC ». La maquette y montre
 * les QUATRE états côte à côte — en cours, en revue, refusée, mineur — c'est-à-dire
 * une documentation des états, pas l'état du membre. En piloter un demanderait de
 * choisir lequel afficher, donc de redessiner la colonne. `GET /me/kyc` est lue et
 * validée (`lireKyc`), prête pour le jour où la maquette réservera une place.
 * Signalé au porteur.
 */
export default function VerificationPage() {
  return (
    <EcranDonnees charger={chargerK03}>
      {(donnees) => (
        <ScreenFrames
          screen="K03"
          desktop={<K03Desktop {...donnees} />}
          mobile={<K03Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
