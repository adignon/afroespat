'use client';

import { chargerK10 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K10Desktop } from '@/screens/k10/desktop.generated';
import { K10Mobile } from '@/screens/k10/mobile.generated';

/**
 * K10 — « Enregistrés » (`/compte/enregistres`, T5 §9).
 *
 * AUCUNE ROUTE N'EXISTE POUR CET ÉCRAN, et c'est le seul des dix dans ce cas.
 *
 * `apps/api/src/modules/bookmarks/` ne contient qu'un `bookmarks.service.ts` : il
 * n'y a ni contrôleur, ni `GET /me/bookmarks`, et le mot `bookmark` n'apparaît dans
 * aucun `*.controller.ts` du dépôt — vérifié, pas supposé. Les six lignes de la
 * planche — « Obtenir la garantie Visale sans CDI », « Story de Aïcha », leurs
 * états « Expiré, gardé pour vous », « Plus disponible », « Contenu retiré » —
 * attendent donc une route qui n'est pas écrite.
 *
 * Les libellés d'état, eux, EXISTENT déjà côté texte : `T2` les nomme
 * (`bookmark.state.unavailable`, `bookmark.state.updated`,
 * `bookmark.state.removed`). C'est donc bien la ROUTE qui manque, pas la décision
 * produit. Signalé au porteur ; on ne fabrique pas une source, et cette page ne lit
 * que le bandeau de compte, qui lui est réel.
 */
export default function EnregistresPage() {
  return (
    <EcranDonnees charger={chargerK10}>
      {(donnees) => (
        <ScreenFrames
          screen="K10"
          desktop={<K10Desktop {...donnees} />}
          mobile={<K10Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
