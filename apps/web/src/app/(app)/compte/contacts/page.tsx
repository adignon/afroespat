'use client';

import { chargerK05 } from '@/screens/compte/appels';
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
  return (
    <EcranDonnees charger={chargerK05}>
      {(donnees) => (
        <ScreenFrames
          screen="K05"
          desktop={<K05Desktop {...donnees} />}
          mobile={<K05Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
