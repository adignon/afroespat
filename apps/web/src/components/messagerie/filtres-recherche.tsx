'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  SEARCH_DEFAULT_RADIUS_KM,
  placesCitiesResponseSchema,
  placesCountriesResponseSchema,
  type PlacesCity,
  type PlacesCountry,
} from '@app/shared';
import { memberApi } from '@/lib/api/index';
import type { ValeursFiltresRecherche } from '@/screens/x01/data';
import { adresseRecherche, FILTRES_VIDES } from '@/screens/x01/filtres';

/**
 * AJOUT HORS MAQUETTE — les filtres de la recherche : ville, rayon, pays, période,
 * état (11 §2.3, `GET /search?cityId&radiusKm&countryId&period&state`).
 *
 * La maquette X01 dessine quatre pastilles mortes — « Lyon ▾ », « Pays ▾ »,
 * « Période ▾ », « État ▾ » — et le serveur traite pourtant ces cinq paramètres. Les
 * pastilles deviennent de vrais `<select>`, avec EXACTEMENT leur dessin
 * (`padding:8px 13px; border-radius:999px; font-size:12.5px; font-weight:700`, fond
 * blanc, trait `#E6EBE9`) ; un filtre posé prend le vert des pastilles actives du
 * module (`#16785E`, texte blanc). Aucune couleur nouvelle.
 *
 * LE FILTRE VIT DANS L'URL (`?ville=&rayon=&pays=&periode=&etat=`), comme `?q=` et
 * `?type=` : partageable, il survit au rechargement, et la page serveur le lit sans
 * `useSearchParams()` (qui ferait échouer `next build` sans Suspense).
 *
 * Le RAYON n'a de sens qu'AVEC une ville (c'est un rayon autour d'elle) : il
 * n'apparaît qu'une ville choisie, et vaut `SEARCH_DEFAULT_RADIUS_KM` par défaut.
 */
const RAYONS = [5, 10, 30, 50, 100] as const;

const PERIODES: readonly { readonly valeur: string; readonly libelle: string }[] = [
  { valeur: 'all', libelle: 'Toute période' },
  { valeur: '7d', libelle: '7 derniers jours' },
  { valeur: '30d', libelle: '30 derniers jours' },
];

const ETATS: readonly { readonly valeur: string; readonly libelle: string }[] = [
  { valeur: '', libelle: 'Tous les états' },
  { valeur: 'open', libelle: 'Ouvert' },
  { valeur: 'resolved', libelle: 'Résolu' },
];

function style(actif: boolean, mobile: boolean): CSSProperties {
  return {
    padding: mobile ? '0 13px' : '8px 13px',
    height: mobile ? '36px' : undefined,
    minHeight: mobile ? '44px' : undefined,
    borderRadius: '999px',
    fontSize: '12.5px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    background: actif ? '#16785E' : '#fff',
    color: actif ? '#fff' : '#16211D',
    border: `1px solid ${actif ? '#16785E' : '#E6EBE9'}`,
    font: 'inherit',
    cursor: 'pointer',
    maxWidth: '220px',
  };
}

export function FiltresRecherche({
  requete,
  type: typePose,
  valeurs: valeursPosees,
  mobile,
}: {
  readonly requete: string;
  readonly type?: string | null | undefined;
  readonly valeurs?: ValeursFiltresRecherche | undefined;
  readonly mobile: boolean;
}) {
  const valeurs = valeursPosees ?? FILTRES_VIDES;
  const type = typePose ?? null;
  const routeur = useRouter();
  const [villes, setVilles] = useState<readonly PlacesCity[]>([]);
  const [pays, setPays] = useState<readonly PlacesCountry[]>([]);
  const [panne, setPanne] = useState(false);

  useEffect(() => {
    let vivant = true;
    void Promise.all([
      memberApi.get('/places/cities?activeOnly=false', placesCitiesResponseSchema),
      memberApi.get('/places/countries', placesCountriesResponseSchema),
    ])
      .then(([c, p]) => {
        if (!vivant) return;
        setVilles(c.items);
        setPays(p.items);
      })
      .catch(() => {
        // Les listes manquent : les filtres restent là, vides, et le disent.
        if (vivant) setPanne(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const changer = (suite: Partial<ValeursFiltresRecherche>): void => {
    routeur.push(adresseRecherche({ requete, type, valeurs: { ...valeurs, ...suite } }));
  };

  const rayon = valeurs.rayon ?? SEARCH_DEFAULT_RADIUS_KM;

  return (
    <div
      data-recherche-filtres=""
      style={{
        display: 'flex',
        gap: '6px',
        flexWrap: mobile ? 'nowrap' : 'wrap',
        flexShrink: 0,
        ...(mobile ? { overflowX: 'auto', padding: '0 16px 10px' } : {}),
      }}
    >
      <select
        aria-label="Ville"
        value={valeurs.ville ?? ''}
        onChange={(e) => {
          changer({ ville: e.target.value === '' ? null : e.target.value, rayon: null });
        }}
        style={style(valeurs.ville !== null, mobile)}
      >
        <option value="">{panne ? 'Villes indisponibles' : 'Toutes les villes'}</option>
        {villes.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      {valeurs.ville === null ? null : (
        <select
          aria-label="Rayon autour de la ville"
          value={String(rayon)}
          onChange={(e) => {
            changer({ rayon: Number(e.target.value) });
          }}
          style={style(valeurs.rayon !== null, mobile)}
        >
          {RAYONS.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Pays"
        value={valeurs.pays ?? ''}
        onChange={(e) => {
          changer({ pays: e.target.value === '' ? null : e.target.value });
        }}
        style={style(valeurs.pays !== null, mobile)}
      >
        <option value="">Tous les pays</option>
        {pays.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nameFr}
          </option>
        ))}
      </select>
      <select
        aria-label="Période"
        value={valeurs.periode}
        onChange={(e) => {
          changer({ periode: e.target.value });
        }}
        style={style(valeurs.periode !== 'all', mobile)}
      >
        {PERIODES.map((p) => (
          <option key={p.valeur} value={p.valeur}>
            {p.libelle}
          </option>
        ))}
      </select>
      <select
        aria-label="État"
        value={valeurs.etat ?? ''}
        onChange={(e) => {
          changer({ etat: e.target.value === '' ? null : e.target.value });
        }}
        style={style(valeurs.etat !== null, mobile)}
      >
        {ETATS.map((x) => (
          <option key={x.valeur} value={x.valeur}>
            {x.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}
