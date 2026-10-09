'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStoryBand } from '@/screens/accueil/api';

/** Ce qu'une carte de voisin montre : son fond, son texte, son auteur. */
interface VoisinVue {
  readonly id: string;
  readonly nom: string;
  readonly bg: string;
  readonly texte: string;
  /** « CONSEIL · LOGEMENT » — la pastille, composée comme celle de la carte. */
  readonly pastille: string;
  /** « CONSEIL » — l'étiquette de type, au-dessus du corps. */
  readonly etiquette: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX VOISINS D'UNE STORY — « PRÉCÉDENT » ET « SUIVANT »               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « pour les écrans précédent et suivant ça affiche à gauche ou à
 * droite selon la maquette non ? Il faut finaliser proprement. »
 *
 * MESURÉ AVANT : zéro bouton et zéro lien dans A13. Les deux chevrons et les deux
 * panneaux de voisins étaient dessinés et morts.
 *
 * ── D'OÙ VIENNENT LES VOISINS ────────────────────────────────────────────
 *
 * PAS de `GET /stories/:id` : `storyDetailResponseSchema` ne porte ni précédent ni
 * suivant, et c'est vérifiable. Le RUBAN les connaît — `GET /stories` rend les
 * stories du jour, groupées par auteur et ordonnées — et c'est lui que l'accueil
 * affiche déjà. On le relit ici plutôt que d'ajouter une route pour une
 * information déjà servie.
 *
 * ── CE QUI SE PASSE QUAND LA STORY N'EST PAS DANS LE RUBAN ───────────────
 *
 * Une story ouverte par son adresse peut ne pas y figurer — elle a expiré, ou elle
 * appartient à une autre ville. Les deux prises valent alors `null` et les boutons
 * ne font rien, plutôt que de sauter sur une story au hasard.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ON CHANGE DE STORY SUR PLACE — PAS PAR LE ROUTEUR                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Première version : `router.replace('/stories/<id>')`. MESURÉ, et c'était un
 * défaut net — deux `[data-screen="A13"]` dans le document après un clic.
 *
 * La cause : `/stories/[id]` est INTERCEPTÉE par `@fenetre`, pour pouvoir
 * s'ouvrir par-dessus le fil. Partir d'une story vers une autre déclenchait donc
 * l'interception À SON TOUR, et la fenêtre se posait sur la page de story déjà
 * ouverte. Le mécanisme qui sert le fil se retournait contre l'écran lui-même.
 *
 * On ne navigue donc plus : l'écran change d'identifiant dans son ÉTAT, et
 * l'adresse suit par `history.replaceState`. Trois conséquences, toutes voulues :
 *
 *   · aucune interception, donc jamais deux écrans empilés ;
 *   · l'adresse reste juste et partageable — c'est tout l'intérêt d'une story ;
 *   · aucune entrée d'historique en plus, donc le bouton « précédent » du
 *     navigateur ramène au fil en UN clic et non en vingt.
 */
export function useVoisinsDeStory(
  storyId: string,
  onChanger: (id: string) => void,
  /**
   * LE TYPE DE LA STORY AFFICHÉE — « les cartes left et right doivent afficher le
   * contenu des story qui suivent dynamiquement SELON LE FILTRE APPLIQUÉ (Conseil,
   * Information etc.) ».
   *
   * Le ruban accepte ce filtre (`GET /stories?type=`). On voisine donc entre
   * stories DU MÊME TYPE : en lisant un conseil, le précédent et le suivant sont
   * des conseils. `null` tant que la story n'est pas lue — on ne demande pas le
   * ruban avant de savoir quoi filtrer.
   */
  type: string | null,
) {
  const [ordre, setOrdre] = useState<readonly VoisinVue[]>([]);

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LE RUBAN EST LU UNE FOIS, ET NE BOUGE PLUS                                ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « dès que le premier slide passe, les autres ne chargent même
   * pas le previous ». REPRODUIT : après le premier saut, les deux cartes
   * passaient à « Aucune story » et les boutons devenaient muets.
   *
   * LA CAUSE N'ÉTAIT PAS LA NAVIGATION, c'était le ruban. Il était re-demandé à
   * CHAQUE changement de story — `storyId` était dans les dépendances — et lire
   * une story la MARQUE VUE (`GET /stories/:id` l'écrit, 92 lignes dans
   * `story_views`). Le ruban suivant ne la contenait donc plus, son rang devenait
   * `-1`, et il n'y avait plus ni précédent ni suivant.
   *
   * Une traversée se fige au moment où on l'ouvre : c'est une liste de lecture,
   * pas une requête rejouée. Le ruban n'est relu que si le TYPE change — on ne
   * voisine pas entre un conseil et une information.
   */
  const typeCharge = useRef<string | null>(null);

  useEffect(() => {
    if (type === null || typeCharge.current === type) return undefined;
    typeCharge.current = type;
    const stop = new AbortController();
    fetchStoryBand({ type }, stop.signal)
      .then((bande) => {
        if (stop.signal.aborted) return;
        /**
         * ── UNE STORY NE FIGURE QU'UNE FOIS DANS LA TRAVERSÉE ──────────────
         *
         * Le ruban est groupé PAR AUTEUR, et la même story peut revenir dans
         * deux entrées. Mesuré : un appui sur « suivant » ne changeait alors
         * rien — on passait d'une story à elle-même — un clic sur deux. C'est
         * le « ça marche parfois » du porteur.
         *
         * `Map` sur l'identifiant garde le PREMIER passage, donc l'ordre que le
         * serveur a choisi.
         */
        const vues = new Map<string, VoisinVue>();
        for (const v of bande.items.flatMap((entree) =>
            entree.stories.map((s) => ({
              id: s.id,
              nom: s.author.displayName,
              /**
               * LE CONTENU DU VOISIN, pour que sa carte le montre.
               *
               * Le porteur : « les cartes left et right doivent afficher le
               * contenu des story qui suivent ». Elles étaient deux rectangles
               * `#0F5C48` écrits en dur, avec un nom d'exemple.
               *
               * Le ruban porte DÉJÀ `backgroundColor` et `body` : il n'y avait
               * rien à demander de plus au serveur.
               */
              bg: s.backgroundColor ?? '#0F5C48',
              texte: s.body,
              /**
               * LA PASTILLE EST COMPOSÉE COMME CELLE DU RUBAN : le SUJET quand il
               * y en a un, le type sinon. `storiesFrom` fait exactement ce choix,
               * et il le justifie — « savoir de quoi parle une story vaut mieux
               * que savoir de quel type elle est ».
               */
              pastille: `${s.typeLabel.toLocaleUpperCase('fr-FR')}${
                s.categoryLabel === null
                  ? ''
                  : ` · ${s.categoryLabel.toLocaleUpperCase('fr-FR')}`
              }`,
              etiquette: s.typeLabel.toLocaleUpperCase('fr-FR'),
            })),
        )) {
          if (!vues.has(v.id)) vues.set(v.id, v);
        }
        setOrdre([...vues.values()]);
      })
      .catch(() => {
        /**
         * Le ruban est un CONFORT : sans lui, la story reste parfaitement lisible
         * et seules les flèches dorment. Un refus ici ne doit pas couvrir l'écran
         * d'un message d'erreur pour une navigation annexe.
         */
      });
    return () => stop.abort();
  }, [type]);

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA TRAVERSÉE EST CIRCULAIRE — « ça doit être une infinite sliding »       ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le next et prev aussi ne marchent plus hein ». MESURÉ : ils
   * marchent — l'URL change dans les deux sens — SAUF aux extrémités, où il n'y a
   * plus de voisin et où le bouton ne fait donc rien. C'est ce silence qu'il
   * décrit, et sa phrase donne le remède : « ça doit être une infinite sliding ».
   *
   * Après la dernière story vient la première, et avant la première vient la
   * dernière. Le modulo est écrit sur la LONGUEUR, pas sur un cas particulier :
   * une liste d'UNE seule story se voisine alors avec elle-même, ce qui est exact
   * — il n'y a nulle part ailleurs où aller — et le bouton ne paraît pas cassé.
   */
  /**
   * ── UNE STORY HORS DU RUBAN GARDE SES VOISINS ──────────────────────────────
   *
   * Le porteur : « Quand je clique sur ceci ça ne marche pas /stories/01a107… ».
   * Une story peut être ouverte par son adresse sans figurer dans le ruban —
   * elle a déjà été vue, elle a expiré, ou elle vient d'une autre ville. Son rang
   * vaut alors `-1`, et la version précédente rendait les deux boutons muets.
   *
   * On la traite comme si elle était AVANT la liste : « suivant » ouvre la
   * première du ruban, « précédent » la dernière. Le membre n'est jamais enfermé
   * sur une story sans issue, ce qui est le seul comportement défendable pour un
   * lecteur de stories.
   */
  const total = ordre.length;
  const rang = ordre.findIndex((s) => s.id === storyId);
  const precedent =
    total === 0 ? null : (ordre[rang < 0 ? total - 1 : (rang - 1 + total) % total] ?? null);
  const suivant = total === 0 ? null : (ordre[rang < 0 ? 0 : (rang + 1) % total] ?? null);

  const aller = useCallback(
    (cible: { id: string } | null) => {
      if (cible === null) return;
      onChanger(cible.id);
      /**
       * L'ADRESSE SUIT, SANS LE ROUTEUR. `replaceState` ne déclenche aucune
       * navigation Next — donc aucune interception — et n'ajoute pas d'entrée
       * d'historique. Le lien reste copiable, et le « précédent » du navigateur
       * ramène d'où l'on venait.
       */
      window.history.replaceState(null, '', `/stories/${cible.id}`);
    },
    [onChanger],
  );

  return {
    /** Le voisin suivant, pour le minuteur de quinze secondes. */
    suivant,
    prises: {
      onPrecedent: () => aller(precedent),
      onSuivant: () => aller(suivant),
      /**
       * CE QUE LES DEUX CARTES MONTRENT. Sans voisin — le ruban n'a pas répondu —
       * elles gardent le vert de la planche et ne disent rien : une carte vide
       * vaut mieux qu'une carte qui invente.
       */
      precedentFond: precedent?.bg ?? '#0F5C48',
      precedentTexte: precedent?.texte ?? '',
      precedentAuteur: precedent?.nom ?? '',
      precedentPastille: precedent?.pastille ?? '',
      precedentEtiquette: precedent?.etiquette ?? '',
      suivantFond: suivant?.bg ?? '#0F5C48',
      suivantTexte: suivant?.texte ?? '',
      suivantAuteur: suivant?.nom ?? '',
      suivantPastille: suivant?.pastille ?? '',
      suivantEtiquette: suivant?.etiquette ?? '',
      /**
       * Le nom accessible porte CELUI DU VOISIN quand on le connaît — « Story de
       * Aïcha D. » dit où l'on va, là où « Précédent » ne dit rien. Sans voisin,
       * le bouton annonce qu'il n'y en a pas plutôt que de mentir.
       */
      precedentNom:
        precedent === null ? 'Aucune story précédente' : `Story de ${precedent.nom}`,
      suivantNom: suivant === null ? 'Aucune story suivante' : `Story de ${suivant.nom}`,
    },
  };
}
