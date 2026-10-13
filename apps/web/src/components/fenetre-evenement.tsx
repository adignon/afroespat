'use client';

import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';
import { E03FormulaireDesktop } from '@/screens/e03/formulaire-desktop.generated';
import { E03FormulaireMobile } from '@/screens/e03/formulaire-mobile.generated';
import { SQUELETTE_E03 } from '@/screens/agenda/appels';
import { useFormulaireEvenement } from '@/screens/agenda/use-formulaire-evenement';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « CRÉER UN ÉVÉNEMENT DU RÉSEAU » — LA PAGE E03, EN FENÊTRE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Ajoute dans Événement la possibilité d'avoir un bouton d'ajout
 * d'événement qui affiche la page Créer un événement (qui est actuellement
 * dessinée) en modal et permet de créer un événement dans le réseau. »
 *
 * Le CONTENU est celui de la page `/agenda/nouveau` — les deux régions que la
 * déclaration de E03 extrait (`E03FormulaireDesktop`, `E03FormulaireMobile`),
 * branchées par la même adaptation et nourries par le même crochet. Seule la
 * ligne « Réservé à un réseau » change : elle est FIGÉE sur le réseau ouvert.
 *
 * Le CHÂSSIS est `PanneauFenetre` — voile, rayon 28, en-tête et croix — comme
 * les autres fenêtres du dépôt sans planche propre. Posée UNE SEULE FOIS par
 * l'écran, hors des deux cadres.
 */
export function FenetreEvenement({
  ouverte,
  reseauId,
  onFermer,
  onCree,
}: {
  readonly ouverte: boolean;
  readonly reseauId: string;
  readonly onFermer: () => void;
  readonly onCree: () => void;
}) {
  const formulaire = useFormulaireEvenement({ reseauId, actif: ouverte, onCree });
  const donnees = { ...SQUELETTE_E03, formulaire };

  return (
    <Modal
      open={ouverte}
      onClose={onFermer}
      titleId="evenement-reseau-titre"
      name="EVENEMENT-RESEAU"
      desktop={
        <PanneauFenetre
          titreId="evenement-reseau-titre"
          titre="Créer un événement du réseau"
          largeur="680px"
        >
          <E03FormulaireDesktop {...donnees} />
        </PanneauFenetre>
      }
      mobile={
        <PanneauFenetre titreId="evenement-reseau-titre" titre="Créer un événement" feuille>
          <E03FormulaireMobile {...donnees} />
        </PanneauFenetre>
      }
    />
  );
}
