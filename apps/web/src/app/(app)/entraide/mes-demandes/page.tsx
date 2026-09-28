import { ScreenFrames } from '@/screens/frames';
import { H09Desktop } from '@/screens/h09/desktop.generated';
import { H09Mobile } from '@/screens/h09/mobile.generated';

/**
 * H09 — Mes demandes (`/entraide/mes-demandes`).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 *
 * CETTE PLANCHE N'EST PAS DANS T5, qui s'arrête à H08. Elle est pourtant légitime :
 * 06 §5 décrit le panneau Entraide avec « Mes demandes · Mes réponses », et l'API
 * expose `GET /help/mine`. La maquette écrit la route sous son numéro de planche —
 * c'est elle qui a été suivie. Arbitrage consigné dans le rapport.
 *
 * Le titre diffère d'un cadre à l'autre, et c'est la maquette qui le veut :
 * « Mes demandes » sur ordinateur, « Fil d'entraide » sur mobile — où « Mes
 * demandes » devient une pastille sous un en-tête commun.
 */
export default function MyHelpRequestsPage() {
  return <ScreenFrames screen="H09" desktop={<H09Desktop />} mobile={<H09Mobile />} />;
}
