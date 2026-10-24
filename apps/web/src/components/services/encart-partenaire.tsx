'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { notifyError } from '@/components/notifications';
import { ApiError, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';

/**
 * AJOUT — l'encart partenaire du pied de la section Logement (S01, 10 §2 / 11 §5.1).
 *
 * La maquette dessine un encart figé (« Partenaire · Garant en ligne pour étudiants
 * étrangers · Découvrir », lien `#`). Il est maintenant celui que le SERVEUR résout :
 * `GET /placements?section=HOUSING` rend l'encart du moment — ou rien, quand le
 * membre n'en voit pas (§5.2 : masqué selon les limites du plan) ; sans encart,
 * RIEN n'est dessiné plutôt qu'un encart inventé.
 *
 * Règles dures de §5 :
 *   · la mention « Partenaire » (`badge`) et le lien de transparence viennent du
 *     serveur et sont TOUJOURS affichés ;
 *   · le clic passe par `POST /placements/:id/click`, qui rend l'URL d'affiliation
 *     — construite côté serveur avec le seul `click_id`. Aucune donnée du membre n'est
 *     ajoutée par ce composant.
 */
const placementSchema = z
  .object({
    placement: z
      .object({
        id: z.string().uuid(),
        headline: z.string(),
        description: z.string().nullable().optional(),
        ctaLabel: z.string(),
        badge: z.string(),
        transparency: z.object({ label: z.string(), url: z.string() }).passthrough(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

type Encart = NonNullable<z.infer<typeof placementSchema>['placement']>;

export function EncartPartenaire() {
  const [encart, setEncart] = useState<Encart | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const r = await memberApi.get('/placements?section=HOUSING', placementSchema, { signal: ac.signal });
        if (!ac.signal.aborted) setEncart(r.placement);
      } catch {
        /* pas d'encart : pas de carte */
      }
    })();
    return () => {
      ac.abort();
    };
  }, []);

  if (encart === null) return null;

  const cliquer = (): void => {
    void memberApi
      .post(`/placements/${encart.id}/click`, z.object({ url: z.string() }).passthrough(), { body: {} })
      .then((r) => {
        window.open(r.url, '_blank', 'noopener,noreferrer');
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof ApiError ? cause.displayMessage : 'Le lien n’a pas pu s’ouvrir.');
      });
  };

  return (
    <div
      data-encart-partenaire=""
      style={{ border: '1.5px dashed #CBD5D1', borderRadius: '22px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', flexWrap: 'wrap' }}
    >
      <span style={{ background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
        {encart.badge}
      </span>
      <span style={{ flex: 1, minWidth: '160px', fontSize: '13.5px', fontWeight: 700 }}>{encart.headline}</span>
      <Link href={encart.transparency.url} style={{ fontSize: '12px', color: '#5D6B66' }}>
        {encart.transparency.label}
      </Link>
      <button
        type="button"
        onClick={cliquer}
        style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: '12.5px', fontWeight: 700, color: '#0F5C48', cursor: 'pointer', padding: 0 }}
      >
        {encart.ctaLabel}
      </button>
    </div>
  );
}
