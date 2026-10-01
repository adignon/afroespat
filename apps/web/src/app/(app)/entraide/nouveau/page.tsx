'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH03 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H03Desktop } from '@/screens/h03/desktop.generated';
import { H03Mobile } from '@/screens/h03/mobile.generated';

/**
 * H03 — Publier une demande (`/entraide/nouveau`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * CET ÉCRAN NE LIT QUE SON BANDEAU, et c'est la maquette qui le décide : ses
 * champs sont des exemples devenus `placeholder` au transcodage, ses cinq types
 * sont l'énumération `HelpType2`, et « Pour un logement ou un emploi, utilisez
 * Services. » est `HELP_USE_SERVICES_HINT` — déjà source unique dans `@app/shared`.
 *
 * « Publier la demande » est INERTE. Une demande d'entraide est une publication
 * adressée à une ville entière ; un bouton qui mentirait sur son envoi est pire
 * qu'un bouton qui ne fait rien. C'est la même règle que « Publier » dans Parcours.
 *
 * L'ENCART « OFFRE · NIVEAU L0 » n'est pas piloté par le niveau du jeton, et c'est
 * délibéré : le niveau est AFFICHÉ, jamais employé pour autoriser (00 §7.3). On
 * tente, et c'est le serveur qui répond `403 LEVEL_REQUIRED`.
 */
export default function HelpComposePage() {
  return (
    <EcranDonnees charger={chargerH03}>
      {(donnees) => (
        <ScreenFrames
          screen="H03"
          desktop={<H03Desktop {...donnees} />}
          mobile={<H03Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
