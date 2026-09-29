import { ScreenFrames } from '@/screens/frames';
import { K05Desktop } from '@/screens/k05/desktop.generated';
import { K05Mobile } from '@/screens/k05/mobile.generated';

/**
 * K05 — « Contacts » (`/compte/contacts`, T5 §9).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html`. Rien n'est
 * réécrit ; la page ne fait que servir les deux cadres de la maquette.
 *
 * LES QUATRE ONGLETS SONT DESSINÉS CÔTE À CÔTE, pas pilotés : la planche
 * d'ordinateur montre « Mes contacts · 12 » ET les demandes reçues, les
 * suggestions et les bloqués, chacun dans sa carte. Ce n'est pas un écran à
 * onglets que la maquette dessine, c'est une page qui les empile — et la
 * transcrire autrement serait redessiner. Le cadre mobile, lui, s'arrête à la
 * liste des contacts sous sa barre d'onglets.
 */
export default function ContactsPage() {
  return <ScreenFrames screen="K05" desktop={<K05Desktop />} mobile={<K05Mobile />} />;
}
