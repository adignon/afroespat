import { EcranMessagerie } from '@/screens/messages/ecran-donnees';

/**
 * M01 — Messagerie, la liste des conversations (`/messages`, 08 §5, T5 §10).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/09 Messages et transverse.dc.html` :
 * les styles en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * BRANCHÉ SUR `GET /conversations` ET `GET /conversations/:id/messages`. Les deux
 * sont nécessaires, même ici où l'URL ne nomme aucune conversation : le cadre
 * d'ordinateur dessine les DEUX volets, donc un fil doit être affiché. La maquette
 * montre la première conversation de la liste ouverte (fond `#E3F0EB`), et c'est
 * celle-là qu'on ouvre. Le détail est dans `chargerM01`.
 *
 * LE CADRE D'ORDINATEUR EST CELUI DE `/messages/:id`, et c'est la maquette qui le
 * décide : elle n'en dessine qu'un, à deux volets — liste de 320 px à gauche,
 * conversation à droite — exactement ce que T5 décrit (« deux volets sur ordinateur,
 * pages séparées sur mobile »). Sur téléphone, les deux planches existent bien
 * séparément, et c'est celle de la LISTE qui sert ici.
 *
 * CETTE PAGE PASSE PAR UNE COQUILLE CLIENTE, et pour deux raisons désormais. La
 * première n'a pas changé : le cadre d'ordinateur qu'elle rend porte le « ··· » qui
 * ouvre le MENU DE LA CONVERSATION, et sans la coquille ce bouton serait là sans
 * rien ouvrir — un contrôle mort, pire qu'un contrôle absent. La seconde est le
 * chargement : le jeton d'accès vit en mémoire et n'existe que dans le navigateur.
 *
 * ELLE RESTE UN COMPOSANT SERVEUR, et c'est une règle de ce module : une fonction
 * exportée d'un module `'use client'` et appelée depuis le serveur n'est pas une
 * fonction mais une RÉFÉRENCE client. Cette page ne fait que RENDRE un composant
 * client ; elle n'appelle rien de `ecran-donnees.tsx` ni de `appels.ts`.
 *
 * 08 §5.1 — « la messagerie n'est pas une entrée de navigation : icône en barre
 * haute ». Vérifié sur les trois cadres : ni le rail de gauche (Accueil, Parcours,
 * Entraide, Services, Agenda) ni la barre d'onglets basse (Accueil, Parcours,
 * Entraide, Services, Compte) ne porte « Messages ». L'accès se fait par l'icône de
 * bulle de la barre haute, comme la règle l'exige.
 */
export default function MessagesPage() {
  return <EcranMessagerie vue="liste" conversationId={null} />;
}
