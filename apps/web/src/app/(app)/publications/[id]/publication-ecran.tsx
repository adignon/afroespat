'use client';

import { ScreenFrames } from '@/screens/frames';
import { A02Desktop } from '@/screens/a02/desktop.generated';
import { A02Mobile } from '@/screens/a02/mobile.generated';
import { panelFil, rail, shortcuts } from '@/screens/a02/data';
import { GUIDES_RATTACHES_SANS_SOURCE } from '@/screens/publication/from-api';
import { usePublication } from '@/screens/publication/use-publication';

/**
 * A02 — une publication et ses réponses. BRANCHÉ SUR L'API.
 *
 * ── CE QUI EST VRAI À L'ÉCRAN, ET CE QUI EST DESSINÉ ──────────────────────
 *
 * Il faut le dire dans cet ordre, parce que la moitié dessinée est la plus visible :
 *
 *   · LES COMMENTAIRES sont réels. Ils viennent de `GET /posts/:id`, qui rend la
 *     publication ET ses vingt premiers commentaires en un appel — §4 le prévoit
 *     ainsi, et c'est ce qui évite un aller-retour de plus pour le fil ;
 *   · LA PUBLICATION est DESSINÉE. L'auteur, le corps, le type, les compteurs et la
 *     ligne de contexte sont écrits en dur dans la maquette : compté sur les deux
 *     cadres, zéro interpolation. Le transcodage est fidèle ; c'est la maquette qui
 *     ne prévoit pas de donnée là. Remonté au rapport de lot — y remédier demande
 *     des `{{ }}` dans `docs/template/03 Accueil v2.dc.html`, donc une décision du
 *     porteur, jamais une retouche du JSX généré ;
 *   · LES GUIDES RATTACHÉS arrivent VIDES : aucune route ne rattache un guide à une
 *     publication. Le vote « utile / pas utile » reste donc branché — c'est un état
 *     de la maquette — mais il n'a aucun guide sur quoi porter. Remonté.
 *
 * ── LE COMPORTEMENT DE L'ÉCRAN ────────────────────────────────────────────
 *
 * LE VOTE SUR UN GUIDE RATTACHÉ A DISPARU DE CETTE PAGE, et c'est la conséquence
 * directe du point précédent : il n'y a aucun guide rattaché. Garder un état de
 * vote que rien ne peut alimenter aurait donné du code mort déguisé en
 * fonctionnalité. `relGuidesFor` reste dans `screens/a02/data.ts` — c'est la
 * fabrique de la maquette, et elle sera prête le jour où le back rattachera.
 *
 * AUCUNE DÉCISION SUR LE NIVEAU ici : pas de `if (level === 'L0')` avant de
 * commenter. On tente, et un `403 LEVEL_REQUIRED` porte de quoi afficher
 * l'invitation de §7.3.
 *
 * PAS DE TITRE DE PAGE, et c'est un manque de la MAQUETTE : ce cadre ne dessine
 * aucun titre, son contenu étant la publication elle-même. En inventer un —
 * « Publication de Fatou Ndiaye » — serait écrire à la place du porteur.
 */
export function PublicationEcran({ postId }: { readonly postId: string }) {
  const pub = usePublication(postId, true);

  const data = {
    rail,
    panelFil,
    shortcuts,
    comments: pub.commentaires,
    relGuides: GUIDES_RATTACHES_SANS_SOURCE,
  };

  return (
    <ScreenFrames screen="A02" desktop={<A02Desktop {...data} />} mobile={<A02Mobile {...data} />} />
  );
}
