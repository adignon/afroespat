'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { helpCanHelpResponseSchema, type HelpCard } from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * AJOUT — l'encart « VOUS POUVEZ AIDER · N » de la colonne de droite (H01, H04).
 *
 * La planche écrit trois suggestions en dur (« Relire une lettre de motivation »,
 * « Traduire un acte de naissance », « Accompagner à la CAF ») servies à tous les
 * membres. Il lit maintenant les trois premières de `GET /help/can-help` — la liste
 * CALCULÉE de §2.6 (types d'aide déclarés, étapes franchies, échéance proche d'abord)
 * — et chaque ligne mène à la demande. Sans suggestion, l'encart disparaît plutôt que
 * d'afficher un titre sans contenu ; un échec de lecture fait de même (c'est un
 * ornement, pas la page).
 */
export function EncartAider({ nombre }: { readonly nombre: number }) {
  const [items, setItems] = useState<readonly HelpCard[]>([]);
  useEffect(() => {
    let vivant = true;
    void memberApi
      .get('/help/can-help?limit=3', helpCanHelpResponseSchema)
      .then((r) => {
        if (vivant) setItems(r.items);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
        VOUS POUVEZ AIDER · {Math.max(nombre, items.length)}
      </div>
      {items.map((d) => (
        <Link
          key={d.id}
          href={`/entraide/${d.id}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '11px 0', borderBottom: '1px solid #F0F3F2', fontSize: '13px', fontWeight: 600, color: 'inherit', textDecoration: 'none' }}
        >
          <span style={{ minWidth: 0 }}>{d.title}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A958F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
