'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Capability } from '@app/shared';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { useCapacites } from '@/lib/capacites';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PORTE D'UNE PAGE DE CRÉATION                                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « les boutons […] non inclus dans ses autorisations doivent être
 * désactivés […] quand il clique un pop-up doit apparaître pour lui dire que
 * pour accéder à cette fonctionnalité il faut être de tel niveau. »
 *
 * La feuille « Créer » éteint déjà les six entrées. Mais une page de création a
 * une ADRESSE : on y arrive par un lien reçu, un signet, l'historique. Sans cette
 * garde, un membre de niveau insuffisant verrait le composeur entier, écrirait
 * son texte, et ne découvrirait le refus qu'au moment de publier — après l'effort.
 *
 * Elle ne REMPLACE rien : le serveur refuse toujours, et c'est lui qui protège.
 * Elle explique plus tôt, ce qui est exactement ce que `lib/api/session.ts`
 * autorise le niveau à faire.
 *
 * ── ELLE N'EFFACE PAS LA PAGE ───────────────────────────────────────────────
 *
 * La fenêtre s'ouvre PAR-DESSUS, et « Plus tard » ramène d'où l'on vient. Vider
 * la page sous la fenêtre laisserait un écran blanc à qui ferme, et effacerait
 * le contexte au moment précis où il faut comprendre ce qu'on manque.
 */
export function GardeNiveau({ capacite }: { readonly capacite: Capability }) {
  const router = useRouter();
  const { niveau, peut } = useCapacites();
  const [ferme, setFerme] = useState(false);

  /**
   * ELLE NE S'OUVRE QU'UNE FOIS LE NIVEAU CONNU. `niveau === null` veut dire
   * « `/me` n'a pas répondu » : ouvrir sur une supposition afficherait une
   * fenêtre de refus à quelqu'un qui a le droit, le temps d'un aller-retour.
   */
  const refuse = niveau !== null && !peut(capacite);

  /** Le membre monte de niveau dans un autre onglet : la garde se rouvre. */
  useEffect(() => {
    if (!refuse) setFerme(false);
  }, [refuse]);

  return (
    <FenetreNiveau
      capacite={refuse && !ferme ? capacite : null}
      onFermer={() => {
        setFerme(true);
        router.back();
      }}
    />
  );
}
