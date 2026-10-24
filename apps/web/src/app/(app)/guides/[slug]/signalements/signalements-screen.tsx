'use client';

import { useEffect, useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A06SignalementsDesktop } from '@/screens/a06/signalementsdesktop.generated';
import { A06SignalementsMobile } from '@/screens/a06/signalementsmobile.generated';
import {
  correction as correctionMaquette,
  guide as guideMaquette,
  panelGuides,
  rail,
  shortcuts,
  signalements as signalementsAvantReponse,
  type A06Data,
} from '@/screens/a06/data';
import { fetchOutdatedFlags } from '@/screens/guides/api';
import { signalementsFrom } from '@/screens/guides/from-api';
import { echecDe } from '@/screens/guides/use-guides';
import { useGuide } from '@/screens/guides/use-guides';
import { notifyError } from '@/components/notifications';
import { PropositionsProvider } from '@/components/propositions-recues';
import type { GuideOutdatedFlagsResponse } from '@app/shared';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « L'AUTEUR DOIT VOIR LES SIGNALEMENTS “A CHANGÉ” »                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, revenant sur son arbitrage de la veille. Ce qui RESTE du précédent,
 * c'est l'ANONYMAT — et il n'est pas tenu par cet écran : il est tenu par la
 * ROUTE, qui ne rend que `{ createdAt, comment }` derrière un schéma `.strict()`.
 * Cette page ne pourrait pas afficher un nom même si on le lui demandait.
 *
 * ── DEUX APPELS, ET POURQUOI DEUX ───────────────────────────────────────────
 *
 * `useGuide(slug)` donne le TITRE et l'adresse du guide (le fil d'Ariane, la carte
 * « VOTRE GUIDE », les trois retours), et il est déjà écrit. `fetchOutdatedFlags`
 * donne la LISTE, et il prend un IDENTIFIANT — pas un slug — donc il ne peut
 * partir qu'APRÈS la réponse du premier. C'est la même séquence que
 * `propositions-screen.tsx` tient pour `GET /guides/:id/proposals`.
 *
 * ⚠ ON N'AJOUTE PAS CETTE LECTURE À `useGuide` : elle est réservée à l'AUTEUR
 * (`guide.write`, N2, `loadOwned`), et `useGuide` sert les QUATRE cadres de A04,
 * dont ceux du lecteur. Un appel posé là aurait tiré un `403 NOT_AUTHOR` sur
 * chaque lecture de guide par un lecteur — c'est-à-dire un échec affiché à qui
 * n'a rien demandé.
 *
 * ── CE QU'ON MONTRE AVANT LA RÉPONSE ────────────────────────────────────────
 *
 * `signalementsAvantReponse`, qui n'est PAS un dessin de maquette (il n'y en a
 * pas) : un compte à « … » et aucune rangée. Un « 0 signalement » servi le temps
 * d'un aller-retour serait un chiffre faux sur la page d'un guide contesté.
 *
 * ── LE REFUS DU SERVEUR EST MONTRÉ, PAS AVALÉ ───────────────────────────────
 *
 * Un lecteur qui tape l'adresse reçoit `403 NOT_AUTHOR` (ou `404` sur un
 * brouillon). On le dit — `notifyError` avec la phrase du socle — et la page reste
 * sur son état d'attente plutôt que d'afficher « Aucun signalement », qui serait
 * une réponse qu'on n'a pas obtenue.
 */
export function SignalementsScreen({ slug }: { readonly slug: string }) {
  const { detail, enTete } = useGuide(slug);
  const [liste, setListe] = useState<GuideOutdatedFlagsResponse | null>(null);

  const guideId = detail?.guide.id ?? null;

  useEffect(() => {
    if (guideId === null) return;
    const abort = new AbortController();
    let vivant = true;
    void fetchOutdatedFlags(guideId, abort.signal)
      .then((r) => {
        if (vivant) setListe(r);
      })
      .catch((error: unknown) => {
        if (!vivant || abort.signal.aborted) return;
        notifyError(echecDe(error).message);
      });
    return () => {
      vivant = false;
      abort.abort();
    };
  }, [guideId]);

  const titre = signalementsAvantReponse.titre;

  const data: A06Data = {
    rail,
    panelGuides,
    shortcuts,
    /**
     * Le guide dont on relit les signalements. Avant la réponse, le dessin de la
     * maquette — comme `propositions-screen.tsx` le fait pour la même carte : « un
     * écran qui montre une planche le temps d'un aller-retour vaut mieux qu'un
     * écran vide qui clignote ».
     */
    guide:
      enTete === null
        ? guideMaquette
        : {
            title: enTete.title,
            href: `/guides/${encodeURIComponent(slug)}`,
            misAJour: enTete.updated,
            utiles: enTete.utiles,
          },
    signalements: liste === null ? signalementsAvantReponse : signalementsFrom(titre, liste),
    /**
     * LES QUATRE PRISES QUE CES DEUX CADRES NE LISENT PAS. Les six cadres de la
     * section partagent une signature (`A06Data`), exactement comme `correction`
     * que les deux cadres « Propositions reçues » ne lisent pas non plus. On y
     * passe le dessin de la maquette plutôt qu'un objet vide.
     */
    correction: correctionMaquette,
  };

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE FOURNISSEUR DES PROPOSITIONS — CETTE PAGE EN A BESOIN SANS LES AFFICHER ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ (audit, lot W1A phase 0.3) : `/guides/:slug/signalements` répondait
   * 500, « PropositionsRecues : hors de PropositionsProvider », y compris en build
   * de production. Les deux cadres de cette page EMPRUNTENT la planche « Propositions
   * reçues » (voir l'en-tête de `page.tsx`) ; leurs composants `OngletsPropositions`
   * et `ListePropositions` lisent le contexte du fournisseur, que seule la page
   * voisine montait.
   *
   * Le fournisseur est monté ICI avec une liste VIDE et aucune décision possible :
   * les signalements « a changé » ne sont pas des propositions, et les cadres
   * retournés par `donnees` ne dessinent ni onglets ni cartes de décision. Si l'un
   * d'eux en lisait un jour, il afficherait un état vide honnête plutôt que de
   * faire tomber la page. `chargement` suit la réponse des signalements.
   */
  return (
    <PropositionsProvider
      items={[]}
      decidable={false}
      chargement={liste === null}
      onDecision={() => undefined}
    >
      <ScreenFrames
        screen="A06"
        desktop={<A06SignalementsDesktop {...data} />}
        mobile={<A06SignalementsMobile {...data} />}
      />
    </PropositionsProvider>
  );
}
