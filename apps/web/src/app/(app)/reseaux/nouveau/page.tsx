'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CommunityDetailResponse } from '@app/shared';
import { ScreenFrames } from '@/screens/frames';
import { A10Desktop } from '@/screens/a10/desktop.generated';
import { A10Mobile } from '@/screens/a10/mobile.generated';
import { useCreation } from '@/screens/reseaux/use-creation';
import { useContactsInvitables } from '@/screens/reseaux/use-contacts-invitables';
import { GardeNiveau } from '@/components/garde-niveau';

/**
 * A10 — créer un réseau. `/reseaux/nouveau`
 *
 * Les trois visibilités de §7 y sont dessinées, « Sur invitation » comprise, dont
 * la maquette rappelle qu'elle est invisible dans Découvrir — ce n'est pas un
 * détail d'affichage : le service l'exclut du `WHERE` de la découverte.
 *
 * ── LE FORMULAIRE EST VIVANT DEPUIS CE LOT ────────────────────────────────
 *
 * Mesuré avant : zéro champ, zéro geste sur les deux planches. Le nom était un
 * `<div>` portant « Entrepreneurs africains à Lyon », la description un `<div>`,
 * les trois visibilités des `<div>` sans clic, « Inviter » un `<span>`, et
 * « Créer le réseau » un `<button>` nu. Tout passe maintenant par des
 * adaptations déclarées (`A10_*` dans `tools/generate-screens.mjs`) : la maquette
 * n'est pas réécrite, elle est transcodée.
 *
 * ── LA LISTE DES CANDIDATS EST PEUPLÉE DEPUIS CE LOT ──────────────────────
 *
 * Le porteur : « Créer un réseau : oui fais-le. »
 *
 * CET EN-TÊTE DISAIT L'INVERSE, et il décrivait un blocage réel : la page passait
 * `AUCUN_CANDIDAT`, un tableau vide figé, parce qu'aucune route du module
 * `communities` ne rend les contacts d'un membre. Conséquence mesurée : le
 * compteur restait à « 0 sur 5 », `creerPret` à faux, et « Créer le réseau » ne
 * s'allumait jamais. Créer un réseau depuis l'interface était IMPOSSIBLE.
 *
 * `useContactsInvitables` lit `GET /me/connections` — le module `connections`,
 * qui est bien là où vivent les relations du lecteur — en réemployant l'appel que
 * la fenêtre de partage, la fenêtre « Créer » de la barre haute et la page des
 * contacts font déjà. Les deux écarts de maquette qui restent (la ville sous
 * chaque nom, la pastille de vérification) sont nommés dans l'en-tête du crochet.
 *
 * ⚠ IL FAUT CINQ CONTACTS POUR CRÉER UN RÉSEAU, et c'est la règle du serveur, pas
 * un effet de bord de l'écran : `createCommunitySchema` exige
 * `COMMUNITY_MIN_INVITES` = 5 et le service revérifie. Un compte qui en a moins
 * voit donc un bouton éteint — avec la phrase de la maquette « Invitez encore N
 * membres » dessous, et, s'il n'en a AUCUN, la ligne d'état ci-dessous qui le
 * dit. Sans elle on chercherait la panne dans le bouton.
 */
export default function NouveauReseauPage() {
  const router = useRouter();

  /**
   * APRÈS LA CRÉATION, ON OUVRE LE RÉSEAU. C'est la page qui le décide — elle a
   * le routeur — et non le crochet : la même création, demandée depuis une
   * fenêtre, n'irait pas au même endroit.
   */
  const apresCreation = useCallback(
    (reseau: CommunityDetailResponse) => {
      router.push(`/reseaux/${encodeURIComponent(reseau.slug)}`);
    },
    [router],
  );

  /** La croix de l'en-tête mobile ramène d'où l'on vient, comme `GardeNiveau`. */
  const surFermeture = useCallback(() => {
    router.back();
  }, [router]);

  const { candidats, aucun } = useContactsInvitables();
  const { data, echec } = useCreation(candidats, apresCreation, surFermeture);

  return (
    <>
      <ScreenFrames
        screen="A10"
        desktop={<A10Desktop {...data} />}
        mobile={<A10Mobile {...data} />}
      />
      {/**
       * LE COMPTEUR N'EST PLUS ÉCRIT ICI : il était affiché sous les cadres parce
       * que la pastille « 3 sur 5 », la barre et la phrase « Invitez encore 2
       * membres » étaient peintes en dur DANS la maquette. Elles sont liées
       * maintenant (`invitesTexte`, `invitesBarre`, `invitesReste`), donc ce
       * paragraphe doublait l'information à l'écran.
       */}
      {/**
       * AUCUN CONTACT — LE SEUL ÉTAT QU'IL FAUT DIRE, ET LA MAQUETTE NE LE DESSINE
       * PAS.
       *
       * Elle montre quatre candidats et ne prévoit rien pour zéro. La phrase est
       * donc écrite ICI, hors des cadres transcodés, exactement comme la ligne de
       * refus juste en dessous : aucune planche n'est réécrite, et le membre
       * apprend pourquoi le bouton reste éteint au lieu de le croire cassé.
       * REMONTÉ : il manque un état vide sur la carte d'invitation.
       */}
      {aucun && (
        <p role="status" style={{ padding: '0 24px 12px', color: '#5D6B66', fontSize: '13px' }}>
          Vous n’avez encore aucun contact : tapez le pseudo exact d’un membre pour l’inviter. Un réseau d’intérêt demande cinq invitations.
        </p>
      )}
      {echec !== null && (
        <p role="status" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
          {/**
           * L'INVITATION de §7.3, jamais une erreur sèche — et jamais le message
           * brut du serveur sur un `429`, qui dit « patientez un instant » pour
           * une attente qui peut valoir une heure.
           */}
          {echec.levelRequired?.labelFr === undefined
            ? echec.message
            : `Pour ${echec.levelRequired.labelFr}, vérifiez votre compte.`}
        </p>
      )}
      {/**
       * `community.create` est **N2**, et le front PRÉVIENT sans autoriser : la
       * garde explique dès l'arrivée, parce qu'une page de création a une adresse
       * et qu'on y arrive par un lien ou un signet. Le serveur, lui, refuse.
       */}
      <GardeNiveau capacite="community.create" />
    </>
  );
}
