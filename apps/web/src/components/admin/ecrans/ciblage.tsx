'use client';

import type { Audience } from '@app/shared';
import { adminCountriesResponseSchema } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { PHASES, libellePlan, toutesLesVilles } from '../donnees';
import { C, useCharge } from '../ui';

/**
 * D12 — LES SÉLECTEURS DE CIBLAGE D'UNE ANNONCE : pays, villes, phases, plans (15 §4.2).
 *
 * Le serveur calculait déjà le ciblage sur les quatre dimensions (`audienceSchema`,
 * `AdminContentService`) ; l'écran n'en proposait que deux (villes, phases). « Pays » est le
 * pays D'ORIGINE du membre (`users.origin_country_id`) — c'est la lecture du serveur, pas un
 * choix de l'écran. Une dimension vide veut dire « tous » : on n'envoie jamais un tableau vide.
 */

export interface Selection {
  readonly countryIds: readonly string[];
  readonly cityIds: readonly string[];
  readonly phases: readonly string[];
  readonly plans: readonly string[];
}

export const SELECTION_VIDE: Selection = { countryIds: [], cityIds: [], phases: [], plans: [] };

/** Les plans proposés, dans l'ordre de `PlanCode`. */
export const PLANS = ['FREE', 'PREMIUM', 'PRO', 'PRO_PLUS'] as const;

/** La sélection de l'écran → le `target` du serveur : `null` si rien n'est coché (tous les membres). */
export function versCible(s: Selection): Audience | null {
  const cible: { -readonly [K in keyof Audience]: Audience[K] } = {};
  if (s.countryIds.length > 0) cible.countryIds = [...s.countryIds];
  if (s.cityIds.length > 0) cible.cityIds = [...s.cityIds];
  if (s.phases.length > 0) cible.phases = [...s.phases] as Audience['phases'] & string[];
  if (s.plans.length > 0) cible.plans = [...s.plans] as Audience['plans'] & string[];
  return Object.keys(cible).length === 0 ? null : cible;
}

/** Le `target` d'une annonce relue → la sélection de l'écran. */
export function depuisCible(
  t: { readonly cityIds?: readonly string[] | undefined; readonly countryIds?: readonly string[] | undefined; readonly phases?: readonly string[] | undefined; readonly plans?: readonly string[] | undefined } | null | undefined,
): Selection {
  return {
    countryIds: t?.countryIds ?? [],
    cityIds: t?.cityIds ?? [],
    phases: t?.phases ?? [],
    plans: t?.plans ?? [],
  };
}

/** Un résumé en français : « Bénin · Lyon, Paris · Installé·e · Premium », ou « Tous les membres ». */
export function resumeCiblage(s: Selection, noms: { pays: ReadonlyMap<string, string>; villes: ReadonlyMap<string, string> }): string {
  const morceaux = [
    s.countryIds.map((id) => noms.pays.get(id) ?? 'Pays inconnu').join(', '),
    s.cityIds.map((id) => noms.villes.get(id) ?? 'Ville inconnue').join(', '),
    s.phases.map((p) => PHASES.find((x) => x.valeur === p)?.libelle ?? p).join(', '),
    s.plans.map(libellePlan).join(', '),
  ].filter((m) => m !== '');
  return morceaux.length === 0 ? 'Tous les membres' : morceaux.join(' · ');
}

const bascule = (liste: readonly string[], v: string): readonly string[] => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

function Pastille({ actif, libelle, onClick, disabled, petit }: { readonly actif: boolean; readonly libelle: string; readonly onClick: () => void; readonly disabled: boolean; readonly petit?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={actif}
      onClick={onClick}
      style={{
        height: petit === true ? '30px' : '34px',
        padding: petit === true ? '0 12px' : '0 14px',
        borderRadius: '999px',
        border: actif ? 'none' : `1px solid ${C.trait}`,
        background: actif ? C.vert : '#fff',
        color: actif ? '#fff' : C.encre,
        font: 'inherit',
        fontSize: petit === true ? '12px' : '12.5px',
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {libelle}
    </button>
  );
}

function Groupe({ titre, children }: { readonly titre: string; readonly children: React.ReactNode }) {
  return (
    <div role="group" aria-label={titre}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: C.gris, marginBottom: '6px' }}>{titre}</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto' }}>{children}</div>
    </div>
  );
}

export function SelecteursCiblage({ valeur, onChange, peut }: { readonly valeur: Selection; readonly onChange: (s: Selection) => void; readonly peut: boolean }) {
  const villes = useCharge(() => toutesLesVilles(), 'villes');
  const pays = useCharge(() => staffApi.get('/ref/countries?limit=50', adminCountriesResponseSchema), 'pays-origine');
  const lesVilles = villes.etat.phase === 'pret' ? villes.etat.donnees.filter((v) => v.isActive) : [];
  // Seuls les pays d'ORIGINE actifs : c'est le pays d'origine du membre que le serveur compare.
  const lesPays = pays.etat.phase === 'pret' ? pays.etat.donnees.items.filter((p) => p.isActive && (p.kind === 'ORIGIN' || p.kind === 'BOTH')) : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700 }}>Ciblage · rien de coché = tous les membres</div>
      <Groupe titre="Pays d’origine">
        {lesPays.map((p) => (
          <Pastille key={p.id} actif={valeur.countryIds.includes(p.id)} libelle={p.nameFr} disabled={!peut} onClick={() => onChange({ ...valeur, countryIds: bascule(valeur.countryIds, p.id) })} />
        ))}
      </Groupe>
      <Groupe titre="Villes">
        {lesVilles.map((v) => (
          <Pastille petit key={v.id} actif={valeur.cityIds.includes(v.id)} libelle={v.name} disabled={!peut} onClick={() => onChange({ ...valeur, cityIds: bascule(valeur.cityIds, v.id) })} />
        ))}
      </Groupe>
      <Groupe titre="Phases">
        {PHASES.map((ph) => (
          <Pastille key={ph.valeur} actif={valeur.phases.includes(ph.valeur)} libelle={ph.libelle} disabled={!peut} onClick={() => onChange({ ...valeur, phases: bascule(valeur.phases, ph.valeur) })} />
        ))}
      </Groupe>
      <Groupe titre="Plans">
        {PLANS.map((p) => (
          <Pastille key={p} actif={valeur.plans.includes(p)} libelle={libellePlan(p)} disabled={!peut} onClick={() => onChange({ ...valeur, plans: bascule(valeur.plans, p) })} />
        ))}
      </Groupe>
    </div>
  );
}
