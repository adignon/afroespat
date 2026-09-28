import { ScreenFrames } from '@/screens/frames';
import { E01Desktop } from '@/screens/e01/desktop.generated';
import { E01Mobile } from '@/screens/e01/mobile.generated';

/**
 * E01 — Agenda (`/agenda`, 09 §3.5).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html` : les styles en ligne sont ceux de
 * la maquette, à l'identique.
 *
 * LES DEUX CADRES NE TITRENT PAS PAREIL, et la spec explique pourquoi : sur
 * ordinateur le titre est le JOUR SÉLECTIONNÉ (« Samedi 21 septembre »), sur mobile
 * c'est la section (« Agenda »), parce que le mobile porte son sélecteur de date en
 * bande horizontale défilante sous le titre (09 §3.5).
 *
 * Aucun état : la maquette écrit son contenu en clair (voir `@/screens/agenda/data`).
 * Le jour sélectionné, les points verts et terre cuite du calendrier vertical et le
 * tri « mes participations en tête » viendront de `GET /events/calendar` et
 * `GET /events`.
 */
export default function AgendaPage() {
  return <ScreenFrames screen="E01" desktop={<E01Desktop />} mobile={<E01Mobile />} />;
}
