'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S03, chargerS03 } from '@/screens/services/appels';
import { S03Desktop } from '@/screens/s03/desktop.generated';
import { S03Mobile } from '@/screens/s03/mobile.generated';

/**
 * S03 — publier une annonce de logement (`/services/logement/nouveau`, 10 §2.1).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * 10 §7 : « aperçu du score de risque NON AFFICHÉ (interne) ». La maquette s'y
 * tient — aucun chiffre de risque nulle part, seulement « Votre annonce est en
 * vérification. Vous serez prévenu·e. » dans sa colonne APRÈS ENVOI. Et l'API s'y
 * tient par le CONTRAT : `housingListResponseSchema` est `.strict()`, donc une
 * réponse portant `riskScore` serait refusée avant d'atteindre cet écran, au lieu
 * d'être dépouillée en silence par zod.
 *
 * CE QUI EST LU ICI, ET RIEN D'AUTRE : le bandeau de §2.2, que `GET /housing`
 * rend dans son `meta` et qui doit venir du serveur. Les champs du formulaire sont
 * des EXEMPLES DE SAISIE (« Studio meublé Lyon 7e », « 620 € ») et non les valeurs
 * d'un objet existant ; les lier transformerait « Publier » en « Modifier », que
 * la maquette ne dessine pas.
 *
 * « PUBLIER L'ANNONCE » EST INERTE, et c'est la décision la plus importante de
 * cet écran. §2.2 calcule un score de risque côté serveur et ne publie jamais une
 * annonce à score ≥ 0,7 sans décision humaine. Un `onClick` qui refermerait le
 * formulaire ferait croire au membre que son annonce est en ligne — c'est pire
 * qu'un bouton inerte, et c'est exactement ce que la règle dure cherche à
 * empêcher.
 *
 * CE QUE LA MAQUETTE NE DESSINE PAS : le formulaire GRISÉ d'un membre L1, que
 * §2.1 décrit avec sa phrase exacte. L'API la SERT pourtant — `meta.canPublish` et
 * `meta.publishRequirement`, relevés `false` + la phrase avec un membre L0 — et la
 * maquette l'écrit mot pour mot dans une carte d'ÉTATS de la section S01
 * (« PUBLIER · SOUS L2 »), qui n'est pas un cadre d'écran. Ce qui manque est
 * l'emplacement, pas la source. Remonté au porteur ; le monter ici demanderait de
 * décider où il s'insère, et ce serait réécrire la maquette.
 */
export default function PublierLogementPage() {
  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_S03} charger={chargerS03} attente="Chargement du formulaire…">
      {(donnees) => (
        <ScreenFrames
          screen="S03"
          desktop={<S03Desktop {...donnees} />}
          mobile={<S03Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
