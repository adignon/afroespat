'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH01 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H01Desktop } from '@/screens/h01/desktop.generated';
import { H01Mobile } from '@/screens/h01/mobile.generated';

/**
 * H01 — Fil d'entraide (`/entraide`, 06 §5).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/05 Entraide.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — les
 * littéraux devenus des données l'ont été par DÉCLARATION dans
 * `tools/screens/05-entraide.mjs`, sous la clé `donnees`.
 *
 * COMPOSANT CLIENT, et c'est le jeton qui le décide : il vit en mémoire, dans la
 * clôture de `lib/api/session.ts`, et n'existe que dans le navigateur. Un composant
 * serveur n'a aucun moyen d'appeler `/help` au nom du membre.
 *
 * `chargerH01` est une fonction DE MODULE, donc STABLE : `EcranDonnees` la met dans
 * les dépendances de son effet, et une fonction anonyme rechargerait en boucle.
 *
 * RÈGLE DURE (14 §2) : l'entraide n'est JAMAIS payante. Cet écran ne porte aucun
 * encart d'abonnement, aucun verrou, aucune mention de plan — la maquette n'en
 * dessine pas non plus, ce qui a été vérifié plutôt que supposé.
 */
export default function HelpListPage() {
  return (
    <EcranDonnees charger={chargerH01}>
      {(donnees) => (
        <ScreenFrames
          screen="H01"
          desktop={<H01Desktop {...donnees} />}
          mobile={<H01Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
