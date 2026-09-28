import { ScreenFrames } from '@/screens/frames';
import { H03Desktop } from '@/screens/h03/desktop.generated';
import { H03Mobile } from '@/screens/h03/mobile.generated';

/**
 * H03 — Publier une demande (`/entraide/nouveau`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 *
 * LES CHAMPS SONT CEUX DE LA MAQUETTE, c'est-à-dire DESSINÉS : des `<div>` portant
 * un exemple de saisie, pas des `<input>`. Ils ne sont pas encore saisissables, et
 * c'est délibéré — les rendre vivants demande de décider du type, du nom, du mode de
 * saisie et de l'autocomplétion de chacun, ce que le générateur fait par déclaration
 * explicite (`FIELD_ADAPTATIONS`) et non par reconnaissance de forme. Ce travail
 * appartient au lot qui branche `POST /help`, avec ses règles : titre 10–120, corps
 * 20–2 000, ville obligatoire, `USE_SERVICES` sur logement et emploi.
 */
export default function NewHelpRequestPage() {
  return <ScreenFrames screen="H03" desktop={<H03Desktop />} mobile={<H03Mobile />} />;
}
