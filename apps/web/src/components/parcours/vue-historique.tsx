'use client';

/**
 * AJOUT HORS MAQUETTE — J07 « HISTORIQUE » : LE JOURNAL PAGINÉ, L'EXPORT, LE GUIDE.
 *
 * `GET /journeys/:id/activities` est paginé par curseur ; la planche n'affichait que
 * la première page et ignorait `nextCursor` (le journal s'arrêtait sans raison
 * visible). « Voir plus » demande la page suivante tant que le serveur en rend une.
 * Le journal est réservé au PROPRIÉTAIRE (§3.4) : un accompagnant reçoit un 404, que
 * l'on traduit en « pas pour vous » plutôt qu'en journal vide.
 *
 * « Exporter » ouvre la feuille d'export (page imprimable, `/parcours/:id/export`) ;
 * « Écrire un guide à partir de ce parcours » mène à l'éditeur de guide (§3.8 : le
 * journal est la base de la conversion en guide).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { JourneyActivity } from '@app/shared';
import { displayMessageFor } from '@/lib/api/index';
import { listJourneyActivitiesPage } from '@/screens/parcours/api';
import { detailEntree, ilYA, titreEntree } from '@/screens/parcours/appels';
import { Avis, Attente, Bouton, C, Etiquette, carte } from './ui';
import { Chargeur, EnteteParcours, OngletsMobile } from './commun';
import { ouvrirFeuille } from './feuilles-store';

function Journal({ journeyId }: { readonly journeyId: string }) {
  const [entrees, setEntrees] = useState<readonly JourneyActivity[] | null>(null);
  const [suite, setSuite] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(
    (curseur: string | null) => {
      setOccupe(true);
      listJourneyActivitiesPage(journeyId, curseur).then(
        (page) => {
          setEntrees((avant) => (curseur === null ? page.items : [...(avant ?? []), ...page.items]));
          setSuite(page.nextCursor);
          setEchec(null);
          setOccupe(false);
        },
        (cause: unknown) => {
          setEchec(displayMessageFor(cause));
          setOccupe(false);
        },
      );
    },
    [journeyId],
  );
  useEffect(() => {
    charger(null);
  }, [charger]);

  return (
    <div style={{ ...carte(20), display: 'flex', flexDirection: 'column' }}>
      <Etiquette>JOURNAL DU PARCOURS</Etiquette>
      {entrees === null && echec === null ? <Attente /> : null}
      <Avis texte={echec} ton="erreur" />
      {entrees !== null && entrees.length === 0 ? (
        <div style={{ fontSize: '14px', color: C.gris, padding: '12px 0' }}>Rien ici pour l’instant : le journal se remplit au fil de vos étapes.</div>
      ) : null}
      {(entrees ?? []).map((a, i) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F0F3F2' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: a.type === 'STEP_DONE' ? C.vert : C.orange, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{titreEntree(a)}</div>
            <div style={{ fontSize: '12px', color: C.grisClair }}>
              {ilYA(a.createdAt)}
              {detailEntree(a) === '' ? '' : ` · ${detailEntree(a)}`}
            </div>
          </div>
        </div>
      ))}
      {suite === null ? null : (
        <div style={{ marginTop: '8px' }}>
          <Bouton ton="calme" compact disabled={occupe} onClick={() => charger(suite)}>
            {occupe ? 'Chargement…' : 'Voir plus'}
          </Bouton>
        </div>
      )}
    </div>
  );
}

export function VueHistorique({ compact }: { readonly compact: boolean }) {
  return (
    <Chargeur
      enfants={(parcours, vue) => {
        const proprietaire = parcours.viewerRole === 'OWNER';
        const corps = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EnteteParcours parcours={parcours} compact={compact} />
            {proprietaire ? (
              <>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Bouton compact ton="calme" onClick={() => ouvrirFeuille('exporter')}>
                    Exporter mon parcours
                  </Bouton>
                  <Link href="/guides/nouveau" style={{ height: '42px', padding: '0 18px', borderRadius: '12px', background: C.fond, color: C.texte, fontSize: '13.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                    Écrire un guide à partir de ce parcours
                  </Link>
                </div>
                <Journal journeyId={parcours.journey.id} />
              </>
            ) : (
              <div style={{ ...carte(20), color: C.gris, fontSize: '14px', lineHeight: 1.5 }}>
                Le journal est réservé au propriétaire du parcours : il peut contenir des demandes privées et des notes.
              </div>
            )}
          </div>
        );
        return compact ? (
          <>
            <OngletsMobile id={vue.id} actif="/historique" />
            <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div>
          </>
        ) : (
          corps
        );
      }}
    />
  );
}
