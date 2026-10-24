'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { bookmarkStatesResponseSchema } from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';

/**
 * AJOUT — le signet d'une annonce, d'une offre ou d'une fiche pro (S01, S02, S04,
 * S05, S07 : l'icône de signet de la maquette est un dessin sans geste).
 *
 * Même route que le signet de l'entraide (`PUT /me/bookmarks`, `DELETE
 * /me/bookmarks/:type/:id`), pour trois autres sujets de §2.9 des enregistrés :
 * `HOUSING`, `JOB` et `PRO`. L'état « déjà enregistré » se lit en LOT
 * (`/me/bookmarks/states`) : vingt cartes ne font qu'une requête par genre.
 *
 * Posé dans une carte-lien, le bouton ne fait QUE son geste : le clic n'ouvre pas la
 * fiche.
 */
export type SujetSignet = 'HOUSING' | 'JOB' | 'PRO';

const attente = new Map<SujetSignet, Map<string, (enregistre: boolean) => void>>();
const planifie = new Set<SujetSignet>();

function etatDuSignet(type: SujetSignet, id: string): Promise<boolean> {
  return new Promise((resoudre) => {
    const file = attente.get(type) ?? new Map<string, (enregistre: boolean) => void>();
    attente.set(type, file);
    file.set(id, resoudre);
    if (planifie.has(type)) return;
    planifie.add(type);
    setTimeout(() => {
      planifie.delete(type);
      const lot = [...(attente.get(type) ?? new Map()).entries()];
      attente.delete(type);
      void (async () => {
        try {
          if (!hasAccessToken()) await resumeSession();
          const r = await memberApi.get(
            `/me/bookmarks/states?subjectType=${type}&ids=${lot.map(([i]) => i).join(',')}`,
            bookmarkStatesResponseSchema,
          );
          const pris = new Set(r.items.map((i) => i.subjectId));
          for (const [i, fin] of lot) fin(pris.has(i));
        } catch {
          for (const [, fin] of lot) fin(false);
        }
      })();
    }, 0);
  });
}

const LIBELLES: Record<SujetSignet, string> = {
  HOUSING: 'cette annonce',
  JOB: 'cette offre',
  PRO: 'cette fiche',
};

export function SignetSujet({
  type,
  id,
  taille = 16,
}: {
  readonly type: SujetSignet;
  readonly id: string;
  readonly taille?: number;
}) {
  const { lancer, occupe, fenetre } = useGeste();
  const [pris, setPris] = useState(false);

  useEffect(() => {
    let vivant = true;
    if (id !== '') {
      void etatDuSignet(type, id).then((v) => {
        if (vivant) setPris(v);
      });
    }
    return () => {
      vivant = false;
    };
  }, [id, type]);

  return (
    <>
      <button
        type="button"
        disabled={occupe || id === ''}
        aria-pressed={pris}
        aria-label={pris ? 'Retirer des enregistrés' : `Enregistrer ${LIBELLES[type]}`}
        data-signet=""
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void lancer(
            () =>
              pris
                ? memberApi.del(`/me/bookmarks/${type}/${id}`, z.unknown())
                : memberApi.put('/me/bookmarks', z.unknown(), { body: { subjectType: type, subjectId: id } }),
            { succes: pris ? 'Retiré de vos enregistrés.' : 'Enregistré.', recharger: false },
          ).then((ok) => {
            if (ok) setPris(!pris);
          });
        }}
        style={{ background: 'transparent', border: 'none', padding: '4px', display: 'flex', cursor: 'pointer' }}
      >
        <svg width={taille} height={taille} viewBox="0 0 24 24" fill={pris ? '#16211D' : 'none'} stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {fenetre}
    </>
  );
}
