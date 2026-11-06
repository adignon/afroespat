'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { compteursDuRail, lireOverview } from './a-traiter';
import { entreeDuChemin, navigationPour, type CleCompteur } from './navigation-admin';
import { useEquipe } from './session-equipe';

/**
 * LE RAIL DE L'ADMINISTRATION — remplace, dans les écrans D02 à D17, les quinze liens à plat que la maquette dessine
 * (la substitution est faite par `tools/rail-admin.mjs`, appelée par le générateur d'écrans).
 *
 *   · les entrées viennent de `navigation-admin.ts`, rangées par métier, filtrées par le rôle de la personne
 *     connectée ;
 *   · la page courante est dite par `aria-current="page"` ET par l'apparence (aplat clair) ; la plus spécifique
 *     gagne (voir `entreeDuChemin`) ;
 *   · une pastille chiffrée dit ce qui attend, avec les comptes que l'API de pilotage donne déjà — rien d'inventé,
 *     et pas de pastille à zéro ;
 *   · sous 1 200 px le rail se replie en icônes (les libellés passent en infobulle) ; sous 1 024 px il devient une
 *     bande défilante au-dessus du contenu. Tout cela vit dans `admin.css`, par classes.
 */

const POINT = (n: number): string => new Intl.NumberFormat('fr-FR').format(n);

export function RailAdmin() {
  const chemin = usePathname() ?? '';
  const { equipe } = useEquipe();
  const [comptes, setComptes] = useState<Readonly<Record<CleCompteur, number>> | null>(null);

  useEffect(() => {
    let annule = false;
    lireOverview().then(
      (o) => {
        if (!annule) setComptes(compteursDuRail(o));
      },
      // Sans compteur, le rail reste utilisable : la page elle-même dit son erreur.
      () => undefined,
    );
    return () => {
      annule = true;
    };
  }, []);

  const groupes = navigationPour(equipe?.role ?? null);
  const courante = entreeDuChemin(chemin)?.entree.href ?? null;

  return (
    <div data-admin-rail="" className="admin-rail">
      <Link href="/admin" className="admin-marque" aria-label="DiasporyPlus, administration : tableau de bord">
        <span className="admin-marque-pastille" aria-hidden="true">
          <svg width="26" height="26" viewBox="-6 -18 60 60">
            <g transform="rotate(-35 24 12)">
              <path d="M0 0H10V14H34V24H0Z" fill="#fff" />
              <path d="M14 0H48V24H38V10H14Z" fill="#E0733A" />
            </g>
          </svg>
        </span>
        <span className="admin-marque-nom">Admin</span>
      </Link>
      <nav aria-label="Administration" className="admin-nav">
        {groupes.map((g) => (
          <div key={g.cle} className="admin-nav-groupe">
            <p className="admin-nav-titre">{g.titre}</p>
            <ul className="admin-nav-liste">
              {g.entrees.map((e) => {
                const n = e.compteur === undefined || comptes === null ? 0 : comptes[e.compteur];
                const actif = courante === e.href;
                return (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      className="admin-nav-lien"
                      title={e.libelle}
                      {...(actif ? { 'aria-current': 'page' as const } : {})}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={e.icone} />
                      </svg>
                      <span className="admin-nav-libelle">{e.libelle}</span>
                      {n > 0 ? (
                        <span className="admin-nav-compte" role="img" aria-label={`${POINT(n)} à traiter`}>
                          {n > 99 ? '99+' : POINT(n)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
