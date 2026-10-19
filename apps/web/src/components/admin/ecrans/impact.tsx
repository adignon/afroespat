'use client';

import { useMemo } from 'react';
import { adminImpactResponseSchema } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { telechargerCsv, toutesLesVilles } from '../donnees';
import { Bandeau, Bouton, C, Carte, Colonnes, Etiquette, Lecture, Message, Titre, Vide, nombreFr, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D16 · LE RAPPORT D'IMPACT TRIMESTRIEL (15 §5.3)                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Pour les financeurs : membres accompagnés, parcours aboutis, présences aux événements,
 * entraides résolues, parrainages menés, répartition par ville et par pays d'origine.
 * `GET /admin/impact` rend les points du dernier trimestre CLOS (`trimestre`, jamais déduit
 * de l'horloge du navigateur).
 *
 * RÈGLE DURE : « toutes les données sont agrégées, jamais nominatives ». Aucune route
 * n'envoie d'identifiant de membre ; les seules dimensions sont des villes et des pays,
 * dont l'écran résout les NOMS.
 *
 * ⚠ ÉCARTS REMONTÉS :
 *   · pas de sélecteur de trimestre : l'API ne garde que le dernier calcul par indicateur,
 *     un sélecteur laisserait croire à un historique qui n'existe pas ;
 *   · l'export est un CSV (`GET /admin/impact/export`), pas un PDF — aucune bibliothèque de
 *     rendu PDF dans l'API. « Imprimer » ouvre la boîte d'impression du navigateur, qui sait
 *     enregistrer en PDF ; les contrôles de la page sont masqués à l'impression.
 *   · « témoignages avec accord de l'auteur » (colonne `quotable`) : non livrés.
 */

const TUILES: readonly { metric: string; libelle: string }[] = [
  { metric: 'impact.members_accompanied', libelle: 'membres accompagnés' },
  { metric: 'impact.journeys_completed', libelle: 'parcours aboutis' },
  { metric: 'impact.event_attendances', libelle: 'présences à des événements' },
  { metric: 'impact.help_resolved', libelle: 'entraides résolues' },
  { metric: 'impact.guides_published', libelle: 'guides produits' },
  { metric: 'impact.mentorships_completed', libelle: 'parrainages menés' },
];

export function ContenuImpact() {
  const { etat, recharger } = useCharge(() => staffApi.get('/impact', adminImpactResponseSchema), 'impact');
  const villes = useCharge(() => toutesLesVilles(), 'villes');
  const geste = useGeste();

  const noms = useMemo(() => {
    const m = new Map<string, string>();
    if (villes.etat.phase === 'pret') {
      for (const v of villes.etat.donnees) {
        m.set(v.id, v.name);
        m.set(v.country.id, v.country.nameFr);
      }
    }
    return m;
  }, [villes.etat]);

  return (
    <Lecture etat={etat} recharger={recharger}>
      {(d) => {
        const valeur = (metric: string) => d.items.find((i) => i.metric === metric && i.dimension === '')?.value ?? null;
        const tranches = (metric: string) =>
          d.items
            .filter((i) => i.metric === metric && i.dimension !== '')
            .map((i) => ({ nom: noms.get(i.dimension) ?? 'Autre', valeur: i.value }))
            .sort((a, b) => b.valeur - a.valeur)
            .slice(0, 8);
        const parVille = tranches('impact.members_by_city');
        const parPays = tranches('impact.members_by_origin_country');
        const vide = d.items.length === 0;
        return (
          <>
            <Titre
              titre="Rapport d’impact"
              sous={`Trimestre ${d.trimestre.replace('-', ' ')} · données agrégées, jamais nominatives`}
              action={
                <div data-no-print="" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Bouton onClick={() => void geste.lancer(() => telechargerCsv('/impact/export', 'rapport-impact.csv'), 'Export téléchargé.')} disabled={geste.occupe}>
                    Exporter (CSV)
                  </Bouton>
                  <Bouton ton="principal" onClick={() => window.print()}>
                    Imprimer / PDF
                  </Bouton>
                </div>
              }
            />
            <Message message={geste.message} />
            {vide ? <Bandeau>Le rapport n’a pas encore de données : les indicateurs d’impact sont calculés à chaque début de trimestre.</Bandeau> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              {TUILES.map((t) => {
                const v = valeur(t.metric);
                return (
                  <Carte key={t.metric}>
                    <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>{v === null ? '—' : nombreFr(Math.round(v))}</div>
                    <div style={{ fontSize: '12.5px', color: C.gris, marginTop: '2px' }}>{t.libelle}</div>
                  </Carte>
                );
              })}
            </div>
            <Colonnes gabarit="minmax(0,1fr) minmax(0,1fr)">
              <Repartition titre="Répartition par ville" lignes={parVille} />
              <Repartition titre="Répartition par pays d’origine" lignes={parPays} />
            </Colonnes>
          </>
        );
      }}
    </Lecture>
  );
}

function Repartition({ titre, lignes }: { readonly titre: string; readonly lignes: readonly { nom: string; valeur: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Etiquette>{titre}</Etiquette>
      {lignes.length === 0 ? (
        <Vide>Pas de répartition calculée.</Vide>
      ) : (
        lignes.map((l) => (
          <div key={l.nom}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600 }}>{l.nom}</span>
              <span>{nombreFr(Math.round(l.valeur))}</span>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: C.aplat }}>
              <div style={{ width: `${Math.round((l.valeur / max) * 100)}%`, height: '8px', borderRadius: '999px', background: C.vert }} />
            </div>
          </div>
        ))
      )}
    </Carte>
  );
}
