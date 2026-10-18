'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchCommunities } from '@/screens/reseaux/api';
import { myNetsFrom } from '@/screens/reseaux/from-api';

type Reseau = ReturnType<typeof myNetsFrom>[number];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « VOS RACCOURCIS » — MES RÉSEAUX, ET NON TROIS NOMS ÉCRITS EN DUR          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « la sidebar n'est pas dynamique ? Aussi sur toutes les autres
 * pages c'est pas réglé aussi ? »
 *
 * MESURÉ : la carte « VOS RACCOURCIS » de la colonne de gauche — commune à quinze
 * planches (accueil, guides, réseaux, villes…) — portait « Lyon & Rhône · 1 400
 * membres », « Béninois en France · 890 membres » et « Recherche Colocation · 210
 * membres », les trois lignes de la maquette, pour tout membre. La spec 00 dit ce
 * qu'elle doit montrer : « VOS RACCOURCIS : mes réseaux (pastille, nom, membres) ·
 * Modifier ».
 *
 * Elle lit donc `GET /communities` — la clé `mine`, mes réseaux — et montre les trois
 * premiers, avec le logo du réseau quand il en a un. « Modifier » mène à la page
 * « Réseaux », où l'on rejoint et quitte. Sans réseau, la carte propose d'en
 * trouver un plutôt que de rester vide.
 *
 * La liste est demandée UNE FOIS par chargement de page et partagée entre les
 * cadres, comme `CarteMonParcours` le fait pour le parcours.
 *
 * Le DESSIN est celui de la maquette, valeur pour valeur (rangée de 50 px, pastille
 * de 32 px de rayon 10, nom 12,5 px gras, sous-ligne 11 px) : seules les valeurs
 * changent. AJOUT pour l'état sans réseau, que la maquette ne dessine pas.
 */
const NOMBRE = 3;

let enCours: Promise<readonly Reseau[]> | null = null;

function demander(): Promise<readonly Reseau[]> {
  return fetchCommunities({})
    .then((r) => myNetsFrom(r.mine).slice(0, NOMBRE))
    .catch(() => {
      // Une liste illisible ne casse pas la colonne : on la redemandera au prochain chargement.
      enCours = null;
      return [];
    });
}

export function RaccourcisReseaux() {
  const [reseaux, setReseaux] = useState<readonly Reseau[] | undefined>(undefined);

  useEffect(() => {
    let vivant = true;
    enCours ??= demander();
    void enCours.then((r) => {
      if (vivant) setReseaux(r);
    });
    return () => {
      vivant = false;
    };
  }, []);

  if (reseaux === undefined)
    return <div style={{ minHeight: '50px' }} data-raccourcis-reseaux="" />;

  if (reseaux.length === 0) {
    return (
      <div
        data-raccourcis-reseaux=""
        style={{ padding: '4px 8px 8px', fontSize: '12.5px', color: '#8A958F' }}
      >
        Aucun réseau pour l’instant.{' '}
        <Link href="/reseaux" style={{ fontWeight: 700, color: '#0F5C48' }}>
          En trouver un
        </Link>
      </div>
    );
  }

  return (
    <div
      data-raccourcis-reseaux=""
      style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
    >
      {reseaux.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          style={{
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '0 8px',
            borderRadius: '14px',
            color: '#16211D',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: r.bg,
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {r.i}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700 }}>{r.name}</span>
            <span style={{ display: 'block', fontSize: '11px', color: '#8A958F' }}>
              {r.members}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
