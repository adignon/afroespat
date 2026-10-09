/**
 * Ce que les écrans M01 et X01 à X04 PARTAGENT — et ce qui ne se partage pas.
 *
 * ── CE FICHIER A CHANGÉ DE NATURE, ET IL FAUT SAVOIR POURQUOI ───────────────
 *
 * Il disait, et c'était exact : « IL N'Y EN A AUCUNE ». Le `renderVals()` de
 * `09 Messages et transverse.dc.html` rend `{}`, et le fichier ne contient ni
 * `{{ … }}` ni `<sc-for>` — zéro de chacun, comptés. Les quinze cadres de ce
 * module recevaient donc `_props`, et le souligné disait que le paramètre n'était
 * pas lu : ces écrans recevaient des données et les IGNORAIENT.
 *
 * Il annonçait aussi la suite : « c'est ici que les champs arriveront quand ces
 * écrans seront branchés sur `apps/api/src/modules/messaging`, sur la recherche
 * (module 11) et sur les notifications (module 12). Le JSX transcodé n'aura pas à
 * bouger. » C'est exactement ce qui vient d'arriver, et le JSX n'a PAS bougé : la
 * prise a été DÉCLARÉE dans `tools/screens/09-messages.mjs`, sous la clé
 * `donnees`, et le générateur produit des cadres qui lisent leurs propriétés.
 *
 * ── UN TYPE PAR ÉCRAN, DONC PEU DE CHOSES ICI ───────────────────────────────
 *
 * Les champs, eux, ne vivent pas ici : chaque écran a son `data.ts`, à côté de ses
 * cadres — `screens/m01/data.ts`, `screens/x01/data.ts`, `screens/x02/data.ts`.
 * Un type commun n'avait aucun coût tant qu'il ne portait RIEN ; il en aurait un
 * dès la première donnée, puisqu'un champ ajouté pour la recherche apparaîtrait
 * dans la signature des cadres de la messagerie.
 *
 * Ce fichier garde donc les deux seules choses qui se partagent VRAIMENT : la
 * barre haute, que les quatre cadres d'ordinateur dessinent à l'identique, et le
 * type des cadres qui ne lisent rien.
 *
 * Les appels, eux, sont dans `./appels.ts`.
 */

/**
 * LA BARRE HAUTE DES CADRES D'ORDINATEUR — M01, M01BLOQUE, X01 et X02.
 *
 * Les quatre planches de 1440 px de cette maquette dessinent la même barre que
 * `08 Compte` : la pastille d'initiales et le prénom du membre connecté. C'est la
 * seule donnée que ces quatre écrans ont réellement en commun, et elle vient d'une
 * seule route — `GET /me`.
 *
 * ELLE NE PORTE NI PSEUDO NI NIVEAU, et c'est la maquette qui le décide : la barre
 * haute de `09` n'écrit que les initiales et le prénom, là où le panneau « MON
 * COMPTE » de `08` écrit aussi « @amina.d · niveau 2 ». On ne transporte pas un
 * niveau dont aucun pixel n'a besoin — et s'il en fallait un, la règle du socle
 * resterait sans exception : le niveau s'affiche, il n'autorise JAMAIS. On tente
 * l'action, et c'est `403 LEVEL_REQUIRED` qui fait afficher l'invitation du §7.3.
 */
export interface BarreHaute {
  /**
   * LE FOND DU ROND D'AVATAR : la photo du membre, ou rien.
   *
   * FACULTATIVE : seul le module Compte la remplit aujourd'hui, parce que lui seul
   * lit `GET /me`. Absente, le cadre reprend l'aplat de la maquette et écrit les
   * initiales — exactement ce qu'il faisait avant. Le jour où ce module lira
   * `avatarUrl`, il suffira de la poser.
   */
  readonly photo?: string | null;
  readonly initiales: string;
  readonly prenom: string;
}

/**
 * Les cadres qui ne consomment RIEN — et ils sont quatre, chacun pour sa raison.
 *
 *   · `m01menu` — les quatre entrées du menu de la conversation sont du TEXTE
 *     (« Voir le profil », « Mettre en sourdine », « Bloquer », « Signaler »), et
 *     la maquette les dessine en `<span>`. Aucune n'est une donnée ;
 *   · `x03` (deux cadres) — les six motifs de signalement sont l'énumération
 *     `ReportReason`, mais AUCUNE route ne les rend : `POST /reports` les reçoit,
 *     il n'y a pas de `GET`. Et les lier à l'énumération partagée changerait le
 *     texte affiché, la maquette écrivant « Indésirable » et « Inapproprié » là où
 *     l'énumération nomme ses propres valeurs ;
 *   · `x03confirmation` — « Merci. Nous regardons sous 24 heures. » est du texte de
 *     maquette, et `REPORT_CONFIRMATION` dans `packages/shared` dit AUTRE CHOSE
 *     (« Merci. Notre équipe examine votre signalement ; vous serez informé·e de sa
 *     clôture. »). Lier remplacerait une phrase par une autre : c'est une décision
 *     de produit, pas une liaison. Signalé au porteur ;
 *   · `x04` — les encarts de refus n'ont aucune route, et ce cadre n'est monté par
 *     AUCUNE page : son composant est généré et importé par personne (vérifié).
 *     Les deux encarts attendent un refus — `403 LEVEL_REQUIRED` porte
 *     `requiredLevel`, `currentLevel` et `labelFr`, et le quota de plan vient de
 *     `GET /me/subscription` — c'est-à-dire une ÉCRITURE refusée, que ce lot ne
 *     tente pas. Signalé.
 *
 * Le détail de chacun est dans la déclaration d'écran, `tools/screens/09-messages.mjs`.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe
 * quelle valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un
 * type qui n'interdit rien ne dirait pas que le cadre ne consomme rien.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE MENU DE LA CONVERSATION — QUATRE ENTRÉES, QUATRE `<span>` INERTES      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Les options voir le profil, mettre en sourdine, bloquer et
 * signaler ne marchent pas. Intègre tout ça. »
 *
 * MESURÉ dans le cadre produit : les quatre entrées étaient des `<span>`. La
 * maquette les dessine ainsi, et le transcodage les avait laissées telles quelles.
 *
 * TOUTES FACULTATIVES, parce que ce type sert aussi aux deux feuilles X03 et à la
 * confirmation, qui n'ont pas de conversation ouverte. Sans geste, l'entrée reste
 * ce qu'elle était — un libellé — plutôt que de promettre une action morte.
 */
export interface MenuConversation {
  /** `/<handle>` du profil public, ou `null` sur une conversation de parcours. */
  readonly profil?: string | null;
  /** L'état courant : le libellé de l'entrée en dépend. */
  readonly sourdine?: boolean;
  readonly onSourdine?: () => void;
  readonly onBloquer?: () => void;
  /** Vrai pendant l'appel : l'entrée se désactive plutôt que de partir deux fois. */
  readonly menuOccupe?: boolean;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA FEUILLE « SIGNALER » — SIX `<div>`, UN TEXTE D'EXEMPLE, UN BOUTON MORT ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le modal n'est pas du tout dynamique (pas d'input, les choix ne
 * marchent pas ainsi que la soumission) ».
 *
 * `motif` porte un `ReportReason` — `SCAM`, `MONEY_REQUEST`, `HARASSMENT`,
 * `SPAM`, `INAPPROPRIATE`, `OTHER` — et `null` tant que rien n'est choisi, ce qui
 * désactive l'envoi : `createReportSchema.reason` est obligatoire.
 */
export interface SignalementVue {
  readonly motif?: string | null;
  readonly onMotif?: (motif: string) => void;
  readonly details?: string;
  readonly onDetails?: (e: { readonly target: { readonly value: string } }) => void;
  readonly onEnvoyer?: () => void;
  readonly envoiBloque?: boolean;
}

export interface MessagesData {
  /**
   * `| undefined` EXPLICITE : `exactOptionalPropertyTypes` est actif dans ce
   * dépôt, et `menu?: MenuConversation` interdit alors de PASSER `undefined` —
   * seulement de l'omettre. Or `EcranMessages` transmet sa propre prise
   * facultative telle quelle.
   */
  readonly menu?: MenuConversation | undefined;
  readonly signalement?: SignalementVue | undefined;
}
