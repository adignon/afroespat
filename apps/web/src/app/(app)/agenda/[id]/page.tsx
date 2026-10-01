import { EvenementEcran } from './evenement-ecran';

/**
 * E02 — Événement (`/agenda/:id`, 09 §3.2 et §6).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html`.
 *
 * LES TROIS BOUTONS DE RSVP RESTENT DES `<span>`, et c'est la maquette : ils ne
 * sont ni cliquables ni atteignables au clavier. Ce que ce lot a branché, c'est
 * LEQUEL est actif — `myStatus` le décide, et `WAITLIST` compte comme « Je viens »
 * puisque c'est le serveur qui a basculé la réponse du membre faute de place
 * (§3.2). `PUT /events/:id/rsvp` les rendra vivants, et il attend des contrôles
 * que la maquette ne dessine pas : un bouton inerte est moins nuisible qu'un
 * bouton qui ment.
 *
 * LES TROIS CARTES DE LA COLONNE DE DROITE SONT DES ÉTATS, et chacune passe
 * maintenant sous sa condition : « COMPLET » n'apparaît qu'à capacité atteinte,
 * « Vous êtes 3e sur la liste » qu'avec une position réelle, « VUE ORGANISATEUR »
 * qu'à l'organisateur — et c'est le serveur qui le dit (`isOrganizer`).
 *
 * UN ÉVÉNEMENT RÉSERVÉ À UN RÉSEAU dont je ne suis pas membre répond `404`, jamais
 * `403` (T4 §3, règle dure §10) : l'écran affiche alors le message d'absence du
 * socle, et ne confirme pas l'existence de l'événement.
 */
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EvenementEcran id={id} />;
}
