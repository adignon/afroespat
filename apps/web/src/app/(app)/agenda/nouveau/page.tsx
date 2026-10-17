'use client';

import { useRouter } from 'next/navigation';
import { SQUELETTE_E03, chargerE03 } from '@/screens/agenda/appels';
import { useFormulaireEvenement } from '@/screens/agenda/use-formulaire-evenement';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { E03Desktop } from '@/screens/e03/desktop.generated';
import { E03Mobile } from '@/screens/e03/mobile.generated';
import { GardeNiveau } from '@/components/garde-niveau';

/**
 * E03 — Créer un événement (`/agenda/nouveau`, 09 §3.1).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html`.
 *
 * L'ENCART DE QUOTA EST LÉGITIME ICI, contrairement à ce qu'il serait dans
 * l'entraide. La maquette affiche « 1 événement sur 1 ce mois-ci · Réinitialisé le
 * 1er octobre » et un bouton « Découvrir Premium » : c'est exactement 09 §3.1 — « 1
 * par mois en gratuit (`usage_counters` EVENTS_CREATED), illimité en Premium » — et
 * T5 le demande explicitement. La règle dure de 14 §2 qui interdit toute mention de
 * plan porte sur l'ENTRAIDE, pas sur l'agenda. Les deux nombres viennent maintenant
 * de `GET /me/subscription`, et la date de `usage.resetsAt`.
 *
 * L'adresse est en texte libre, avec la note « Adresse en texte libre, jamais
 * géolocalisée » que la maquette écrit — la règle dure de 09 §3.1. Elle n'est pas
 * liée : c'est du texte de RÈGLE, vrai pour tout le monde et en tout temps.
 *
 * ⚠ CE PARAGRAPHE DISAIT « CET ÉCRAN NE PEUT PAS ENCORE CRÉER », ET CE N'EST PLUS
 * VRAI. Les champs dessinés en `<div>` sont devenus leurs contrôles par
 * `RV_E03_FORMULAIRE` (`tools/adaptations/reseau-vivant.mjs`), et l'état du
 * formulaire vit dans `useFormulaireEvenement` — le même crochet que la fenêtre
 * « Créer un événement du réseau » de l'onglet « Événements » d'un réseau. La
 * ligne « Réservé à un réseau » liste mes réseaux (`GET /communities`, `mine`).
 * Les bornes de §3.1 restent celles du serveur : son refus s'affiche tel quel.
 *
 * `charger` EST UNE FONCTION DE MODULE, donc stable : cet écran n'a aucun
 * paramètre de route, et il n'a pas besoin de `useCallback`.
 */
export default function NewEventPage() {
  const router = useRouter();
  const formulaire = useFormulaireEvenement({
    actif: true,
    onCree: (id) => {
      router.push(`/agenda/${id}`);
    },
  });
  return (
    <>
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant « DisaporyPlus Chargement de l'agenda... » et rien d'autre — ni
       * rail, ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_E03} charger={chargerE03}>
      {(donnees) => (
        <ScreenFrames
          screen="E03"
          desktop={<E03Desktop {...donnees} formulaire={formulaire} />}
          mobile={<E03Mobile {...donnees} formulaire={formulaire} />}
        />
      )}
    </EcranDonnees>
      <GardeNiveau capacite="event.create" />
    </>
  );
}
