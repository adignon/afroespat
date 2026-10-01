'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { chargerJ06 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J06Desktop } from '@/screens/j06/desktop.generated';
import { J06Mobile } from '@/screens/j06/mobile.generated';

/**
 * J06 — la checklist de documents. `/parcours/:id/documents`.
 *
 * BRANCHÉ SUR `GET /journeys/:id` : la checklist voyage avec les étapes, et elle
 * n'est rendue QU'AU PROPRIÉTAIRE (§3.4, §10). Un accompagnant qui ouvre cette URL
 * reçoit des étapes SANS `checklist` — ce n'est pas un champ vide, c'est un champ
 * absent, et le schéma de `@app/shared` le dit en `.optional()` plutôt qu'en
 * `.nullable()`. L'écran affiche alors une checklist vide, ce qui est exact.
 *
 * §3.3, RÈGLE DURE : aucun fichier en V1. La phrase du bandeau vient du SERVEUR
 * (`meta.checklistNotice`) et non d'un texte d'écran — elle est écrite une fois,
 * côté API, pour toutes les routes de parcours. Et le schéma d'un libellé de
 * checklist est `.strict()` : le jour où le serveur y greffe un `fileKey`, l'appel
 * ÉCHOUE en nommant le champ au lieu de le dépouiller en silence.
 *
 * L'ÉCRITURE N'EST PAS CÂBLÉE : `PUT /journeys/:id/steps/:stepId/checklist`
 * remplace la liste entière, et le générateur ne pose aucun `onClick` sur les cases
 * de la maquette. Cocher une case ne part donc nulle part. Signalé.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const contexte = useContexteParcours();
  const charger = useCallback(() => chargerJ06(journeyId), [journeyId]);

  return (
    <EcranParcoursDonnees
      screen="J06"
      charger={charger}
      contexte={contexte}
      desktop={(d) => <J06Desktop {...d} />}
      mobile={(d) => <J06Mobile {...d} />}
      modales={(d, volet) => ({ J03: plancheBlocage(volet, d) })}
    />
  );
}
