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
export type MessagesData = Record<string, never>;
