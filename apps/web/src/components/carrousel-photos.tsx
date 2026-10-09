'use client';

import { useCallback, useEffect, useState } from 'react';
import { photoFondFor } from '@/screens/a14/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE PUBLICATION PEUT PORTER QUATRE IMAGES — ET LA CARTE N'EN MONTRAIT     ║
 * ║ QU'UNE, SANS JAMAIS POUVOIR L'AGRANDIR                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, en deux fois :
 *
 *   · « Pour une publication avec plusieurs images ça s'affiche comment ? je
 *     propose un affichage en slide avec des boutons next et prev, les images
 *     affichées au centre en 3/4 de l'espace. » ;
 *   · « Mais on ne peut pas visualiser une image ? l'agrandir les images des
 *     publications ? »
 *
 * ── CE QUI EXISTAIT ───────────────────────────────────────────────────────
 *
 * `postCardSchema.media` porte JUSQU'À QUATRE images (§2.4), et `from-api` n'en
 * lisait que la première. Les trois autres étaient envoyées par le serveur,
 * reçues par l'écran, et jetées. Et la seule qui s'affichait était un FOND CSS
 * recadré en « couvrir » : rien ne pouvait l'ouvrir, et une photo de téléphone
 * était donc montrée amputée de ses bords, sans recours.
 *
 * ── CE DESSIN N'EST PAS DANS LA MAQUETTE, ET C'EST ASSUMÉ ─────────────────
 *
 * Aucune planche ne dessine une publication à plusieurs images, ni une
 * visionneuse. Les deux formes ci-dessous sont celles que le PORTEUR a demandées,
 * et elles empruntent leur vocabulaire à ce qui est déjà dessiné ailleurs plutôt
 * que d'en inventer un :
 *
 *   · les chevrons sont ceux de la planche de lecture de story (A13), réduits de
 *     52 à 32 px dans la carte, gardés à 44 px en plein écran ;
 *   · le voile `rgba(22,33,29,.55)` et le bouton de fermeture rond sont ceux des
 *     fenêtres transcodées (`data-modal-overlay`, `data-modal-close`) ;
 *   · le rayon de 16 px, la hauteur et la marge sont ceux du bloc photo
 *     transcodé, passés en propriétés pour que l'ordinateur garde ses 14 px et le
 *     téléphone ses 12 px.
 *
 * AUCUNE OMBRE PORTÉE : T1 §2.3, et `e2e/services.spec.ts` le garde.
 *
 * ── « COUVRIR » DANS LA CARTE, « CONTENIR » EN GRAND ──────────────────────
 *
 * Et c'est tout l'objet de l'agrandissement : la carte a une hauteur fixe, donc
 * elle RECADRE (`cover`) pour la remplir ; la visionneuse n'a pas de forme à
 * tenir, donc elle montre l'image ENTIÈRE (`contain`). Ce composant reçoit donc
 * les ADRESSES et compose lui-même les deux fonds — recevoir un fond déjà composé
 * l'aurait enfermé dans l'un des deux.
 *
 * ── POURQUOI UN RAIL QUI SE DÉPLACE, ET PAS UNE IMAGE QU'ON REMPLACE ──────
 *
 * « En slide » : les images voisines DOIVENT se voir, sinon rien ne dit qu'il y
 * en a d'autres — c'est tout l'objet des trois quarts demandés. Le rail porte
 * donc les quatre images côte à côte et c'est LUI qui glisse.
 *
 * LE POURCENTAGE DE `translateX` SE RÉSOUT CONTRE LA LARGEUR DU RAIL, pas contre
 * celle du cadre. Le rail est donc tenu à `width: 100%` et chaque image à
 * `flex: 0 0 75%` : les deux mesures se rapportent alors au même cadre, et
 * `12.5% - i × 75%` centre la i-ième. Un rail laissé libre de s'étendre aurait
 * fait dériver le centrage au nombre d'images.
 */
export function CarrouselPhotos({
  urls,
  hauteur,
  marge,
  rayon = '16px',
}: {
  /**
   * Les ADRESSES des images, dans l'ordre choisi par l'auteur.
   *
   * FACULTATIVES, comme `photoH` l'est sur la carte : la maquette ne rend ce bloc
   * que sous `<sc-if value="{{ photo }}">`, et ses cartes d'exemple sont des
   * DESSINS sans image. Les rendre obligatoires forcerait le cadre généré à
   * inventer une valeur pour une carte qui n'en a pas.
   *
   * `| undefined` EXPLICITE : `exactOptionalPropertyTypes` est actif, et sans lui
   * le cadre généré — qui passe `p.photoUrls`, de type `readonly string[] |
   * undefined` — est refusé. Omettre la clé et la passer à `undefined` ne sont
   * pas la même chose pour ce drapeau ; le cadre, lui, la passe toujours.
   */
  readonly urls?: readonly string[] | undefined;
  readonly hauteur?: string | undefined;
  readonly marge: string;
  readonly rayon?: string;
}) {
  const [rang, setRang] = useState(0);
  const [agrandie, setAgrandie] = useState<number | null>(null);
  const total = urls?.length ?? 0;

  const borner = useCallback(
    (r: number): number => Math.min(Math.max(r, 0), Math.max(total - 1, 0)),
    [total],
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ ÉCHAP FERME, ET LES FLÈCHES NAVIGUENT — EN GRAND SEULEMENT             ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Une image en plein écran couvre TOUT : sans Échap, la seule sortie serait la
   * croix, et un lecteur au clavier qui ne la trouve pas est enfermé. C'est la
   * même règle que les fenêtres transcodées tiennent déjà (`e2e/modales.spec.ts`
   * la garde pour chacune).
   *
   * L'ÉCOUTE N'EXISTE QUE PENDANT L'AGRANDISSEMENT : branchée en permanence, les
   * flèches d'un membre qui lit son fil feraient défiler les photos d'une carte
   * au hasard, et Échap fermerait quelque chose d'invisible.
   */
  useEffect(() => {
    if (agrandie === null) return undefined;
    const surTouche = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setAgrandie(null);
      else if (event.key === 'ArrowLeft') setAgrandie((a) => (a === null ? null : borner(a - 1)));
      else if (event.key === 'ArrowRight') setAgrandie((a) => (a === null ? null : borner(a + 1)));
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
    };
  }, [agrandie, borner]);

  if (urls === undefined || hauteur === undefined || total === 0) return null;

  const ouvrir = (i: number) => (): void => {
    setAgrandie(i);
  };

  /** Le chevron, à deux tailles : 32 px dans la carte, 44 px en plein écran. */
  const chevron = (
    sens: 'prev' | 'suiv',
    position: number,
    aller: () => void,
    bloque: boolean,
    taille: number,
    fond: string,
    encre: string,
  ) => (
    <button
      type="button"
      onClick={aller}
      disabled={bloque}
      aria-label={sens === 'prev' ? 'Image précédente' : 'Image suivante'}
      data-publication-photo-pas={sens}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...(sens === 'prev' ? { left: `${String(position)}px` } : { right: `${String(position)}px` }),
        width: `${String(taille)}px`,
        height: `${String(taille)}px`,
        borderRadius: '999px',
        background: fond,
        border: 'none',
        padding: 0,
        font: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: bloque ? 'default' : 'pointer',
        opacity: bloque ? '.4' : '1',
      }}
    >
      <svg
        width={taille < 40 ? '16' : '20'}
        height={taille < 40 ? '16' : '20'}
        viewBox="0 0 24 24"
        fill="none"
        stroke={encre}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={sens === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  );

  /** La visionneuse. Rendue au-dessus de tout, et seulement quand on l'a ouverte. */
  const visionneuse =
    agrandie === null ? null : (
      <div
        data-publication-visionneuse=""
        role="dialog"
        aria-modal="true"
        aria-label={`Image ${String(agrandie + 1)} sur ${String(total)}`}
        onClick={(event) => {
          /**
           * LE VOILE FERME, LE CONTENU NON. `event.target === event.currentTarget`
           * et non `closest(…)` : la cible est le voile lui-même uniquement quand
           * le clic a porté à côté de l'image. Un clic SUR l'image remonte ici
           * aussi, et sans ce test il fermerait la visionneuse qu'on vient
           * d'ouvrir — c'est exactement ce que les fenêtres transcodées évitent
           * avec `data-modal-overlay`.
           */
          if (event.target === event.currentTarget) setAgrandie(null);
        }}
        style={{
          position: 'fixed',
          inset: '0',
          background: 'rgba(22,33,29,.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          /**
           * AU-DESSUS DES FENÊTRES TRANSCODÉES, qui sont en `position: fixed` sans
           * `z-index` déclaré — elles s'empilent donc dans l'ordre du document. Une
           * visionneuse ouverte depuis une publication montrée DANS une fenêtre
           * passerait dessous sans cette couche.
           */
          zIndex: 1000,
        }}
      >
        <div
          data-publication-visionneuse-image=""
          style={{
            width: '100%',
            height: '100%',
            background: photoFondFor(urls[agrandie] ?? null, true),
          }}
        />
        <button
          type="button"
          onClick={() => {
            setAgrandie(null);
          }}
          aria-label="Fermer"
          data-publication-visionneuse-fermer=""
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,.14)',
            border: 'none',
            padding: 0,
            font: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {total === 1
          ? null
          : chevron(
              'prev',
              16,
              () => {
                setAgrandie((a) => (a === null ? null : borner(a - 1)));
              },
              agrandie === 0,
              44,
              'rgba(255,255,255,.14)',
              '#fff',
            )}
        {total === 1
          ? null
          : chevron(
              'suiv',
              16,
              () => {
                setAgrandie((a) => (a === null ? null : borner(a + 1)));
              },
              agrandie === total - 1,
              44,
              'rgba(255,255,255,.14)',
              '#fff',
            )}
        {total === 1 ? null : (
          <span
            data-publication-visionneuse-compte=""
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#fff',
              fontSize: '12.5px',
              fontWeight: '700',
            }}
          >
            {agrandie + 1} / {total}
          </span>
        )}
      </div>
    );

  /**
   * UNE SEULE IMAGE REND LE BLOC DE LA MAQUETTE, À L'IDENTIQUE — hauteur, rayon,
   * marge et recadrage compris. On n'y ajoute QUE le geste d'agrandissement, sans
   * rail, sans chevrons et sans pastille : la planche n'en dessine aucun, et le
   * cas d'une image unique est le plus fréquent.
   */
  if (total === 1) {
    return (
      <>
        <button
          type="button"
          onClick={ouvrir(0)}
          aria-label="Agrandir l’image"
          data-publication-photos=""
          data-publication-photo=""
          style={{
            display: 'block',
            width: '100%',
            marginTop: marge,
            height: hauteur,
            borderRadius: rayon,
            background: photoFondFor(urls[0] ?? null, false),
            border: 'none',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
          }}
        />
        {visionneuse}
      </>
    );
  }

  return (
    <>
      <div
        data-publication-photos=""
        aria-label={`Photos de la publication — ${String(total)}`}
        style={{
          marginTop: marge,
          height: hauteur,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: rayon,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            transform: `translateX(calc(12.5% - ${String(rang * 75)}%))`,
            transition: 'transform .35s ease',
          }}
        >
          {urls.map((url, i) => (
            <div
              key={i}
              style={{ flex: '0 0 75%', height: '100%', padding: '0 4px', boxSizing: 'border-box' }}
            >
              <button
                type="button"
                onClick={ouvrir(i)}
                aria-label={`Agrandir l’image ${String(i + 1)}`}
                data-publication-photo=""
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  borderRadius: rayon,
                  background: photoFondFor(url, false),
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  cursor: 'pointer',
                  /** La voisine s'efface : c'est elle qui dit « il y en a d'autres ». */
                  opacity: i === rang ? '1' : '.45',
                  transition: 'opacity .35s ease',
                }}
              />
            </div>
          ))}
        </div>
        {chevron(
          'prev',
          6,
          () => {
            setRang((r) => borner(r - 1));
          },
          rang === 0,
          /**
           * 44 px, ET C'EST T1 §2.3 : un chevron est une cible tactile, et la règle
           * ne distingue pas celles qui sont posées sur une image. 32 px aurait été
           * plus discret et refusé par `e2e/responsive.spec.ts`.
           */
          44,
          'rgba(255,255,255,.92)',
          '#16211D',
        )}
        {chevron(
          'suiv',
          6,
          () => {
            setRang((r) => borner(r + 1));
          },
          rang === total - 1,
          44,
          'rgba(255,255,255,.92)',
          '#16211D',
        )}
        <span
          data-publication-photo-compte=""
          style={{
            position: 'absolute',
            right: '10px',
            bottom: '10px',
            background: 'rgba(22,33,29,.55)',
            color: '#fff',
            fontSize: '11.5px',
            fontWeight: '700',
            borderRadius: '999px',
            padding: '4px 10px',
          }}
        >
          {rang + 1} / {total}
        </span>
      </div>
      {visionneuse}
    </>
  );
}
