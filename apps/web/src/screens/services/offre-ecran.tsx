'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranServices, useServices } from '@/screens/services/ecran';
import { SQUELETTE_S05, chargerS05, chargerS05Nouveau } from '@/screens/services/appels';
import { useFormulaireOffre, useOffre } from '@/screens/services/use-offre';
import type { S05Charge } from '@/screens/s05/data';
import { S05Desktop } from '@/screens/s05/desktop.generated';
import { S05Mobile } from '@/screens/s05/mobile.generated';
import { S05LienExterne } from '@/screens/s05lien/lienexterne.generated';
import { S05Recommander } from '@/screens/s05recommander/recommander.generated';

/**
 * S05 — une offre d'emploi (`/services/emploi/:id`) ou le formulaire de publication
 * (`/services/emploi/nouveau`, `id === null`). La maquette dessine les deux sur une
 * seule planche ; `offre.mode` dit lequel des deux blocs s'affiche.
 *
 * Postuler ouvre l'interstitiel S05L puis `externalUrl` ; Recommander (S05R) écrit
 * `POST /recommendations/members` ; « Publier l'offre » envoie `POST /jobs`.
 */
export function OffreEcran({ id }: { readonly id: string | null }) {
  const services = useServices();
  const charger = useCallback(() => (id === null ? chargerS05Nouveau() : chargerS05(id)), [id]);

  return (
    <EcranDonnees squelette={SQUELETTE_S05} charger={charger} attente="Chargement de l’offre…">
      {(donnees) => <OffreVivante donnees={donnees} services={services} />}
    </EcranDonnees>
  );
}

function OffreVivante({
  donnees,
  services,
}: {
  readonly donnees: S05Charge;
  readonly services: ReturnType<typeof useServices>;
}) {
  const { ouverte, onOuvrir, onFermer, ouvrir } = services;
  const { vivant, fenetres } = useOffre(
    { id: donnees.offre.id, externalUrl: donnees.offre.lienExterne },
    { ouvrir, fermer: onFermer },
  );
  const { formulaire, fenetre } = useFormulaireOffre(donnees.offre.mode === 'nouveau');
  const avec = { ...donnees, vivant, formulaire };
  return (
    <>
      <EcranServices
        screen="S05"
        desktop={<S05Desktop {...avec} />}
        mobile={<S05Mobile {...avec} />}
        ouverte={ouverte}
        onOuvrir={onOuvrir}
        onFermer={onFermer}
        modales={{
          S05L: { mobile: <S05LienExterne {...avec} /> },
          S05R: { mobile: <S05Recommander /> },
        }}
      />
      {fenetres}
      {fenetre}
    </>
  );
}
