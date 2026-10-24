'use client';

import { useRouter } from 'next/navigation';

/**
 * La case de VILLE de l'annuaire (S06) — lot E2.
 *
 * La maquette dessine, à droite de la recherche, une pastille « Lyon » : le nom d'une
 * ville d'exemple, écrit en toutes lettres et sans geste. C'est ici une liste des villes
 * du référentiel (`GET /places/cities`), qui filtre `GET /pros?cityId=` par l'adresse
 * `?ville=` — un lien se partage, se recharge et revient en arrière. « Toutes les
 * villes » est le choix par défaut : filtrer d'office sur la ville du membre viderait
 * l'annuaire sans qu'il l'ait demandé.
 *
 * Mêmes mesures que la pastille dessinée : 200 × 48 px, rayon 999, liseré `#E6EBE9`,
 * retrait 18, icône de repère `#8A958F`. Sur 390 px la planche ne la dessine pas : la
 * pastille y prend la largeur de la colonne, à 44 px comme la recherche voisine.
 */
export function FiltreVilleAnnuaire({
  villes,
  ville,
  recherche,
  mobile = false,
}: {
  readonly villes: readonly { readonly valeur: string; readonly libelle: string }[];
  readonly ville: string;
  readonly recherche: string;
  readonly mobile?: boolean;
}) {
  const router = useRouter();

  const changer = (valeur: string): void => {
    const params = new URLSearchParams();
    if (recherche !== '') params.set('q', recherche);
    if (valeur !== '') params.set('ville', valeur);
    const suite = params.toString();
    router.push(suite === '' ? '/services/annuaire' : `/services/annuaire?${suite}`);
  };

  return (
    <label
      data-filtre-ville=""
      style={{
        width: mobile ? 'auto' : '200px',
        height: mobile ? '44px' : '48px',
        borderRadius: '999px',
        background: '#fff',
        border: '1px solid #E6EBE9',
        padding: mobile ? '0 16px' : '0 18px',
        display: 'flex',
        alignItems: 'center',
        gap: mobile ? '8px' : '10px',
        fontSize: mobile ? '13.5px' : '14px',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A958F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      </svg>
      <select
        value={ville}
        onChange={(e) => {
          changer(e.target.value);
        }}
        aria-label="Ville"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
          outline: 'none',
          cursor: 'pointer',
          textOverflow: 'ellipsis',
        }}
      >
        {villes.map((v) => (
          <option key={v.valeur} value={v.valeur}>
            {v.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}
