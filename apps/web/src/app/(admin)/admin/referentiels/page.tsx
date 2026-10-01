'use client';

import { chargerD08 } from '@/screens/administration/appels';
import { EcranDonneesEquipe } from '@/screens/administration/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { D08Desktop } from '@/screens/d08/desktop.generated';

/**
 * D08 — les référentiels. `/admin/referentiels` (02 §4.2, T5 D08).
 *
 * Onglets Pays · Villes · Langues · Compétences · Métiers, import CSV, et le
 * tableau des villes avec ses trois cas : une ville active, une ville à activer et
 * un doublon à fusionner.
 *
 * LA CONFIRMATION EST DANS LA PAGE, PAS DANS UNE FENÊTRE. La maquette dessine
 * « Activer Nantes ? » en carte de 440 px posée à côté du tableau, sans voile et
 * sans panneau. Elle n'est donc pas transcodée en modale : `Modal` attend
 * exactement un voile et un panneau, et lui en fabriquer un serait inventer une
 * forme que la maquette ne montre pas. C'est le même arbitrage que J08 sur
 * ordinateur, où la confirmation d'arrêt est une carte en ligne.
 *
 * ─── BRANCHÉ SUR `GET /admin/ref/cities` ───────────────────────────────────────
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/10 Administration.dc.html` et il
 * n'a pas bougé d'une virgule pour recevoir l'API : les valeurs affichées sont
 * devenues des interpolations par une DÉCLARATION dans
 * `tools/screens/10-administration.mjs`, sous la clé `donnees`.
 *
 * CETTE PAGE EST DEVENUE CLIENTE, et pas par confort. Le cookie de session
 * d'équipe est `HttpOnly` et `SameSite=Strict`, et le navigateur ne le joint
 * qu'avec `credentials: 'include'` — ce que le transport fait. Un composant serveur
 * de Next n'a pas la requête du navigateur sous la main pour relayer ce cookie vers
 * une autre origine ; il appellerait l'API en anonyme et prendrait un
 * `401 STAFF_SESSION_REQUIRED`. Les écrans d'équipe chargent donc côté client,
 * comme ceux du module Compte, et pour une raison voisine.
 *
 * `chargerD08` est une fonction de MODULE, donc stable : `useDonneesEquipe` la
 * garde dans ses dépendances sans boucler. Une fonction anonyme écrite ici
 * rechargerait sans fin.
 *
 * ─── CE QUE CET ÉCRAN NE FAIT TOUJOURS PAS ─────────────────────────────────────
 *
 * Aucun bouton n'écrit. « Activer la ville », « Fusionner », « Import CSV » et les
 * quatre autres onglets du référentiel restent inertes : 15 §2.3 veut que toute
 * écriture passe par `AuditService.record()`, et un bouton qui n'écrit rien ferait
 * croire à l'équipe qu'une ville est ouverte — donc qu'un réseau a été créé et des
 * membres rattachés. Les routes existent (`POST /ref/cities/:id/activate`,
 * `/merge`, `/import`) ; les brancher est un lot à part, qui doit porter la saisie
 * du motif que ces routes exigent.
 *
 * Les onglets Pays, Langues, Compétences et Métiers sont DESSINÉS CÔTE À CÔTE par
 * la maquette, pas pilotés : elle montre le tableau des villes et les cinq onglets
 * dans le même cadre. Leurs routes existent (`/ref/countries`, `/ref/languages`,
 * `/ref/skills`, `/ref/professions`, relevées à 200 sur l'API qui tourne) mais
 * aucun tableau n'est dessiné pour elles. Signalé au porteur plutôt que redessiné.
 */
export default function Page() {
  return (
    <EcranDonneesEquipe charger={chargerD08}>
      {(donnees) => <ScreenFrames screen="D08" desktop={<D08Desktop {...donnees} />} />}
    </EcranDonneesEquipe>
  );
}
