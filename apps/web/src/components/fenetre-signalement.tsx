'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { notifyError } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';
import { signaler } from '@/screens/messages/appels';
import { X03Desktop } from '@/screens/x03/desktop.generated';
import { X03Mobile } from '@/screens/x03/mobile.generated';
import { X03MobileConfirmation } from '@/screens/x03confirmation/mobileconfirmation.generated';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ SIGNALER, DEPUIS N'IMPORTE QUEL ÉCRAN — LA MÊME PLANCHE QU'EN MESSAGERIE  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « sur les publications le signalement des commentaires ne marche
 * pas non plus. »
 *
 * MESURÉ dans le cadre produit : `<a href="#">Signaler</a>` sous chaque
 * commentaire. Un lien mort — cliquer n'ouvrait rien et ne changeait pas l'URL.
 *
 * ── POURQUOI X03 ET PAS UNE SECONDE FENÊTRE ───────────────────────────────
 *
 * X03 est dessinée dans `09 Messages et TRANSVERSE`, et le mot est dans le titre
 * du fichier : c'est LA feuille de signalement du produit, pas celle de la
 * messagerie. Elle porte les six motifs de `ReportReason`, le champ de détails et
 * l'envoi. En dessiner une seconde pour les commentaires donnerait deux fenêtres
 * à tenir d'accord, et la première retouche les ferait diverger.
 *
 * ── POURQUOI UN COMPOSANT PLUTÔT QUE LE MÉCANISME `?feuille=` ─────────────
 *
 * La messagerie ouvre la sienne par un paramètre d'URL, et c'est juste là-bas :
 * son menu est une fenêtre, l'entrée « Signaler » est un LIEN, et une
 * conversation n'a qu'un sujet. Un commentaire n'est pas une page : le fil en
 * porte vingt, et un seul paramètre ne pourrait pas dire LEQUEL. L'état vit donc
 * dans l'écran, avec l'identifiant du sujet.
 *
 * ── LA CONFIRMATION EST CELLE DE LA MAQUETTE ──────────────────────────────
 *
 * X03M, la carte « Merci ». On l'affiche après l'envoi plutôt que de fermer
 * sèchement : c'est ce que la planche prévoit, et c'est aussi ce qui remet le
 * formulaire à zéro.
 */
export function FenetreSignalement({
  sujet,
  onFermer,
}: {
  /** `null` = fermée. Sinon le genre (`ReportSubjectType`) et l'identifiant. */
  readonly sujet: { readonly type: string; readonly id: string } | null;
  readonly onFermer: () => void;
}) {
  const [motif, setMotif] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const fermer = (): void => {
    setMotif(null);
    setDetails('');
    setEnvoye(false);
    onFermer();
  };

  const signalement = {
    motif,
    onMotif: (choix: string) => {
      setMotif(choix);
    },
    details,
    onDetails: (e: { readonly target: { readonly value: string } }) => {
      setDetails(e.target.value);
    },
    envoiBloque: motif === null || enVol,
    onEnvoyer: () => {
      if (sujet === null || motif === null || enVol) return;
      setEnVol(true);
      signaler(sujet.type, sujet.id, motif, details)
        .then(() => {
          setEnvoye(true);
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'Le signalement n’a pas pu être envoyé.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
  };

  return (
    <>
      <Modal
        open={sujet !== null && !envoye}
        onClose={fermer}
        titleId="x03-titre"
        name="X03"
        desktop={<X03Desktop signalement={signalement} />}
        mobile={<X03Mobile signalement={signalement} />}
      />
      <Modal
        open={envoye}
        onClose={fermer}
        /**
         * `x03-titre` ET NON `x03m-titre` : la carte de confirmation porte le
         * MÊME identifiant de titre que la feuille — les deux viennent de la
         * section X03, et le transcodeur nomme par section. Relevé sur le cadre,
         * pas supposé : avec un identifiant inventé, `aria-labelledby` pointait
         * dans le vide et la fenêtre n'avait aucun nom accessible.
         */
        titleId="x03-titre"
        name="X03M"
        mobile={<X03MobileConfirmation />}
      />
    </>
  );
}
