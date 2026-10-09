'use client';

import { useCallback, useState } from 'react';
import { SQUELETTE_K10, chargerK10 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EnregistresVivants } from '@/screens/compte/enregistres-vivants';
import { ScreenFrames } from '@/screens/frames';
import { K10Desktop } from '@/screens/k10/desktop.generated';
import { K10Mobile } from '@/screens/k10/mobile.generated';

/**
 * K10 — « Enregistrés » (`/compte/enregistres`, T5 §9).
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉCRAN QUI N'AVAIT PAS DE SOURCE EN A UNE                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * Cette page portait, jusqu'à ce jour, le constat exact de son propre trou :
 * « AUCUNE ROUTE N'EXISTE POUR CET ÉCRAN, et c'est le seul des dix dans ce cas ».
 * `apps/api/src/modules/bookmarks/` n'avait qu'un service et sa tâche horaire
 * `bookmark.state_refresh` — qui rafraîchissait les états d'une table que
 * personne ne pouvait ni remplir ni lire.
 *
 * Les quatre routes de §2.9 sont écrites et MESURÉES sur un compte neuf :
 *
 *     PUT    /me/bookmarks            → { id, state: "AVAILABLE" }   ×4
 *     GET    /me/bookmarks            → 4 items, meta.parType { GUIDE: 2, … }
 *     GET    /me/bookmarks/states     → { items: [{ subjectId, state }] }
 *     DELETE /me/bookmarks/GUIDE/:id  → 204, puis meta.total 4 → 3
 *
 * Et le geste qui REMPLIT la liste existait déjà : le signet des cartes du fil
 * (`A01_SIGNET_ET_OPTIONS`) appelle `bookmarkPost` depuis le premier jour. Ce
 * sont ses signets que cette page montre enfin.
 *
 * ── L'ONGLET EST UN ÉTAT DE PAGE, ET IL RECHARGE ──────────────────────────
 *
 * `useDonnees` relance son effet quand `charger` CHANGE D'IDENTITÉ — c'est le
 * seul mécanisme qu'il offre, et les quatre autres écrans de ce module s'en
 * servent déjà pour se rafraîchir après un geste. L'onglet entre donc dans ses
 * dépendances : le changer refait l'appel avec `?subjectType=…`, ce qui est le
 * seul filtre honnête sur une liste paginée (voir `chargerK10`).
 */
export default function EnregistresPage() {
  const [onglet, setOnglet] = useState('*');
  const [recharge, setRecharge] = useState(0);

  const charger = useCallback(() => {
    /** `recharge` n'est lu par personne : il est là POUR changer l'identité. */
    void recharge;
    return chargerK10(onglet, setOnglet);
  }, [onglet, recharge]);

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
      squelette={SQUELETTE_K10} charger={charger}>
      {(donnees) => (
        <EnregistresVivants donnees={donnees} onRecharger={recharger}>
          {(vivantes) => (
            <ScreenFrames
              screen="K10"
              desktop={<K10Desktop {...vivantes} />}
              mobile={<K10Mobile {...vivantes} />}
            />
          )}
        </EnregistresVivants>
      )}
    </EcranDonnees>
  );
}
