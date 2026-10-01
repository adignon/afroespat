'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { chargerS04 } from '@/screens/services/appels';
import { S04Desktop } from '@/screens/s04/desktop.generated';
import { S04Mobile } from '@/screens/s04/mobile.generated';

/**
 * S04 — Bourses et emploi (`/services/emploi`, 10 §3).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * DEUX ROUTES POUR UN ÉCRAN, et c'est la maquette qui le veut : `GET /jobs` au
 * centre, `GET /job-seekers` dans la colonne de contexte (« PROFILS
 * DISPONIBLES »). Ce ne sont pas deux onglets mais deux cartes, dessinées côte à
 * côte — comme les quatre cartes de K05.
 *
 * RÈGLE DURE (10 §3.1 et §11) : « une offre sponsorisée porte TOUJOURS la pastille
 * et n'occupe jamais plus de 2 emplacements de tête ». La tête arrive dans
 * `sponsored`, un champ À PART d'`items` qui l'exclut, et chaque offre porte
 * `isSponsored` et `sponsoredLabel` — le libellé vient du serveur, parce qu'un
 * front qui le posséderait pourrait l'oublier. `isSponsored` est calculé par le
 * serveur SUR LA DATE et non recopié de la colonne : une mise en avant expirée
 * cesse d'être annoncée même si la tâche `sponsored.expire` a du retard.
 *
 * ÉCART SIGNALÉ AU PORTEUR : « 8 offres à Lyon et en télétravail » n'est pas lié.
 * Le `meta` de `GET /jobs` ne porte AUCUN `total`, là où `GET /housing` en porte
 * un ; compter `items` donnerait le compte de la page, pas celui de la recherche.
 */
export default function EmploiListePage() {
  return (
    <EcranDonnees charger={chargerS04} attente="Chargement des offres…">
      {(donnees) => (
        <ScreenFrames
          screen="S04"
          desktop={<S04Desktop {...donnees} />}
          mobile={<S04Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
