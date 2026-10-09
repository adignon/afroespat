'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA VIGNETTE EST LA STORY ELLE-MÊME, EN RÉDUCTION                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Ça doit être le même composant du display qui est affiché en
 * preview, un peu comme WhatsApp. Et non écrire le texte sur la story comme tu as
 * fait. »
 *
 * CE QUI PRÉCÉDAIT, et pourquoi c'était faux : la carte peignait le fond de la
 * story et RECOLLAIT son corps par-dessus, en bas à gauche, dans la typographie
 * de la carte. Le membre voyait donc une légende sur une couleur — pas sa story.
 * Une story est une COMPOSITION : un fond, une étiquette, un texte centré dans
 * une certaine taille. C'est cela qu'il faut montrer.
 *
 * ── LA RÉDUCTION EST UNE MISE À L'ÉCHELLE, PAS UNE RÉÉCRITURE ─────────────
 *
 * On rend la story à SA taille — 430 × 800, celle de `data-story-carte` dans
 * A13 — puis on la réduit par `transform: scale()`. Deux conséquences, et
 * l'une est la raison du choix :
 *
 *   · les proportions sont EXACTES. Le texte garde son rapport au fond, ses
 *     retours à la ligne tombent aux mêmes mots, et la vignette ressemble à ce
 *     qui s'ouvrira. Recomposer en « 10 px au lieu de 30 » aurait donné une
 *     autre image, puisque les retours à la ligne auraient changé ;
 *   · il n'y a QU'UN jeu de constantes typographiques à tenir.
 *
 * ⚠ CES CONSTANTES SONT CELLES DE A13, RECOPIÉES. A13 est un cadre GÉNÉRÉ depuis
 * `03 Accueil v2` : on ne peut pas lui emprunter un composant sans réécrire la
 * maquette, ce que le dépôt s'interdit. Les valeurs sont donc relevées sur le
 * cadre produit — 30 px / 800 / 1,18 / -0,6 px pour le corps, 11 px / 800 /
 * 1,4 px pour l'étiquette, voile `rgba(0,0,0,.78)` sur 60 % de hauteur quand il y
 * a une photo. Si la maquette de A13 change, celle-ci ne suivra pas toute seule.
 * REMONTÉ au porteur.
 */

/** La carte de lecture de A13, au pixel : `data-story-carte`. */
const LARGEUR = 430;
const HAUTEUR = 800;

export function ApercuStory({
  fond,
  photo,
  etiquette,
  texte,
}: {
  /** La valeur CSS de fond : la photo en « couvrir », ou l'aplat choisi. */
  readonly fond: string;
  /** Vrai quand `fond` est une photo : le voile du bas ne se pose que là. */
  readonly photo: boolean;
  /** La petite ligne en capitales — `typeLabel` dans A13. */
  readonly etiquette: string;
  readonly texte: string;
}) {
  /**
   * ── LA VIGNETTE SE MESURE ELLE-MÊME ──────────────────────────────────────
   *
   * La carte fait `calc((100% - 48px) / 5)` de large : sa largeur n'est connue
   * ni au transcodage ni au premier rendu, et elle change avec la fenêtre. Lui
   * passer des nombres en prise aurait demandé au cadre de les calculer, ce
   * qu'il ne peut pas faire.
   *
   * `ResizeObserver` plutôt que `resize` : la colonne du fil change aussi quand
   * le rail de gauche se replie, sans que la fenêtre bouge.
   */
  const boite = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState<{ l: number; h: number }>({ l: 0, h: 0 });

  useEffect(() => {
    const n = boite.current;
    if (n === null) return undefined;
    const relire = (): void => {
      setTaille({ l: n.clientWidth, h: n.clientHeight });
    };
    relire();
    const oeil = new ResizeObserver(relire);
    oeil.observe(n);
    return () => {
      oeil.disconnect();
    };
  }, []);

  /**
   * « COUVRIR » ET NON « CONTENIR » : la story est un portrait de téléphone, la
   * carte un rectangle plus large que haut. `Math.max` remplit la carte et laisse
   * déborder le bas de la story — ce que `overflow: hidden` rogne — plutôt que de
   * laisser deux bandes vides sur les côtés.
   *
   * ZÉRO TANT QU'ON N'A PAS MESURÉ : le fond est déjà peint sur la boîte, donc la
   * carte n'est jamais blanche, et la story apparaît au premier passage de
   * l'observateur — c'est-à-dire tout de suite.
   */
  const echelle = taille.l === 0 ? 0 : Math.max(taille.l / LARGEUR, taille.h / HAUTEUR);

  return (
    <div
      ref={boite}
      data-apercu-story=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        /** Le fond est aussi sur le parent : une story plus étroite que la carte
         * ne laisse alors aucun blanc sur les côtés. */
        background: fond,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${LARGEUR}px`,
          height: `${HAUTEUR}px`,
          transform: `translate(-50%,-50%) scale(${echelle})`,
          /** Sans mesure, on ne peint pas la composition : elle serait à 430 px
           * de large dans une carte de 116, et déborderait de partout. */
          visibility: echelle === 0 ? 'hidden' : 'visible',
          background: fond,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {photo ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '60%',
              background: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.78))',
            }}
          />
        ) : null}
        {/*
          LE CONTENU SEUL, SANS LA CHROME. Les barres de progression, la croix de
          fermeture et les deux boutons de vote appartiennent à la LECTURE, pas à
          la story : une vignette qui les montrerait promettrait des commandes
          qu'on ne peut pas toucher. C'est aussi ce que montre la capture du
          porteur — le fond et le texte, rien d'autre.
        */}
        <div
          style={{
            position: 'relative',
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '24px 26px',
            gap: '16px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '1.4px',
              color: 'rgba(255,255,255,.75)',
            }}
          >
            {etiquette}
          </div>
          <div
            style={{
              fontSize: '30px',
              fontWeight: 800,
              lineHeight: '1.18',
              letterSpacing: '-0.6px',
              textWrap: 'pretty',
            }}
          >
            {texte}
          </div>
        </div>
      </div>
    </div>
  );
}
