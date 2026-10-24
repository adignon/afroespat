'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S03, chargerS03 } from '@/screens/services/appels';
import { useFormulaireAnnonce } from '@/screens/services/use-publication';
import { S03Desktop } from '@/screens/s03/desktop.generated';
import { S03Mobile } from '@/screens/s03/mobile.generated';

/**
 * S03 — publier (ou, avec `?modifier=<id>`, modifier) une annonce de logement.
 *
 * Le bouton « Publier l'annonce » envoie `POST /housing` ; une annonce retenue pour
 * décision humaine répond `LISTING_UNDER_REVIEW` et l'écran dit « en vérification »,
 * jamais « publiée ». Le formulaire est grisé quand le serveur dit `canPublish: false`.
 */
export function PublierLogementEcran({ modifier }: { readonly modifier: string | null }) {
  const { formulaire, fenetre } = useFormulaireAnnonce(modifier);
  return (
    <>
      <EcranDonnees
        charger={chargerS03}
        attente="Chargement du formulaire…"
        squelette={SQUELETTE_S03}
      >
        {(donnees) => (
          <ScreenFrames
            screen="S03"
            desktop={<S03Desktop {...donnees} formulaire={formulaire} />}
            mobile={<S03Mobile {...donnees} formulaire={formulaire} />}
          />
        )}
      </EcranDonnees>
      {fenetre}
    </>
  );
}
