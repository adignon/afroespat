'use client';

import Link from 'next/link';
import { adminDashboardResponseSchema, type AdminDashboardOverview } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { vueD02 } from '@/screens/administration/appels';
import type { D02Data } from '@/screens/administration/data';
import { lireOverview } from '../a-traiter';
import { C, Lecture, useCharge } from '../ui';
import { ABSENT, cartesOverview, courbe, lignesAlertes, objectif, pourcentage, pourcentageEntier, variation, type AlerteLigne, type Rangee } from './tableau-de-bord-vue';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ D02 · LE TABLEAU DE BORD D'ÉQUIPE — UNE HIÉRARCHIE, PAS UNE GRILLE         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine douze cartes égales et un bandeau d'alertes. Tout est lu de l'API, sur DEUX routes ouvertes
 * aux quatre rôles (15 §2.2) :
 *
 *   · `GET /admin/dashboard` — les instantanés horaires : membres, parcours, entraide, guides, services ;
 *   · `GET /admin/dashboard/overview` — l'indicateur clé et sa courbe, les alertes, la file de modération et son SLA,
 *     la note des parrainages, les événements du mois, les réseaux (lue UNE fois pour la page et pour les pastilles
 *     du rail : voir `a-traiter.ts`).
 *
 * L'ordre de lecture suit l'urgence :
 *
 *   1. « À traiter » — ce qui attend une personne, chaque ligne mène à l'écran qui la traite ;
 *   2. l'indicateur clé, en grand, avec son objectif ;
 *   3. les domaines, regroupés (communauté, contenu et offre), chacun avec son chiffre principal en tête et le
 *      détail en dessous — des blocs séparés par un simple filet, pas douze cartes identiques.
 *
 * UNE MESURE ABSENTE EST « — » ET LE BLOC LE DIT (« Pas encore de mesure ») : jamais un nombre inventé. Les REVENUS
 * restent à « — » : le paiement est hors périmètre, tout est gratuit pour le moment, et le bloc l'écrit.
 */

const surface = { background: '#fff', border: `1px solid ${C.trait}`, borderRadius: '16px', minWidth: 0 } as const;
const petitTitre = { margin: 0, fontSize: '12.5px', fontWeight: 700, color: C.gris } as const;
const titreSection = { margin: '6px 0 -2px', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.2px' } as const;

interface Donnees {
  readonly blocs: D02Data;
  readonly overview: AdminDashboardOverview;
}

async function charger(): Promise<Donnees> {
  const [blocs, overview] = await Promise.all([staffApi.get('/dashboard', adminDashboardResponseSchema), lireOverview()]);
  return { blocs: vueD02(blocs), overview };
}

export function ContenuTableauDeBord() {
  const { etat, recharger } = useCharge(charger, 'tableau-de-bord');
  return (
    <Lecture etat={etat} recharger={recharger} forme="tableau-de-bord">
      {(d) => <TableauDeBord blocs={d.blocs} overview={d.overview} />}
    </Lecture>
  );
}

export function TableauDeBord({ blocs, overview }: { readonly blocs: D02Data; readonly overview: AdminDashboardOverview }) {
  const cartes = cartesOverview(overview);
  const aucunInstantane = blocs.aucuneMesure;
  return (
    <>
      <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.8px' }}>Tableau de bord</h1>
      {aucunInstantane ? (
        <div role="status" style={{ fontSize: '13px', color: C.gris }}>
          Pas encore de mesure : les indicateurs d’instantané apparaissent après le premier calcul horaire.
        </div>
      ) : null}
      <div data-admin-d02-haut="" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '14px', alignItems: 'stretch' }}>
        <Alertes alertes={overview.alerts} file={overview.moderation.queue} />
        <IndicateurCle k={overview.keyIndicator} />
      </div>

      <h2 style={titreSection}>Communauté</h2>
      <div data-admin-d02-cartes="" style={groupe}>
        <Carte
          titre="Membres"
          rangees={[
            { libelle: 'Inscrits', valeur: blocs.membres.inscrits },
            { libelle: 'Actifs 30 j', valeur: blocs.membres.actifs30j },
            { libelle: 'Niveau 2', valeur: blocs.membres.niveau2 },
          ]}
        />
        <Carte
          titre="Parcours"
          rangees={[
            { libelle: 'Créés', valeur: blocs.parcours.crees },
            { libelle: 'Actifs', valeur: blocs.parcours.actifs },
            { libelle: 'Aboutis', valeur: blocs.parcours.aboutis },
            { libelle: 'En pause', valeur: blocs.parcours.enPause },
          ]}
        />
        <Carte
          titre="Entraide"
          rangees={[
            { libelle: 'Ouvertes', valeur: blocs.entraide.ouvertes },
            { libelle: 'Résolues', valeur: blocs.entraide.resolues },
            { libelle: 'Délai médian', valeur: blocs.entraide.delaiMedian },
          ]}
        />
        <Carte titre="Parrainage" rangees={cartes.parrainage} />
        <Carte titre="Événements" rangees={cartes.evenements} />
        <Carte titre="Réseaux" rangees={cartes.reseaux} />
      </div>

      <h2 style={titreSection}>Contenu et offre</h2>
      <div data-admin-d02-cartes="" style={groupe}>
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
        <Carte
          titre="Guides"
          rangees={[
            { libelle: 'Publiés', valeur: blocs.guides.publies },
            { libelle: 'À vérifier', valeur: blocs.guides.aVerifier },
          ]}
        />
        <Carte
          titre="Services"
          rangees={[
            { libelle: 'Annonces', valeur: blocs.services.annonces },
            { libelle: 'Fiches pro', valeur: blocs.services.fichesPro },
          ]}
        />
      </div>
    </>
  );
}

/**
 * Les blocs d'un domaine sont posés dans un cadre unique, séparés par un filet de 1 px : le fond du cadre est la
 * couleur du filet, `gap: 1px` le laisse apparaître entre les cellules blanches.
 */
const groupe = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '1px',
  background: C.trait,
  border: `1px solid ${C.trait}`,
  borderRadius: '16px',
  overflow: 'hidden',
} as const;

/**
 * Un bloc de domaine : le titre, le CHIFFRE PRINCIPAL en grand (la première rangée), puis le détail en petit.
 * « Pas encore de mesure » s'il y a un tiret, sauf si le bloc a son propre pied.
 */
export function Carte({ titre, rangees, pied }: { readonly titre: string; readonly rangees: readonly Rangee[]; readonly pied?: string }) {
  const absente = rangees.some((r) => r.valeur === ABSENT);
  const [principale, ...detail] = rangees;
  return (
    <div style={{ background: '#fff', padding: '14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={petitTitre}>{titre}</h3>
      {principale === undefined ? null : (
        <div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1.1 }}>{principale.valeur}</div>
          <div style={{ fontSize: '12px', color: C.gris, marginTop: '2px' }}>{principale.libelle}</div>
        </div>
      )}
      {detail.length === 0 ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderTop: `1px solid ${C.traitLeger}`, paddingTop: '8px' }}>
          {detail.map((r) => (
            <div key={r.libelle} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px' }}>
              <span style={{ color: C.gris }}>{r.libelle}</span>
              <strong>{r.valeur}</strong>
            </div>
          ))}
        </div>
      )}
      {pied !== undefined ? (
        <div style={{ fontSize: '11.5px', color: C.gris }}>{pied}</div>
      ) : absente ? (
        <div style={{ fontSize: '11.5px', color: C.gris }}>Pas encore de mesure</div>
      ) : null}
    </div>
  );
}

/** L'indicateur clé : le pourcentage en grand, l'écart en points, l'objectif, la courbe hebdomadaire et les villes. */
export function IndicateurCle({ k }: { readonly k: AdminDashboardOverview['keyIndicator'] }) {
  const ecart = variation(k.variationPoints);
  const trace = courbe(k.weekly, k.target);
  const resume =
    k.percent === null
      ? 'Indicateur clé : pas encore de mesure.'
      : `Courbe hebdomadaire de l’indicateur clé : ${pourcentage(k.percent)}, objectif ${objectif(k.target)}.`;
  return (
    <section aria-label="Indicateur clé" style={{ ...surface, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 12px', flexWrap: 'wrap' }}>
        <h2 style={{ ...petitTitre, color: C.encre }}>Indicateur clé</h2>
        <span style={{ fontSize: '12px', color: C.gris }}>Membres présents à au moins un événement sur 90 jours</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px 14px', marginTop: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '52px', fontWeight: 800, letterSpacing: '-1.8px', lineHeight: 1.05 }}>{pourcentage(k.percent)}</span>
        {ecart !== null ? <span style={{ fontSize: '14px', color: C.vert, fontWeight: 700 }}>{ecart}</span> : null}
        <span style={{ fontSize: '12.5px', color: C.terre, fontWeight: 700 }}>objectif {objectif(k.target)}</span>
      </div>
      {k.percent === null ? <div style={{ fontSize: '12px', color: C.gris, marginTop: '2px' }}>Pas encore de mesure</div> : null}
      <svg role="img" aria-label={resume} width="100%" height="120" viewBox="0 0 600 120" preserveAspectRatio="none" style={{ display: 'block', marginTop: '6px' }}>
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
            <span key={c.cityId} style={{ background: '#F2F5F4', color: C.gris, fontSize: '11px', fontWeight: 700, padding: '4px 9px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
              {c.name} · {pourcentageEntier(c.percent)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

const TON: Record<AlerteLigne['ton'], string> = { encre: C.encre, terre: C.terre, vert: C.vertFonce };

/**
 * « À traiter » : une ligne par chose qui attend une personne, chacune mène à l'écran qui la traite. `file` est le
 * nombre de dossiers dans la file de modération (de l'overview) ; sans alerte ni dossier, un constat sobre.
 */
export function Alertes({ alertes, file = 0 }: { readonly alertes: AdminDashboardOverview['alerts']; readonly file?: number }) {
  const lignes = lignesAlertes(alertes);
  const enFile: AlerteLigne | null =
    file > 0
      ? { cle: 'file', ton: 'terre', titre: 'File de modération', detail: `${new Intl.NumberFormat('fr-FR').format(file)} dossier${file > 1 ? 's' : ''} ouvert${file > 1 ? 's' : ''}`, vers: '/admin/moderation' }
      : null;
  const toutes = enFile === null ? lignes : [enFile, ...lignes];
  return (
    <section aria-label="À traiter" style={{ ...surface, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ ...petitTitre, color: C.encre }}>À traiter</h2>
      {toutes.length === 0 ? (
        <div style={{ marginTop: '10px', fontSize: '13.5px', color: C.gris, lineHeight: 1.55 }}>
          Rien à signaler.
          {file === 0 ? <span style={{ display: 'block', fontSize: '12.5px' }}>La file de modération est vide et aucune alerte n’attend.</span> : null}
        </div>
      ) : (
        toutes.map((l, i) => (
          <Link
            key={l.cle}
            href={l.vers}
            className="admin-ligne-action"
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              minHeight: '52px',
              padding: '10px 0',
              borderBottom: i === toutes.length - 1 ? 'none' : `1px solid ${C.traitLeger}`,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: TON[l.ton], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{l.titre}</span>
              <span style={{ display: 'block', fontSize: '12.5px', color: C.gris }}>{l.detail}</span>
            </span>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: C.vertFonce, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Traiter
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
