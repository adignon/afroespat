'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranServices, useServices } from '@/screens/services/ecran';
import { chargerS05Nouveau } from '@/screens/services/appels';
import { S05Desktop } from '@/screens/s05/desktop.generated';
import { S05Mobile } from '@/screens/s05/mobile.generated';
import { S05LienExterne } from '@/screens/s05lien/lienexterne.generated';
import { S05Recommander } from '@/screens/s05recommander/recommander.generated';

/**
 * S05 · `/services/emploi/nouveau` — publier une offre (10 §3.1).
 *
 * ── POURQUOI CETTE PAGE EXISTE MAINTENANT, ET PAS AVANT ─────────────────────
 *
 * La maquette donne DEUX ROUTES à une seule planche : sa légende dit
 * « /services/emploi/:id · /nouveau », et son cadre d'ordinateur dessine le détail
 * d'une offre à gauche ET le formulaire « PUBLIER UNE OFFRE » à droite. Tant que
 * l'écran lisait la maquette, `/nouveau` pouvait tomber sur la route dynamique :
 * il n'y avait rien à charger, et le lot précédent l'avait noté comme un choix
 * délibéré.
 *
 * Avec l'API, les deux routes DIVERGENT. `/services/emploi/nouveau` tombait sur
 * `[id]` et partait chercher l'offre d'identifiant « nouveau » — un
 * `400 VALIDATION_FAILED`, parce que le contrôleur valide `:id` comme un UUID. Un
 * segment statique gagne sur `[id]` dans le routeur ; c'est ce fichier.
 *
 * ── CE QUE LA MAQUETTE NE DIT PAS, ET LE CHOIX ASSUMÉ ──────────────────────
 *
 * Elle ne dit pas ce que la colonne de détail montre quand aucune offre n'est
 * visée. Ses valeurs restent donc des tirets — `chargerS05Nouveau` les écrit
 * explicitement — SAUF le titre, qui reprend les mots de la maquette elle-même :
 * « Publier une offre » est le libellé que sa colonne de droite porte en toutes
 * lettres (« PUBLIER UNE OFFRE »). Ce n'est pas un titre inventé comme celui qui a
 * coûté A01 : c'est le seul titre que cette planche écrive pour cette route.
 *
 * ÉCART REMONTÉ AU PORTEUR : il faudrait soit une planche propre à `/nouveau`,
 * soit une colonne de détail que la maquette déclare absente dans ce cas.
 */
export default function PublierOffrePage() {
  const { ouverte, onOuvrir, onFermer } = useServices();

  return (
    <EcranDonnees charger={chargerS05Nouveau} attente="Chargement du formulaire…">
      {(donnees) => (
        <EcranServices
          screen="S05"
          desktop={<S05Desktop {...donnees} />}
          mobile={<S05Mobile {...donnees} />}
          ouverte={ouverte}
          onOuvrir={onOuvrir}
          onFermer={onFermer}
          modales={{
            /**
             * `/nouveau` n'a pas d'offre à lire : `chargerS05Nouveau` met un tiret
             * cadratin dans `domaine`, comme dans `lien`. L'interstitiel ne peut
             * donc pas annoncer un domaine inventé — et il n'a de toute façon
             * aucun bouton pour s'ouvrir sur cette route.
             */
            S05L: { mobile: <S05LienExterne {...donnees} /> },
            S05R: { mobile: <S05Recommander /> },
          }}
        />
      )}
    </EcranDonnees>
  );
}
