'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S08, chargerS08 } from '@/screens/services/appels';
import { S08Desktop } from '@/screens/s08/desktop.generated';
import { S08Mobile } from '@/screens/s08/mobile.generated';

/**
 * S08 — créer ma fiche pro (`/services/annuaire/ma-fiche`, 10 §4.1).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * CET ÉCRAN NE LIT QUE LE BANDEAU DE QUOTAS, et c'est un choix à défendre plutôt
 * qu'à cacher. `GET /me/pro-profile` existe, son schéma est écrit et éprouvé sur
 * une charge réelle — mais il rend `null` tant que la fiche n'existe pas, et c'est
 * LE CAS PRINCIPAL d'un écran qui s'appelle « Créer ma fiche pro ». La planche,
 * elle, dessine un formulaire REMPLI (« Avocate », « Cabinet Bah », « Consultation
 * dès 80 € ») et ne dessine PAS l'état vide. Lier ses champs viderait l'écran pour
 * tous ceux qui viennent le remplir. Voir `screens/s08/data.ts` pour les deux
 * écarts remontés au porteur, dont celui du palier affiché.
 *
 * La maquette porte les conditions de §4.1 à l'écran, en toutes lettres :
 * « Numéro français vérifié (L2) » et « Justificatif professionnel à déposer ».
 * Elle ajoute, sous le dépôt du justificatif, « Il n'est jamais affiché » —
 * l'exigence de §4.1 (« accès équipe uniquement ») dite au membre. Et l'API la
 * tient : `GET /me/pro-profile` ne rend qu'un booléen `hasProof`, jamais
 * l'identifiant du justificatif, que `myProProfileResponseSchema` refuse par son
 * `.strict()`.
 *
 * « ENVOYER POUR VALIDATION » EST INERTE : la fiche attend une validation humaine
 * (§4.1, module 15) et reste invisible jusque-là. Rien n'est branché dans ce lot.
 *
 * ⚠ ÉCART DE LA MAQUETTE, SIGNALÉ ET NON CORRIGÉ : elle affiche « Pro 9 €/mois »
 * et « Pro+ 19 €/mois » là où 10 §4.1 et 14 §2 écrivent « ~25 € » et « ~40 € ».
 * On ne réécrit pas la maquette, et on ne réécrit pas non plus la spec : l'écart
 * est consigné dans le rapport de lot pour que le porteur tranche. `GET /plans`
 * rend les vrais montants des deux paliers, en euros ET en francs CFA — de quoi
 * lier ces trois lignes le jour où le porteur aura tranché.
 */
export default function MaFicheProPage() {
  return (
    <EcranDonnees
      charger={chargerS08}
      attente="Chargement
      de
      votre
      fiche…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots et aucune entrée de rail dans le HTML
       * servi. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_S08}
    >
      {(donnees) => (
        <ScreenFrames
          screen="S08"
          desktop={<S08Desktop {...donnees} />}
          mobile={<S08Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
