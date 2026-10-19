'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenFrames } from '@/screens/frames';
import { A05Desktop } from '@/screens/a05/desktop.generated';
import { A05Mobile } from '@/screens/a05/mobile.generated';
import { mdTools, rules, type A05Data } from '@/screens/a05/data';
import { GardeNiveau } from '@/components/garde-niveau';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import {
  GUIDE_BODY_MAX,
  GUIDE_PAGE_TITLE_MAX,
  GUIDE_TITLE_MAX,
  GuideCategory,
} from '@app/shared';
import { CorpsGuide } from '@/screens/guides/corps-guide';
import { useEditeurGuide, type ModeEditeur } from '@/screens/guides/use-editeur-guide';
import { FenetreParcoursSource } from '@/components/fenetre-parcours-source';
import { notifyError } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';
import { draftFromJourney } from '@/screens/guides/api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A05 — L'ÉDITEUR DE GUIDE, MONTÉ PAR DEUX ADRESSES                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `/guides/nouveau` (mode `nouveau`) et `/guides/:slug/modifier` (mode
 * `modifier`). UN SEUL ÉCRAN, et c'est l'exigence : « Elle monte LE MÊME écran
 * A05 que `/guides/nouveau` — pas une copie. »
 *
 * ── POURQUOI CE FICHIER EXISTE, ALORS QU'IL ÉTAIT LA PAGE ──────────────────
 *
 * Tout ce corps vivait dans `(app)/guides/nouveau/page.tsx`. Une seconde page qui
 * l'aurait recopié serait devenue fausse au premier changement de l'une des deux
 * — et il y a ici une trentaine de prises à tenir identiques. Le code est donc
 * descendu dans `screens/guides/`, à côté du crochet qu'il relie, et les DEUX
 * pages ne font plus que le monter avec leur mode.
 *
 * ⚠ LE DESSIN EST INCHANGÉ. Ce fichier ne contient aucune mesure, aucune
 * couleur : le dessin est transcodé par `A05_EDITEUR` (`tools/generate-screens.mjs`)
 * et les deux cadres sont les mêmes objets qu'avant. La non-régression de
 * `/guides/nouveau` est donc structurelle — c'est littéralement le même code,
 * appelé avec `{ kind: 'nouveau' }`, et le crochet sort à la première ligne de
 * chacun de ses effets de reprise dans ce mode.
 *
 * ── LE `GardeNiveau` RESTE, ET IL NE GARDE RIEN ─────────────────────────────
 *
 * `guide.write` est en N2. Le front PRÉVIENT, il n'autorise pas : la garde ouvre
 * la fenêtre de niveau dès que `/me` a répondu et que la capacité manque, pour
 * que personne n'écrive un guide entier avant d'apprendre qu'il ne peut pas le
 * publier. Mais elle n'efface pas la page et n'empêche aucun appel — c'est le
 * serveur qui refuse, en `403 LEVEL_REQUIRED`, et c'est lui qui protège. En mode
 * `modifier`, c'est en plus `loadOwned` qui refuse à qui n'est pas l'auteur.
 */
export function EditeurGuideEcran({ mode }: { readonly mode: ModeEditeur }) {
  const editeur = useEditeurGuide(mode);
  const router = useRouter();
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [parcoursEnVol, setParcoursEnVol] = useState(false);

  /**
   * « PARTIR D'UN PARCOURS » : le serveur crée le brouillon pré-rempli, puis on
   * l'ouvre dans l'éditeur existant (`/guides/:slug/modifier`) — le même chemin que
   * la reprise d'un brouillon, donc rien n'est dupliqué.
   */
  const partirDuParcours = (parcoursId: string): void => {
    if (parcoursEnVol) return;
    setParcoursEnVol(true);
    void draftFromJourney(parcoursId)
      .then((brouillon) => {
        setChoixOuvert(false);
        router.push(`/guides/${encodeURIComponent(brouillon.slug)}/modifier`);
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'Le brouillon n’a pas pu être créé depuis ce parcours.',
        );
      })
      .finally(() => {
        setParcoursEnVol(false);
      });
  };

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'APERÇU EST RENDU PAR `CorpsGuide` — LA MÊME GRAMMAIRE QUE LA PAGE      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Un aperçu qui ne rendrait pas comme la page du guide publié serait un aperçu
   * qui mentirait. `CorpsGuide` suit la grammaire que le SERVEUR impose
   * (`restrictedMarkdownIssue`, `guideBodyMediaKeys`) et les styles de la planche,
   * images comprises — donc ce que le membre voit ici est ce qu'il publiera.
   *
   * DEUX PRISES ET NON UNE, pour la raison déjà écrite sur A04 : `ScreenFrames`
   * rend les DEUX cadres et masque l'un par CSS, et l'image n'a pas le même dessin
   * aux deux largeurs — 220 px de haut et légende sous le bloc à 1 440 px, 170 px
   * et légende DANS le bloc à 390 px. Un seul nœud aurait donné le dessin
   * d'ordinateur sur le téléphone.
   *
   * ⚠ `auteurImage` EST `null`, et c'est juste : la planche écrit « Image ajoutée
   * par Marc K. » sous une image du guide PUBLIÉ, parce qu'un guide est maintenu à
   * plusieurs et qu'il faut dire qui a ajouté quoi. Dans l'éditeur, celui qui
   * ajoute est celui qui regarde : se créditer soi-même dans son propre brouillon
   * n'apporterait rien, et il n'y a d'ailleurs pas de nom à mettre — le brouillon
   * n'a pas encore d'auteur côté API.
   *
   * ⚠ `onProposerCorrection` EST OMIS, et il faut le dire : `CorpsGuide` écoute la
   * sélection de texte pour poser son infobulle « Proposer une correction sur ce
   * passage ». Dans un éditeur, ce geste n'a aucun sens — on corrige en tapant.
   * La prise est facultative, et sans elle l'infobulle ne s'arme pas.
   */
  const apercuDe = (planche: 'desktop' | 'mobile') =>
    editeur.corps === '' ? null : (
      <CorpsGuide body={editeur.corps} planche={planche} auteurImage={null} />
    );

  const data: A05Data = {
    mdTools,
    rules,
    editeur: {
      titre: editeur.titre,
      onTitre: (e) => {
        editeur.setTitre(e.target.value);
      },
      titreMax: GUIDE_TITLE_MAX,
      categorie: editeur.categorie,
      categorieLibelle: editeur.categorieLibelle,
      categorieOptions: editeur.categorieOptions,
      onCategorie: (e) => {
        /**
         * LA VALEUR VIENT DE LA LISTE QUE NOUS AVONS DONNÉE, donc c'est une
         * `GuideCategory` — mais un `<select>` rend une `string`, et le type ne
         * peut pas le savoir. On le vérifie contre l'énumération du serveur plutôt
         * que de l'affirmer : un `as` aurait éteint le compilateur à l'endroit
         * précis où une énumération partagée est en jeu.
         */
        const choix = GuideCategory.find((c) => c === e.target.value);
        if (choix !== undefined) editeur.setCategorie(choix);
      },
      portee: editeur.portee,
      porteeLibelle: editeur.porteeLibelle,
      porteeOptions: editeur.porteeOptions,
      onPortee: (e) => {
        editeur.setPortee(e.target.value);
      },
      ville: editeur.ville,
      villeLibelle: editeur.villeLibelle,
      villeLibelleCourt: editeur.villeLibelleCourt,
      villeOptions: editeur.villeOptions,
      onVille: (e) => {
        editeur.setVille(e.target.value);
      },
      corps: editeur.corps,
      onCorps: (e) => {
        editeur.setCorps(e.target.value);
      },
      corpsMax: GUIDE_BODY_MAX,
      /**
       * LE MÊME APERÇU POUR LES DEUX CADRES ? NON — et c'est pourquoi il y a deux
       * appels. Le cadre d'ordinateur lit `editeur.apercu` dans sa colonne
       * « APERÇU », celui de 390 px le lit dans sa boîte quand l'onglet est sur
       * « Aperçu ». Comme la prise est la MÊME, on ne peut en donner qu'une : c'est
       * donc celle de la planche d'ordinateur qui part dans `A05Desktop` et celle
       * du téléphone dans `A05Mobile`, par deux objets de données distincts. Voir
       * juste en dessous.
       */
      apercu: null,
      apercuOuvert: editeur.apercuOuvert,
      onApercu: editeur.setApercu,
      brouillon: editeur.brouillon,
      brouillonCourt: editeur.brouillonCourt,
      peutPublier: editeur.peutPublier,
      motifPublier: editeur.motifPublier,
      /**
       * « Publier » SUR UN BROUILLON, « Enregistrer » SUR UN GUIDE DÉJÀ PARU.
       *
       * Le mot vient du crochet et non de ce fichier parce que c'est le STATUT du
       * guide qui le décide, et le statut, seul le serveur le dit. Voir
       * `publierLibelle` dans `use-editeur-guide.ts` pour les deux refus mesurés
       * (`ALREADY_PUBLISHED`, `ARCHIVED`) qui rendent ce libellé nécessaire.
       */
      publierLibelle: editeur.publierLibelle,
      onPublier: editeur.publier,
      onFermer: editeur.fermer,
      onOutil: editeur.outil,
      onImage: (e) => {
        const fichier = e.target.files?.[0];
        if (fichier === undefined) return;
        editeur.deposerImage(fichier);
        /**
         * LE CHAMP EST VIDÉ APRÈS COUP, et sans cela le MÊME fichier choisi deux
         * fois de suite ne déclencherait rien : `change` n'est émis que si la
         * valeur change. C'est le même geste que le composeur de publication fait
         * déjà pour sa photo.
         */
        e.target.value = '';
      },
      imageOccupe: editeur.imageOccupe,
      parcours: null,
      parcoursChoix:
        mode.kind === 'nouveau'
          ? {
              titre: 'PARTIR D’UN PARCOURS TERMINÉ',
              texte: 'Pré-remplissez le guide avec une section par étape franchie, puis complétez-le.',
              bouton: 'Choisir un parcours',
              occupe: parcoursEnVol,
              onChoisir: () => {
                setChoixOuvert(true);
              },
            }
          : null,
      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LA CARTE DES PAGES — SES DEUX LIBELLÉS ET SES QUATRE GESTES          ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur : « il faut au niveau de la side bar la possibilité d'ajouter
       * les pages ou d'en retirer, pour l'auteur bien sûr. »
       *
       * LES DEUX LIBELLÉS SONT DU TEXTE DE PRODUIT, et c'est pour cela qu'ils sont
       * ici et non dans le transcodeur : la carte est EMPRUNTÉE au « MODE MODIFIER
       * LES ÉTAPES » du parcours, dont le titre et le lien parlent d'étapes. Un
       * emprunt pose du dessin ; les mots viennent du produit.
       *
       * `bord` PORTE LA PAGE EN COURS D'ÉCRITURE, avec les DEUX valeurs que la
       * carte empruntée dessine : `1.5px solid #16785E` sur la ligne que la planche
       * montre saisie, `1px solid #E6EBE9` sur les autres. Aucune couleur n'est
       * inventée, et l'on n'assombrit rien.
       */
      pagesTitre: 'LES PAGES',
      ajouterLibelle: 'Ajouter une page',
      pageTitreMax: GUIDE_PAGE_TITLE_MAX,
      onAjouterPage: editeur.ajouterPage,
      pages: editeur.pages.map((page) => ({
        id: page.id,
        titre: page.title,
        bord:
          page.id === editeur.pageCourante ? '1.5px solid #16785E' : '1px solid #E6EBE9',
        onTitre: (e) => {
          editeur.renommerPage(page.id, e.target.value);
        },
        /**
         * LE FOCUS CHOISIT LA PAGE. C'est le geste que `A05_PAGES` décrit : la
         * ligne n'a qu'une prise, et une page demande deux gestes. Cliquer sur le
         * nom d'une page y va ET permet de la renommer.
         */
        onChoisir: () => {
          editeur.choisirPage(page.id);
        },
        onRetirer: () => {
          editeur.demanderRetraitPage(page.id);
        },
      })),
    },
  };

  return (
    <>
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ RETIRER UNE PAGE EFFACE DU TEXTE ÉCRIT — ON DEMANDE D'ABORD          ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * C'est la MÊME fenêtre que « L'information a changé » sur la page du guide,
       * et le même raisonnement : un clic malheureux sur une corbeille de 32 px ne
       * doit pas emporter une section entière. Le retrait est logique côté serveur
       * (`deleted_at`), donc rien n'est perdu en base — mais le texte disparaît de
       * l'écran et du guide publié, et c'est ce que le membre voit.
       *
       * LE TITRE DE LA PAGE EST DANS LA QUESTION : « Retirer “Le dossier” ? » dit
       * laquelle part, là où « Retirer cette page ? » laisserait douter — la
       * corbeille cliquée n'est pas forcément celle de la page en cours d'écriture.
       */}
      <FenetreConfirmation
        ouverte={editeur.pageARetirer !== null}
        titre={
          editeur.pageARetirer === null
            ? 'Retirer cette page ?'
            : `Retirer « ${editeur.pageARetirer.titre} » ?`
        }
        question="Le texte de cette page ne paraîtra plus dans le guide. Les commentaires qu’elle a reçus ne seront plus visibles non plus."
        libelleConfirmer="Retirer la page"
        onConfirmer={editeur.confirmerRetraitPage}
        onAnnuler={editeur.annulerRetraitPage}
        nom="A05_RETIRER_PAGE"
      />
      <ScreenFrames
        screen="A05"
        direction="column"
        desktop={<A05Desktop {...data} editeur={{ ...data.editeur, apercu: apercuDe('desktop') }} />}
        mobile={<A05Mobile {...data} editeur={{ ...data.editeur, apercu: apercuDe('mobile') }} />}
      />
      <FenetreParcoursSource
        ouverte={choixOuvert}
        occupe={parcoursEnVol}
        onChoisir={(p) => {
          partirDuParcours(p.id);
        }}
        onFermer={() => {
          setChoixOuvert(false);
        }}
      />
      <GardeNiveau capacite="guide.write" />
    </>
  );
}
