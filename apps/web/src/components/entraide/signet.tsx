'use client';

import { useEffect, useState } from 'react';
import { bookmarkStatesResponseSchema } from '@app/shared';
import { z } from 'zod';
import { memberApi } from '@/lib/api/index';
import { useGeste } from './geste';

/**
 * AJOUT — le signet d'une carte d'entraide (H01, H04).
 *
 * L'icône de signet de chaque carte était un `<svg>` sans geste. Elle enregistre la
 * demande dans « Enregistrés » (`PUT /me/bookmarks`, `DELETE /me/bookmarks/HELP_REQUEST/:id`,
 * `HELP_REQUEST` figurant parmi les sujets de §2.9) et se remplit quand c'est fait.
 *
 * L'ÉTAT SE LIT PAR LOT : vingt cartes ne font pas vingt appels. Les signets montés
 * dans le même tour d'horloge sont regroupés en UN `GET /me/bookmarks/states` — la
 * route a été faite pour « dessiner vingt signets d'un coup ». Un échec de lecture
 * laisse le signet vide, et il reste utilisable.
 */
const attente = new Map<string, (enregistre: boolean) => void>();
let planifie = false;

function etatDuSignet(id: string): Promise<boolean> {
  return new Promise((resoudre) => {
    attente.set(id, resoudre);
    if (planifie) return;
    planifie = true;
    setTimeout(() => {
      planifie = false;
      const lot = [...attente.entries()];
      attente.clear();
      void memberApi
        .get(
          `/me/bookmarks/states?subjectType=HELP_REQUEST&ids=${lot.map(([i]) => i).join(',')}`,
          bookmarkStatesResponseSchema,
        )
        .then((r) => {
          const pris = new Set(r.items.map((i) => i.subjectId));
          for (const [i, fin] of lot) fin(pris.has(i));
        })
        .catch(() => {
          for (const [, fin] of lot) fin(false);
        });
    }, 0);
  });
}

export function Signet({ href }: { readonly href: string }) {
  const id = href.split('/').pop() ?? '';
  const { lancer, occupe, fenetre } = useGeste();
  const [pris, setPris] = useState(false);

  useEffect(() => {
    let vivant = true;
    if (id !== '') {
      void etatDuSignet(id).then((v) => {
        if (vivant) setPris(v);
      });
    }
    return () => {
      vivant = false;
    };
  }, [id]);

  return (
    <>
      <button
        type="button"
        disabled={occupe || id === ''}
        aria-pressed={pris}
        aria-label={pris ? 'Retirer des enregistrés' : 'Enregistrer cette demande'}
        data-signet=""
        onClick={() => {
          void lancer(
            () =>
              pris
                ? memberApi.del(`/me/bookmarks/HELP_REQUEST/${id}`, z.unknown())
                : memberApi.put('/me/bookmarks', z.unknown(), { body: { subjectType: 'HELP_REQUEST', subjectId: id } }),
            { succes: pris ? 'Retiré de vos enregistrés.' : 'Demande enregistrée.', recharger: false },
          ).then((ok) => {
            if (ok) setPris(!pris);
          });
        }}
        style={{ background: 'transparent', border: 'none', padding: '4px', display: 'flex', cursor: 'pointer' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={pris ? '#16211D' : 'none'} stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {fenetre}
    </>
  );
}
