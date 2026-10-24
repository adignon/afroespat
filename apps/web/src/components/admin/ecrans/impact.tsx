'use client';

import { useMemo, useState } from 'react';
import {
  IMPACT_QUOTE_MAX,
  IMPACT_QUOTE_MIN,
  adminImpactCandidatesSchema,
  adminImpactReportSchema,
  okResponseSchema,
  type AdminImpactCandidates,
  type AdminImpactReport,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { telechargerCsv, toutesLesVilles } from '../donnees';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Colonnes, Etiquette, Lecture, Message, Selecteur, Titre, Vide, ZoneTexte, dateLongue, nombreFr, useCharge, useGeste } from '../ui';
import { TYPE_CITATION, extraitProposable, libelleTrimestre, nomFichierCsv, optionsTrimestres } from './impact-vue';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D16 · LE RAPPORT D'IMPACT TRIMESTRIEL (15 §5.3)                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Pour les financeurs : membres accompagnés, parcours aboutis, présences aux événements,
 * entraides résolues, guides, parrainages menés, répartition par ville et par pays d'origine,
 * témoignages consentis.
 *
 * ─── DÉCISION DU PORTEUR : « IL FAUT TOUT CONSERVER » ───────────────────────────
 *
 * Chaque calcul d'un trimestre est conservé (`impact_report_snapshots`, une révision par
 * recalcul, jamais écrasée). Le SÉLECTEUR de trimestre relit l'historique : on ouvre T2
 * comme T3, et un recalcul pose une révision de plus sans effacer la précédente.
 *
 * ─── TÉMOIGNAGES : TROIS CONDITIONS ─────────────────────────────────────────────
 *
 *   1. l'auteur a coché « autoriser la citation » (`quotable`) sur son contenu ;
 *   2. l'équipe a APPROUVÉ l'extrait (modération : elle le raccourcit ou le corrige) ;
 *   3. l'accord tient encore à l'affichage : l'auteur qui le retire fait disparaître sa
 *      citation du rapport.
 * Le rapport ne montre NI nom NI identifiant d'auteur : « agrégé, jamais nominatif ».
 *
 * ─── EXPORT ET IMPRESSION ───────────────────────────────────────────────────────
 *
 * « Exporter (CSV) » rend le trimestre AFFICHÉ (`GET /admin/impact/export?quarter=`) ; « Imprimer / PDF »
 * ouvre la boîte d'impression du navigateur, qui enregistre en PDF (aucune bibliothèque de rendu
 * PDF dans l'API). La FEUILLE D'IMPRESSION (`admin.css`, `@media print`) masque le rail, la barre
 * haute, le sélecteur, les boutons et le panneau de choix des citations ; elle garde le titre, le
 * trimestre, la date de calcul, les chiffres, les répartitions et les témoignages.
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
  const [choix, setChoix] = useState<string | undefined>(undefined);
  const { etat, recharger } = useCharge(
    () => staffApi.get(choix === undefined ? '/impact' : `/impact?quarter=${encodeURIComponent(choix)}`, adminImpactReportSchema),
    `impact-${choix ?? 'dernier'}`,
  );
  const villes = useCharge(() => toutesLesVilles(), 'villes');

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
      {(d) => <Rapport rapport={d} noms={noms} onChoisir={setChoix} onChange={recharger} />}
    </Lecture>
  );
}

function Rapport({
  rapport: d,
  noms,
  onChoisir,
  onChange,
}: {
  readonly rapport: AdminImpactReport;
  readonly noms: ReadonlyMap<string, string>;
  readonly onChoisir: (q: string) => void;
  readonly onChange: () => void;
}) {
  const geste = useGeste();
  const peutEcrire = useDroit('content');
  const valeur = (metric: string) => d.items.find((i) => i.metric === metric && i.dimension === '')?.value ?? null;
  const tranches = (metric: string) =>
    d.items
      .filter((i) => i.metric === metric && i.dimension !== '')
      .map((i) => ({ nom: noms.get(i.dimension) ?? 'Autre', valeur: i.value }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 8);
  const vide = d.revision === null;
  const sous =
    d.computedAt === null
      ? `${libelleTrimestre(d.trimestre)} · données agrégées, jamais nominatives`
      : `${libelleTrimestre(d.trimestre)} · calculé le ${dateLongue(d.computedAt)} · révision ${d.revision} · données agrégées, jamais nominatives`;

  const recalculer = () =>
    void geste
      .lancer(() => staffApi.post('/impact/recompute', okResponseSchema, { body: { quarter: d.trimestre } }), vide ? 'Trimestre calculé.' : 'Nouvelle révision conservée : la précédente reste consultable.')
      .then((ok) => {
        if (ok) onChange();
      });

  return (
    <>
      <Titre
        titre="Rapport d’impact"
        sous={sous}
        action={
          <div data-no-print="" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: '230px' }}>
              <Selecteur libelle="Trimestre" valeur={d.trimestre} onChange={onChoisir} options={optionsTrimestres(d.quarters, d.trimestre)} />
            </div>
            <Bouton
              onClick={() => void geste.lancer(() => telechargerCsv(`/impact/export?quarter=${encodeURIComponent(d.trimestre)}`, nomFichierCsv(d.trimestre)), 'Export téléchargé.')}
              disabled={geste.occupe}
            >
              Exporter (CSV)
            </Bouton>
            <Bouton ton="principal" onClick={() => window.print()}>
              Imprimer / PDF
            </Bouton>
          </div>
        }
      />
      <div data-no-print="">
        <Message message={geste.message} />
      </div>
      {vide ? (
        <div data-no-print="" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Bandeau>Pas encore de mesure pour ce trimestre : le rapport est calculé au début de chaque trimestre.</Bandeau>
          {peutEcrire ? (
            <Bouton onClick={recalculer} disabled={geste.occupe} petit ton="contour">
              {geste.occupe ? 'Un instant…' : 'Calculer ce trimestre'}
            </Bouton>
          ) : null}
        </div>
      ) : peutEcrire ? (
        <div data-no-print="">
          <Bouton onClick={recalculer} disabled={geste.occupe} petit ton="contour" titre="Pose une révision de plus ; la précédente est conservée">
            {geste.occupe ? 'Un instant…' : 'Recalculer ce trimestre'}
          </Bouton>
        </div>
      ) : null}

      <div data-print-grid="" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        {TUILES.map((t) => {
          const v = valeur(t.metric);
          return (
            <Carte key={t.metric} className="admin-print-carte">
              <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>{v === null ? '—' : nombreFr(Math.round(v))}</div>
              <div style={{ fontSize: '12.5px', color: C.gris, marginTop: '2px' }}>{t.libelle}</div>
            </Carte>
          );
        })}
      </div>
      <Colonnes gabarit="minmax(0,1fr) minmax(0,1fr)">
        <Repartition titre="Répartition par ville" lignes={tranches('impact.members_by_city')} />
        <Repartition titre="Répartition par pays d’origine" lignes={tranches('impact.members_by_origin_country')} />
      </Colonnes>

      <Temoignages temoignages={d.temoignages} />
      {peutEcrire ? <ChoixCitations trimestre={d.trimestre} onChange={onChange} /> : null}
    </>
  );
}

function Repartition({ titre, lignes }: { readonly titre: string; readonly lignes: readonly { nom: string; valeur: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <Carte className="admin-print-carte" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Etiquette>{titre}</Etiquette>
      {lignes.length === 0 ? (
        <Vide>Pas encore de mesure.</Vide>
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

/** Les témoignages APPROUVÉS du trimestre dont l'auteur a donné son accord : l'extrait, le type, la ville — jamais l'auteur. */
export function Temoignages({ temoignages }: { readonly temoignages: AdminImpactReport['temoignages'] }) {
  return (
    <Carte className="admin-print-carte" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Etiquette>Témoignages</Etiquette>
      {temoignages.length === 0 ? (
        <Vide>Aucun témoignage approuvé pour ce trimestre.</Vide>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {temoignages.map((t) => (
            <figure key={t.id} className="admin-print-carte" style={{ margin: 0, background: '#F2F5F4', borderRadius: '18px', padding: '14px 16px' }}>
              <blockquote style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>« {t.quote} »</blockquote>
              <figcaption style={{ marginTop: '8px', fontSize: '12px', color: C.gris }}>
                {TYPE_CITATION[t.kind]}
                {t.cityName === null ? '' : ` · ${t.cityName}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Carte>
  );
}

/**
 * Le choix des citations — PANNEAU D'ÉQUIPE, jamais imprimé. Ne propose QUE les contenus dont l'auteur a
 * coché « autoriser la citation » ; l'équipe approuve (et peut raccourcir) l'extrait, ou le retire.
 */
function ChoixCitations({ trimestre, onChange }: { readonly trimestre: string; readonly onChange: () => void }) {
  const { etat, recharger } = useCharge(() => staffApi.get(`/impact/testimonials?quarter=${encodeURIComponent(trimestre)}`, adminImpactCandidatesSchema), `citations-${trimestre}`);
  return (
    <div data-no-print="">
      <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Etiquette>Choisir les citations</Etiquette>
        <div style={{ fontSize: '13px', color: C.gris }}>
          Seuls les contenus dont l’auteur a coché « autoriser la citation » sont proposés. Vous approuvez l’extrait cité — raccourcissez-le
          ou corrigez-le — ; ni le nom ni l’identifiant de l’auteur n’apparaissent dans le rapport. Si l’auteur retire son accord, la citation
          disparaît du rapport.
        </div>
        <Lecture etat={etat} recharger={recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Vide>Aucun contenu consenti pour l’instant.</Vide>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {d.items.map((c) => (
                  <Candidat
                    key={`${c.kind}-${c.sourceId}`}
                    candidat={c}
                    trimestre={trimestre}
                    onChange={() => {
                      recharger();
                      onChange();
                    }}
                  />
                ))}
              </div>
            )
          }
        </Lecture>
      </Carte>
    </div>
  );
}

function Candidat({
  candidat: c,
  trimestre,
  onChange,
}: {
  readonly candidat: AdminImpactCandidates['items'][number];
  readonly trimestre: string;
  readonly onChange: () => void;
}) {
  const [texte, setTexte] = useState(c.quote?.quote ?? extraitProposable(c.excerpt, IMPACT_QUOTE_MAX));
  const geste = useGeste();
  const longueur = texte.trim().length;
  const valide = longueur >= IMPACT_QUOTE_MIN && longueur <= IMPACT_QUOTE_MAX;
  return (
    <div style={{ border: `1px solid ${C.trait}`, borderRadius: '18px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', color: C.gris }}>
        {TYPE_CITATION[c.kind]}
        {c.title === null ? '' : ` · « ${c.title} »`}
        {c.cityName === null ? '' : ` · ${c.cityName}`}
      </div>
      <ZoneTexte libelle={`Citation (${IMPACT_QUOTE_MIN} à ${IMPACT_QUOTE_MAX} caractères)`} valeur={texte} onChange={setTexte} lignes={3} maxLength={IMPACT_QUOTE_MAX} />
      <div style={{ fontSize: '12px', fontWeight: 700, color: valide ? C.vertFonce : C.gris }}>
        {longueur} / {IMPACT_QUOTE_MAX}
      </div>
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Bouton
          ton="principal"
          disabled={geste.occupe || !valide}
          onClick={() =>
            void geste
              .lancer(
                () => staffApi.put('/impact/quotes', okResponseSchema, { body: { quarter: trimestre, kind: c.kind, sourceId: c.sourceId, quote: texte.trim() } }),
                'Citation approuvée.',
              )
              .then((ok) => {
                if (ok) onChange();
              })
          }
        >
          {c.quote === null ? 'Approuver la citation' : 'Mettre à jour la citation'}
        </Bouton>
        {c.quote === null ? null : (
          <Bouton
            ton="contour"
            disabled={geste.occupe}
            onClick={() =>
              void geste
                .lancer(() => staffApi.del(`/impact/quotes/${c.quote?.id ?? ''}`, okResponseSchema), 'Citation retirée du rapport.')
                .then((ok) => {
                  if (ok) onChange();
                })
            }
          >
            Retirer du rapport
          </Bouton>
        )}
      </div>
    </div>
  );
}
