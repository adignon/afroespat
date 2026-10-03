'use client';

import { chargerD10 } from '@/screens/administration/appels';
import { EcranDonneesEquipe } from '@/screens/administration/ecran-donnees';
import { SQUELETTE_D10 } from '@/screens/administration/data';
import { ScreenFrames } from '@/screens/frames';
import { D10Desktop } from '@/screens/d10/desktop.generated';

/**
 * D10 — les services. `/admin/services` (T5 D10).
 *
 * Trois blocs : justificatifs pro en attente (approuver / rejeter avec motif),
 * annonces logement à risque, et les bornes de prix par ville.
 *
 * LES ANNONCES À RISQUE portent leur score et leurs drapeaux — « Score 82 · prix
 * bas · compte récent · photos réutilisées ». 13 §4.4 fixe les seuils : « annonce
 * logement à risque, score 0,4–0,7 → dossier priorité 2 ; ≥ 0,7 → priorité 1 + non
 * publiée ». La maquette montre un 82 et un 61, c'est-à-dire un cas de chaque côté
 * du seuil — et les deux gardent pourtant « Publier » et « Retirer » : la décision
 * reste humaine (13 §2, règle dure).
 *
 * LES BORNES DE PRIX sont un paramètre système (15 §4.4, « bornes de prix
 * logement »), modifiable sans déploiement. Le tableau les dessine par ville et
 * par type de bien.
 *
 * ─── UN SEUL NOMBRE EST LIÉ : LES JUSTIFICATIFS EN ATTENTE ───────────────────
 *
 * Compté en SUIVANT LE CURSEUR jusqu'au bout de
 * `GET /admin/pro-profiles?status=PENDING`. C'est possible ici parce que cette
 * route pagine honnêtement (`take: limit + 1` puis `buildPage`) ; cinq routes
 * d'équipe de ce dépôt ne le font pas et affirment la fin en tronquant.
 *
 * ─── LES TROIS BLOCS DESSINÉS, ET CE QUI MANQUE À CHACUN ─────────────────────
 *
 *   · la LIGNE de justificatif — trois de ses quatre valeurs sont servies, et
 *     richement (`member.displayName`, `profession.nameFr`, les initiales s'en
 *     dérivent). Mais le TYPE du justificatif ne l'est pas : `proof` porte `mime`,
 *     `sizeBytes`, `status`, `storageKey` — jamais « carte professionnelle ». Ce
 *     mot AFFIRME de quel document il s'agit ; répété dans une boucle, il
 *     écrirait « carte professionnelle » sous le nom d'un chauffagiste dont la
 *     pièce est peut-être un SIRET. Une fausse affirmation sur la pièce
 *     professionnelle d'une personne réelle est pire qu'une ligne dessinée.
 *   · ANNONCES LOGEMENT À RISQUE — aucune route d'équipe ne sert cette file. Les
 *     scores (82, 61) et les indices n'existent que comme PONDÉRATIONS dans le
 *     réglage `housing.risk_weights`, pas comme liste d'annonces scorées.
 *   · BORNES DE PRIX PAR VILLE — `housing.price_bounds` est UNE paire GLOBALE,
 *     relevée `{ minCents: 15000, maxCents: 800000 }`. La maquette dessine six
 *     valeurs (deux villes × chambre/studio/T2). Cette granularité n'existe pas ;
 *     poser la paire globale dans six cases serait inventer six bornes de prix.
 *
 * Les trois manques sont remontés au porteur plutôt que comblés.
 */
export default function Page() {
  return (
    <EcranDonneesEquipe charger={chargerD10} squelette={SQUELETTE_D10}>
      {(donnees) => <ScreenFrames screen="D10" desktop={<D10Desktop {...donnees} />} />}
    </EcranDonneesEquipe>
  );
}
