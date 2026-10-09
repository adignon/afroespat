'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { MENUS_RAIL } from './menus';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE RAIL DÉPLIE SON MENU AU SURVOL                                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le menu green de gauche affiche au "hover" un floatting side bar
 * menu quand on passe le curseur sur Accueil, Parcours etc. Donc ça va permettre
 * d'avoir la navigation même sur les pages où la side bar est réutilisée pour le
 * contexte de la page sur laquelle on se trouve, comme la recherche. »
 *
 * C'est la seconde moitié d'une demande dont la première était « sur la page du
 * search, la left side bar doit contenir plutôt les filtres ». Les deux vont
 * ensemble : la colonne de gauche est la seule navigation de second niveau du
 * produit, et la rendre au contexte de la page la retire. Le rail la rend.
 *
 * ── CE COMPOSANT NE REDESSINE PAS LE RAIL, IL L'ENVELOPPE ─────────────────
 *
 * Il rend le `<nav>` que la maquette dessine, avec SON style, et ses enfants tels
 * qu'ils sont transcodés. Le rail existe en deux formes dans les planches — 51
 * littérales (cinq `<a>` écrits) et 13 en boucle (un `<a>` dans un `<sc-for>`) — et
 * ce composant ne distingue pas les deux : il écoute le survol et demande au DOM
 * quel lien est sous le curseur. Un mécanisme qui aurait modifié le balisage aurait
 * dû traiter les deux formes séparément, donc exister en double.
 *
 * ── POURQUOI LE LIBELLÉ EST LU DANS LE DOM ────────────────────────────────
 *
 * `cible.closest('a')` puis `textContent` : le libellé rendu est le seul
 * discriminant que les deux formes partagent. Dans la forme en boucle il n'y a
 * aucun texte dans le JSX — c'est `{r.label}` — donc rien à indexer à la
 * génération. Au rendu, les deux disent « Accueil ».
 *
 * ── LE PONT DE 8 PIXELS N'EST PAS DE LA DÉCORATION ────────────────────────
 *
 * Le panneau flotte à 8 px du rail, comme la colonne de la maquette. Si ces 8 px
 * étaient une marge, le curseur quitterait le rail en les traversant et le panneau
 * se fermerait sous la main — le menu serait inatteignable. Ils sont donc un
 * RETRAIT du conteneur du panneau, qui est lui-même un enfant du `<nav>` : le
 * pointeur ne quitte jamais la zone.
 *
 * ── AU CLAVIER AUSSI ──────────────────────────────────────────────────────
 *
 * `onFocus` et `onBlur` doublent le survol : le rail est atteignable à la
 * tabulation, et un menu qui ne s'ouvre qu'à la souris n'existe pas pour qui
 * navigue au clavier. `onBlur` regarde où va le foyer — sans quoi il se fermerait
 * avant que la première entrée du menu soit atteinte, ce qui est exactement le
 * défaut qu'on vient d'éviter pour la souris.
 */
export function RailSurvol({ style, children }: {
  readonly style: CSSProperties;
  readonly children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState<{ readonly rubrique: string; readonly haut: number } | null>(null);
  const nav = useRef<HTMLElement | null>(null);

  /** La rubrique sous le pointeur, ou rien si ce n'est pas une entrée connue. */
  const viser = (cible: EventTarget | null): void => {
    if (!(cible instanceof Element)) return;
    const lien = cible.closest('a');
    if (lien === null || nav.current === null || !nav.current.contains(lien)) return;
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE MENU SE REFERMAIT QUAND ON ALLAIT LE CLIQUER                      ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * MESURÉ au navigateur, et c'est ce qui a fait rougir le cas « ses entrées
     * mènent quelque part » : survoler « Accueil » ouvrait bien le volet, et
     * déplacer le curseur DEDANS le faisait disparaître. L'URL ne changeait pas.
     *
     * POURQUOI : le volet est un enfant du `<nav>`, exprès — c'est ce qui évite que
     * `mouseleave` parte en traversant les 8 px. Mais `mouseover` BOUILLONNE lui
     * aussi : entrer dans le volet rappelait `viser` avec, pour cible, une entrée du
     * MENU. Son libellé — « Guides et Démarches » — n'est pas une rubrique du rail,
     * donc la branche « une entrée sans menu referme » s'appliquait. Elle avait
     * raison sur le bouton de réglages, et tort ici.
     *
     * Les liens DU VOLET ne visent donc rien : ils ne sont pas des rubriques.
     */
    if (lien.closest('[data-rail-survol]') !== null) return;

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA RUBRIQUE OÙ L'ON EST DÉJÀ NE DÉPLIE RIEN                          ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « sur les pages où l'un des menus est actif, le menu actif, son
     * hover ne doit pas marcher ».
     *
     * Il a raison, et la raison tient en un dessin : sur `/entraide`, la colonne de
     * gauche porte DÉJÀ la carte « ENTRAIDE » avec ses quatre entrées. Déplier le
     * volet au survol poserait le même menu PAR-DESSUS lui — deux fois la même
     * chose, à vingt pixels d'écart. Le volet existe pour les pages dont la colonne
     * sert à autre chose : la recherche, et toute page qui réemploie sa colonne.
     *
     * ── L'ÉTAT ACTIF EST LU SUR LE DESSIN, PAS SUR L'ADRESSE ───────────────
     *
     * Comparer `href` au chemin courant semblait plus direct ; c'est faux ici.
     * « Services » mène à `/services/logement` — un arbitrage déjà remonté — donc
     * sur `/services/emploi` la comparaison échouerait alors que la maquette peint
     * bien « Services » en actif. Et le rail existe en deux formes dont l'une tire
     * son adresse d'une donnée.
     *
     * CE QUE LA MAQUETTE PEINT, elle, est sans ambiguïté et mesuré sur les 65
     * cadres : 35 entrées en `#fff` sur `#0F5C48` — l'entrée active — et 205 en
     * `rgba(255,255,255,.08)` sur `#CFE3DA`. La forme en boucle écrit `#FFFFFF`
     * plutôt que `#fff` ; `getComputedStyle` normalise les deux en
     * `rgb(255, 255, 255)`, donc une seule comparaison couvre les deux formes.
     */
    if (getComputedStyle(lien).backgroundColor === 'rgb(255, 255, 255)') {
      setOuvert(null);
      return;
    }

    const rubrique = (lien.textContent ?? '').trim();
    if (!(rubrique in MENUS_RAIL)) {
      /**
       * UNE ENTRÉE SANS MENU FERME CELUI QUI EST OUVERT. Le bas du rail porte un
       * bouton de réglages sans menu ; sans cette ligne, passer dessus laisserait
       * le menu d'Agenda ouvert au-dessus de lui.
       */
      setOuvert(null);
      return;
    }
    setOuvert({ rubrique, haut: (lien as HTMLElement).offsetTop });
  };

  const menu = ouvert === null ? undefined : MENUS_RAIL[ouvert.rubrique];

  return (
    <nav
      ref={nav}
      style={{ ...style, position: 'relative' }}
      onMouseOver={(event) => viser(event.target)}
      onFocus={(event) => viser(event.target)}
      onMouseLeave={() => setOuvert(null)}
      onBlur={(event) => {
        const vers = event.relatedTarget;
        if (vers instanceof Node && event.currentTarget.contains(vers)) return;
        setOuvert(null);
      }}
    >
      {children}
      {ouvert === null || menu === undefined ? null : (
        <div
          data-rail-survol={ouvert.rubrique}
          style={{
            position: 'absolute',
            left: '100%',
            top: `${String(ouvert.haut)}px`,
            paddingLeft: '8px',
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: '236px',
              background: '#fff',
              border: '1px solid #E6EBE9',
              borderRadius: '22px',
              padding: '14px',
              /**
               * AUCUNE OMBRE PORTÉE — T1 §2.3, et les sept maquettes n'en portent
               * pas une seule (`grep box-shadow` rend zéro). J'en avais mis une
               * ici aussi. Le volet reprend donc le dessin EXACT de la carte de
               * section qu'il remplace — fond blanc, bord `#E6EBE9`, rayon 22,
               * retrait 14 — et c'est ce bord qui le détache, comme il détache la
               * carte dans la colonne.
               */
            }}
          >
            <div style={{ padding: '0 6px 8px' }}>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: '#8A958F',
                }}
              >
                {menu.titre}
              </div>
            </div>
            {menu.entrees.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                style={{
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '0 12px',
                  borderRadius: '14px',
                  background: 'transparent',
                  color: '#16211D',
                  fontWeight: 500,
                  fontSize: '13.5px',
                  textDecoration: 'none',
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path d={e.trace} />
                </svg>
                <span style={{ flex: 1 }}>{e.libelle}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
