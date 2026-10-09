'use client';

import { chargerK06, SQUELETTE_K06 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranCompte, useCompte } from '@/screens/compte/ecran';
import { VOLETS_PAIEMENT, type VoletPaiement } from '@/screens/compte/data';
import { K06Desktop } from '@/screens/k06/desktop.generated';
import { K06Mobile } from '@/screens/k06/mobile.generated';
import { K06Numero } from '@/screens/k06momo/numero.generated';
import { K06Attente } from '@/screens/k06momo/attente.generated';
import { K06Succes } from '@/screens/k06momo/succes.generated';

/**
 * K06 — « Abonnement et Premium », et le flux Mobile Money (14 §4.2).
 *
 * Les trois volets sont trois PLANCHES de la maquette, pas trois états d'un
 * composant : « Étape 1 sur 3 · saisie du numéro », « 2 · ATTENTE », « 3 ·
 * SUCCÈS ». Le volet hors bornes retombe sur le premier — `noUncheckedIndexedAccess`
 * l'exige, et c'est de toute façon le repli qu'on veut : jamais le succès, qui
 * annoncerait un paiement qui n'a pas eu lieu.
 *
 * LE VOLET VIENT DE L'URL, et rien d'autre ne le fait avancer.
 *
 * 14 §4.2 : « notification USSD/push de l'opérateur → webhook de confirmation →
 * activation ». Les deux derniers volets n'ont AUCUN contrôle dans la maquette :
 * l'attente est un sablier avec son compte à rebours, le succès une confirmation.
 * Ce qui les fait avancer est le réseau, et ce lot ne branche aucune route. Brancher
 * « Payer 2 600 F » sur un passage local au volet d'attente annoncerait un paiement
 * que personne n'a demandé — c'est la même règle dure que « Publier » côté Parcours.
 *
 * Le paramètre d'URL les rend atteignables sans rien affirmer, exactement comme
 * `?etat=` le fait dans le module Parcours pour les états dont la maquette ne
 * dessine pas le contrôle. Il n'ajoute aucun pixel et se teste.
 */
const PLANCHES = [K06Numero, K06Attente, K06Succes] as const;

export function AbonnementEcran({ volet }: { readonly volet: VoletPaiement | null }) {
  /**
   * La fenêtre s'ouvre DÈS L'ARRIVÉE quand l'URL nomme un volet. `Modal` sait le
   * faire depuis le premier rendu client — il lit la largeur à l'initialisation
   * de son état pour cette raison exacte, et le module Parcours l'emploie déjà
   * pour `/parcours/:id?etat=parcours`.
   */
  const { ouverte, onOuvrir, onFermer } = useCompte(volet === null ? null : 'K06M');

  const index = volet === null ? 0 : VOLETS_PAIEMENT.indexOf(volet);
  const Planche = PLANCHES[index] ?? K06Numero;

  /**
   * LES PRIX VIENNENT DE `GET /plans`, JAMAIS DU FRONT.
   *
   * `packages/shared` porte `PREMIUM_MONTH_PRICE_CENTS`, et il aurait été tentant
   * de l'employer : c'est la même source, après tout. Non — c'est la même
   * valeur d'AMORÇAGE. La table `plans` est modifiable depuis l'administration
   * (15 §3), et un prix figé dans le front afficherait 4 € le jour où le porteur
   * passe à 5 €, sur un écran où le membre s'engage à payer. Le serveur calcule
   * aussi la conversion en francs CFA, avec son taux — la refaire ici en
   * donnerait un second, et deux taux de change dans un même produit finissent
   * toujours par ne plus coïncider.
   *
   * 14 §4.1, RÈGLE DURE : aucune donnée de carte. Les trois routes lues n'en
   * portent aucune, et `myPaymentsResponseSchema` le rend EXÉCUTABLE : ni numéro,
   * ni empreinte, ni quatre derniers chiffres. `method` est le CANAL, pas
   * l'instrument.
   */
  return (
    <EcranDonnees
      charger={chargerK06}
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : `/premium` et `/compte/abonnement`
       * repondaient 200 avec CINQ mots et zero entree de rail. Voir
       * `SQUELETTE_K06` — et la correction qu'il porte sur la cause annoncee.
       */
      squelette={SQUELETTE_K06}
    >
      {(donnees) => (
        <EcranCompte
          screen="K06"
          desktop={<K06Desktop {...donnees} />}
          mobile={<K06Mobile {...donnees} />}
          ouverte={ouverte}
          onOuvrir={onOuvrir}
          onFermer={onFermer}
          modales={{
            K06M: {
              /**
               * LES TROIS VOLETS REÇOIVENT `K06Data`, et un seul en lit quelque
               * chose : « Payer 2 600 F » est le MONTANT de `GET /plans`, et le
               * figer sur l'écran où le membre s'engage est exactement la faute
               * que le bloc ci-dessus décrit. Les deux autres volets n'ont rien à
               * lire — code USSD de l'opérateur qu'aucune route ne rend, compte à
               * rebours qui est une horloge — et leur signature le dit : `_props`.
               */
              mobile: <Planche {...donnees} />,
              // `moments.panelAdvance` : « vous avancez dans une démarche, vous ne
              // sautez pas d'un écran à l'autre ». Le premier volet reste une ouverture.
              phase: index,
            },
          }}
        />
      )}
    </EcranDonnees>
  );
}
