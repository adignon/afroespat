import { ScreenFrames } from '@/screens/frames';
import { E03Desktop } from '@/screens/e03/desktop.generated';
import { E03Mobile } from '@/screens/e03/mobile.generated';

/**
 * E03 — Créer un événement (`/agenda/nouveau`, 09 §3.1).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html`.
 *
 * L'ENCART DE QUOTA EST LÉGITIME ICI, contrairement à ce qu'il serait dans l'entraide.
 * La maquette affiche « 1 événement sur 1 ce mois-ci · Réinitialisé le 1er octobre » et
 * un bouton « Découvrir Premium » : c'est exactement 09 §3.1 — « 1 par mois en gratuit
 * (`usage_counters` EVENTS_CREATED), illimité en Premium » — et T5 le demande
 * explicitement (« Encart de quota … en gratuit »). La règle dure de 14 §2 qui interdit
 * toute mention de plan porte sur l'ENTRAIDE, pas sur l'agenda ; les dix écrans H01–H10
 * ont été vérifiés et n'en portent aucune.
 *
 * L'adresse est en texte libre, avec la note « Adresse en texte libre, jamais
 * géolocalisée » que la maquette écrit — la règle dure de 09 §3.1.
 */
export default function NewEventPage() {
  return <ScreenFrames screen="E03" desktop={<E03Desktop />} mobile={<E03Mobile />} />;
}
