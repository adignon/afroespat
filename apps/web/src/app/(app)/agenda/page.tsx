import { AgendaEcran } from './agenda-ecran';

/**
 * E01 — Agenda (`/agenda`, 09 §3.5).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html` : les styles en ligne sont ceux
 * de la maquette, à l'identique. Ce qui a changé dans ce lot n'est pas le dessin —
 * il n'a pas bougé d'une virgule — mais le fait que l'écran LIT enfin ses données.
 *
 * LES DEUX CADRES NE TITRENT PAS PAREIL, et la spec explique pourquoi : sur
 * ordinateur le titre est le JOUR SÉLECTIONNÉ, sur mobile c'est la section, parce
 * que le mobile porte son sélecteur de date en bande horizontale défilante sous le
 * titre (09 §3.5). Le titre d'ordinateur est donc une DONNÉE, et le générateur le
 * reprend sur sa forme liée.
 *
 * COMPOSANT SERVEUR qui délègue à un composant client : le jeton d'accès vit en
 * mémoire, dans la clôture de `lib/api/session.ts`, et n'existe que dans le
 * navigateur — un composant serveur n'a aucun moyen d'appeler l'API au nom du
 * membre. La raison complète est dans `screens/compte/ecran-donnees.tsx`.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jour = params['jour'];
  return <AgendaEcran jour={typeof jour === 'string' ? jour : null} />;
}
