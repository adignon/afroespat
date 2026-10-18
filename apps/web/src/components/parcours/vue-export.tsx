'use client';

/**
 * AJOUT HORS MAQUETTE — LA PAGE IMPRIMABLE D'UN PARCOURS (J07 « Exporter mon parcours »).
 *
 * Voir `app/(app)/parcours/[id]/export/page.tsx` pour le raisonnement. Le CSS
 * d'impression ne laisse visible que ce document : le rail, la barre haute et la barre
 * basse du gabarit n'ont rien à faire sur une feuille de papier. Aucune note, aucune
 * checklist : on exporte ce qu'on pourrait montrer, c'est-à-dire l'historique des étapes.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { JourneyActivity } from '@app/shared';
import { listJourneyActivitiesPage } from '@/screens/parcours/api';
import { dateComplete, detailEntree, duree, titreEntree } from '@/screens/parcours/appels';
import { Bouton, C, carte } from './ui';
import { Chargeur } from './commun';

const CSS_IMPRESSION = `@media print {
  body * { visibility: hidden !important; }
  #export-parcours, #export-parcours * { visibility: visible !important; }
  #export-parcours { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
  [data-no-print] { display: none !important; }
}`;

function Journal({ journeyId }: { readonly journeyId: string }) {
  const [entrees, setEntrees] = useState<readonly JourneyActivity[]>([]);
  useEffect(() => {
    let annule = false;
    void (async () => {
      let curseur: string | null = null;
      const tout: JourneyActivity[] = [];
      for (let i = 0; i < 10; i += 1) {
        const page = await listJourneyActivitiesPage(journeyId, curseur, 50);
        tout.push(...page.items);
        curseur = page.nextCursor;
        if (curseur === null) break;
      }
      if (!annule) setEntrees(tout);
    })().catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [journeyId]);
  return (
    <>
      <h2 style={{ fontSize: '16px', margin: '24px 0 8px' }}>Journal</h2>
      {entrees.map((a) => (
        <div key={a.id} style={{ fontSize: '13px', padding: '4px 0' }}>
          {new Date(a.createdAt).toLocaleDateString('fr-FR')} — {titreEntree(a)}
          {detailEntree(a) === '' ? '' : ` (${detailEntree(a)})`}
        </div>
      ))}
    </>
  );
}

export function VueExport() {
  return (
    <Chargeur
      enfants={(parcours, vue) => (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '800px', margin: '0 auto' }}>
          <style>{CSS_IMPRESSION}</style>
          <div data-no-print="" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href={`/parcours/${vue.id}/historique`} style={{ fontSize: '13px', fontWeight: 700, color: C.vertFonce }}>← Historique</Link>
            <span style={{ flex: 1 }} />
            <Bouton compact onClick={() => window.print()}>Imprimer / Enregistrer en PDF</Bouton>
          </div>
          <article id="export-parcours" style={{ ...carte(28), color: C.texte }}>
            <h1 style={{ margin: 0, fontSize: '26px' }}>{parcours.journey.title}</h1>
            <div style={{ color: C.gris, fontSize: '14px', marginTop: '4px' }}>
              Parcours {parcours.journey.template.nameFr} · {parcours.journey.originCountry.nameFr} → {parcours.journey.destinationCity.name}
              {parcours.journey.targetArrivalDate === null ? '' : ` · départ prévu le ${dateComplete(parcours.journey.targetArrivalDate)}`}
            </div>
            <div style={{ fontSize: '14px', margin: '8px 0 16px' }}>
              {parcours.journey.doneCount} / {parcours.journey.totalCount} étapes franchies ({Math.round(parcours.journey.progressPct)} %)
            </div>
            <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Étapes</h2>
            {parcours.steps.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: '12px', padding: '6px 0', fontSize: '14px', borderBottom: '1px solid #F0F3F2' }}>
                <span style={{ width: '24px', color: C.grisClair }}>{e.position}</span>
                <span style={{ flex: 1 }}>{e.title}</span>
                <span style={{ color: C.gris }}>
                  {e.status === 'DONE' ? `franchie${e.durationDays === null ? '' : ` en ${duree(e.durationDays)}`}` : e.status === 'IN_PROGRESS' ? 'en cours' : e.status === 'PAUSED' ? 'en pause' : 'à faire'}
                </span>
              </div>
            ))}
            {parcours.viewerRole === 'OWNER' ? <Journal journeyId={vue.id} /> : null}
          </article>
        </div>
      )}
    />
  );
}
