'use client';

import { ScreenFrames } from '@/screens/frames';
import { A02Desktop } from '@/screens/a02/desktop.generated';
import { A02Mobile } from '@/screens/a02/mobile.generated';
import { panelFil, rail, shortcuts } from '@/screens/a02/data';
import { PublicationProvider } from '@/components/publication-vivante';

/**
 * A02 — une publication et ses réponses. VIVANTE (lot G).
 *
 * Avant ce lot, la publication elle-même (« Fatou Ndiaye », « 11 réponses »…) était
 * écrite en dur dans la planche et seuls les commentaires venaient de l'API ; le
 * compositeur n'était pas un champ, « Répondre » et « Lier un guide » menaient à
 * `#`. Tout cela vit maintenant dans `components/publication-vivante.tsx` (AJOUT hors
 * maquette, dans les valeurs exactes de la planche) :
 *
 *   · la publication, son état de modération (« contenu en vérification » / « contenu
 *     retiré »), ses images, son lien « Suite dans le réseau » ;
 *   · répondre, modifier et supprimer SON commentaire, réagir, enregistrer, signaler ;
 *   · « Choisir un réseau » (déplacement, jamais automatique) ;
 *   · les guides liés, et « Lier un guide » (fenêtre A01G, puis `PATCH /posts/:id`).
 *
 * AUCUNE DÉCISION SUR LE NIVEAU ici : on tente, et un `403 LEVEL_REQUIRED` remonte.
 */
export function PublicationEcran({ postId }: { readonly postId: string }) {
  /**
   * Le fournisseur porte l'état de la page (la publication, ses réponses, le
   * compositeur, les fenêtres) ; les cadres générés n'en reçoivent plus que le
   * chrome. `PublicationVivante` et `GuidesLiesPublication` le lisent.
   */
  const data = { rail, panelFil, shortcuts };

  return (
    <PublicationProvider postId={postId}>
      <ScreenFrames screen="A02" desktop={<A02Desktop {...data} />} mobile={<A02Mobile {...data} />} />
    </PublicationProvider>
  );
}
