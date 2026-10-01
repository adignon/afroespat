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
 * ─── CE QUI A CHANGÉ : LA PRISE EXISTE, ET D08 S'EN SERT ───────────────────────
 *
 * Ce fichier disait « Le type ci-dessous est le point d'accroche du lot qui
 * branchera ». C'est ce lot. La prise a été DÉCLARÉE dans
 * `tools/screens/10-administration.mjs`, sous la clé `donnees`, et le JSX
 * transcodé n'a pas bougé d'une virgule — c'est tout l'intérêt du mécanisme.
 *
 * Le type vide survit pour les cadres qui ne lisent RIEN, et ils sont encore la
 * majorité. Ce qui les retient est écrit route par route dans `appels.ts` : pour
 * la plupart, la route d'équipe n'existe pas, et on ne lui fabrique pas une
 * source.
 *
 * ─── CE QUE CE LOT NE BRANCHE PAS, ET POURQUOI ─────────────────────────────────
 *
 * D16 (rapport d'impact) réclame `guides.quotable` et `city_tips.quotable`, qui
 * n'existent pas au schéma. Citer un membre sans son accord est exactement ce que
 * ces colonnes existent pour empêcher : le mur reste intact, et les témoignages
 * de la planche restent dessinés.
 *
 * Le MRR n'est pas posé, faute de règle sur les plans annuels — « un MRR faux est
 * pire qu'un MRR absent » — et la répartition Mobile Money / carte ainsi que
 * l'affiliation sont dans le même cas. Les quatre tuiles de tête de D14 et le bloc
 * REVENUS de D02 restent donc ceux de la maquette.
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

/**
 * D08 — les référentiels, onglet Villes (`/admin/referentiels`).
 *
 * `GET /admin/ref/cities` via `staffApi`. Les trois états de 02 §4.2 sont des
 * BOOLÉENS SÉPARÉS et non une énumération, parce que la maquette dessine trois
 * colonnes d'action structurellement différentes et que chacune garde son dessin
 * sous son propre `<sc-if>`. Un seul champ `etat: 'active' | 'bientot' | 'doublon'`
 * aurait obligé le JSX à décider, et le JSX transcodé ne décide rien.
 */
export interface VilleD08 {
  readonly nom: string;
  readonly region: string;
  /** Déjà mis en forme — « 1 400 », espace insécable comprise. */
  readonly membres: string;
  /**
   * Le libellé de la pastille, et ses DEUX couleurs.
   *
   * Lier le seul libellé laisserait « Bientôt » sur le fond vert d'une ville
   * active. Les trois paires sont celles de la maquette, relevées sur ses propres
   * planches et jamais assombries.
   */
  readonly statut: string;
  readonly statutFond: string;
  readonly statutTexte: string;
  /** Une ville ouverte : la maquette lui laisse « Fusionner » en texte nu. */
  readonly fusionnable: boolean;
  /** Une ville à ouvrir : le bouton vert « Activer ». */
  readonly activable: boolean;
  /** Un doublon déjà rattaché : « Fusionner avec … ». */
  readonly doublon: boolean;
  /** Le nom de la ville cible de la fusion, vide hors du cas `doublon`. */
  readonly fusionneAvec: string;
}

export interface D08Data {
  readonly villes: readonly VilleD08[];
  /**
   * La carte « Activer … ? », qui porte la ville CANDIDATE.
   *
   * La maquette la dessine toujours : ce n'est pas une fenêtre, c'est une carte de
   * la page. Quand aucune ville n'est candidate, les deux champs le disent plutôt
   * que d'afficher « undefined ».
   */
  readonly activation: { readonly ville: string; readonly membres: string };
}

/**
 * D16 — le rapport d'impact (`/admin/impact`, 15 §5.3).
 *
 * Les cinq nombres de la première planche, plus le trimestre que le SERVEUR
 * nomme. Tous sont déjà mis en forme : « 5 820 », espace fine insécable comprise.
 *
 * CE TYPE NE PORTE AUCUN TÉMOIGNAGE, et c'est le point de l'écran : `guides.quotable`
 * et `city_tips.quotable` n'existent pas au schéma, donc rien ne dit qu'un membre a
 * donné son accord pour être cité. Un champ `temoignages` ici serait la première
 * marche vers une citation publiée sans accord — ce que ces colonnes manquantes
 * existent pour empêcher. Les deux citations de la maquette restent dessinées.
 */
export interface D16Data {
  readonly impact: {
    readonly membres: string;
    readonly parcours: string;
    readonly presences: string;
    readonly entraides: string;
    readonly parrainages: string;
    /** « T3 2026 », dans l'ordre que la maquette écrit — l'API dit « 2026-T3 ». */
    readonly trimestre: string;
  };
}
