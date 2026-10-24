'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { SEARCH_MIN_QUERY_LENGTH } from '@app/shared';
import { memberApi } from '@/lib/api/index';
import { adresseRecherche, FILTRES_VIDES } from '@/screens/x01/filtres';

/**
 * AJOUTS HORS MAQUETTE — la mémoire de la recherche (11 §2.3, §2.4).
 *
 * Trois petits composants, sans pixel propre ou presque :
 *
 *   · `SignalerRechercheVide` — quand une recherche ne rend rien, `POST /search/zero`
 *     (anonyme côté serveur : un pseudonyme par requête, jamais le membre). Une seule
 *     fois par requête et par page vue : le serveur compte des chercheurs DISTINCTS,
 *     et rejouer le même appel n'apprendrait rien. Un échec est silencieux — c'est un
 *     signal statistique, pas un geste du membre.
 *   · `MemoriserRecherche` / `RecherchesRecentes` — les dernières requêtes, gardées
 *     dans le NAVIGATEUR (`localStorage`), jamais envoyées. Chaque accès est dans un
 *     `try/catch` : le stockage peut être vide, bloqué ou absent (fenêtre privée), et
 *     la page doit s'afficher sans lui.
 */
const CLE = 'afroespat:recherches-recentes';
const MAX_RECENTES = 6;
const dejaSignalees = new Set<string>();

export function SignalerRechercheVide({
  requete,
  ville,
}: {
  readonly requete: string;
  readonly ville: string | null;
}) {
  useEffect(() => {
    const q = requete.trim();
    if (q.length < SEARCH_MIN_QUERY_LENGTH) return;
    const cle = `${q}|${ville ?? ''}`;
    if (dejaSignalees.has(cle)) return;
    dejaSignalees.add(cle);
    void memberApi
      .post('/search/zero', z.unknown(), {
        body: { q, ...(ville === null ? {} : { cityId: ville }) },
      })
      .catch(() => undefined);
  }, [requete, ville]);
  return null;
}

function lire(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE);
    const valeur: unknown = brut === null ? [] : JSON.parse(brut);
    return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function ecrire(liste: readonly string[]): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // Stockage indisponible : la mémoire est un confort, pas une fonction.
  }
}

export function MemoriserRecherche({ requete, nbResultats }: { readonly requete: string; readonly nbResultats: number }) {
  useEffect(() => {
    const q = requete.trim();
    // On ne garde que ce qui a donné quelque chose : une faute de frappe n'a rien à faire là.
    if (q.length < SEARCH_MIN_QUERY_LENGTH || nbResultats === 0) return;
    ecrire([q, ...lire().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENTES));
  }, [requete, nbResultats]);
  return null;
}

export function RecherchesRecentes({ requete }: { readonly requete: string }) {
  const [liste, setListe] = useState<readonly string[]>([]);
  useEffect(() => {
    setListe(lire());
  }, []);
  if (requete.trim() !== '' || liste.length === 0) return null;
  return (
    <div
      data-recherches-recentes=""
      style={{
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: '22px',
        padding: '16px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
          RECHERCHES RÉCENTES
        </div>
        <button
          type="button"
          onClick={() => {
            ecrire([]);
            setListe([]);
          }}
          style={{
            border: 'none',
            background: 'none',
            font: 'inherit',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#16785E',
            minHeight: '44px',
            padding: '0 4px',
            cursor: 'pointer',
          }}
        >
          Effacer
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
        {liste.map((r) => (
          <Link
            key={r}
            href={adresseRecherche({ requete: r, type: null, valeurs: FILTRES_VIDES })}
            style={{
              padding: '8px 13px',
              minHeight: '36px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '999px',
              fontSize: '12.5px',
              fontWeight: 700,
              background: '#fff',
              color: '#16211D',
              border: '1px solid #E6EBE9',
              textDecoration: 'none',
            }}
          >
            {r}
          </Link>
        ))}
      </div>
    </div>
  );
}
