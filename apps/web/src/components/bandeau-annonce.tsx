'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { activeAnnouncementSchema } from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT SOBRE — LE BANDEAU D'ANNONCE D'ÉQUIPE (15 §4.2)                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Affichées en bandeau en tête de l'accueil, fermables par le membre (fermeture
 * mémorisée côté client), 1 active par membre à la fois (la plus récente ciblée). »
 *
 *   · le CIBLAGE (villes, pays, phases, plans) et le choix de « la plus récente » sont
 *     faits par le SERVEUR (`GET /announcements/active`) : le front reçoit l'annonce ou rien ;
 *   · la fermeture est mémorisée dans `localStorage`, par identifiant d'annonce — une
 *     convenance par navigateur, jamais un état à retrouver : `localStorage` peut manquer
 *     (navigation privée), donc chaque accès est gardé, et sans lui le bandeau revient ;
 *   · seul l'accueil le montre ; il se pose DANS LE FLUX en tête de page, il n'en recouvre
 *     aucune partie ;
 *   · couleurs de la maquette : fond `#E3F0EB`, encre `#0F5C48` (celles de l'aperçu d'annonce
 *     de D12). Aucune nouvelle couleur.
 */

const CLE = (id: string) => `annonce-fermee:${id}`;

function dejaFermee(id: string): boolean {
  try {
    return window.localStorage.getItem(CLE(id)) !== null;
  } catch {
    return false;
  }
}

export function BandeauAnnonce() {
  const chemin = usePathname();
  const [annonce, setAnnonce] = useState<{ id: string; title: string; body: string } | null>(null);

  useEffect(() => {
    if (chemin !== '/accueil') return;
    let annule = false;
    memberApi.get('/announcements/active', activeAnnouncementSchema).then(
      (r) => {
        if (annule || r.announcement === null || dejaFermee(r.announcement.id)) return;
        setAnnonce(r.announcement);
      },
      () => {
        /* Une annonce qu'on ne peut pas lire n'est pas une erreur à montrer. */
      },
    );
    return () => {
      annule = true;
    };
  }, [chemin]);

  if (annonce === null || chemin !== '/accueil') return null;

  const fermer = () => {
    try {
      window.localStorage.setItem(CLE(annonce.id), '1');
    } catch {
      /* Mode privé : le bandeau reviendra au prochain chargement, c'est acceptable. */
    }
    setAnnonce(null);
  };

  return (
    <div role="status" data-annonce="" style={{ background: '#E3F0EB', color: '#0F5C48', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '13.5px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{annonce.title}</strong>
        <span> — {annonce.body}</span>
      </div>
      <button type="button" aria-label="Fermer l’annonce" onClick={fermer} style={{ width: '28px', height: '28px', borderRadius: '999px', border: 'none', background: 'rgba(15,92,72,.12)', color: '#0F5C48', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>
        ×
      </button>
    </div>
  );
}
