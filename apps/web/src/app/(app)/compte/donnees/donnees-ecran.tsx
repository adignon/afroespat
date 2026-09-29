'use client';

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
    <EcranCompte
      screen="K08"
      desktop={<K08Desktop />}
      mobile={<K08Mobile />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ K08S: { mobile: <K08Confirmation /> } }}
    />
  );
}
