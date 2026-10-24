'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/index';
import { notifyError, notifySuccess } from '@/components/notifications';
import { useAutresOnglets } from '@/lib/entre-onglets';
import { relireCompteursBarre } from '@/components/barre-haute/compteurs';
import { useEvenements, useRepliPolling } from '@/lib/use-temps-reel';
import type { X02Data } from '../x02/data';
import { marquerLues } from './appels';

/**
 * LES GESTES DE LA PAGE « NOTIFICATIONS » (X02, 12 §2.7 et §4).
 *
 *   · « Tout marquer lu » — `POST /notifications/read { all: true }` ;
 *   · ouvrir une ligne la marque lue — l'état est posé tout de suite (une ligne qui
 *     reste « non lue » le temps de la navigation se lit comme un clic perdu), puis
 *     confirmé par le serveur ; en cas d'échec la ligne est simplement relue au
 *     prochain chargement, rien n'est annoncé pour un détail aussi mince ;
 *   · la liste se relit à `notification.new` (la cloche bouge ailleurs, la page doit
 *     suivre) et, socket coupée, toutes les 15 s.
 */
const LIGNE_LUE = { fond: '#F6F8F7', fondIcone: '#F2F5F4' } as const;

export function NotificationsVivantes({
  donnees,
  onRecharger,
  children,
}: {
  readonly donnees: X02Data;
  readonly onRecharger: () => void;
  readonly children: (enrichies: X02Data) => ReactNode;
}) {
  /** Les lignes que j'ai ouvertes depuis le dernier chargement. */
  const [ouvertes, setOuvertes] = useState<ReadonlySet<string>>(new Set());
  const [toutLu, setToutLu] = useState(false);
  const [enVol, setEnVol] = useState(false);

  useEvenements(['notification.new', 'resync'], onRecharger);
  // Lot F2 : un autre onglet a marqué lu — la liste se relit comme à `notification.new`.
  useAutresOnglets(onRecharger);
  useRepliPolling(onRecharger);

  const ouvrir = useCallback((id: string | undefined): void => {
    if (id === undefined) return;
    setOuvertes((avant) => new Set(avant).add(id));
    void marquerLues({ ids: [id] })
      .then(relireCompteursBarre)
      .catch(() => undefined);
  }, []);

  const toutLire = useCallback((): void => {
    if (enVol) return;
    setEnVol(true);
    marquerLues({ all: true })
      .then(() => {
        setToutLu(true);
        notifySuccess('Toutes vos notifications sont lues.');
        relireCompteursBarre();
        onRecharger();
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'Les notifications n’ont pas pu être marquées lues.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [enVol, onRecharger]);

  const lignes = donnees.lignes.map((l) => {
    const lue = toutLu || (l.id !== undefined && ouvertes.has(l.id));
    const base = lue && l.nonLu ? { ...l, ...LIGNE_LUE, nonLu: false } : l;
    return { ...base, onOuvrir: () => { if (base.nonLu || l.nonLu) ouvrir(l.id); } };
  });
  // Le total vient du serveur ; on en retire les lignes que je viens d'ouvrir (le
  // serveur ne l'a pas encore relu), sans jamais descendre sous zéro.
  const ouvertesNonLues = donnees.lignes.filter((l) => l.nonLu && l.id !== undefined && ouvertes.has(l.id)).length;
  const nonLusTotal = toutLu ? 0 : Math.max(0, donnees.nonLusTotal - ouvertesNonLues);

  return (
    <>
      {children({
        ...donnees,
        lignes,
        nonLusTotal,
        onToutLire: toutLire,
        toutLuBloque: enVol || nonLusTotal === 0,
      })}
    </>
  );
}
