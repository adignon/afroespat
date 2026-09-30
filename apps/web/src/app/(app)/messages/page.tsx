import { EcranMessages } from '@/screens/messages/ecran';
import { M01Desktop } from '@/screens/m01/desktop.generated';
import { M01Mobile } from '@/screens/m01/mobile.generated';

/**
 * M01 — Messagerie, la liste des conversations (`/messages`, 08 §5, T5 §10).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/09 Messages et transverse.dc.html` :
 * les styles en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * LE CADRE D'ORDINATEUR EST CELUI DE `/messages/:id`, et c'est la maquette qui le
 * décide : elle n'en dessine qu'un, à deux volets — liste de 320 px à gauche,
 * conversation à droite — exactement ce que T5 décrit (« deux volets sur ordinateur,
 * pages séparées sur mobile »). Sur téléphone, les deux planches existent bien
 * séparément, et c'est celle de la LISTE qui sert ici.
 *
 * CETTE PAGE PASSE PAR LA COQUILLE CLIENTE, alors qu'elle n'a aucun état d'URL, et
 * ce n'est pas une inadvertance : le cadre d'ordinateur qu'elle rend est celui de la
 * conversation, donc il porte le « ··· » qui ouvre le MENU DE LA CONVERSATION. Sans
 * la coquille, ce bouton serait là et n'ouvrirait rien — un contrôle mort, ce qui
 * est pire qu'un contrôle absent. Le cadre MOBILE de cette route (« MOBILE · LISTE »)
 * n'en porte aucun : la maquette y dessine un crayon.
 *
 * AUCUNE DONNÉE : la maquette est statique (voir `@/screens/messages/data`).
 *
 * 08 §5.1 — « la messagerie n'est pas une entrée de navigation : icône en barre
 * haute ». Vérifié sur les trois cadres : ni le rail de gauche (Accueil, Parcours,
 * Entraide, Services, Agenda) ni la barre d'onglets basse (Accueil, Parcours,
 * Entraide, Services, Compte) ne porte « Messages ». L'accès se fait par l'icône de
 * bulle de la barre haute, comme la règle l'exige.
 */
export default function MessagesPage() {
  return <EcranMessages desktop={<M01Desktop />} mobile={<M01Mobile />} />;
}
