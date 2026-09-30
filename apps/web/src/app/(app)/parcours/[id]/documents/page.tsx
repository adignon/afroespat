'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J06Desktop } from '@/screens/j06/desktop.generated';
import { J06Mobile } from '@/screens/j06/mobile.generated';

/**
 * J06 — la checklist de documents. `/parcours/:id/documents`.
 *
 * §3.3, et la maquette l'écrit en toutes lettres : AUCUN FICHIER n'est attaché
 * en V1 — « Cochez ce que vous avez réuni. Les documents restent chez vous. »
 * Il n'y a donc aucun dépôt de fichier à brancher, et il ne faut surtout pas en
 * ajouter un.
 *
 * Les cases ne sont pas encore cochables : `PUT /journeys/:id/steps/:stepId/
 * checklist` remplace la liste entière, et la maquette ne donne pas la donnée
 * qui permettrait de la reconstruire. L'écran est transcodé, la manipulation
 * viendra avec l'API.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data, erreur, niveauRequis, oublierNiveauRequis } = useParcours(null, useContexteParcours());

  return (
    <EcranParcours
      screen="J06"
      desktop={<J06Desktop {...data} />}
      mobile={<J06Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ J03: plancheBlocage(volet, data) }}
      erreur={erreur}
      niveauRequis={niveauRequis}
      oublierNiveauRequis={oublierNiveauRequis}
    />
  );
}
