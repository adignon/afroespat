import { ScreenFrames } from '@/screens/frames';
import { D03Desktop } from '@/screens/d03/desktop.generated';

/**
 * D03 — la recherche et la fiche membre. `/admin/membres` (15 §3.1, T5 D03).
 *
 * RÈGLE DURE (§3.1) : « l'application admin n'affiche jamais un numéro de
 * téléphone en clair, ni ne permet de lire une conversation privée hors d'un
 * dossier de modération qui la joint. »
 *
 * L'écran la tient PAR CONSTRUCTION, parce qu'il transcrit ce que la maquette
 * dessine et que la maquette ne dessine aucun numéro complet :
 *   · la recherche montre « +33 6 12 … » suivi de « Recherche par empreinte » —
 *     §3.1 : « saisie du numéro → HMAC → recherche, le numéro n'est jamais
 *     affiché » ;
 *   · la fiche écrit « +33 6 •• •• •• 18 · +229 •• 42 » ;
 *   · la carte d'actions le répète en toutes lettres : « Chaque action demande un
 *     motif. Aucun numéro n'est affiché en clair. »
 * C'est vérifiable à l'œil dans `docs/template/10 Administration.dc.html`, et
 * `e2e/administration.spec.ts` le mesure sur le HTML rendu plutôt que sur la
 * bonne volonté de l'écran.
 *
 * UNE SEULE ROUTE, alors que T5 annonce `admin/membres · /:id` : la maquette
 * dessine la liste et la fiche dans le MÊME cadre, en deux colonnes. Découper une
 * vue de détail qu'elle ne dessine pas serait l'inventer.
 *
 * Les sept actions de §3.2 sont dessinées en `<span>` par la maquette, pas en
 * `<button>` : elles restent telles quelles. Aucune n'est branchée — §2.3 est une
 * règle dure (« toute écriture passe par `AuditService.record()` avant validation
 * de la transaction »), et une action qui n'écrit rien ne serait tracée nulle part.
 *
 * Sans `<h1>` : même raison que D02, la maquette n'écrit « Membres » que dans le
 * menu.
 */
export default function Page() {
  return <ScreenFrames screen="D03" desktop={<D03Desktop />} />;
}
