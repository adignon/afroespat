'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { notifyError } from '@/components/notifications';
import { A01CDesktop } from '@/screens/a01c/desktop.generated';
import { A01CMobile } from '@/screens/a01c/mobile.generated';
import { usePublication, type SujetCommente } from '@/screens/publication/use-publication';
import { threadFrom } from '@/screens/accueil/from-api';
import type { A01CData } from '@/screens/a01c/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A01C — LA FEUILLE DE COMMENTAIRES, POUR N'IMPORTE QUEL SUJET               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Comment commenter un guide, c'est pas dans les design ? » — puis
 * son arbitrage, mot pour mot ce qu'il a accepté : « EMPRUNTER A01C AU GUIDE —
 * rendre l'en-tête "14 COMMENTAIRES" cliquable, et ouvrir cette feuille sur le
 * guide au lieu d'une publication. »
 *
 * ── D'OÙ CE FICHIER VIENT, ET CE QUI A ÉTÉ DÉPLACÉ ──────────────────────────
 *
 * Ce composant était une fonction LOCALE de
 * `apps/web/src/screens/accueil/cartes-fil-vivantes.tsx`, câblée sur
 * `postId: string | null`. Rien ne l'empêchait d'être partagé — c'est juste qu'il
 * n'avait eu qu'un seul emploi. Le recopier pour le guide aurait fait deux
 * feuilles de commentaires qui auraient divergé au premier changement de
 * maquette, exactement ce que `composants` évite déjà pour la carte de
 * publication.
 *
 * LE DÉPLACEMENT NE CHANGE RIEN AU FIL, et c'est la contrainte qui compte : le
 * corps de la fonction est le même, les prises de A01C sont remplies dans le même
 * ordre, et `usePublication` est appelé avec `avecPublication: false` comme avant.
 * Seules `sujetCarte` et `commentairesCompte` sont devenues des PRISES — voir
 * plus bas pourquoi, et quel défaut cela met au jour.
 *
 * ── CE QU'UN SUJET APPORTE, ET CE QU'IL N'APPORTE PAS ───────────────────────
 *
 * `sujet` est `{ subjectType, subjectId }`, ou une chaîne qui vaut une
 * publication. `null` ferme la feuille : c'est `Modal` qui lit `open`, et c'est
 * aussi le signal que `usePublication` attend pour rendre un fil vide plutôt que
 * de garder celui du sujet précédent.
 *
 * LA CARTE DU SUJET ET LE COMPTE SONT PASSÉS, PAS DEVINÉS. Le composant ne charge
 * PAS le sujet : la feuille s'ouvre depuis un écran qui l'affiche déjà — une carte
 * de fil, la page d'un guide — et aller rechercher ce que le membre regarde serait
 * un appel pour rien. C'est l'arbitrage que `FenetrePartage` écrit déjà pour
 * `partageSujet`, et il vaut pour la même raison.
 *
 * ── LE DÉFAUT QUE L'EXTRACTION AVAIT RÉVÉLÉ EST CORRIGÉ ─────────────────────
 *
 * Il était écrit ici : « dans sa version locale, la carte et le compte étaient lus
 * sur `commentaires.post`, c'est-à-dire sur `etat.post` de `usePublication` — qui
 * n'est rempli QUE par `avecPublication: true`. Appelé avec `false`, il reste
 * `null` pour toujours. La fenêtre de commentaires de la page PROFIL n'a donc
 * JAMAIS affiché ni carte de sujet ni compteur. » Le diagnostic était juste ; les
 * prises sont maintenant REMPLIES par `CartesFilVivantes`, qui retrouve la carte
 * par le `postId` du déclencheur et lui passe `i`, `bg`, `name`, `type`, `body` et
 * `commentCount`. Le raisonnement et la mesure sont dans son en-tête.
 *
 * LE FIL N'A PAS BOUGÉ, et c'était la contrainte : `/accueil` monte A01C par son
 * propre objet de prises (`app/(app)/accueil/page.tsx`), pas par ce composant.
 * MESURÉ au navigateur après la correction, aux deux largeurs : fil à 1440 px —
 * carte de sujet 672 × 72 à (384, 126), fond `#F6F8F7`, rayon 18, « Commentaires
 * · 4 » ; profil à 1440 px — la MÊME carte, mêmes dimensions, même position, même
 * titre. À 390 px, aucun des deux ne dessine de carte de sujet : la planche
 * mobile de A01C n'en dessine pas (relevé, zéro nœud de rayon 18 dans le panneau),
 * et seul le COMPTEUR y apparaît — « Commentaires · 4 » sur les deux chemins.
 *
 * ── AUCUN GARDE DE NIVEAU, ET C'EST VÉRIFIÉ ─────────────────────────────────
 *
 * `comment.create` est déclarée `{ minLevel: 'L0' }` dans
 * `packages/shared/src/capabilities/capabilities.ts` — donc N0 — et
 * `feed.controller.ts` l'applique à `POST /comments`. Ce composant n'appelle donc
 * PAS `peut()` avant d'envoyer, et il ne doit pas : §9 dit « un L0 peut commenter
 * ET RÉAGIR ». Un `FenetreNiveau` interposé ici barrerait un geste que le serveur
 * accepte. Si l'API refusait un jour, `echecDe` porte déjà de quoi l'afficher.
 */
export function FenetreCommentaires({
  sujet,
  sujetCarte = null,
  compte = '',
  onFermer,
  onCommente,
}: {
  readonly sujet: SujetCommente | string | null;
  /** La carte du haut. `null` quand l'appelant ne l'a pas — mieux vaut rien qu'un exemple. */
  readonly sujetCarte?: A01CData['sujetCarte'];
  /** « · 8 » dans le titre, déjà composé par l'appelant, du compteur du SERVEUR. */
  readonly compte?: string;
  readonly onFermer: () => void;
  /**
   * APPELÉ APRÈS UN ENVOI RÉUSSI, et seulement là.
   *
   * Le compteur du sujet vit chez l'appelant — `guide.commentCount` pour un
   * guide, la carte du fil pour une publication — et le serveur vient de
   * l'incrémenter. Sans ce signal, l'en-tête du guide continuerait d'afficher
   * « 3 COMMENTAIRES » au-dessus d'un fil qui en montre quatre : c'est
   * exactement le mensonge que `commentVisibilityWhere` existe pour empêcher,
   * reproduit côté écran.
   */
  readonly onCommente?: () => void;
}) {
  const commentaires = usePublication(sujet, false);
  const [texte, setTexte] = useState('');
  const [reponse, setReponse] = useState<{ id: string; nom: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const thread =
    commentaires.fil === null
      ? []
      : threadFrom(
          commentaires.fil.items,
          (id, nom) => {
            setReponse({ id, nom });
          },
          () => undefined,
        );

  const donnees: A01CData = {
    thread,
    commentaireTexte: texte,
    onCommentaireTexte: (e) => {
      setTexte(e.target.value);
    },
    envoiBloque: texte.trim() === '' || envoi,
    onEnvoyerCommentaire: () => {
      const corps = texte.trim();
      if (corps === '' || envoi) return;
      setEnvoi(true);
      void commentaires
        .commenter(corps, reponse?.id)
        .then((echec) => {
          if (echec !== null) {
            notifyError(echec.message);
            return;
          }
          setTexte('');
          setReponse(null);
          onCommente?.();
        })
        .finally(() => {
          setEnvoi(false);
        });
    },
    sujetCarte,
    commentairesCompte: compte,
    /**
     * « CHARGÉ ET VIDE », et pas « vide » : `commentaires.fil` est `null` pendant
     * la requête, et le laisser compter pour un fil vide ferait clignoter « Soyez
     * la première personne à réagir » à chaque ouverture, même sur un guide qui a
     * douze commentaires. Voir la prise dans `screens/a01c/data.ts`.
     */
    filVide: commentaires.fil !== null && thread.length === 0,
    triCommentaires: commentaires.tri,
    triLibelle: commentaires.tri === 'RELEVANT' ? 'Pertinents' : 'Récents',
    onTriCommentaires: (valeur) => {
      commentaires.setTri(valeur ?? (commentaires.tri === 'RELEVANT' ? 'RECENT' : 'RELEVANT'));
    },
    suiteVisible: commentaires.fil !== null && commentaires.fil.nextCursor !== null,
    suiteLibelle: commentaires.suiteEnCours ? 'Chargement…' : 'Voir les autres commentaires',
    onVoirSuite: () => {
      void commentaires.chargerSuite().then((echec) => {
        if (echec !== null) notifyError(echec.message);
      });
    },
    reponseA: reponse?.nom ?? null,
    onAnnulerReponse: () => {
      setReponse(null);
    },
  };

  return (
    <Modal
      open={sujet !== null}
      onClose={onFermer}
      titleId="a01c-titre"
      name="A01C"
      desktop={<A01CDesktop {...donnees} />}
      mobile={<A01CMobile {...donnees} />}
    />
  );
}
