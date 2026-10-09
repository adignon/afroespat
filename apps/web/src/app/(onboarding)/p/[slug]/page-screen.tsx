'use client';

import { P03Desktop } from '@/screens/p03/desktop.generated';
import { P03Ressources } from '@/screens/p03/ressources.generated';
import { ScreenFrames } from '@/screens/frames';
import { INITIAL_ONBOARDING_STATE, onboardingVals } from '@/screens/onboarding/data';

/**
 * P03 — la page statique, `/p/:slug`, telle que la maquette l'écrit sous sa
 * planche. Deux variantes : le document, et « RESSOURCES ».
 *
 * ── COMPOSANT CLIENT, ET C'EST UN CHOIX RÉFLÉCHI ────────────────────────────
 *
 * `onboardingVals` vit dans un module `'use client'`. Un composant SERVEUR qui
 * l'importerait n'obtiendrait pas la fonction mais une RÉFÉRENCE client — c'est
 * exactement le piège que `resume.ts` a déjà payé sur ce chemin, et le symptôme
 * n'est pas une erreur mais un `undefined` silencieux.
 *
 * Être client ne rend PAS la page vide pour autant : Next rend les composants
 * client côté serveur pour le HTML initial. Le texte du document part donc dans
 * la première réponse — vérifié au `curl`, parce que cinq pages de ce dépôt ont
 * déjà été servies blanches et que le symptôme ne désigne jamais la cause.
 *
 * Ce qui aurait rendu la page vide, en revanche, c'est `useSearchParams()`. Le
 * slug est donc lu en PROPRIÉTÉ, par le composant serveur d'à côté.
 *
 * ── CE QUE CET ÉCRAN NE PEUT PAS ENCORE FAIRE ───────────────────────────────
 *
 * Le corps du document est celui de la maquette, transcodé — il n'y a pas d'autre
 * choix aujourd'hui : `static_pages` existe en base et porte deux lignes
 * publiées (`cgu`, `confidentialite`, version « 0 »), mais AUCUNE ROUTE ne les
 * sert. Ni côté membre (`GET /pages/:slug`), ni côté équipe, alors que
 * 15-administration §5 promet le CRUD `/pages` et que `consents.version`
 * référence `static_pages.version`.
 *
 * Conséquence visible, et à remonter plutôt qu'à maquiller : les deux pastilles
 * « Version 3 » et « En vigueur depuis le 1er septembre 2026 » sont celles de la
 * maquette, et la base dit version « 0 ». Les corriger à la main ici serait
 * inventer une donnée ; les brancher demande la route.
 */
export type PageStatique = 'document' | 'ressources';

export function PageStatiqueScreen({ variante }: { readonly variante: PageStatique }) {
  /**
   * Les valeurs de la maquette, sans état vivant.
   *
   * `onboardingVals` est PURE — elle reçoit l'état et de quoi le changer, et ne
   * lit rien d'autre. Cette page n'a aucun état à changer : le `patch` ne fait
   * donc rien, et les listes dont elle a besoin (`toc`, `resources`) n'en
   * dépendent pas. Les recopier ici en aurait fait une deuxième source.
   */
  const vals = onboardingVals(INITIAL_ONBOARDING_STATE, () => undefined, {
    busy: false,
    onSubmit: () => undefined,
    onContinue: () => undefined,
    // P03 ne dessine aucun bouton retour : l'action est inerte, comme ses voisines.
    onBack: () => undefined,
    countryOptions: [],
    cityCatalogue: [],
    skillCatalogue: [],
    languageCatalogue: [],
    templates: [],
    // P03 ne dessine ni compte à rebours, ni « Renvoyer », ni retour : ces trois
    // valeurs existent pour P02 seul, et cette page ne les rend nulle part.
    resendIn: 0,
    onResend: () => undefined,
    onChangeNumber: () => undefined,
  });

  return (
    <ScreenFrames
      screen={variante === 'ressources' ? 'P03-ressources' : 'P03'}
      /**
       * `direction="column"` : la maquette écrit `flex-direction: column` sur ce
       * cadre, et le générateur retire ce conteneur parce qu'il portait aussi la
       * taille fixe de la planche. L'enveloppe repose alors sur son défaut — une
       * RANGÉE, juste pour les écrans à rail de gauche, faux pour ceux-ci. Les HUIT
       * cadres d'ordinateur de cette maquette sont des colonnes. Voir le détail dans
       * `(onboarding)/bienvenue/phase/page.tsx`.
       */
      direction="column"
      // La maquette ne dessine PAS de cadre mobile pour P03 : la planche du
      // document fait 1440 px, celle des ressources 560 px. Un seul cadre donc,
      // comme pour O05 — et non un cadre mobile inventé.
      desktop={variante === 'ressources' ? <P03Ressources {...vals} /> : <P03Desktop {...vals} />}
    />
  );
}
