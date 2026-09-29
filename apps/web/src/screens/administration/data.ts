/**
 * Données des écrans D01 à D16, reprises de `docs/template/10 Administration.dc.html`.
 *
 * ET IL N'Y EN A AUCUNE — ce fichier existe pour le dire, pas pour combler un vide.
 *
 * Les maquettes `01 Accès et Onboarding` et `03 Accueil v2` calculent leurs valeurs
 * d'affichage dans un `renderVals()` et les interpolent dans le HTML (`{{ p.comment }}`,
 * `<sc-for>`). `apps/web/src/screens/a01/data.ts` recopie ce `renderVals()` à
 * l'identique : c'est la séparation qui tient tout, la FORME transcodée d'un côté,
 * la DONNÉE écrite à la main de l'autre.
 *
 * `10 Administration` ne fonctionne pas ainsi. Son `renderVals()` est littéralement
 * `renderVals() { return {}; }`, le fichier ne contient ni `{{ }}` ni `<sc-for>`, et
 * tout le contenu — les 46 dossiers de la file, les cinq blocs du tableau de bord,
 * les trois lignes du journal d'audit — est écrit en clair dans le HTML. C'est vrai
 * des sept maquettes 04 à 10 ; seules 01 et 03 emploient le dialecte.
 *
 * Recopier ce `renderVals()` à l'identique, c'est donc n'écrire aucune donnée. En
 * écrire une — extraire les lignes de tableau du HTML pour les remettre dans un
 * tableau TypeScript — serait choisir une structure que la maquette n'a pas choisie,
 * et introduire exactement l'écart de jugement que le transcodage supprime.
 *
 * ─── CE QUE CE LOT NE BRANCHE PAS, ET POURQUOI ─────────────────────────────────
 *
 * Le back-end est complet : `apps/api/src/modules/{admin,moderation,referentials}`
 * exposent les routes de 15 §7. Ce lot est du TRANSCODAGE et n'en appelle aucune.
 *
 * Deux écrans ne pourraient d'ailleurs pas l'être : D02 (tableau de bord) et D16
 * (rapport d'impact) reposent sur `metric_snapshots`, table que 15 §6 ajoute
 * (« historique des indicateurs pour les courbes ») et qui manque au schéma. Les
 * chiffres qu'ils montrent sont ceux de la maquette, pas une mesure.
 *
 * ─── L'AUTHENTIFICATION N'EST PAS CELLE DES MEMBRES ────────────────────────────
 *
 * 15 §2.1 : cookie `HttpOnly` `Strict` de session d'équipe (8 h, 30 min
 * d'inactivité) et TOTP obligatoire — pas le jeton porteur des membres. Aucun écran
 * de ce lot ne suppose le contraire : rien n'y lit de jeton, rien n'y appelle
 * l'API, et D01 dessine les deux temps (identifiants puis TOTP) plus l'enrôlement
 * forcé. Le type ci-dessous est le point d'accroche du lot qui branchera.
 */

/**
 * Aucun champ : les cadres générés reçoivent `_props`.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe quelle
 * valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un type qui
 * n'interdit rien ne dirait pas que l'écran ne consomme rien.
 *
 * Aucune entrée n'a été ajoutée à `BUTTON_ACTIONS` pour ce lot, et c'est délibéré :
 * brancher un `onClick` qui ne fait rien ferait CROIRE à l'équipe qu'une sanction a
 * été appliquée ou qu'une ville a été activée. 15 §2.3 est une règle dure — « toute
 * écriture depuis l'application admin passe par `AuditService.record()` avant
 * validation de la transaction » — donc une action qui n'écrit rien n'est pas une
 * action : c'est un mensonge tracé nulle part. Les boutons restent inertes.
 */
export type AdministrationData = Record<string, never>;
