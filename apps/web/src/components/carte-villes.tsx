'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { cityProfileResponseSchema } from '@app/shared';
import { memberApi } from '@/lib/api/index';
import type { PointCarte } from '@/screens/villes/data';
import { MOINS_DU_SEUIL, barresPays, nombre } from '@/screens/villes/from-api';

/**
 * AJOUT — la carte des villes, en SVG LOCAL.
 *
 * La maquette dessine un `<iframe src="Carte Villes.html">` : une page de
 * `docs/template/` qui charge Leaflet et des tuiles OpenStreetMap, et que
 * l'application ne sert pas (404). 09 §2.1 interdit tout service de cartes tiers —
 * « aucune requête vers un service de cartes tiers » — et §2.1 veut « un fond de
 * carte vectoriel léger (France métropolitaine, sans tuiles externes) ». Ce composant
 * en est l'exécution : un contour de la France métropolitaine (quelques dizaines de
 * points, tracés à la main), les villes ACTIVES placées par leurs coordonnées du
 * référentiel (`cities.latitude/longitude`), un cercle par ville dont l'aire suit
 * `member_count`, et le libellé « Lyon · 340 ».
 *
 * Aucune requête réseau n'en part. Aucun script, aucune police, aucune tuile.
 *
 * ── CE QUE LA MAQUETTE DESSINAIT, ET QU'ON GARDE ───────────────────────────
 * Le fond `#EEF2F0`, le cercle `rgba(22,120,94,.22)` au trait `#16785E` de 2 px,
 * la pastille du nombre `#16785E` à encre blanche, l'étiquette blanche au liseré
 * `#E6EBE9`, la fiche `#fff` de 280 px à rayon 20 avec ses barres par pays, et le
 * bouton « Voir la fiche ville » vert. Le cercle de MA ville est terre cuite.
 *
 * ── LA RÈGLE DURE ───────────────────────────────────────────────────────────
 * Une ville dont le compteur est sous le seuil (filtre par pays) arrive en `compte:
 * null` : le libellé dit « moins de 3 », jamais le nombre (09 §2.1). Le composant
 * n'a aucun moyen de le deviner — il ne reçoit pas le vrai chiffre.
 */

/** Le contour de la France métropolitaine, [longitude, latitude], sens horaire. */
const CONTOUR: readonly (readonly [number, number])[] = [
  [2.55, 51.08], [1.85, 50.95], [1.58, 50.73], [1.37, 50.06], [0.6, 49.75], [0.1, 49.5],
  [-0.35, 49.33], [-1.1, 49.4], [-1.62, 49.68], [-1.85, 49.3], [-1.5, 48.64], [-2.0, 48.65],
  [-2.8, 48.6], [-3.4, 48.85], [-4.0, 48.7], [-4.7, 48.45], [-4.75, 48.05], [-4.2, 47.85],
  [-3.4, 47.72], [-3.0, 47.5], [-2.5, 47.3], [-2.2, 47.27], [-2.15, 46.95], [-1.8, 46.5],
  [-1.15, 46.15], [-1.1, 45.7], [-1.05, 45.55], [-1.25, 44.65], [-1.4, 44.1], [-1.55, 43.48],
  [-1.78, 43.37], [-1.3, 43.1], [-0.7, 42.95], [0.2, 42.78], [0.65, 42.8], [1.45, 42.45],
  [1.7, 42.5], [2.0, 42.35], [3.17, 42.43], [3.03, 42.7], [3.1, 43.1], [3.7, 43.4],
  [4.5, 43.4], [5.0, 43.35], [5.35, 43.2], [5.93, 43.1], [6.75, 43.4], [7.1, 43.58],
  [7.5, 43.78], [7.0, 44.2], [6.7, 44.5], [7.05, 45.0], [6.8, 45.15], [7.1, 45.4],
  [6.9, 45.9], [6.8, 46.4], [6.1, 46.25], [6.3, 46.6], [6.95, 47.0], [7.0, 47.5],
  [7.6, 47.6], [7.55, 48.0], [8.2, 48.97], [7.0, 49.2], [6.4, 49.45], [5.8, 49.55],
  [4.85, 50.15], [4.2, 50.3], [3.6, 50.4], [3.1, 50.78],
];

const CORSE: readonly (readonly [number, number])[] = [
  [9.4, 43.0], [9.55, 42.4], [9.4, 41.8], [9.15, 41.38], [8.7, 41.9], [8.6, 42.4], [8.9, 42.6],
];

const LON_MIN = -5.4;
const LON_MAX = 10.0;
const LAT_MIN = 41.1;
const LAT_MAX = 51.4;
/** Un degré de longitude est plus court qu'un degré de latitude : cos(46,5°). */
const ECHELLE_LON = Math.cos((46.5 * Math.PI) / 180);
const ECHELLE = 70;
const LARGEUR = (LON_MAX - LON_MIN) * ECHELLE_LON * ECHELLE;
const HAUTEUR = (LAT_MAX - LAT_MIN) * ECHELLE;

/** Projection équirectangulaire corrigée : suffisante pour une carte d'agrégats. */
export function projeter(longitude: number, latitude: number): readonly [number, number] {
  return [
    (longitude - LON_MIN) * ECHELLE_LON * ECHELLE,
    (LAT_MAX - latitude) * ECHELLE,
  ];
}

const chemin = (points: readonly (readonly [number, number])[]): string =>
  `${points
    .map(([lon, lat], i) => {
      const [x, y] = projeter(lon, lat);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ')} Z`;

/** Le rayon d'un cercle : la racine du compteur, bornée — l'aire suit `member_count`. */
export function rayon(compte: number | null, max: number): number {
  if (compte === null || compte <= 0) return 14;
  return Math.max(14, Math.min(46, 14 + (Math.sqrt(compte) / Math.sqrt(Math.max(1, max))) * 32));
}

export function CarteVilles({
  points,
  maVilleId = null,
  hauteurMin = 360,
  filtre = null,
}: {
  readonly points: readonly PointCarte[];
  /** Le cercle de ma ville est terre cuite, comme dans la maquette. */
  readonly maVilleId?: string | null;
  readonly hauteurMin?: number;
  /** Un filtre posé en haut à gauche (mobile) — absent là où l'écran le porte déjà. */
  readonly filtre?: React.ReactNode;
}) {
  const [choisie, setChoisie] = useState<string | null>(null);
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.compte ?? 0)), [points]);
  // Les gros cercles d'abord : les petits restent cliquables par-dessus.
  const ordre = useMemo(
    () => [...points].sort((a, b) => (b.compte ?? 0) - (a.compte ?? 0)),
    [points],
  );
  const selection = points.find((p) => p.id === choisie) ?? null;

  return (
    <div
      data-carte-villes=""
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: `${hauteurMin}px`, background: '#EEF2F0' }}
    >
      <svg
        viewBox={`0 0 ${LARGEUR.toFixed(0)} ${HAUTEUR.toFixed(0)}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Carte des villes de France et de leurs membres"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      >
        <path d={chemin(CONTOUR)} fill="#fff" stroke="#CBD5D1" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={chemin(CORSE)} fill="#fff" stroke="#CBD5D1" strokeWidth="1.5" strokeLinejoin="round" />
        {ordre.map((p) => {
          const [x, y] = projeter(p.longitude, p.latitude);
          const r = rayon(p.compte, max);
          const moi = p.id === maVilleId;
          const actif = p.id === choisie;
          const libelle = `${p.nom} · ${p.compte === null ? MOINS_DU_SEUIL : nombre(p.compte)}`;
          const largeur = Math.max(70, libelle.length * 7.4 + 20);
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${p.nom}, ${p.compte === null ? MOINS_DU_SEUIL : `${nombre(p.compte)} membres`}`}
              aria-pressed={actif}
              data-ville-pin={p.slug}
              onClick={() => {
                setChoisie(actif ? null : p.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setChoisie(actif ? null : p.id);
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={moi ? 'rgba(224,115,58,.2)' : 'rgba(22,120,94,.22)'}
                stroke={moi ? '#E0733A' : '#16785E'}
                strokeWidth={actif ? 4 : 2}
              />
              <rect x={x - largeur / 2} y={y + r + 6} width={largeur} height={24} rx={12} fill="#fff" stroke="#E6EBE9" />
              <text
                x={x}
                y={y + r + 22}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#16211D"
                style={{ fontFamily: 'inherit' }}
              >
                {libelle}
              </text>
            </g>
          );
        })}
      </svg>

      {filtre === null ? null : (
        <div style={{ position: 'absolute', top: '14px', left: '14px', right: '14px', zIndex: 2 }}>{filtre}</div>
      )}

      <div
        style={{
          position: 'absolute',
          left: '14px',
          bottom: '14px',
          background: '#fff',
          border: '1px solid #E6EBE9',
          borderRadius: '16px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#5D6B66',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i style={{ width: '12px', height: '12px', borderRadius: '999px', border: '2px solid #16785E', background: 'rgba(22,120,94,.22)', display: 'inline-block' }} />
          Un cercle par ville
        </span>
        <span>Aucune position individuelle</span>
      </div>

      {selection === null ? null : <FicheCarte point={selection} onFermer={() => { setChoisie(null); }} />}
    </div>
  );
}

/** La fiche de la ville touchée : région, membres et barres par pays — les mots de la maquette. */
function FicheCarte({ point, onFermer }: { readonly point: PointCarte; readonly onFermer: () => void }) {
  const [barres, setBarres] = useState<readonly { c: string; w: string; n: string }[] | null>(null);

  useEffect(() => {
    let annule = false;
    setBarres(null);
    memberApi
      .get(`/cities/${encodeURIComponent(point.slug)}`, cityProfileResponseSchema)
      .then((p) => {
        if (!annule) setBarres(barresPays(p));
      })
      .catch(() => {
        if (!annule) setBarres([]);
      });
    return () => {
      annule = true;
    };
  }, [point.slug]);

  return (
    <div
      data-carte-fiche=""
      style={{
        position: 'absolute',
        right: '14px',
        bottom: '14px',
        zIndex: 3,
        width: '280px',
        maxWidth: 'calc(100% - 28px)',
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: '20px',
        padding: '16px',
        boxSizing: 'border-box',
        maxHeight: 'calc(100% - 28px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, flex: 1 }}>{point.nom}</h3>
        <button
          type="button"
          aria-label="Fermer la fiche"
          onClick={onFermer}
          style={{ border: 'none', background: '#F2F5F4', borderRadius: '999px', width: '28px', height: '28px', cursor: 'pointer', font: 'inherit' }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: '12.5px', color: '#5D6B66', marginTop: '2px' }}>
        {[point.region ?? '', point.compte === null ? MOINS_DU_SEUIL : `${nombre(point.compte)} membres`]
          .filter((x) => x !== '')
          .join(' · ')}
      </div>
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {barres === null ? (
          <span style={{ fontSize: '12px', color: '#8A958F' }}>Chargement…</span>
        ) : (
          barres.map((b) => (
            <div key={b.c} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ width: '84px' }}>{b.c}</span>
              <i style={{ flex: 1, height: '6px', borderRadius: '999px', background: '#EEF2F0', overflow: 'hidden', display: 'block' }}>
                <b style={{ display: 'block', height: '100%', width: b.w, background: '#16785E' }} />
              </i>
              <strong>{b.n}</strong>
            </div>
          ))
        )}
      </div>
      <Link
        href={`/villes/${point.slug}`}
        data-carte-voir-fiche=""
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '14px',
          height: '42px',
          borderRadius: '14px',
          background: '#16785E',
          color: '#fff',
          fontSize: '13.5px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Voir la fiche ville
      </Link>
    </div>
  );
}
