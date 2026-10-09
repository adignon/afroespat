'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { suggestResponseSchema, SUGGEST_MIN_QUERY_LENGTH, type SuggestResponse } from '@app/shared';
import { memberApi } from '@/lib/api/member';
import { MOT_SINGULIER, TRACE } from '@/lib/recherche/types';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES PROPOSITIONS SOUS LE CHAMP, PENDANT QU'ON TAPE                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Lorsqu'on tape dans le champ, les propositions sous l'input
 * doivent s'afficher et permettre d'aller DIRECTEMENT sur un élément. »
 *
 * MESURÉ avant : le champ de la barre haute était un `<form method="get">` et rien
 * d'autre. Taper puis Entrée menait à `/recherche?q=…` — une page de résultats pour
 * trouver ce que le serveur savait déjà nommer. `GET /search/suggest` existait, et
 * n'était appelée que par la page de recherche ELLE-MÊME, au rendu serveur : jamais
 * pendant la frappe.
 *
 * ── CE QUI A DÛ CHANGER CÔTÉ SERVEUR, ET POURQUOI ─────────────────────────
 *
 * `GET /search/suggest` rendait `{ title, subjectType }` — un titre et un type,
 * sans identifiant. « Aller directement sur un élément » était donc IMPOSSIBLE à
 * écrire ici : au mieux, choisir une proposition relançait la recherche sur son
 * texte. La réponse porte maintenant `subjectId` et `url`, et c'est le SERVEUR qui
 * compose l'adresse : quatre des neuf types ne s'ouvrent pas par leur identifiant
 * (un guide par son slug, un membre par son pseudo, une ville par son slug, un
 * sujet par le slug de son réseau), et le front n'a pas à savoir résoudre trois
 * référentiels pour poser un lien.
 *
 * ── LE SEUIL EST CELUI DE LA SPÉCIFICATION, PAS UN `3` ÉCRIT ICI ───────────
 *
 * §2.3 : « suggestions dès 3 caractères ». En dessous, le serveur REFUSE la requête
 * — `suggestQuerySchema` a un `min`. On ne l'appelle donc pas, et la borne est lue
 * dans `@app/shared` : quatre bornes recopiées à la main ont déjà divergé dans ce
 * dépôt, et le symptôme serait un `400` affiché comme une panne.
 *
 * ── LE FREIN : 220 ms, ET CE N'EST PAS UN CONFORT ─────────────────────────
 *
 * Sans frein, « logement » est huit requêtes dont sept sont jetées — et chacune
 * compte dans le plafond de débit du membre. Le minuteur est REMIS À ZÉRO à chaque
 * touche : seule la dernière frappe part. 220 ms est la durée de feuille de
 * `packages/config/motion.js` ; on reprend le pas du produit plutôt que d'en
 * inventer un.
 *
 * LE RÉSULTAT PÉRIMÉ EST JETÉ. Deux requêtes peuvent se croiser — la deuxième
 * répond avant la première — et la liste afficherait alors les propositions de la
 * requête précédente. Chaque appel retient le texte qui l'a lancé et ne pose son
 * résultat que si ce texte est toujours celui du champ.
 */

type Suggestion = SuggestResponse['items'][number];

export function useSuggestions(texte: string): readonly Suggestion[] {
  const [items, setItems] = useState<readonly Suggestion[]>([]);

  useEffect(() => {
    const q = texte.trim();
    if (q.length < SUGGEST_MIN_QUERY_LENGTH) {
      setItems([]);
      return undefined;
    }

    let vivant = true;
    const minuteur = setTimeout(() => {
      void memberApi
        .get(`/search/suggest?q=${encodeURIComponent(q)}`, suggestResponseSchema)
        .then((reponse) => {
          if (vivant) setItems(reponse.items);
        })
        /**
         * UNE SUGGESTION EST UN ACCESSOIRE. Un `429`, une coupure, un `401` pendant
         * la reprise de session : la liste reste vide et le champ continue de
         * fonctionner — Entrée mène toujours à la page de résultats. Afficher une
         * erreur sous un champ de recherche pendant la frappe serait disproportionné.
         */
        .catch(() => {
          if (vivant) setItems([]);
        });
    }, 220);

    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [texte]);

  return items;
}

/** Le préfixe saisi, en gras, comme la planche de recherche le dessine. */
function decoupe(titre: string, requete: string): { readonly gras: string; readonly suite: string } {
  const q = requete.trim();
  if (q === '' || !titre.toLocaleLowerCase('fr').startsWith(q.toLocaleLowerCase('fr'))) {
    return { gras: '', suite: titre };
  }
  return { gras: titre.slice(0, q.length), suite: titre.slice(q.length) };
}

/**
 * LE PANNEAU.
 *
 * Son dessin reprend celui que la planche X01 dessine pour ses suggestions — carte
 * blanche, bord `#DDE3E0`, rayon 20, retrait 8 — parce que c'est le même objet au
 * même endroit, et qu'en inventer un second serait avoir deux grammaires pour une
 * idée.
 *
 * ── CHAQUE LIGNE EST UN VRAI LIEN ─────────────────────────────────────────
 *
 * `url` peut être nul : la source a disparu entre l'indexation et la frappe. La
 * ligne mène alors à la page de résultats sur son titre — ce qu'on savait faire
 * avant — plutôt qu'à une page absente. C'est le seul repli, et il est visible :
 * la ligne reste cliquable et emmène quelque part de vrai.
 */
export function PanneauSuggestions({
  items,
  requete,
  surChoix,
  indexActif,
}: {
  readonly items: readonly Suggestion[];
  readonly requete: string;
  readonly surChoix: () => void;
  /** La ligne désignée au clavier, ou `-1`. */
  readonly indexActif: number;
}) {
  if (items.length === 0) return null;

  return (
    <div
      id="barre-recherche-propositions"
      role="listbox"
      aria-label="Propositions de recherche"
      data-recherche-suggestions=""
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        minWidth: '100%',
        width: 'max(100%, 360px)',
        zIndex: 60,
        background: '#fff',
        border: '1px solid #DDE3E0',
        borderRadius: '20px',
        padding: '8px',
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ AUCUNE OMBRE PORTÉE — ET J'EN AVAIS MIS UNE                      ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * T1 §2.3 l'interdit, `e2e/services.spec.ts` le relève sur chaque écran,
         * et les sept maquettes du produit n'en contiennent PAS UNE : `grep
         * box-shadow docs/template/*.dc.html` rend zéro.
         *
         * J'avais posé `0 12px 32px rgba(22,33,29,.12)` par réflexe, pour
         * « décoller » un panneau flottant. La maquette décolle le sien
         * autrement, et elle dessine EXACTEMENT ce panneau-là sur X01 : un bord
         * `1px solid #DDE3E0` et un fond blanc. C'est sa grammaire, et elle
         * suffit — le panneau est déjà distinct de ce qu'il recouvre.
         */
        textAlign: 'left',
      }}
    >
      {items.map((s, i) => {
        const { gras, suite } = decoupe(s.title, requete);
        return (
          <Link
            key={`${s.subjectId}:${String(i)}`}
            href={s.url ?? `/recherche?q=${encodeURIComponent(s.title)}`}
            role="option"
            aria-selected={i === indexActif}
            data-recherche-suggestion={String(i)}
            onClick={surChoix}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              height: '44px',
              padding: '0 12px',
              borderRadius: '14px',
              textDecoration: 'none',
              color: '#16211D',
              fontSize: '13.5px',
              background: i === indexActif ? '#F2F5F4' : 'transparent',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F5C48"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d={TRACE[s.subjectType]} />
            </svg>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ fontWeight: 700 }}>{gras}</strong>
              {suite}
            </span>
            <span
              style={{
                background: '#F2F5F4',
                color: '#5D6B66',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {MOT_SINGULIER[s.subjectType]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
