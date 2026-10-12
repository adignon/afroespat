'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H04, chargerH04 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H04Desktop } from '@/screens/h04/desktop.generated';
import { H04Mobile } from '@/screens/h04/mobile.generated';

/**
 * H04 — « Vous pouvez aider » (`/entraide/aider`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * Le sous-titre compte les suggestions de `GET /help/can-help` (§2.6) — le même
 * nombre que la pastille du rail : UNE donnée, deux endroits.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA LISTE DE CARTES EST LIÉE — ELLE NE L'ÉTAIT PAS, ET LE DISAIT             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le commentaire précédent de ce fichier affirmait que la liste ne pouvait pas
 * l'être : « les deux cartes de cette planche portent chacune une pastille de motif
 * différente […] que l'API ne renvoie pas. » Le FAIT était exact — `helpCardSchema`
 * ne porte que `fromJourney` — et la CONCLUSION était trop large. Le `where` du
 * service en dit davantage que le schéma : `fromJourney === false` interdit le
 * critère « étape franchie », donc DÉMONTRE la correspondance par types déclarés.
 * Une moitié du motif était donc disponible, et l'autre se dit avec la phrase que
 * le module emploie déjà pour ce manque. Voir `ligneSuggestion` dans
 * `screens/entraide/appels.ts`.
 *
 * MESURÉ avant correction, aux deux largeurs : `GET /help/can-help` rendait SEPT
 * suggestions au membre de mesure, et cette page affichait « Dossier Visale refusé,
 * que faire ? » et « Relire une lettre de motivation » — les deux cartes de la
 * planche, servies à tout le monde. Le même membre, à 390 px sur `/entraide` avec la
 * portée « Vous pouvez aider », en voyait sept. Deux chemins vers la même liste,
 * deux réponses différentes.
 *
 * ⚠ CE QUI RESTE REMONTÉ, deux choses, et aucune n'est comblée en devinant :
 *
 *   · la pastille « Vous avez franchi l'étape Logement » NOMME une étape que la
 *     réponse ne contient pas. Une demande issue d'un parcours a pu correspondre
 *     par son type autant que par sa définition d'étape — les deux critères sont en
 *     `OR`. Refermer cet écart demande que la route dise ce qui a matché ;
 *   · les deux pastilles de tri « Échéance » et « Récentes » restent des dessins :
 *     `helpCanHelpQuerySchema` n'accepte que `limit` et `radiusKm`, et §2.6 impose
 *     « échéance proche d'abord » SANS option. « Récentes » n'a aucune route
 *     derrière.
 */
export default function HelpCanHelpPage() {
  return (
    <EcranDonnees
      charger={chargerH04}
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots — « DisaporyPlus Chargement de votre
       * compte… » — et aucune entrée de rail dans le HTML servi. Voir
       * `screens/compte/ecran-donnees.tsx` pour le raisonnement complet.
       */
      squelette={SQUELETTE_H04}
    >
      {(donnees) => (
        <ScreenFrames
          screen="H04"
          desktop={<H04Desktop {...donnees} />}
          mobile={<H04Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
