'use client';

import { O04Desktop } from '@/screens/o04/desktop.generated';
import { O04Mobile } from '@/screens/o04/mobile.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';
import { ChoixReferentiel } from '@/screens/onboarding/choix-referentiel';
import { useCallback, useRef, useState } from 'react';
import { ApiError, uploadAvatar } from '@/lib/api';
import { urlMedia } from '@/lib/api/base';
import { notifyError } from '@/components/notifications';

/**
 * O04 — Présentez-vous. Écran 5 des six de §5.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/01 Accès et Onboarding.dc.html`.
 * Seuls le comportement et l'appel à l'API s'écrivent ici.
 */
export default function Page() {
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(5);

  /**
   * LES DEUX CHAMPS « COMPÉTENCES » ET « LANGUES ».
   *
   * Le porteur : « L'ajout de compétences et langue », puis « les inputs d'ajout
   * de langue, compétences et autres de la page marchent ? » Ils ne marchaient
   * pas : la maquette dessine cinq noms et le mot « Rechercher… » en `<span>`,
   * donc zéro `input` et zéro bouton — mesuré au navigateur.
   *
   * Montés ICI, et pas dans `data.ts`, pour la même raison que le panneau de pays
   * de O02 : `data.ts` n'est pas un fichier de rendu. Le transcodeur ménage la
   * place (`{{ competencesChamp }}`, `{{ languesChamp }}`) à l'intérieur des
   * boîtes que la maquette dessine ; la page y pose le contrôle.
   *
   * LE CADRE MOBILE N'EN REÇOIT PAS, et ce n'est pas un oubli : la planche de
   * 390 px ne dessine NI compétences NI langues. Leur ajouter un champ serait
   * dessiner à la place du porteur. REMONTÉ.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA SÉLECTION D'IMAGE — « la sélection d'image », et il n'y en avait pas  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ sur cet écran : zéro `input[type=file]`, zéro bouton. Le rond en
   * pointillés avec son appareil photo était un `<div>`.
   *
   * L'ENVOI EST IMMÉDIAT, et c'est voulu : `PUT /me/avatar` écrit le portrait
   * tout de suite et retire l'ancien. Le garder pour le « Continuer » obligerait
   * à tenir un fichier en mémoire au travers de deux écrans, et un membre qui
   * ferme l'onglet perdrait une photo qu'il a vue à l'écran.
   *
   * `portrait` est l'adresse RENDUE PAR LE SERVEUR, passée par `urlMedia` comme
   * toutes les autres : la réponse donne `/media/<clé>`, et le navigateur doit
   * la préfixer par l'API — sans quoi il la demanderait au serveur web.
   */
  const fichier = useRef<HTMLInputElement | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const onAvatar = useCallback(() => fichier.current?.click(), []);

  const onFichierChoisi = useCallback((evenement: React.ChangeEvent<HTMLInputElement>) => {
    const choisi = evenement.target.files?.[0];
    /**
     * LE CHAMP EST VIDÉ TOUT DE SUITE. Sans cela, rechoisir LE MÊME fichier après
     * un échec ne déclenche aucun `change` — le navigateur considère que la valeur
     * n'a pas bougé — et le membre croit l'écran mort.
     */
    evenement.target.value = '';
    if (choisi === undefined || envoi) return;
    setEnvoi(true);
    uploadAvatar(choisi)
      .then((media) => setPortrait(urlMedia(media.url)))
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'La photo n’a pas pu être envoyée.',
        );
      })
      .finally(() => setEnvoi(false));
  }, [envoi]);

  const avatar = {
    onAvatar,
    avatarFond: portrait === null ? 'none' : `url(${portrait})`,
    // L'appareil photo s'efface sous le portrait : les deux superposés sont illisibles.
    avatarIconDisplay: portrait === null ? 'block' : 'none',
  };

  const champs = {
    competencesChamp: (
      <ChoixReferentiel
        libelle="Compétences"
        options={vals.competencesOptions}
        choisis={vals.competencesChoisies}
        max={vals.choixMax}
        onAjouter={vals.onAjouterCompetence}
        onRetirer={vals.onRetirerCompetence}
        /**
         * LA SAISIE LIBRE N'EST DONNÉE QU'AUX COMPÉTENCES. Une langue est un code
         * ISO 639-1 côté serveur : en inventer une donnerait une ligne que rien ne
         * sait rapprocher d'une autre.
         */
        onCreer={vals.onCreerCompetence}
      />
    ),
    languesChamp: (
      <ChoixReferentiel
        libelle="Langues"
        options={vals.languesOptions}
        choisis={vals.languesChoisies}
        max={vals.choixMax}
        onAjouter={vals.onAjouterLangue}
        onRetirer={vals.onRetirerLangue}
      />
    ),
  };

  return (
    <>
      <ScreenFrames
        screen="O04"
      /**
       * `direction="column"` : LA MAQUETTE ÉCRIT `flex-direction: column` SUR CE
       * CADRE, et le générateur retire ce conteneur parce qu’il portait aussi la
       * taille fixe de la planche. L’enveloppe repose alors sur son défaut — une
       * RANGÉE, qui est juste pour les écrans à rail de gauche et faux pour
       * ceux-ci.
       *
       * MESURÉ AU NAVIGATEUR, et c’est le porteur qui l’a vu : « La page
       * d’onboarding a une pagination à gauche ? » Non — la maquette dessine une
       * BARRE DE PROGRESSION EN HAUT (bouton retour, six segments sur toute la
       * largeur, compteur à droite). En rangée, cette barre devenait une colonne
       * de 216 px de large sur toute la hauteur, ses six segments écrasés à 30 px,
       * et le bouton avec le compteur flottaient au milieu à gauche. Les HUIT
       * cadres d’ordinateur de cette maquette sont des colonnes : toutes les
       * pages de ce groupe portent donc cette prise.
       */
      direction="column"
        desktop={<O04Desktop {...vals} {...champs} {...avatar} />}
        mobile={<O04Mobile {...vals} />}
      />
      {/*
        LE CHOISISSEUR DE FICHIER — INVISIBLE, ET HORS DES CADRES.

        `ScreenFrames` rend LES DEUX cadres : à l'intérieur, ce champ existerait en
        double et `fichier.current` n'en désignerait qu'un — une fois sur deux celui
        du cadre masqué, dont le `click()` n'ouvre rien sur certains navigateurs.
        C'est le même montage que le sélecteur de photo de A14, pour la même raison.

        `aria-hidden` est VOLONTAIREMENT ABSENT : le champ est atteint par le rond
        de portrait, qui porte déjà le nom du geste. Le retirer de l'arbre
        d'accessibilité tout en le laissant focalisable serait le pire des deux.
      */}
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        onChange={onFichierChoisi}
        style={{ display: 'none' }}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
