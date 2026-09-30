'use client';

import { ScreenFrames } from '@/screens/frames';
import { A10Desktop } from '@/screens/a10/desktop.generated';
import { A10Mobile } from '@/screens/a10/mobile.generated';
import { a10Fallback } from '@/screens/a10/data';
import { useCreation } from '@/screens/reseaux/use-creation';

/**
 * A10 — créer un réseau. `/reseaux/nouveau`
 *
 * Les trois visibilités de §7 y sont dessinées, « Sur invitation » comprise, dont
 * la maquette rappelle qu'elle est invisible dans Découvrir — ce n'est pas un
 * détail d'affichage : le service l'exclut du `WHERE` de la découverte.
 *
 * ── LA LISTE DES CANDIDATS N'EST PAS ENCORE PEUPLÉE, ET C'EST DIT ──────────
 *
 * La maquette dessine cinq contacts à inviter, « Sandra M. », « Kofi Boateng »…
 * Aucune route de CE module ne rend les contacts d'un membre : `GET
 * /communities/:id/members` liste les membres d'un réseau, pas les relations du
 * lecteur. Les contacts vivent dans le module `connections`, hors de ce lot.
 *
 * On passe donc une liste VIDE plutôt que cinq noms inventés : un bouton
 * « Inviter » sous un contact qui n'existe pas enverrait un handle que l'API
 * rangerait dans `unresolved`, et le compteur « 3 sur 5 » mentirait. Remonté.
 */
export default function NouveauReseauPage() {
  const { data, echec, invitesChoisis, invitesRequis } = useCreation([]);
  const props = data ?? a10Fallback;

  return (
    <>
      <ScreenFrames
        screen="A10"
        desktop={<A10Desktop {...props} />}
        mobile={<A10Mobile {...props} />}
      />
      <p style={{ padding: '0 24px 12px', color: '#5D6B66', fontSize: '13px' }}>
        {/**
         * Le compteur lit `COMMUNITY_MIN_INVITES`, la MÊME constante que le
         * schéma partagé applique et que l'API refuse. Une seconde définition
         * ici finirait par autoriser quatre invités là où le serveur en exige
         * cinq.
         */}
        {invitesChoisis} sur {invitesRequis} invitations requises
      </p>
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
    </>
  );
}
