'use client';

import { SQUELETTE_K03, chargerK03 } from '@/screens/compte/appels';
import { useCallback, useState } from 'react';
import { fetchMe } from '@/lib/api/index';
import { lireKyc, statutKyc } from '@/screens/compte/appels';
import { VerificationVivante } from '@/screens/compte/verification-vivante';
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
  /**
   * ── RECHARGER APRÈS UN GESTE ─────────────────────────────────────────────
   *
   * Même recette que la sécurité et la messagerie : `useDonnees` relance son
   * effet quand `charger` CHANGE D'IDENTITÉ, et c'est le seul mécanisme qu'il
   * offre. `fetchMe({ force: true })` est indispensable — la réponse de `/me` est
   * en cache, et sans forçage un numéro ajouté ou une vérification lancée ne se
   * verraient qu'au rechargement complet de la page.
   *
   * LE STATUT KYC VOYAGE À PART du chargeur du cadre : `K03Data` décrit ce que la
   * planche DESSINE — trois pastilles de niveau — et le statut n'y a pas de
   * place. Le lui ajouter pour le seul besoin du libellé d'un bouton mélangerait
   * deux choses.
   */
  const [recharge, setRecharge] = useState(0);
  const [kyc, setKyc] = useState<string | null>(null);
  /**
   * LE DÉTAIL KYC, pour la carte « ÉTATS KYC ». `GET /me/kyc` donne le statut, la
   * date de nouvelle tentative et `isMinor` — ce que `/me` ne porte pas. La
   * lecture est TOLÉRANTE : `lireKyc` rend `null` plutôt que de jeter quand la
   * route refuse, et la carte redevient alors la légende qu'elle était.
   */
  const [detail, setDetail] = useState<{
    status: string;
    retryAvailableAt: string | null;
    isMinor: boolean;
  } | null>(null);
  const charger = useCallback(async () => {
    await fetchMe({ force: true });
    setKyc(await statutKyc());
    setDetail(await lireKyc());
    return chargerK03();
    /** `recharge` n'est lu par personne : il est là POUR changer l'identité. */
  }, [recharge]);
  const recharger = useCallback(() => {
    setRecharge((n) => n + 1);
  }, []);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_K03} charger={charger}>
      {(donnees) => (
        <VerificationVivante
          donnees={donnees}
          statutKyc={kyc}
          detailKyc={detail}
          onRecharger={recharger}
        >
          {(vivantes) => (
            <ScreenFrames
              screen="K03"
              desktop={<K03Desktop {...vivantes} />}
              mobile={<K03Mobile {...vivantes} />}
            />
          )}
        </VerificationVivante>
      )}
    </EcranDonnees>
  );
}
