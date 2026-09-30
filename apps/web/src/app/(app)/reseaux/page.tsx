'use client';

import { ScreenFrames } from '@/screens/frames';
import { A07Desktop } from '@/screens/a07/desktop.generated';
import { A07Mobile } from '@/screens/a07/mobile.generated';
import { a07Fallback } from '@/screens/a07/data';
import { useReseaux } from '@/screens/reseaux/use-reseaux';

/**
 * A07 — mes réseaux, et ceux à découvrir. `/reseaux`
 *
 * Le cadre mobile vient de la planche « Versions mobiles » (MOB), cinquième
 * position — « A07 · Réseaux ».
 *
 * ── LE PREMIER RENDU EST CELUI DE LA MAQUETTE, PUIS CELUI DE L'API ─────────
 *
 * `a07Fallback` sert tant que `GET /communities` n'a pas répondu — listes vides,
 * chrome complet. Il n'invente AUCUNE donnée : pas un nom de réseau, pas un
 * compteur. C'est ce qui permet à la page d'être rendue côté serveur avec du
 * texte réel (le rail, le panneau, les filtres) plutôt que d'être servie vide,
 * sans pour autant afficher un réseau qui n'existe pas.
 */
export default function ReseauxPage() {
  const { data, pret, echec, seuilPhrase } = useReseaux();
  const props = pret && echec === null ? data : a07Fallback;

  return (
    <>
      <ScreenFrames
        screen="A07"
        desktop={<A07Desktop {...props} />}
        mobile={<A07Mobile {...props} />}
      />
      {/**
       * L'INVITATION À MONTER DE NIVEAU, et la phrase du seuil.
       *
       * Ni l'une ni l'autre n'a de place dans la maquette — elle ne dessine ni
       * bandeau d'erreur ni explication de seuil sur cet écran. Les ajouter au
       * cadre serait le RÉÉCRIRE ; elles vivent donc à côté, dans la page, où
       * elles ne touchent pas au transcodage.
       *
       * `levelRequired` porte `labelFr` : on affiche l'INVITATION du serveur,
       * pas une erreur sèche, et surtout pas le message brut d'un `429`.
       */}
      {echec !== null && (
        <p role="status" style={{ padding: '12px 24px', color: '#B4581F', fontSize: '13px' }}>
          {/**
           * Les quatre champs de `levelRequired` sont FACULTATIFS dans le
           * catalogue : on retombe donc sur le message du socle plutôt que
           * d'écrire « Pour undefined, vérifiez votre compte ».
           */}
          {echec.levelRequired?.labelFr === undefined
            ? echec.message
            : `Pour ${echec.levelRequired.labelFr}, vérifiez votre compte.`}
        </p>
      )}
      {seuilPhrase !== null && (
        <p style={{ padding: '0 24px 12px', color: '#5D6B66', fontSize: '13px' }}>{seuilPhrase}</p>
      )}
    </>
  );
}
