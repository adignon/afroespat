'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { chargerS06 } from '@/screens/services/appels';
import { S06Desktop } from '@/screens/s06/desktop.generated';
import { S06Mobile } from '@/screens/s06/mobile.generated';

/**
 * S06 — l'annuaire professionnel (`/services/annuaire`, 10 §4.2).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * RÈGLE DURE (10 §4.2) : « les fiches PRO/PRO_PLUS obtiennent un emplacement mis
 * en avant CLAIREMENT SIGNALÉ : AU PLUS 2 en tête, puis le classement naturel ».
 * La tête arrive dans `featured`, un champ À PART d'`items` qui l'exclut, et
 * chaque fiche porte `isFeatured` et `featuredLabel` — le libellé vient du
 * serveur, pour la même raison que la pastille « Sponsorisée » de l'emploi.
 *
 * RÈGLE DURE (10 §4.1) : le téléphone n'est JAMAIS affiché. Aucun champ lu ici
 * n'en est un, et ce n'est pas une promesse : `proCardSchema` ne DÉCRIT aucun
 * champ de numéro et il est `.strict()`, donc une réponse qui en porterait un
 * serait REFUSÉE à la frontière au lieu d'être dépouillée en silence par zod.
 *
 * « 2 contacts sur 3 ce mois-ci » lit le MÊME quota que la barre latérale
 * (`usage.items[PRO_CONTACTS]` de `GET /me/subscription`). §4.4 ne compte qu'un
 * quota ; deux sources pour un seul compteur finiraient par ne plus dire la même
 * chose.
 */
export default function AnnuaireListePage() {
  return (
    <EcranDonnees charger={chargerS06} attente="Chargement de l’annuaire…">
      {(donnees) => (
        <ScreenFrames
          screen="S06"
          desktop={<S06Desktop {...donnees} />}
          mobile={<S06Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
