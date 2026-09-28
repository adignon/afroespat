import { ScreenFrames } from '@/screens/frames';
import { E02Desktop } from '@/screens/e02/desktop.generated';
import { E02Mobile } from '@/screens/e02/mobile.generated';

/**
 * E02 — Événement (`/agenda/:id`, 09 §3.2 et §6).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html`.
 *
 * LES TROIS BOUTONS DE RSVP SONT DESSINÉS EN `<span>`, dans une grille de trois
 * colonnes : « Je viens » actif en vert, « Peut-être » et « Je ne viens pas » en gris.
 * Ce ne sont donc pas encore des contrôles — ils ne sont ni cliquables ni atteignables
 * au clavier. La maquette les montre dans l'état qu'elle a choisi ; `PUT /events/:id/rsvp`
 * les rendra vivants, avec la bascule en `WAITLIST` que 09 §3.2 impose quand la
 * capacité est atteinte. L'état complet, lui, est déjà dessiné : la planche porte une
 * carte « COMPLET » avec « Rejoindre la liste d'attente » et « Vous êtes 3e sur la
 * liste » — c'est un ÉTAT de la colonne de droite, pas le bouton principal.
 */
export default function EventPage() {
  return <ScreenFrames screen="E02" desktop={<E02Desktop />} mobile={<E02Mobile />} />;
}
