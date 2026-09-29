import { ScreenFrames } from '@/screens/frames';
import { D12Desktop } from '@/screens/d12/desktop.generated';

/**
 * D12 — pages statiques et annonces. `/admin/contenu` (15 §4.1 et §4.2, T5 D12).
 *
 * L'ÉCRAN PORTE LA CONSÉQUENCE LA PLUS LOURDE DE CE MODULE, et la maquette
 * l'écrit en clair sous l'éditeur : « Publier cette version redemandera le
 * consentement de tous les membres. » C'est §4.1 — « publier une nouvelle version
 * des conditions ou de la confidentialité déclenche la redemande de consentement
 * (module 01 §2.9) » — dite à la personne qui va cliquer, au moment où elle va
 * cliquer. C'est exactement ce qu'on attend d'un écran d'administration, et c'est
 * pourquoi « Publier la v4 » reste INERTE dans ce lot : un bouton qui semble
 * publier sans publier serait pire qu'un bouton absent.
 *
 * L'annonce, elle, est dessinée avec son ciblage (« Lyon · Bénin · toutes
 * phases »), sa période et son aperçu de bandeau — §4.2.
 */
export default function Page() {
  return <ScreenFrames screen="D12" desktop={<D12Desktop />} />;
}
