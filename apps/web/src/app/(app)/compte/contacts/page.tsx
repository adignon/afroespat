'use client';

import { useCallback, useState } from 'react';
import { ContactsVivants } from '@/screens/compte/contacts-vivants';
import { SQUELETTE_K05, chargerK05 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K05Desktop } from '@/screens/k05/desktop.generated';
import { K05Mobile } from '@/screens/k05/mobile.generated';

/**
 * K05 — « Contacts » (`/compte/contacts`, T5 §9).
 *
 * LES QUATRE ONGLETS SONT DESSINÉS CÔTE À CÔTE, pas pilotés : la planche
 * d'ordinateur montre « Mes contacts · 12 » ET les demandes reçues, les
 * suggestions et les bloqués, chacun dans sa carte. Ce n'est pas un écran à
 * onglets que la maquette dessine, c'est une page qui les empile — et la
 * transcrire autrement serait redessiner. Quatre routes sont donc lues ensemble.
 *
 * `meta.count` est MON nombre de contacts, et la règle dure du 08 §3.2 dit
 * « jamais celui d'un autre ». Il vient du serveur : le compter sur la page
 * courante afficherait vingt là où le membre en a deux cents.
 *
 * ÉCART SIGNALÉ AU PORTEUR : la maquette écrit « Installée · Lyon 3e » sous chaque
 * nom — la phase et la ville. `GET /me/connections` ne rend ni l'une ni l'autre.
 * La ligne porte donc la date de mise en relation, qui est une donnée réelle de la
 * MÊME route. Composer une phase et une ville qu'on n'a pas reçues serait pire
 * qu'un sous-titre différent de la maquette.
 */
export default function ContactsPage() {
  /**
   * ── RECHARGER APRÈS UN GESTE ─────────────────────────────────────────────
   *
   * Même recette que la sécurité et la vérification : `useDonnees` relance son
   * effet quand `charger` CHANGE D'IDENTITÉ, et c'est le seul mécanisme qu'il
   * offre. Accepter une demande la retire de la liste et ajoute un contact — les
   * deux sections doivent suivre, et seul un rechargement le garantit.
   */
  const [recharge, setRecharge] = useState(0);
  const charger = useCallback(() => {
    /** `recharge` n'est lu par personne : il est là POUR changer l'identité. */
    void recharge;
    return chargerK05();
  }, [recharge]);
  const recharger = useCallback(() => {
    setRecharge((n) => n + 1);
  }, []);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_K05} charger={charger}>
      {(donnees) => (
        <ContactsVivants donnees={donnees} onRecharger={recharger}>
          {(vivantes) => (
            <ScreenFrames
              screen="K05"
              desktop={<K05Desktop {...vivantes} />}
              mobile={<K05Mobile {...vivantes} />}
            />
          )}
        </ContactsVivants>
      )}
    </EcranDonnees>
  );
}
