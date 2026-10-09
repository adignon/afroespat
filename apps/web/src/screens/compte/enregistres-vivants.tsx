'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { z } from 'zod';
import type { K10Data, LigneEnregistree } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SIGNET PLEIN RETIRE — K10 §2.9                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * La maquette dessine un signet PLEIN au bout de chaque ligne, avec
 * `title="Retirer"` : elle annonçait le geste dans son infobulle et ne le faisait
 * pas. `DELETE /me/bookmarks/:type/:id` existe maintenant, et le chemin porte le
 * TYPE autant que l'identifiant — la table est polymorphe, deux sujets d'espèces
 * différentes peuvent porter le même UUID. `cle` les transporte ensemble.
 *
 * ── POURQUOI UN RECHARGEMENT, ET PAS UN RETRAIT LOCAL ─────────────────────
 *
 * Retirer une ligne du tableau local serait plus vif, mais FAUX sur deux points
 * visibles à l'œil : le compte sous le titre (« 14 enregistrés ») et les comptes
 * d'onglets viennent de `meta`, que le serveur recalcule. Les laisser en arrière
 * donnerait une page qui montre treize lignes en annonçant quatorze — et c'est
 * exactement le genre d'écart qui fait douter du reste.
 *
 * ── 204, DONC AUCUN CORPS ─────────────────────────────────────────────────
 *
 * `z.unknown()` : la route rend 204 sans contenu. Un schéma qui attendrait un
 * objet ferait échouer un retrait réussi.
 */
export function EnregistresVivants({
  donnees,
  onRecharger,
  children,
}: {
  readonly donnees: K10Data;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K10Data) => ReactNode;
}) {
  const [enVol, setEnVol] = useState(false);

  const retirer = useCallback(
    (cle: string, titre: string) => {
      const coupe = cle.indexOf(':');
      if (coupe < 0) return;
      const type = cle.slice(0, coupe);
      const id = cle.slice(coupe + 1);

      setEnVol(true);
      memberApi
        .del(`/me/bookmarks/${type}/${id}`, z.unknown())
        .then(() => {
          notifySuccess(`« ${titre} » a été retiré de vos enregistrés.`);
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le retrait n’a pas abouti.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [onRecharger],
  );

  const enrichies: K10Data = {
    ...donnees,
    enregistresOccupe: enVol,
    lignes: donnees.lignes.map(
      (l): LigneEnregistree => ({
        ...l,
        onRetirer: () => {
          retirer(l.cle, l.titre);
        },
      }),
    ),
  };

  return <>{children(enrichies)}</>;
}
