import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE CARTE QUI MÈNE QUELQUE PART — OU QUI N'Y MÈNE PAS                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les cartes de résultat de la recherche dessinent un CHEVRON depuis le premier
 * jour : elles promettaient d'ouvrir quelque chose, et n'ouvraient rien. `GET
 * /search` rend maintenant `url` par résultat, composée par le serveur — mais elle
 * peut être nulle, quand la source a disparu entre l'indexation et la lecture.
 *
 * ── POURQUOI UN COMPOSANT, ET PAS UN TERNAIRE DANS LE CADRE GÉNÉRÉ ────────
 *
 * Un ternaire `{r.url === null ? <div…>…</div> : <a…>…</a>}` recopierait TOUT le
 * dessin intérieur de la carte — rond d'icône, pastille, titre, extrait, chevron —
 * dans les deux branches. Le dessin de la maquette existerait alors en double dans
 * le cadre produit, et la seule chose dont on est sûr, c'est qu'un jour les deux
 * copies divergeront.
 *
 * Le dessin reste donc écrit UNE fois, en enfants, et c'est le CONTENANT qui change
 * de nature. Aucun état, aucun effet : ce composant reste rendu côté serveur.
 *
 * `textDecoration` et `color` sont remis parce qu'un `<a>` les change et qu'un
 * `<div>` ne les avait pas : sans eux, la carte entière se soulignerait en bleu.
 */
export function CadreCliquable({ vers, style, children }: {
  readonly vers: string | null;
  readonly style: CSSProperties;
  readonly children: ReactNode;
}) {
  if (vers === null) return <div style={style}>{children}</div>;

  return (
    <Link
      href={vers}
      style={{
        ...style,
        /**
         * ── LE `display` DESSINÉ GAGNE ────────────────────────────────────
         *
         * `block` était posé en dur, et c'était juste tant que ce composant ne
         * servait qu'aux cartes de recherche, qui n'en déclarent pas. Les cartes
         * de guide, d'événement, d'annonce et de parcours, elles, sont des
         * colonnes ou des rangées `flex` : leur imposer `block` écraserait la
         * mise en page que la maquette a dessinée.
         *
         * `block` reste le repli, parce qu'un `<a>` est inline par défaut et
         * qu'une carte inline s'effondre sur son contenu.
         */
        display: style.display ?? 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}
      data-cadre-cliquable={vers}
    >
      {children}
    </Link>
  );
}
