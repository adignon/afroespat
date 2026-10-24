'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { O05AvecParcours } from '@/screens/o05/avecparcours.generated';
import { O05SansParcours } from '@/screens/o05/sansparcours.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';
import { listJourneys } from '@/screens/parcours/api';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { LIEU_INCONNU, chargerAtterrissage, type LieuAtterrissage } from '@/screens/onboarding/atterrissage';
import { PARCOURS_INCONNU, type ParcoursPret } from '@/screens/onboarding/data';

/**
 * Les deux atterrissages de §5, écran 6.
 *
 * DEUX variantes, et c'est une règle dure : « le parcours n'est jamais imposé ».
 * Avec parcours, on arrive sur la première étape ; sans, sur le réseau de la
 * ville, trois événements et un parrain suggéré. Les deux sont de vrais
 * atterrissages, pas un principal et un dégradé.
 *
 * La maquette ne donne pas de cadre mobile pour cet écran : les deux variantes
 * font 700 px. Le cadre unique s'étire donc, sans bascule au seuil de 1024 px.
 *
 * ── LA VARIANTE VIENT DE `GET /journeys`, ET D'ELLE SEULE ───────────────────
 *
 * Elle était décidée par `?parcours=non`, c'est-à-dire par l'URL. C'était juste
 * pour montrer la planche, et faux pour un membre : celui qui avait décoché
 * « Créer mon parcours » à O03 atterrissait quand même sur « votre parcours est
 * prêt », avec un bouton vers un parcours qui n'existait pas.
 *
 * Le paramètre ne fait plus que donner la valeur de DÉPART, le temps que la liste
 * réponde — il évite un écran vide, rien de plus. Une première version le traitait
 * comme une dérogation qui court-circuitait l'appel, et c'était une mauvaise idée
 * pour deux raisons :
 *
 *   · elle rendait l'écran dépendant d'une URL que personne ne construit. La
 *     planche « sans parcours » est atteignable par le vrai chemin — décocher la
 *     case à O03 — donc elle n'a pas besoin d'un paramètre pour exister ;
 *   · elle rendait le test de bout en bout CREUX. Sa variante par défaut était
 *     celle qu'il attendait, donc il passait même quand l'appel échouait. Et
 *     l'appel échouait : `journeysListResponseSchema` décrivait la forme du DÉTAIL
 *     et non celle de la LISTE, ce qui ne se voit pas sur une liste vide. Le test
 *     mesurait la valeur par défaut, pas le branchement.
 *
 * Une bascule à la première réponse reste possible, et c'est assumé : les deux
 * variantes sont des atterrissages complets, et un écran vide au dernier écran
 * d'une inscription serait bien pire — c'est le piège des cinq pages blanches.
 */
export function FinScreen({ withJourney }: { readonly withJourney: boolean }) {
  // Écran 6 : le dernier. `onContinue` y marque l'onboarding terminé.
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(6);

  const router = useRouter();
  const [hasJourney, setHasJourney] = useState(withJourney);

  /**
   * ── LA MÊME RÉPONSE SERT MAINTENANT DEUX FOIS ─────────────────────────────
   *
   * Cet appel ne décidait que la VARIANTE, et jetait le reste. La planche « avec
   * parcours » écrivait donc « Mes études à Lyon · ÉTAPE 1 SUR 12 · Obtenir votre
   * admission » — le parcours de l'EXEMPLE de la maquette — au membre qui venait
   * de créer le sien, sur l'écran intitulé « Votre parcours est prêt ».
   *
   * `journeyListItemSchema` portait déjà tout : `title`, `doneCount`, `stepCount`
   * et `currentStep.title`. Rien de plus n'est demandé au serveur.
   *
   * LE PREMIER ÉLÉMENT, et non une recherche : `GET /journeys` rend MES parcours,
   * et à cet écran-ci il vient d'en être créé un seul. Choisir « le plus récent »
   * demanderait un tri sur un champ que la liste ne promet pas d'ordonner ; le
   * membre qui revient sur cette URL avec plusieurs parcours verra le premier que
   * l'API nomme, ce qui est ce que `hasJourney` suppose déjà depuis toujours.
   */
  const [parcours, setParcours] = useState<ParcoursPret>(PARCOURS_INCONNU);

  useEffect(() => {
    let alive = true;
    void listJourneys()
      .then(({ items }) => {
        if (!alive) return;
        setHasJourney(items.length > 0);
        const premier = items[0];
        if (premier === undefined) return;
        setParcours({
          id: premier.id,
          titre: premier.title,
          /** La liste porte les étapes FRANCHIES ; le rang en cours est la suivante. */
          rang: premier.doneCount + 1,
          total: premier.stepCount,
          /** `null` quand toutes les étapes sont franchies — la planche montre alors un titre vide plutôt qu’une étape inventée. */
          etape: premier.currentStep?.title ?? '',
          /** La phrase sous le titre. Dessinée jusqu'ici, et donc fausse dès que le parcours n'était pas celui de la maquette. */
          description: premier.currentStep?.description ?? '',
        });
      })
      // Un échec laisse la valeur de départ. Ne pas savoir n'est pas une raison de
      // montrer l'autre planche : ce serait deviner. Mais l'échec n'est plus
      // invisible pour autant — le test l'exerce dans le sens où il compte.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /**
   * « COMMENCER » OUVRE LE PARCOURS CRÉÉ.
   *
   * Le porteur : « Le bouton commencer ne marche pas sur cet écran. » Il n'avait
   * aucun `onClick` — mesuré dans le JSX produit.
   *
   * Tant que `GET /journeys` n'a pas répondu, `parcours.id` est `null` et le
   * bouton NE FAIT RIEN : pousser `/parcours/null` mènerait à un écran d'erreur,
   * ce qui est pire qu'un bouton qui attend une demi-seconde.
   */
  const onCommencer = useCallback((): void => {
    if (parcours.id === null) return;
    router.push(`/parcours/${parcours.id}`);
  }, [parcours.id, router]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « SANS PARCOURS » : LA VILLE, LE RÉSEAU, LES ÉVÉNEMENTS, LE PARRAIN     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Lot W1A, phase 0.1. Cette variante était entièrement dessinée — « Bienvenue à
   * Lyon », trois événements lyonnais, une marraine inventée — et ses deux boutons
   * ne faisaient rien. Les données viennent maintenant de `chargerAtterrissage`
   * (voir `screens/onboarding/atterrissage.ts`), chargé seulement quand la variante
   * est celle qu'on montre : l'autre planche n'en lit rien.
   *
   * Une erreur de chargement laisse `LIEU_INCONNU` : titre sans ville, aucun
   * événement annoncé, aucune carte de parrain — jamais la démonstration.
   */
  const [lieu, setLieu] = useState<LieuAtterrissage>(LIEU_INCONNU);

  useEffect(() => {
    if (hasJourney) return undefined;
    let alive = true;
    void chargerAtterrissage()
      .then((charge) => {
        if (alive) setLieu(charge);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hasJourney]);

  /**
   * « ALLER À L'ACCUEIL » VÉRIFIE LA SESSION, PUIS Y VA.
   *
   * L'accueil est une page du groupe `(app)`, dont la garde de session renvoie vers
   * la connexion si la session est morte. Y pousser le membre sans vérifier, c'est
   * lui faire traverser un écran qui se ferme aussitôt. On reprend donc la session
   * d'abord (un jeton est déjà en main dans le cas normal : aucun appel), et on
   * l'envoie se reconnecter — avec l'accueil comme suite — si elle est perdue.
   */
  const onAccueil = useCallback((): void => {
    void (async () => {
      if (!hasAccessToken() && !(await resumeSession())) {
        router.push(`/connexion?suite=${encodeURIComponent('/accueil')}`);
        return;
      }
      router.push('/accueil');
    })();
  }, [router]);

  /** « Demander » : la fiche du parrain suggéré, où la demande se rédige et s'envoie. */
  const onDemander = useCallback((): void => {
    if (lieu.parrain === null) return;
    router.push(`/parrainage/${encodeURIComponent(lieu.parrain.handle)}`);
  }, [lieu.parrain, router]);

  return (
    <>
      <ScreenFrames
        screen="O05"
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
        desktop={
          hasJourney ? (
            <O05AvecParcours
              {...vals}
              lieu={lieu}
              parcours={parcours}
              onCommencer={onCommencer}
              onAccueil={onAccueil}
              onDemander={onDemander}
            />
          ) : (
            <O05SansParcours
              {...vals}
              events={lieu.evenements}
              lieu={lieu}
              parcours={parcours}
              onCommencer={onCommencer}
              onAccueil={onAccueil}
              onDemander={onDemander}
            />
          )
        }
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
