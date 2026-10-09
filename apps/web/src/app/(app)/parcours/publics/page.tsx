'use client';

import { VUE_NEUTRE, chargerJ09 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J09Desktop } from '@/screens/j09/desktop.generated';
import { J09Mobile } from '@/screens/j09/mobile.generated';

/**
 * J09 — les parcours publics. `/parcours/publics` (§3.7).
 *
 * ── « PUBLIC » VEUT DIRE « VISIBLE DES MEMBRES CONNECTÉS », PAS « DU WEB » ──
 *
 * C'est la chose à savoir avant de lire le reste, et elle est VÉRIFIABLE :
 * `JourneysController` ne porte AUCUN `@PublicRead()`, et son en-tête dit pourquoi
 * — §3.7 exige qu'« un parcours public ne soit jamais visible hors connexion ni
 * indexé par la recherche », et « un `@PublicRead()` sur `/journeys/public`
 * suffirait à faire mentir cette phrase ». `GET /journeys/public` demande donc
 * `content.read` avec un jeton, comme toutes les autres.
 *
 * CONSÉQUENCE POUR LA GARDE DE SESSION : une garde qui couvre `/parcours/publics`
 * est JUSTE, pas un défaut. Sans session il n'y a rien à montrer ici — l'API
 * répondrait `401`, et l'écran afficherait « reconnectez-vous » après un
 * chargement. Mieux vaut le renvoi immédiat.
 *
 * C'est aussi pourquoi aucune lecture ne part avant la reprise de session : un
 * appel parti sans jeton prend un `401`, le transport rafraîchit UNE fois et
 * rejoue. Il ne reçoit pas, en silence, une vue de visiteur qui changerait d'avis
 * au rechargement — ce qui serait le cas sur une route `@PublicRead`.
 *
 * ── CE QUE L'ÉCRAN NE PEUT PAS FUIR ────────────────────────────────────────
 *
 * RÈGLE DURE §3.7 : la vue publique ne contient NI titre personnel, NI notes, NI
 * checklist, NI équipe, NI discussion. Cet écran n'a rien à filtrer — il n'a
 * jamais les champs en main — et `publicJourneySchema` est `.strict()` dans
 * `@app/shared` : si le serveur se mettait à envoyer `title`, l'appel ÉCHOUERAIT en
 * nommant le champ, au lieu que zod le dépouille sans un mot.
 *
 * TROIS APPELS, et chacun répond à une question différente : les parcours publics
 * à montrer, mes parcours pour savoir lequel est courant, et le parcours courant
 * pour remplir le panneau de gauche. Voir `chargerJ09`.
 *
 * LES TROIS FILTRES DESSINÉS — « Études », « Lyon », « Avancement ▾ » — NE SONT PAS
 * CLIQUABLES : le générateur ne pose aucun `onClick` sur eux, et ce lot n'en
 * ajoute pas. Les deux premiers AFFICHENT ce sur quoi le serveur a classé (§3.7 :
 * « même type d'abord, puis même ville de destination »), donc ils ne mentent pas.
 * Signalé.
 */
export default function Page() {
  return (
    <EcranParcoursDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE. `VUE_NEUTRE` est le DESSIN sans la
       * donnee, et il existait deja pour les planches d'illustration : rien n'est
       * invente ici. Sans lui, cette route repond 200 en servant « DisaporyPlus
       * Chargement de votre parcours... » et RIEN d'autre — ni rail, ni panneau,
       * ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={VUE_NEUTRE}
      screen="J09"
      charger={chargerJ09}
      desktop={(d) => <J09Desktop {...d} />}
      mobile={(d) => <J09Mobile {...d} />}
      modales={(d, volet) => ({ J03: plancheBlocage(volet, d) })}
    />
  );
}
