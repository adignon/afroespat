'use client';

import { useCallback, useState } from 'react';
import { ProfilReferentiels } from '@/screens/compte/profil-referentiels';
import { SQUELETTE_K01, chargerK01 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { useEditionProfil } from '@/screens/compte/profil-edition';
import { K01Desktop } from '@/screens/k01/desktop.generated';
import { K01Mobile } from '@/screens/k01/mobile.generated';

/**
 * K01 — « Mon profil » (`/compte/profil`, T5 §9).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — et rien
 * n'a été réécrit pour brancher l'API non plus : les valeurs affichées sont
 * devenues des interpolations par une DÉCLARATION dans
 * `tools/screens/08-compte.mjs`, sous la clé `donnees`.
 *
 * CETTE PAGE EST DEVENUE CLIENTE, et ce n'est pas un choix de confort. Le jeton
 * d'accès vit en mémoire, dans la clôture de `lib/api/session.ts`, et il n'existe
 * que dans le navigateur — décision de `session.ts`, qui refuse tout stockage
 * lisible par JavaScript. Un composant serveur n'a donc aucun moyen d'appeler
 * `/me` au nom du membre. Voir `screens/compte/ecran-donnees.tsx`.
 *
 * DEUX ROUTES, et c'est un écart de l'API : `GET /me` rend `cityId` et
 * `originCountryId` — des UUID — là où la planche écrit « Lyon » et « Bénin ».
 * Les référentiels qui les résoudraient sont des routes d'ÉQUIPE. `GET /users/{mon
 * pseudo}` est donc le seul chemin honnête vers les noms. Signalé au porteur.
 *
 * 01 §2.1, RÈGLE DURE : aucun numéro de téléphone en clair. Cet écran n'en affiche
 * aucun — ni la maquette, ni les données liées : aucune n'est un numéro. Le seul
 * téléphone du module vit sur K04, masqué par le serveur.
 */
export default function ProfilPage() {
  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LA LECTURE ET L'ÉCRITURE SONT DEUX CHOSES, ET ELLES SE REJOIGNENT ICI    ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * `EcranDonnees` sert la LECTURE — le profil tel qu'il est, avec son squelette
   * servi avant la réponse. `useEditionProfil` porte l'ÉCRITURE : l'état du
   * formulaire, les deux listes fermées, le téléversement de la photo et les deux
   * `PATCH`.
   *
   * `cle` FORCE LE RECHARGEMENT APRÈS UN ENREGISTREMENT. Sans elle, la page
   * continuerait d'afficher le profil d'avant — un membre qui change son nom le
   * verrait dans le champ et pas dans le bandeau du haut, et croirait que rien
   * n'a été pris.
   */
  const { edition, rechargement } = useEditionProfil();

  /**
   * ── RECHARGER APRÈS UN CHOIX DE COMPÉTENCES OU DE LANGUES ───────────────
   *
   * `EcranDonnees` est remonté par sa `key` : c'est le mécanisme que cette page
   * emploie déjà pour la photo de profil, et il relit tout. On réutilise le
   * même compteur plutôt que d'en ajouter un second qui ferait la même chose.
   */
  const [choixFaits, setChoixFaits] = useState(0);
  const rechargerProfil = useCallback(() => {
    setChoixFaits((n) => n + 1);
  }, []);

  return (
    <EcranDonnees
      key={`${rechargement}-${choixFaits}`}
      charger={chargerK01}
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : `/compte/profil` repondait 200 avec
       * CINQ mots et zero entree de rail. Voir `SQUELETTE_K01`.
       */
      squelette={SQUELETTE_K01}
    >
      {(donnees) => (
        <ProfilReferentiels donnees={donnees} onRecharger={rechargerProfil}>
          {(vivantes) => (
            <ScreenFrames
              screen="K01"
              desktop={<K01Desktop {...vivantes} edition={edition} />}
              mobile={<K01Mobile {...vivantes} edition={edition} />}
            />
          )}
        </ProfilReferentiels>
      )}
    </EcranDonnees>
  );
}
