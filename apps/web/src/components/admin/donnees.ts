'use client';

import {
  MAX_PAGE_LIMIT,
  adminCitiesResponseSchema,
  adminStepDefinitionsResponseSchema,
  type AdminCity,
  type AdminStepDefinition,
} from '@app/shared';
import { API_BASE, staffApi } from '@/lib/api/index';

/** Les pages au-delà desquelles on REFUSE de continuer (voir `lireToutesLesVilles` de D08). */
const PAGES_MAX = 20;

/**
 * Toutes les villes, en suivant le curseur — jamais `limit=50` seul : une borne écrite à
 * la main devient fausse par accumulation, et personne ne regarde un sélecteur pour
 * vérifier qu'il est complet.
 */
export async function toutesLesVilles(): Promise<readonly AdminCity[]> {
  const villes: AdminCity[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < PAGES_MAX; i += 1) {
    const chemin: string = `/ref/cities?limit=${MAX_PAGE_LIMIT}${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
    const page = await staffApi.get(chemin, adminCitiesResponseSchema);
    villes.push(...page.items);
    if (page.nextCursor === null) return villes;
    cursor = page.nextCursor;
  }
  throw new Error(`Le référentiel des villes dépasse ${PAGES_MAX} pages : ce sélecteur n’est plus la bonne forme.`);
}

export const PHASES: readonly { valeur: string; libelle: string }[] = [
  { valeur: 'PRE_DEPARTURE', libelle: 'Avant le départ' },
  { valeur: 'RECENT_ARRIVAL', libelle: 'Arrivé·e récemment' },
  { valeur: 'SETTLED', libelle: 'Installé·e' },
];

export const libellePhase = (p: string): string => PHASES.find((x) => x.valeur === p)?.libelle ?? p;
export const libellePlan = (p: string): string => (p === 'FREE' ? 'Gratuit' : p === 'PREMIUM' ? 'Premium' : p);

/** Toutes les définitions d'étape, en suivant le curseur (la bibliothèque en compte une trentaine). */
export async function toutesLesDefinitions(): Promise<readonly AdminStepDefinition[]> {
  const out: AdminStepDefinition[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < PAGES_MAX; i += 1) {
    const chemin: string = `/journey-templates/step-definitions?limit=${MAX_PAGE_LIMIT}${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
    const page = await staffApi.get(chemin, adminStepDefinitionsResponseSchema);
    out.push(...page.items);
    if (page.nextCursor === null) return out;
    cursor = page.nextCursor;
  }
  throw new Error('La bibliothèque d’étapes dépasse 20 pages : ce sélecteur n’est plus la bonne forme.');
}

/**
 * Télécharge un export CSV d'équipe (`/audit/export`, `/impact/export`).
 *
 * `staffApi` valide du JSON ; un CSV n'en est pas. Cet appel porte donc le COOKIE
 * d'équipe (`credentials: 'include'`) et rien d'autre — jamais un en-tête
 * `Authorization` — et il reste sous `/v1/admin` : même étanchéité que `staffApi`.
 */
export async function telechargerCsv(chemin: string, nom: string): Promise<void> {
  if (!chemin.startsWith('/') || chemin.includes('..')) throw new Error('Chemin d’export refusé.');
  const reponse = await fetch(`${API_BASE}/admin${chemin}`, { credentials: 'include' });
  if (!reponse.ok) throw new Error(`L’export a échoué (${reponse.status}).`);
  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
