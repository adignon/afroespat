'use client';

import { FenetreMotif } from './ui';

/**
 * Une confirmation sans motif saisi, pour les gestes destructeurs ou visibles des membres dont la route ne prend pas de
 * motif (supprimer, retirer, désactiver). C'est `FenetreMotif` : même fenêtre accessible, même bouton « Annuler »,
 * l'action est tracée côté serveur. Le texte dit CE QUI ARRIVE, pas seulement « Êtes-vous sûr ? ».
 */
export function Confirmation({
  ouverte,
  titre,
  consigne,
  libelle,
  onConfirmer,
  onFermer,
  occupe,
  message,
}: {
  readonly ouverte: boolean;
  readonly titre: string;
  readonly consigne: string;
  readonly libelle: string;
  readonly onConfirmer: () => void;
  readonly onFermer: () => void;
  readonly occupe: boolean;
  readonly message: { ton: 'info' | 'attention'; texte: string } | null;
}) {
  return (
    <FenetreMotif ouverte={ouverte} titre={titre} consigne={consigne} min={0} motifRequis={false} libelleConfirmer={libelle} onConfirmer={onConfirmer} onFermer={onFermer} occupe={occupe} message={message} />
  );
}
