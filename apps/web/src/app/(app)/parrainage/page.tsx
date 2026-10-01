'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH05 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H05Desktop } from '@/screens/h05/desktop.generated';
import { H05Mobile } from '@/screens/h05/mobile.generated';

/**
 * H05 — Trouver un parrain (`/parrainage`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * RÈGLE DURE (§2.4) : le parrainage n'implique JAMAIS d'argent. Le bandeau qui le
 * dit voyage dans le `meta` de chaque réponse (`MENTORSHIP_MONEY_BANNER`), et
 * `mentorshipMetaSchema` l'EXIGE : une API qui cesserait de l'envoyer verrait sa
 * réponse refusée, au lieu de produire une liste de parrains sans son
 * avertissement.
 *
 * LA LISTE DE PARRAINS N'EST PAS LIÉE : chaque carte contient une LISTE de pastilles
 * de types de parcours — deux pour Aïcha, une pour Ibrahim — c'est-à-dire une boucle
 * DANS une boucle. Rien n'a été vérifié sur un `<sc-for>` imbriqué, et le vérifier
 * fait partie du même travail. Remonté plutôt que monté à moitié.
 */
export default function MentorsPage() {
  return (
    <EcranDonnees charger={chargerH05}>
      {(donnees) => (
        <ScreenFrames
          screen="H05"
          desktop={<H05Desktop {...donnees} />}
          mobile={<H05Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
