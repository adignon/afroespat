'use client';

import { useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A06Desktop } from '@/screens/a06/desktop.generated';
import { A06Mobile } from '@/screens/a06/mobile.generated';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import {
  correction as correctionMaquette,
  guide as guideMaquette,
  panelGuides,
  rail,
  shortcuts,
  signalements,
  type A06Data,
} from '@/screens/a06/data';
import { AMENDEMENT_MAX, REFUS_MOTIF_MAX, REFUS_MOTIF_MIN } from '@/screens/guides/api';
import { propositionFrom } from '@/screens/guides/from-api';
import { PropositionsProvider } from '@/components/propositions-recues';
import type { GuideProposalView } from '@app/shared';
import { useGuide } from '@/screens/guides/use-guides';

/**
 * A06 · planche 2 — « Propositions reçues » de l'auteur. BRANCHÉE SUR L'API.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE L'AUTEUR NE POUVAIT PAS FAIRE, ET QUI ÉTAIT LE DÉFAUT               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant ce lot : `grep -o "onClick" a06/desktop.generated.tsx` → ZÉRO. Cette
 * page chargeait les VRAIES propositions depuis des lots, et les trois boutons de
 * décision étaient du dessin pur. L'auteur voyait ce qu'on lui proposait et ne
 * pouvait ni accepter, ni amender, ni refuser.
 *
 * Les trois appels existaient (`acceptProposal`, `amendProposal`,
 * `rejectProposal`), les trois routes aussi (`POST /proposals/:id/…`). Il ne
 * manquait que le clic : voir `A06_DECISIONS` dans `tools/generate-screens.mjs`
 * pour le dessin, et `deciderProposition` dans `use-guides.ts` pour l'état.
 *
 * ── LES TROIS FENÊTRES, ET POURQUOI TROIS ───────────────────────────────────
 *
 * ⚠ ACCEPTER ÉCRIT DANS LE GUIDE — §2.4 crée une version, remplace le passage et
 * crédite le proposant. On CONFIRME donc avant, exactement comme le dépôt le fait
 * déjà pour le signalement d'obsolescence et pour « Ouvrir à la communauté ». Sans
 * champ : il n'y a rien à saisir.
 *
 * REFUSER exige un MOTIF, et ce n'est pas une politesse : `rejectProposalSchema`
 * déclare `reason` trimé, de 10 à 1 000 caractères, et §2.4 veut que le proposant
 * en soit notifié. La fenêtre emploie donc `champ`, avec son `min` — le bouton de
 * confirmation reste éteint sous le plancher, plutôt que de promettre un `400`.
 *
 * AMENDER laisse l'auteur retoucher le remplacement avant de l'accepter
 * (`amendProposalSchema` ne porte QUE `replacement`). Le champ est pré-rempli avec
 * ce que le proposant a écrit, et le VIDE est licite : §2.4 prévoit le retrait d'un
 * passage, donc aucun plancher sur ce champ.
 *
 * ⚠ LA PLANCHE NE DESSINE AUCUN CHAMP POUR AMENDER, et il faut le dire : elle
 * dessine un bouton « Accepter en modifiant » et rien derrière. On n'invente pas un
 * écran pour lui — on emploie `FenetreConfirmation`, le châssis que ce dépôt a
 * posé au lot précédent et dont chaque pièce est relevée sur K08 et X03. REMONTÉ :
 * il manque une planche qui dise où l'auteur retouche le texte.
 *
 * ⚠ LA PLANCHE DE 1 440 px DESSINAIT UN FORMULAIRE DE REFUS EN PLACE, dans sa
 * seconde carte (« Motif du refus * », « Confirmer le refus », « Annuler »). Il n'a
 * pas été retenu, et le pourquoi au long est sur `A06_DECISIONS` : 390 px n'en
 * dessine aucun, et deux mécaniques pour un seul geste auraient divergé.
 *
 * ── ZÉRO, UNE OU DIX PROPOSITIONS (lot G) ──────────────────────────────────
 *
 * La maquette dessine EXACTEMENT DEUX cartes en balisage statique, ni `<sc-for>` ni
 * `<sc-if>` : deux EMPLACEMENTS, pas une liste. Avec zéro proposition l'écran
 * montrait deux cartes « Aucune proposition », avec une seule une carte vide, avec
 * trois ou plus les deux premières. Les onglets et la liste sont désormais un AJOUT
 * (`components/propositions-recues.tsx`) : autant de cartes que de propositions, le
 * diff AVANT / APRÈS réel (mots barrés, mots surlignés), un état vide par onglet.
 * Cette page ne fournit plus que la liste et les trois gestes.
 *
 * Reste vrai, et remonté : la route ne rend JAMAIS de proposition refusée à cette
 * page (§4 — « pour l'auteur : en attente ; pour tous : acceptées »), donc l'onglet
 * « Refusées » n'a ni liste ni compteur ; et `GuideProposalView` ne porte pas le
 * nom de la section visée, que la planche écrivait en dur — la ligne a disparu.
 */

/** La décision demandée, et sur quelle proposition. `null` : aucune fenêtre ouverte. */
interface DemandeDecision {
  readonly proposalId: string;
  readonly kind: 'ACCEPT' | 'AMEND' | 'REJECT';
  /** Le nom du proposant, pour que la question nomme ce qu'elle décide. */
  readonly proposant: string;
}

export function PropositionsScreen({ slug }: { readonly slug: string }) {
  const { detail, propositions, enTete, deciderProposition, decisionEnVol } = useGuide(slug);

  const [demande, setDemande] = useState<DemandeDecision | null>(null);
  /** Le motif du refus, et le remplacement amendé : deux champs, deux états. */
  const [motifRefus, setMotifRefus] = useState('');
  const [remplacement, setRemplacement] = useState('');
  const [echecDecision, setEchecDecision] = useState<string | null>(null);

  /**
   * Avant la réponse, la liste est vide et le crochet le dit (`chargement`) : la page
   * ne montre plus de proposition de maquette — « Fatou Ndiaye · 11 j » sur un guide
   * qui n'a reçu aucune correction aurait l'air branché sans l'être.
   */
  const servi = detail !== null;
  const items = propositions?.items ?? [];

  /**
   * LES TROIS GESTES, SUR N'IMPORTE QUELLE CARTE (lot G). Le fournisseur
   * (`PropositionsProvider`) les passe aux boutons de chaque carte ; la page garde
   * la fenêtre de confirmation et l'appel. Le proposant et le remplacement viennent
   * de la proposition elle-même — le même `propositionFrom` que le reste de la page.
   */
  const demander = (kind: DemandeDecision['kind'], proposition: GuideProposalView): void => {
    const vue = propositionFrom(proposition);
    setEchecDecision(null);
    setMotifRefus('');
    setRemplacement(vue.apres);
    setDemande({ proposalId: vue.proposalId, kind, proposant: vue.proposant });
  };

  const data: A06Data = {
    rail,
    panelGuides,
    shortcuts,
    /** Le guide dont on relit les propositions : son titre vient de `GET /guides/:slug`. */
    guide:
      servi && enTete !== null
        ? { title: enTete.title, href: `/guides/${encodeURIComponent(slug)}` }
        : guideMaquette,
    /**
     * NON LUE PAR LES DEUX CADRES DE CETTE PLANCHE : « Propositions reçues » ne
     * dessine pas le panneau de correction — c'est la planche 1 de A06 qui le fait.
     * La prise est dans `A06Data` parce que les QUATRE cadres de la section
     * partagent une signature, exactement comme `guide` juste au-dessus, et on y
     * passe donc le dessin de la maquette plutôt qu'un objet vide.
     */
    correction: correctionMaquette,
    /**
     * NON LUE PAR CES DEUX CADRES : la liste des signalements « a changé » vit sur
     * `/guides/:slug/signalements`, qui emprunte CETTE MÊME planche (voir
     * `tools/screens/03-accueil.mjs`). La prise est partagée par les six cadres de
     * la section, comme `correction` juste au-dessus.
     */
    signalements,
  };

  const occupe = decisionEnVol !== null;

  /** Ce que chaque fenêtre dit, et ce qu'elle demande de saisir. */
  const fenetre =
    demande === null
      ? null
      : demande.kind === 'ACCEPT'
        ? {
            titre: 'Accepter cette correction ?',
            question: `La correction proposée par ${demande.proposant} remplacera le passage visé dans votre guide, et une nouvelle version sera créée.`,
            precision:
              'Le proposant sera crédité comme contributeur. Vous pourrez revenir à une version précédente depuis l’historique.',
            libelle: 'Accepter',
            champ: undefined,
          }
        : demande.kind === 'AMEND'
          ? {
              titre: 'Accepter en modifiant',
              question: `Retouchez le remplacement proposé par ${demande.proposant} avant de l’accepter. Il sera crédité comme contributeur quand même.`,
              precision:
                'Un remplacement vide retire le passage visé du guide : c’est licite, et c’est parfois ce qu’il faut.',
              libelle: 'Accepter en modifiant',
              champ: {
                libelle: 'Texte de remplacement',
                valeur: remplacement,
                onChange: setRemplacement,
                max: AMENDEMENT_MAX,
              },
            }
          : {
              titre: 'Refuser cette correction ?',
              question: `${demande.proposant} sera prévenu·e de votre refus et en lira le motif. Dites-lui pourquoi.`,
              precision: undefined,
              libelle: 'Refuser',
              champ: {
                libelle: `Motif du refus (${REFUS_MOTIF_MIN} caractères minimum)`,
                valeur: motifRefus,
                onChange: setMotifRefus,
                max: REFUS_MOTIF_MAX,
                min: REFUS_MOTIF_MIN,
              },
            };

  const confirmer = () => {
    if (demande === null) return;
    const decision =
      demande.kind === 'ACCEPT'
        ? ({ kind: 'ACCEPT' } as const)
        : demande.kind === 'AMEND'
          ? ({ kind: 'AMEND', replacement: remplacement } as const)
          : ({ kind: 'REJECT', reason: motifRefus.trim() } as const);
    void deciderProposition(demande.proposalId, decision).then((echec) => {
      /**
       * LA FENÊTRE RESTE OUVERTE SUR UN ÉCHEC, avec le message du serveur. La
       * fermer aurait fait disparaître la saisie — un motif de refus de deux
       * phrases — en même temps que l'erreur, et le membre aurait tout retapé pour
       * apprendre la même chose.
       */
      if (echec !== null) {
        setEchecDecision(echec.message);
        return;
      }
      setDemande(null);
      setMotifRefus('');
      setRemplacement('');
    });
  };

  return (
    <>
      {/*
        L'échec d'une décision est annoncé AU-DESSUS de la page, et avec le dessin
        que `guides-screen.tsx` emploie déjà pour le même cas : le message vient du
        socle (`displayMessageFor`), jamais du serveur sur un 429, qui dit
        « patientez un instant » pour une heure d'attente.
      */}
      {echecDecision === null ? null : (
        <p
          role="alert"
          data-decision-echec=""
          style={{
            margin: '12px 24px 0',
            padding: '12px 16px',
            borderRadius: '14px',
            background: '#FDF0E7',
            color: '#B4581F',
            fontSize: '13px',
          }}
        >
          {echecDecision}
        </p>
      )}
      <PropositionsProvider
        items={items}
        decidable={decisionEnVol === null}
        chargement={!servi}
        onDecision={demander}
      >
        <ScreenFrames
          screen="A06"
          desktop={<A06Desktop {...data} />}
          mobile={<A06Mobile {...data} />}
        />
      </PropositionsProvider>
      {fenetre === null ? null : (
        <FenetreConfirmation
          ouverte
          nom="A06_DECISION"
          titre={fenetre.titre}
          question={fenetre.question}
          {...(fenetre.precision === undefined ? {} : { precision: fenetre.precision })}
          {...(fenetre.champ === undefined ? {} : { champ: fenetre.champ })}
          libelleConfirmer={fenetre.libelle}
          occupe={occupe}
          onConfirmer={confirmer}
          onAnnuler={() => {
            if (occupe) return;
            setDemande(null);
          }}
        />
      )}
    </>
  );
}
