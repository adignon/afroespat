'use client';

import { chargerK01 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K01Desktop } from '@/screens/k01/desktop.generated';
import { K01Mobile } from '@/screens/k01/mobile.generated';

/**
 * K01 — « Mon profil » (`/compte/profil`, T5 §9).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — et rien
 * n'a été réécrit pour brancher l'API non plus : les valeurs affichées sont
 * devenues des interpolations par une DÉCLARATION dans
 * `tools/screens/08-compte.mjs`, sous la clé `donnees`.
 *
 * CETTE PAGE EST DEVENUE CLIENTE, et ce n'est pas un choix de confort. Le jeton
 * d'accès vit en mémoire, dans la clôture de `lib/api/session.ts`, et il n'existe
 * que dans le navigateur — décision de `session.ts`, qui refuse tout stockage
 * lisible par JavaScript. Un composant serveur n'a donc aucun moyen d'appeler
 * `/me` au nom du membre. Voir `screens/compte/ecran-donnees.tsx`.
 *
 * DEUX ROUTES, et c'est un écart de l'API : `GET /me` rend `cityId` et
 * `originCountryId` — des UUID — là où la planche écrit « Lyon » et « Bénin ».
 * Les référentiels qui les résoudraient sont des routes d'ÉQUIPE. `GET /users/{mon
 * pseudo}` est donc le seul chemin honnête vers les noms. Signalé au porteur.
 *
 * 01 §2.1, RÈGLE DURE : aucun numéro de téléphone en clair. Cet écran n'en affiche
 * aucun — ni la maquette, ni les données liées : aucune n'est un numéro. Le seul
 * téléphone du module vit sur K04, masqué par le serveur.
 */
export default function ProfilPage() {
  return (
    <EcranDonnees charger={chargerK01}>
      {(donnees) => (
        <ScreenFrames
          screen="K01"
          desktop={<K01Desktop {...donnees} />}
          mobile={<K01Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
