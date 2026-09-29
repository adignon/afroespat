'use client';

import { useCallback, useState } from 'react';
import { Modal } from '@/components/modal';
import { X03Desktop } from '@/screens/x03/desktop.generated';
import { X03Mobile } from '@/screens/x03/mobile.generated';
import { X03MobileConfirmation } from '@/screens/x03confirmation/mobileconfirmation.generated';

/**
 * X03 — « Signaler », et sa confirmation.
 *
 * « Fenêtre sur ordinateur, feuille du bas sur mobile », comme la maquette l'écrit
 * elle-même sous la planche. Le dessin vient entièrement du transcodage ; ce
 * fichier n'apporte que ce qu'une image ne peut pas contenir — l'ouverture, la
 * fermeture, le piège au clavier, que `Modal` porte déjà.
 *
 * L'ÉTAT ARRIVE PAR L'URL, et ce n'est pas un raccourci de test.
 *
 * La maquette ne dessine « Signaler » QUE dans la carte « MENU DE LA
 * CONVERSATION » — une carte nue de 300 px, sans voile ni panneau positionné, qui
 * n'appartient donc à aucun cadre (voir `tools/screens/09-messages.mjs`). Aucun
 * bouton de M01 ne peut porter le déclencheur : inventer ce contrôle serait
 * réécrire la maquette, et laisser la feuille inatteignable serait livrer une
 * planche morte. C'est exactement le raisonnement — et la solution — du sélecteur
 * de parcours de J01M (`apps/web/src/screens/parcours/data.ts`).
 *
 * « ENVOYER LE SIGNALEMENT » RESTE INERTE, et la confirmation n'est donc PAS
 * enchaînée derrière lui. Le signalement part par `POST /reports` (module 13), que
 * ce lot ne branche pas ; faire apparaître « Merci. Nous regardons sous 24 heures. »
 * sans que rien ne soit parti serait mentir au membre — la même règle que pour le
 * « Publier » de J03. Les deux planches sont donc servies séparément, et
 * l'enchaînement viendra avec la route.
 */
export type FeuilleSignalement = 'signaler' | 'merci';

/**
 * Les deux feuilles portent LE MÊME `titleId`, et c'est voulu : le transcodeur le
 * dérive de la SECTION de la maquette (`x03-titre`), et les deux planches sont
 * dessinées dans la section X03. Elles ne sont jamais ouvertes en même temps —
 * `Modal` ne rend rien quand elle est fermée — donc l'identifiant reste unique
 * dans le document, ce qu'`aria-labelledby` exige.
 */
const TITRE = 'x03-titre';

export function FeuillesSignalement({ ouverte }: { readonly ouverte: FeuilleSignalement | null }) {
  const [courante, setCourante] = useState<FeuilleSignalement | null>(ouverte);
  const fermer = useCallback((): void => setCourante(null), []);

  return (
    <>
      <Modal
        open={courante === 'signaler'}
        onClose={fermer}
        titleId={TITRE}
        name="X03"
        desktop={<X03Desktop />}
        mobile={<X03Mobile />}
      />
      {/*
        La confirmation n'a qu'une seule planche — une carte nue de 360 px — et la
        maquette ne lui en dessine pas de seconde. La même sert donc aux deux
        largeurs, comme la feuille d'invitation de J05.

        ⚠ ELLE NE DESSINE AUCUNE FERMETURE : ni croix ni poignée. Elle se referme au
        voile et à Échap, ce que `Modal` fournit, mais aucun bouton ne l'annonce à un
        lecteur d'écran. C'est un manque de la maquette, pas un choix : lui ajouter
        une croix serait dessiner à la place du porteur.
      */}
      <Modal
        open={courante === 'merci'}
        onClose={fermer}
        titleId={TITRE}
        name="X03M"
        mobile={<X03MobileConfirmation />}
      />
    </>
  );
}
