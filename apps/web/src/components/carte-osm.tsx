'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import type { Map as CarteLeaflet, Marker } from 'leaflet';
import type { PointCarte } from '@/screens/villes/data';
import { MOINS_DU_SEUIL, nombre } from '@/screens/villes/from-api';

/**
 * AJOUT — la carte des villes sur un fond OpenStreetMap (Leaflet).
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ DÉCISION DU PORTEUR, ET SA PORTÉE EXACTE                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La carte des villes était un SVG local, parce que 09 §2.1 interdisait « toute
 * requête vers un service de cartes tiers ». Le porteur a tranché : une vraie carte
 * OpenStreetMap. Ce qui est AUTORISÉ — et RIEN d'autre :
 *
 *   · AFFICHER des tuiles : le navigateur demande `https://tile.openstreetmap.org/
 *     {z}/{x}/{y}.png`, des images publiques, comme n'importe quel visiteur ;
 *   · l'attribution « © OpenStreetMap » reste visible en permanence (licence ODbL) ;
 *   · le navigateur envoie son `User-Agent` d'origine et un `Referer` limité à
 *     l'origine du site (`referrerPolicy: 'strict-origin-when-cross-origin'`, la
 *     même politique que l'en-tête du site) — c'est ce que la politique d'usage des
 *     tuiles OSM exige d'un client qui n'est pas anonyme.
 *
 * CE QUI RESTE INTERDIT, et que ce composant ne fait pas : AUCUN géocodage (ni
 * Nominatim, ni recherche d'adresse), AUCUNE donnée du membre dans une requête (les
 * tuiles sont demandées par numéro de tuile, pas par position du membre), AUCUNE
 * position individuelle. Les points sont les coordonnées de la table `cities` du
 * référentiel, rendues par `GET /cities` ; la vue de départ cadre la France.
 * La seule chose que les serveurs d'OSM apprennent est ce que n'importe quelle
 * page à fond de carte leur apprend : l'adresse IP du visiteur et la zone regardée.
 *
 * LE REPLI. Si les tuiles ne se chargent pas — hors-ligne, CSP, serveur de tuiles
 * en panne, pare-feu — le composant appelle `onEchec` et `carte-villes.tsx` remet
 * le SVG local d'avant : la carte ne reste jamais blanche. Il faut une raison nette
 * pour y basculer : aucune tuile chargée au bout de 7 s, ou quatre erreurs de tuile
 * sans une seule réussie.
 *
 * Leaflet n'est chargé que dans le navigateur (`import()` dans l'effet) : il lit
 * `window` dès son import, ce que le rendu serveur et les tests n'ont pas.
 */

const TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** La France métropolitaine et la Corse : [sud, ouest], [nord, est]. */
const FRANCE: [[number, number], [number, number]] = [
  [41.2, -5.3],
  [51.2, 9.8],
];
/** On ne laisse pas s'éloigner au-delà de la France et de ses voisins immédiats. */
const LIMITES: [[number, number], [number, number]] = [
  [38.5, -9.5],
  [54.0, 14.0],
];
const DELAI_SANS_TUILE_MS = 7000;
const ERREURS_TOLEREES = 4;

/** Le diamètre d'un cercle, en pixels : l'aire suit `member_count`, comme dans le SVG. */
function diametre(compte: number | null, max: number): number {
  if (compte === null || compte <= 0) return 26;
  return Math.round(
    2 * Math.max(13, Math.min(34, 13 + (Math.sqrt(compte) / Math.sqrt(Math.max(1, max))) * 21)),
  );
}

function echapper(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function libelleDe(p: PointCarte): string {
  return `${p.nom} · ${p.compte === null ? MOINS_DU_SEUIL : nombre(p.compte)}`;
}

/** Le HTML d'un repère : le cercle de la maquette et son étiquette blanche en dessous. */
function repere(
  p: PointCarte,
  max: number,
  moi: boolean,
  actif: boolean,
): { html: string; taille: [number, number] } {
  const d = diametre(p.compte, max);
  const libelle = libelleDe(p);
  const largeur = Math.max(70, Math.round(libelle.length * 7.4 + 20));
  const fond = moi ? 'rgba(224,115,58,.2)' : 'rgba(22,120,94,.22)';
  const trait = moi ? '#E0733A' : '#16785E';
  const html =
    `<div style="position:relative;width:${largeur}px;height:${d + 32}px;display:flex;flex-direction:column;align-items:center;">` +
    `<span style="display:block;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:999px;background:${fond};border:${actif ? 4 : 2}px solid ${trait};"></span>` +
    `<span style="margin-top:6px;height:24px;box-sizing:border-box;padding:0 10px;border-radius:12px;background:#fff;border:1px solid #E6EBE9;font-weight:700;font-size:12px;line-height:22px;font-family:inherit;color:#16211D;white-space:nowrap;">${echapper(libelle)}</span>` +
    '</div>';
  return { html, taille: [largeur, d + 32] };
}

export default function CarteOsm({
  points,
  maVilleId,
  choisie,
  onChoisir,
  onEchec,
}: {
  readonly points: readonly PointCarte[];
  readonly maVilleId: string | null;
  readonly choisie: string | null;
  readonly onChoisir: (id: string | null) => void;
  readonly onEchec: () => void;
}) {
  const conteneur = useRef<HTMLDivElement | null>(null);
  const carte = useRef<CarteLeaflet | null>(null);
  const reperes = useRef<Map<string, { marker: Marker; point: PointCarte }>>(new Map());
  const lib = useRef<typeof import('leaflet') | null>(null);
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.compte ?? 0)), [points]);
  // Les gestionnaires changent à chaque rendu du parent : on lit toujours le dernier.
  const rappels = useRef({ onChoisir, onEchec, choisie });
  rappels.current = { onChoisir, onEchec, choisie };
  // Les points et le maximum « à jour » pour l'effet de création, qui ne se rejoue pas.
  const courant = useRef({ points, max, maVilleId });
  courant.current = { points, max, maVilleId };

  // ── La carte et ses tuiles : créées une fois, détruites au démontage. ──────
  useEffect(() => {
    let vivant = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const el = conteneur.current;
    if (el === null) return undefined;
    // Hors-ligne d'emblée : inutile d'attendre sept secondes.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      rappels.current.onEchec();
      return undefined;
    }
    /**
     * PAS DE CARTE DANS UN CADRE MASQUÉ. L'écran rend ses deux cadres (ordinateur et
     * téléphone) et en cache un par CSS : sans cette garde, chaque page demandait deux
     * fois les mêmes tuiles à OpenStreetMap, dont la moitié pour une carte invisible.
     * La carte ne démarre donc que quand son conteneur a une taille — tout de suite
     * s'il est visible, au premier redimensionnement sinon.
     */
    let demarre = false;
    const demarrer = (): void => {
      if (demarre || !vivant || el.clientWidth === 0) return;
      demarre = true;
      observateur.disconnect();
      lancer();
    };
    const observateur = new ResizeObserver(demarrer);
    observateur.observe(el);
    demarrer();
    function lancer(): void {
      void import('leaflet').then((L) => {
        if (!vivant || conteneur.current === null) return;
        lib.current = L;
        const m = L.map(conteneur.current, {
          zoomControl: false,
          attributionControl: false,
          minZoom: 5,
          maxZoom: 12,
          maxBounds: LIMITES,
          maxBoundsViscosity: 0.8,
          keyboard: true,
        });
        m.fitBounds(FRANCE);
        let reussies = 0;
        let erreurs = 0;
        const couche = L.tileLayer(TUILES, {
          maxZoom: 12,
          // Les tuiles sont des images publiques : aucun cookie, aucun identifiant.
          crossOrigin: false,
          referrerPolicy: 'strict-origin-when-cross-origin',
          detectRetina: false,
        });
        couche.on('tileload', () => {
          reussies += 1;
          if (minuteur !== undefined) {
            clearTimeout(minuteur);
            minuteur = undefined;
          }
        });
        couche.on('tileerror', () => {
          erreurs += 1;
          if (reussies === 0 && erreurs >= ERREURS_TOLEREES) rappels.current.onEchec();
        });
        couche.addTo(m);
        minuteur = setTimeout(() => {
          if (reussies === 0) rappels.current.onEchec();
        }, DELAI_SANS_TUILE_MS);
        L.control
          .zoom({
            position: 'bottomright',
            zoomInTitle: 'Zoom avant',
            zoomOutTitle: 'Zoom arrière',
          })
          .addTo(m);
        // L'attribution OBLIGATOIRE de la licence : sans préfixe « Leaflet », avec un lien.
        L.control
          .attribution({ prefix: false, position: 'bottomright' })
          .addAttribution(
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
          )
          .addTo(m);
        m.on('click', () => {
          rappels.current.onChoisir(null);
        });
        carte.current = m;
        // Les repères, une fois la carte prête.
        for (const p of courant.current.points) ajouter(L, m, p);
      });
    }
    return () => {
      vivant = false;
      observateur.disconnect();
      if (minuteur !== undefined) clearTimeout(minuteur);
      reperes.current.clear();
      carte.current?.remove();
      carte.current = null;
    };
    // La carte ne se recrée pas quand les points changent : l'effet suivant les met à jour.
  }, []);

  function ajouter(L: typeof import('leaflet'), m: CarteLeaflet, p: PointCarte): void {
    const r = repere(
      p,
      courant.current.max,
      p.id === courant.current.maVilleId,
      p.id === rappels.current.choisie,
    );
    const marker = L.marker([p.latitude, p.longitude], {
      icon: L.divIcon({
        html: r.html,
        className: '',
        iconSize: r.taille,
        iconAnchor: [r.taille[0] / 2, (r.taille[1] - 32) / 2],
      }),
      keyboard: true,
      title: libelleDe(p),
      riseOnHover: true,
    });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      rappels.current.onChoisir(rappels.current.choisie === p.id ? null : p.id);
    });
    marker.addTo(m);
    const noeud = marker.getElement();
    if (noeud !== undefined) {
      noeud.setAttribute('data-ville-pin', p.slug);
      noeud.setAttribute('role', 'button');
      noeud.setAttribute(
        'aria-label',
        `${p.nom}, ${p.compte === null ? MOINS_DU_SEUIL : `${nombre(p.compte)} membres`}`,
      );
    }
    reperes.current.set(p.id, { marker, point: p });
  }

  // ── Les points, la ville choisie et « ma ville » : repeints sans recréer la carte. ──
  useEffect(() => {
    const L = lib.current;
    const m = carte.current;
    if (L === null || m === null) return;
    for (const { marker } of reperes.current.values()) marker.remove();
    reperes.current.clear();
    for (const p of points) ajouter(L, m, p);
  }, [points, maVilleId, choisie, max]);

  return (
    <div
      ref={conteneur}
      data-carte-osm=""
      role="group"
      aria-label="Carte des villes de France et de leurs membres"
      style={{
        position: 'absolute',
        inset: 0,
        isolation: 'isolate',
        background: '#EEF2F0',
        fontFamily: 'inherit',
      }}
    />
  );
}
