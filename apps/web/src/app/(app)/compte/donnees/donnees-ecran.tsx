'use client';

import { SQUELETTE_K08, chargerK08 } from '@/screens/compte/appels';
import { DonneesVivantes } from '@/screens/compte/donnees-vivantes';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranCompte, useCompte } from '@/screens/compte/ecran';
import { K08Desktop } from '@/screens/k08/desktop.generated';
import { K08Mobile } from '@/screens/k08/mobile.generated';
import { K08Confirmation } from '@/screens/k08suppression/confirmation.generated';

/**
 * K08 — « Mes données » et sa confirmation de suppression.
 *
 * La fenêtre est la planche de 440 px de la maquette (T5 K08 : « écran de
 * confirmation détaillé : ce qui est supprimé, ce qui est conservé sans nom,
 * délai de 7 jours, confirmation par code SMS »). Elle n'a qu'une planche, donc
 * la même sert aux deux largeurs — `Modal` le prévoit dans son type.
 *
 * CETTE PLANCHE NE DESSINE AUCUNE DONNÉE, et il faut le dire plutôt que d'en
 * inventer une. Ses trois blocs sont du TEXTE DE RÈGLE — « Préparé sous 48 h. Lien
 * valable 7 jours. », « Reconnectez-vous dans les 6 mois », « Définitif après
 * 7 jours. » — c'est-à-dire les bornes de 01 §2.7 et §2.8, vraies pour tout le
 * monde et en tout temps. `GET /me/export/latest` sait dire où en est l'archive du
 * membre, et `lireExport()` la lit et la valide déjà ; la maquette n'a nulle part
 * où l'écrire. Lui faire une place serait redessiner la planche. Signalé au
 * porteur ; cet écran ne lit donc que le bandeau de compte.
 *
 * « Confirmer la suppression » EST INERTE, et c'est la décision la plus
 * importante de cet écran. 01 §5 rend la suppression définitive après sept jours ;
 * ce lot ne branche aucune route. Un `onClick` qui refermerait la fenêtre ferait
 * croire au membre que son compte est supprimé — et il ne s'en apercevrait qu'en
 * revenant. C'est la même règle que « Publier » côté Parcours : un bouton inerte
 * est moins nuisible qu'un bouton qui ment.
 */
export function DonneesEcran() {
  const { ouverte, onOuvrir, onFermer } = useCompte();

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_K08} charger={chargerK08}>
      {(donnees) => (
        <DonneesVivantes donnees={donnees}>
          {(vivantes) => (
            <EcranCompte
              screen="K08"
              desktop={<K08Desktop {...vivantes} />}
              mobile={<K08Mobile {...vivantes} />}
              ouverte={ouverte}
              onOuvrir={onOuvrir}
              onFermer={onFermer}
              modales={{ K08S: { mobile: <K08Confirmation /> } }}
            />
          )}
        </DonneesVivantes>
      )}
    </EcranDonnees>
  );
}
