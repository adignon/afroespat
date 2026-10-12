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
  propositionDepliee as deplieeMaquette,
  propositionRepliee as replieeMaquette,
  propositionsCompte as compteMaquette,
  rail,
  shortcuts,
  signalements,
  type A06Data,
  type PropositionEnTeteView,
} from '@/screens/a06/data';
import { AMENDEMENT_MAX, REFUS_MOTIF_MAX, REFUS_MOTIF_MIN } from '@/screens/guides/api';
import { propositionEnTeteDe, propositionsCompteDe } from '@/screens/guides/from-api';
import type { PropositionVue } from '@/screens/guides/from-api';
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
 * ── LA LIMITE STRUCTURELLE DE CETTE PLANCHE, QU'IL FAUT REDIRE ──────────────
 *
 * La maquette dessine EXACTEMENT DEUX cartes, une dépliée et une repliée, en
 * balisage statique — ni `<sc-for>`, ni `<sc-if>`. Cet écran ne peut donc pas
 * représenter 0, 1, ni 3 propositions : il a deux EMPLACEMENTS, pas une liste.
 *
 * Conséquence tenue ici : un emplacement sans proposition reçoit un en-tête VIDE
 * (« Aucune proposition », pastille grise) et non les valeurs de la maquette. Un
 * dessin de maquette servi à la place d'une donnée absente aurait l'air branché
 * sans l'être — « Fatou Ndiaye · 11 j » s'afficherait sur un guide qui n'a reçu
 * aucune correction. REMONTÉ : IL MANQUE UNE PLANCHE QUI DISE CE QUI DÉPLIE UNE
 * CARTE, puis une boucle.
 *
 * ⚠ ET À 390 px L'EMPLACEMENT 2 N'EST PAS DÉCIDABLE : la carte repliée du téléphone
 * ne dessine aucun bouton. Les trois gestes y sont posés quand même — la prise est
 * la même sur les deux cadres — mais aucun cadre de 390 px ne les appelle. REMONTÉ.
 *
 * ⚠ CONSÉQUENCE MESURÉE, ET CORRIGÉE ICI : tant que les emplacements portaient la
 * liste BRUTE, une proposition déjà décidée pouvait occuper l'emplacement 1 — la
 * route rend aussi les acceptées — et l'auteur de téléphone se retrouvait avec
 * « En attente · 1 » et un seul bouton ÉTEINT. Les deux emplacements portent
 * maintenant les propositions EN ATTENTE, ce que l'onglet actif de la planche
 * annonce. Voir le bloc `enAttente` plus bas.
 *
 * ── CE QUI RESTE DESSINÉ, ET POURQUOI ───────────────────────────────────────
 *
 * Les blocs AVANT et APRÈS de la carte dépliée. La maquette y dessine un DIFF — le
 * mot retiré barré, les mots ajoutés surlignés — là où l'API rend deux chaînes
 * nues (`targetExcerpt`, `replacement`). Les lier mettrait le texte entier dans un
 * seul `<span>` et ferait DISPARAÎTRE la différence, c'est-à-dire la seule chose
 * que ces deux blocs montrent. Il faut un composant de différence, pas une prise.
 *
 * Et « Refusées · 1 » à 1 440 px : la route ne rend JAMAIS de proposition refusée à
 * cette page (§4 — « pour l'auteur : en attente ; pour tous : acceptées »), donc le
 * compte n'est pas dérivable. Il reste la valeur de la planche. REMONTÉ.
 */

/**
 * L'emplacement sans proposition.
 *
 * La pastille grise et le `·` sont la convention que ce module tient déjà pour un
 * auteur anonymisé (`guideCardFrom`, §8) : une identité qui n'est pas là se dessine
 * en gris, elle ne s'emprunte pas à quelqu'un d'autre.
 *
 * `decidable: false` : il n'y a rien à décider, donc les trois boutons s'éteignent.
 */
const EMPLACEMENT_VIDE: PropositionEnTeteView = {
  i: '·',
  bg: '#8A958F',
  proposant: 'Aucune proposition',
  delai: '—',
  delaiLong: '—',
  motif: '',
  decidable: false,
  onAccepter: () => undefined,
  onAmender: () => undefined,
  onRefuser: () => undefined,
};

/** La décision demandée, et sur quelle proposition. `null` : aucune fenêtre ouverte. */
interface DemandeDecision {
  readonly proposalId: string;
  readonly kind: 'ACCEPT' | 'AMEND' | 'REJECT';
  /** Le nom du proposant, pour que la question nomme ce qu'elle décide. */
  readonly proposant: string;
}

export function PropositionsScreen({ slug }: { readonly slug: string }) {
  const { detail, propositions, enTete, propositionsVues, deciderProposition, decisionEnVol } =
    useGuide(slug);

  const [demande, setDemande] = useState<DemandeDecision | null>(null);
  /** Le motif du refus, et le remplacement amendé : deux champs, deux états. */
  const [motifRefus, setMotifRefus] = useState('');
  const [remplacement, setRemplacement] = useState('');
  const [echecDecision, setEchecDecision] = useState<string | null>(null);

  /**
   * Avant la réponse, on garde le DESSIN de la maquette — le même choix que
   * `guide-screen.tsx` documente pour l'en-tête de A04 : un écran qui montre une
   * planche le temps d'un aller-retour vaut mieux qu'un écran vide qui clignote.
   *
   * Dès que la réponse est là, tout vient d'elle, y compris les emplacements vides.
   */
  const servi = detail !== null;
  const items = propositions?.items ?? [];

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEUX EMPLACEMENTS PORTENT LES PROPOSITIONS *EN ATTENTE*              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ AU NAVIGATEUR, et c'est le défaut le plus intéressant du lot : la liste
   * revient triée par DATE DÉCROISSANTE, et elle contient AUSSI les propositions
   * déjà acceptées — §4 : « en attente pour l'auteur, acceptées pour tous ». Après
   * une première décision, c'est donc la proposition DÉCIDÉE qui occupait
   * l'emplacement 1 et la proposition en attente qui tombait dans l'emplacement 2.
   *
   * À 1 440 px cela gênait ; à 390 px cela BLOQUAIT, parce que la carte repliée du
   * téléphone ne dessine AUCUN bouton : l'auteur lisait « En attente · 1 » et son
   * seul bouton « Accepter » était éteint. Relevé par l'épreuve, pas supposé —
   * Playwright a attendu 240 s sur un `<button disabled>`.
   *
   * ── LE FILTRE EST DESSINÉ, IL N'EST PAS INVENTÉ ───────────────────────────
   *
   * La planche dessine TROIS ONGLETS — « En attente · 2 », « Acceptées · 7 »,
   * « Refusées » — et c'est le PREMIER qui porte l'état actif (aplat blanc à
   * 1 440 px, aplat vert à 390 px : relevé sur chaque cadre, pas supposé
   * symétrique). La page montre donc ce que son onglet actif annonce : les
   * propositions qui attendent une décision — `PENDING` et `ESCALATED`, les deux
   * seuls états qui attendent (§2.4).
   *
   * ⚠ LES ONGLETS NE CHANGENT TOUJOURS PAS DE VUE : la maquette les dessine en
   * `<span>` nus, sans marqueur d'interaction, et le transcodeur ne devine pas une
   * interaction. Les deux autres vues — acceptées, refusées — sont donc
   * inatteignables, et « Refusées » n'est de toute façon pas servie par la route.
   * REMONTÉ : il faut que la planche marque ses onglets.
   *
   * ── CE QUE CHAQUE PRISE APPORTE ──────────────────────────────────────────
   *
   * `propositionEnTeteDe` rend les SIX valeurs d'affichage — avatar, nom, les deux
   * délais, motif — et il est la seule arithmétique du délai. `propositionsVues`
   * rend la proposition ENTIÈRE : son IDENTIFIANT, sans lequel un bouton ne saurait
   * pas quoi accepter, son `enAttente` — la règle de statut, tenue en UN endroit —
   * et le remplacement proposé qui pré-remplit le champ d'amendement. Les deux
   * listes sortent du même `propositions.items`, donc le rang les apparie.
   */
  const enAttente = items
    .map((brut, rang) => ({ brut, vue: propositionsVues[rang] }))
    .filter(
      (paire): paire is { brut: GuideProposalView; vue: PropositionVue } =>
        paire.vue !== undefined && paire.vue.enAttente,
    );

  const emplacement = (rang: number): PropositionEnTeteView => {
    const paire = enAttente[rang];
    if (paire === undefined) return EMPLACEMENT_VIDE;
    const { brut, vue } = paire;
    const ouvrir = (kind: DemandeDecision['kind']) => () => {
      setEchecDecision(null);
      setMotifRefus('');
      setRemplacement(vue.apres);
      setDemande({ proposalId: vue.proposalId, kind, proposant: vue.proposant });
    };
    return {
      ...propositionEnTeteDe(brut),
      /**
       * TOUT CE QUI EST DANS CES DEUX EMPLACEMENTS ATTEND UNE DÉCISION — c'est le
       * filtre ci-dessus qui le garantit. Ne reste donc qu'un cas d'extinction :
       * un appel EN VOL. Sans lui, un double clic sur « Accepter » écrirait deux
       * fois dans le corps du guide. L'emplacement VIDE, lui, est éteint par
       * `EMPLACEMENT_VIDE`.
       */
      decidable: decisionEnVol === null,
      onAccepter: ouvrir('ACCEPT'),
      onAmender: ouvrir('AMEND'),
      onRefuser: ouvrir('REJECT'),
    };
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
    propositionDepliee: servi ? emplacement(0) : deplieeMaquette,
    propositionRepliee: servi ? emplacement(1) : replieeMaquette,
    propositionsCompte: servi ? propositionsCompteDe(items) : compteMaquette,
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
      <ScreenFrames
        screen="A06"
        desktop={<A06Desktop {...data} />}
        mobile={<A06Mobile {...data} />}
      />
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
