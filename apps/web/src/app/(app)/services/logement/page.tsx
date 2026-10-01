'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { chargerS01 } from '@/screens/services/appels';
import { S01Desktop } from '@/screens/s01/desktop.generated';
import { S01Mobile } from '@/screens/s01/mobile.generated';

/**
 * S01 — Annonces de logement, la liste (`/services/logement`, 10 §7).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/06 Services.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — et rien
 * n'a été réécrit pour brancher l'API non plus : les valeurs affichées sont
 * devenues des interpolations par une DÉCLARATION dans
 * `tools/screens/06-services.mjs`, sous la clé `donnees`.
 *
 * RESPONSIVE : la maquette fournit DEUX designs — un cadre ordinateur de 1440 px
 * et un cadre mobile de 390 px. `ScreenFrames` bascule au seuil de 1024 px que
 * fixe §10.1, plutôt que d'inventer un comportement intermédiaire que le design
 * n'a pas défini.
 *
 * CETTE PAGE EST DEVENUE CLIENTE, et ce n'est pas un choix de confort. Le jeton
 * d'accès vit en mémoire, dans la clôture de `lib/api/session.ts`, et il n'existe
 * que dans le navigateur — décision de `session.ts`, qui refuse tout stockage
 * lisible par JavaScript. Un composant serveur n'a donc aucun moyen d'appeler
 * `/me/subscription` au nom du membre. Voir `screens/compte/ecran-donnees.tsx`,
 * que les dix écrans de ce module réemploient.
 *
 * RÈGLE DURE (10 §2.2) : le bandeau de non-paiement est affiché en permanence, ET
 * « renvoyé par l'API sur chaque liste ». Le cadre d'ordinateur affiche donc
 * `meta.safetyBanner` — le texte vient du serveur, qui est la seule forme de la
 * règle qu'un déploiement front ne peut pas effacer. Le cadre mobile garde
 * l'abréviation de la maquette (« Aucun versement avant visite. »), qu'elle écrit
 * pour tenir dans 390 px.
 *
 * RÈGLE DURE (14 §17) : l'encart partenaire ne vit QUE sur une étape de parcours
 * et « en pied de la section Logement ». Celui du bas de cette liste est donc le
 * seul de tout le module, ce que `e2e/services.spec.ts` vérifie dans les deux
 * sens. Il n'est PAS branché : aucune route de ce module ne rend de placement
 * partenaire.
 */
export default function LogementListePage() {
  return (
    <EcranDonnees charger={chargerS01} attente="Chargement des annonces…">
      {(donnees) => (
        <ScreenFrames
          screen="S01"
          desktop={<S01Desktop {...donnees} />}
          mobile={<S01Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
