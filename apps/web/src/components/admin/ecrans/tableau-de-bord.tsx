'use client';

import Link from 'next/link';
import { adminDashboardOverviewSchema, adminDashboardResponseSchema, type AdminDashboardOverview } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { vueD02 } from '@/screens/administration/appels';
import type { D02Data } from '@/screens/administration/data';
import { C, Lecture, useCharge } from '../ui';
import { ABSENT, cartesOverview, courbe, lignesAlertes, objectif, pourcentage, pourcentageEntier, variation, type AlerteLigne, type Rangee } from './tableau-de-bord-vue';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D02 · LE TABLEAU DE BORD D'ÉQUIPE, ENTIÈREMENT BRANCHÉ              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine douze cartes et un bandeau d'alertes. Avant ce composant, cinq cartes
 * seulement étaient liées : les sept autres (et l'indicateur clé, et les alertes) montraient
 * un tiret faute de source. Tout est maintenant lu de l'API, sur DEUX routes ouvertes aux
 * quatre rôles (15 §2.2) :
 *
 *   · `GET /admin/dashboard` — les instantanés horaires : membres, parcours, entraide,
 *     guides, services (dérivés par `vueD02`, inchangé et éprouvé) ;
 *   · `GET /admin/dashboard/overview` — l'indicateur clé AVEC son objectif, son écart en
 *     points et sa courbe hebdomadaire, le bandeau d'alertes, la file de modération et son
 *     SLA, la note des parrainages, les événements du mois, les réseaux par type.
 *
 * UNE MESURE ABSENTE EST « — » ET LA CARTE LE DIT (« Pas encore de mesure ») : jamais un
 * nombre inventé. Les REVENUS restent à « — » : le paiement est hors périmètre, tout est
 * gratuit pour le moment, et la carte l'écrit.
 *
 * La géométrie (cartes de 22 px de rayon, étiquettes de 10,5 px, trait `#E6EBE9`, rangées
 * 2fr/1fr puis deux fois cinq colonnes) est celle de la planche D02 ; `admin.css` replie les
 * grilles sous 1 024 px (repères `data-admin-d02-*`) — le tableau de bord ne déborde pas à
 * 390 px.
 */

const carteBase = { background: '#fff', border: `1px solid ${C.trait}`, borderRadius: '22px', flexShrink: 0, minWidth: 0 } as const;
const etiquette = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: C.grisClair } as const;

interface Donnees {
  readonly blocs: D02Data;
  readonly overview: AdminDashboardOverview;
}

async function charger(): Promise<Donnees> {
  const [blocs, overview] = await Promise.all([
    staffApi.get('/dashboard', adminDashboardResponseSchema),
    staffApi.get('/dashboard/overview', adminDashboardOverviewSchema),
  ]);
  return { blocs: vueD02(blocs), overview };
}

export function ContenuTableauDeBord() {
  const { etat, recharger } = useCharge(charger, 'tableau-de-bord');
  return (
    <Lecture etat={etat} recharger={recharger}>
      {(d) => <TableauDeBord blocs={d.blocs} overview={d.overview} />}
    </Lecture>
  );
}

/** La présentation seule : elle ne lit rien, elle est éprouvée sur des charges (`tableau-de-bord.test.tsx`). */
export function TableauDeBord({ blocs, overview }: { readonly blocs: D02Data; readonly overview: AdminDashboardOverview }) {
  const cartes = cartesOverview(overview);
  const aucunInstantane = blocs.aucuneMesure;
  return (
    <>
      {aucunInstantane ? (
        <div role="status" style={{ fontSize: '13px', color: C.gris }}>
          Pas encore de mesure : les indicateurs d’instantané apparaissent après le premier calcul horaire.
        </div>
      ) : null}
      <div data-admin-d02-haut="" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
        <IndicateurCle k={overview.keyIndicator} />
        <Alertes alertes={overview.alerts} />
      </div>
      <div data-admin-d02-cartes="" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
        <Carte titre="Membres" rangees={[
          { libelle: 'Inscrits', valeur: blocs.membres.inscrits },
          { libelle: 'Actifs 30 j', valeur: blocs.membres.actifs30j },
          { libelle: 'Niveau 2', valeur: blocs.membres.niveau2 },
        ]} />
        <Carte titre="Parcours" rangees={[
          { libelle: 'Créés', valeur: blocs.parcours.crees },
          { libelle: 'Actifs', valeur: blocs.parcours.actifs },
          { libelle: 'Aboutis', valeur: blocs.parcours.aboutis },
          { libelle: 'En pause', valeur: blocs.parcours.enPause },
        ]} />
        <Carte titre="Entraide" rangees={[
          { libelle: 'Ouvertes', valeur: blocs.entraide.ouvertes },
          { libelle: 'Résolues', valeur: blocs.entraide.resolues },
          { libelle: 'Délai médian', valeur: blocs.entraide.delaiMedian },
        ]} />
        <Carte titre="Modération" rangees={cartes.moderation} />
        <Carte
          titre="Revenus"
          rangees={[
            { libelle: 'MRR', valeur: ABSENT },
            { libelle: 'Mobile Money', valeur: ABSENT },
            { libelle: 'Affiliation', valeur: ABSENT },
          ]}
          pied="Tout est gratuit pour le moment."
        />
      </div>
      <div data-admin-d02-cartes="" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
        <Carte titre="Guides" rangees={[
          { libelle: 'Publiés', valeur: blocs.guides.publies },
          { libelle: 'À vérifier', valeur: blocs.guides.aVerifier },
        ]} />
        <Carte titre="Parrainage" rangees={cartes.parrainage} />
        <Carte titre="Événements" rangees={cartes.evenements} />
        <Carte titre="Réseaux" rangees={cartes.reseaux} />
        <Carte titre="Services" rangees={[
          { libelle: 'Annonces', valeur: blocs.services.annonces },
          { libelle: 'Fiches pro', valeur: blocs.services.fichesPro },
        ]} />
      </div>
    </>
  );
}

/** Une carte de la grille : étiquette, rangées libellé / valeur, et « Pas encore de mesure » si un tiret y figure. */
export function Carte({ titre, rangees, pied }: { readonly titre: string; readonly rangees: readonly Rangee[]; readonly pied?: string }) {
  const absente = rangees.some((r) => r.valeur === ABSENT);
  return (
    <div style={{ ...carteBase, padding: '16px' }}>
      <div style={etiquette}>{titre.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        {rangees.map((r) => (
          <div key={r.libelle} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: C.gris }}>{r.libelle}</span>
            <strong>{r.valeur}</strong>
          </div>
        ))}
      </div>
      {pied !== undefined ? (
        <div style={{ marginTop: '8px', fontSize: '11.5px', color: C.gris }}>{pied}</div>
      ) : absente ? (
        <div style={{ marginTop: '8px', fontSize: '11.5px', color: C.gris }}>Pas encore de mesure</div>
      ) : null}
    </div>
  );
}

/** L'indicateur clé : le pourcentage, l'écart en points, l'objectif, la courbe hebdomadaire et les villes. */
export function IndicateurCle({ k }: { readonly k: AdminDashboardOverview['keyIndicator'] }) {
  const ecart = variation(k.variationPoints);
  const trace = courbe(k.weekly, k.target);
  const resume =
    k.percent === null
      ? 'Indicateur clé : pas encore de mesure.'
      : `Courbe hebdomadaire de l’indicateur clé : ${pourcentage(k.percent)}, objectif ${objectif(k.target)}.`;
  return (
    <div style={{ ...carteBase, padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 12px', flexWrap: 'wrap' }}>
        <div style={etiquette}>INDICATEUR CLÉ</div>
        <span style={{ fontSize: '12px', color: C.gris }}>Membres présents à au moins un événement sur 90 jours</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 14px', marginTop: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-1.2px' }}>{pourcentage(k.percent)}</span>
        {ecart !== null ? <span style={{ fontSize: '13px', color: C.vert, fontWeight: 700 }}>{ecart}</span> : null}
        <span style={{ fontSize: '12.5px', color: C.terre, fontWeight: 700 }}>objectif {objectif(k.target)}</span>
      </div>
      {k.percent === null ? <div style={{ fontSize: '12px', color: C.gris, marginTop: '2px' }}>Pas encore de mesure</div> : null}
      <svg role="img" aria-label={resume} width="100%" height="120" viewBox="0 0 600 120" preserveAspectRatio="none" style={{ display: 'block' }}>
        <line x1="0" y1={trace.yObjectif} x2="600" y2={trace.yObjectif} stroke="#E0733A" strokeWidth="1.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        {k.weekly.length >= 2 ? (
          <polyline fill="none" stroke={C.vert} strokeWidth="3" points={trace.points} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
      </svg>
      {k.weekly.length === 1 ? (
        <div style={{ fontSize: '12px', color: C.gris }}>Une seule semaine mesurée : la courbe apparaîtra à la suivante.</div>
      ) : null}
      {k.byCity.length === 0 ? (
        <div style={{ marginTop: '6px', fontSize: '12px', color: C.gris }}>Pas encore de mesure par ville.</div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
          {k.byCity.slice(0, 3).map((c) => (
            <span key={c.cityId} style={{ background: '#F2F5F4', color: C.gris, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
              {c.name} · {pourcentageEntier(c.percent)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const TON: Record<AlerteLigne['ton'], string> = { encre: C.encre, terre: C.terre, vert: C.vertFonce };

/** Le bandeau d'alertes : une ligne par alerte à traiter, chacune mène à l'écran qui la traite. */
export function Alertes({ alertes }: { readonly alertes: AdminDashboardOverview['alerts'] }) {
  const lignes = lignesAlertes(alertes);
  return (
    <div style={{ ...carteBase, padding: '20px' }}>
      <div style={etiquette}>ALERTES</div>
      {lignes.length === 0 ? (
        <div style={{ marginTop: '10px', fontSize: '13px', color: C.gris }}>Rien à signaler.</div>
      ) : (
        lignes.map((l, i) => (
          <Link
            key={l.cle}
            href={l.vers}
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i === lignes.length - 1 ? 'none' : `1px solid ${C.traitLeger}`,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: TON[l.ton], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{l.titre}</span>
              <span style={{ display: 'block', fontSize: '12px', color: C.gris }}>{l.detail}</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.grisClair} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ))
      )}
    </div>
  );
}
