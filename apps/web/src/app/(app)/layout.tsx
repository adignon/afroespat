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
export default function LayoutApplication({ children }: { readonly children: ReactNode }) {
  return <GardeSession>{children}</GardeSession>;
}
