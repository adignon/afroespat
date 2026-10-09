import type { ReactNode } from 'react';
import { GardeSession } from '@/components/garde-session';

/**
 * LE LAYOUT DU GROUPE `(app)` — il n'existait pas.
 *
 * Toutes les pages de l'application connectée vivent dans ce groupe, et aucune
 * n'avait d'enveloppe commune. C'est la raison pour laquelle la garde de session
 * manquait : il n'y avait pas d'endroit où elle aurait pu vivre, donc personne ne
 * s'est aperçu qu'elle n'y était pas.
 *
 * Ce fichier ne fait qu'une chose, et volontairement : il pose la garde. Il
 * n'ajoute aucun dessin, aucune coquille, aucun style — ceux-là sont transcodés
 * des maquettes, écran par écran, et une enveloppe qui en ajouterait serait du
 * dessin inventé.
 *
 * Il reste un composant SERVEUR : seule la garde est cliente. Les pages du groupe
 * gardent donc leur rendu serveur, et le HTML servi garde ses mots — ce que deux
 * tests de `e2e/shell.spec.ts` vérifient en lisant la réponse sans exécuter de
 * JavaScript.
 */
export default function LayoutApplication({
  children,
  fenetre,
}: {
  readonly children: ReactNode;
  /**
   * ── LE CRÉNEAU DE FENÊTRE ────────────────────────────────────────────────
   *
   * Le porteur : « la création et le display des stories sont en fait des modals
   * qui couvrent tout l'écran et non des nouvelles pages de lien ».
   *
   * `@fenetre` est un CRÉNEAU PARALLÈLE : il se rend À CÔTÉ de `children`, sans
   * le démonter. Les routes `@fenetre/(.)stories/…` interceptent `/stories/…`
   * quand on y arrive depuis une page du groupe, et la page d'origine reste
   * visible dessous, sous un voile. La même adresse tapée directement sert la
   * page entière — c'est tout l'intérêt, et c'est pourquoi aucune route n'a été
   * supprimée.
   *
   * `default.tsx` rend `null` partout ailleurs : sans lui, Next rendrait un 404
   * pour ce créneau dès qu'on quitte une story.
   */
  readonly fenetre: ReactNode;
}) {
  return (
    <GardeSession>
      {children}
      {fenetre}
    </GardeSession>
  );
}
