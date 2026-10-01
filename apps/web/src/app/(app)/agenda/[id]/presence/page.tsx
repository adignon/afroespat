import { PresenceEcran } from './presence-ecran';

/**
 * E04 — Présence, vue organisateur (`/agenda/:id/presence`, 09 §3.3).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html`.
 *
 * Le cadre mobile titre « Présence · 18 / 23 » : le compteur est DANS le titre,
 * faute de place pour le sous-titre que l'ordinateur affiche à côté. Le titre
 * déclaré le reprend tel quel, et puisqu'il est devenu une donnée, le générateur
 * le reprend sur sa forme liée.
 *
 * CE QUI DÉCIDE LA CASE COCHÉE EST `checkedIn`, PAS LE RSVP. C'est la donnée qui
 * alimente l'indicateur clé de la plateforme (« 30 % des inscrits participent à un
 * événement physique en 3 mois ») et le crédit `EVENT_ORGANIZED` (≥ 3 présents
 * cochés). Un inscrit `GOING` n'est pas un présent, et confondre les deux champs
 * voisins est le défaut que `screens/agenda/agenda.test.ts` garde.
 *
 * LES CASES NE SONT PAS COCHABLES : la maquette les dessine en `<span>`.
 * `POST /events/:id/check-in` existe, applique la fenêtre H−0 → H+6 pour un
 * participant et la ferme sur le STATUT pour l'organisateur. Brancher le bouton
 * « Enregistrer » demanderait des contrôles que la maquette ne dessine pas.
 *
 * QUI N'EST PAS L'ORGANISATEUR NE VOIT PAS DE PRÉSENCE, et ce n'est pas un
 * renoncement : §5 ne lui envoie ni `userId` ni `checkedIn`. La ligne ne dessine
 * alors AUCUNE case — ne pas savoir n'est pas dire « absent » — et la pastille de
 * compteur disparaît au lieu d'afficher un zéro que le serveur n'a pas envoyé.
 */
export default async function EventAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PresenceEcran id={id} />;
}
