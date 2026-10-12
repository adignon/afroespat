'use client';

import { use } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A09Desktop } from '@/screens/a09/desktop.generated';
import { A09Mobile } from '@/screens/a09/mobile.generated';
import { a09Fallback } from '@/screens/a09/data';
import { useSujet } from '@/screens/reseaux/use-sujet';

/**
 * A09 — un sujet du réseau. `/reseaux/:slug/sujets/:id`
 *
 * « vue auteur + modérateur », dit la maquette : les actions de modération —
 * épingler, clore, masquer — sont dessinées dans le même cadre. Elles sont
 * MONTRÉES d'après `canPin` et `canResolve`, que le serveur recalcule à chaque
 * lecture du sujet, et jamais d'après un rôle gardé en mémoire.
 *
 * ── LE REFUS N'EST PAS UNE PAGE VIDE ───────────────────────────────────────
 *
 * `GET /topics/:id` est la porte de derrière : elle atteint un sujet sans passer
 * par son réseau. Elle refuse un non-membre par `403 NOT_A_MEMBER` — et cette
 * page l'affiche comme tel, sans chercher ailleurs ce que la route a refusé. Il
 * n'y a pas d'ailleurs, et en inventer un serait contourner la garde.
 */
export default function SujetPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string; readonly id: string }>;
}) {
  const { slug, id } = use(params);
  const { data, pret, refuse, introuvable, echec, sujet } = useSujet(id);
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ UN GESTE QUI ÉCHOUE NE DOIT PAS EFFACER LA PAGE                       ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * C'était `pret && echec === null ? data : a09Fallback`, et c'était juste tant
   * que l'écran ne faisait que LIRE : le seul échec possible venait du
   * chargement, et retomber sur le repli était exactement ce qu'il fallait.
   *
   * Dès que l'écran AGIT, ce n'est plus vrai. `useSujet` pose `echec` aussi
   * quand une réponse ou un `PATCH` est refusé — un `429`, un `403` parce que le
   * rôle a changé — et le sujet, lui, est toujours là, lu une seconde plus tôt.
   * Avec l'ancienne condition, un envoi refusé VIDAIT la page : titre, corps,
   * auteur et réponses remplacés par le repli, et le message d'échec en dessous
   * d'un écran blanc. Le symptôme n'aurait pas désigné la cause.
   *
   * On décide donc sur ce qu'on A — `sujet !== null` — et non sur l'absence
   * d'échec. Le refus, lui, est dit en toutes lettres juste sous le cadre.
   */
  const props = pret && sujet !== null ? data : a09Fallback;

  if (refuse) {
    return (
      <p role="status" style={{ padding: '24px', color: '#16211D', fontSize: '14px' }}>
        Ce sujet appartient à un réseau que vous n’avez pas rejoint.{' '}
        <a href={`/reseaux/${slug}`} style={{ color: '#0F5C48', fontWeight: 700 }}>
          Voir le réseau
        </a>
      </p>
    );
  }

  /**
   * « Introuvable », et jamais « accès refusé ».
   *
   * Sur un réseau `INVITE_ONLY`, le 404 EST le refus — il est choisi pour ne pas
   * confirmer l'existence du réseau. Écrire « vous n'y avez pas accès »
   * annulerait tout le bénéfice de ce choix en révélant que quelque chose existe.
   */
  if (introuvable) {
    return (
      <p role="status" style={{ padding: '24px', color: '#16211D', fontSize: '14px' }}>
        Ce sujet est introuvable.
      </p>
    );
  }

  return (
    <>
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ UN SUJET MASQUÉ LE DIT — SINON LA PAGE MENT PAR OMISSION              ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Depuis l'arbitrage du porteur, `GET /topics/:id` rend le sujet masqué AUX
       * MODÉRATEURS du réseau : c'est ce qui rend l'erreur de clic réparable. Mais
       * un sujet masqué rendu SANS le dire est pire que le `404` d'avant — le
       * modérateur croit avoir raté son clic, remasque, et ne comprend pas
       * pourquoi plus personne n'en parle.
       *
       * La phrase est un `role="status"`, comme les deux refus ci-dessus : c'est
       * la forme que cette page emploie déjà pour ce qu'elle doit dire en plus du
       * cadre transcodé. Elle n'invente aucun dessin, et le geste de remise reste
       * là où la maquette le dessine — la carte « MODÉRATION ».
       *
       * `unhideUntil` est une DATE DU SERVEUR, formatée ici et jamais calculée :
       * l'horloge du navigateur n'a pas voix au chapitre sur une fenêtre de sept
       * jours. Quand `canUnhide` est faux, la fenêtre est passée (ou le réseau est
       * archivé) et la phrase le dit, plutôt que de promettre un geste refusé.
       */}
      {sujet?.hidden === true && (
        <p role="status" style={{ padding: '12px 24px 0', color: '#B4581F', fontSize: '13px' }}>
          {sujet.canUnhide
            ? `Ce sujet est masqué : seuls les modérateurs le voient. Vous pouvez le remettre jusqu’au ${new Date(
                sujet.unhideUntil ?? '',
              ).toLocaleDateString('fr-FR')}.`
            : 'Ce sujet est masqué : seuls les modérateurs le voient. Le délai de sept jours est passé — seule l’équipe peut encore le remettre.'}
        </p>
      )}
      <ScreenFrames
        screen="A09"
        desktop={<A09Desktop {...props} />}
        mobile={<A09Mobile {...props} />}
      />
      {/**
       * L'ÉCHEC EST UN FRÈRE DANS UN FRAGMENT, JAMAIS UN PARENT.
       *
       * Un conteneur interposé casse le `position: sticky` de la barre haute et de
       * la colonne de gauche — leçon déjà payée sur `screens/compte/ecran-donnees.tsx`
       * et reprise dans `reseau-screen.tsx`, qui dit pourquoi.
       *
       * Les deux refus qui dessinent un AUTRE écran sont traités plus haut
       * (`refuse`, `introuvable`). Ce qui reste ici est ce qu'un geste a ramené :
       * un `429`, un `403` parce que le rôle a changé entre la lecture et le
       * clic, une coupure. La page reste, le brouillon de réponse reste, et le
       * message du socle dit quoi.
       */}
      {echec !== null && sujet !== null && (
        <p role="status" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
          {echec.message}
        </p>
      )}
    </>
  );
}
