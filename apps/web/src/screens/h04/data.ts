import type { BandeauEntraide } from '../entraide/data';
import type { EtatVide, PorteeFil } from '../h01/data';

/**
 * H04 — ce que ses deux cadres lisent.
 *
 * Voir `../entraide/data` pour les formes partagées, et
 * `tools/screens/05-entraide.mjs` pour les liaisons qui les consomment.
 */
export interface H04Data extends BandeauEntraide {
  /**
   * LES TROIS PASTILLES DE PORTÉE du cadre de 390 px — la même rangée que H01,
   * arrêtée à « Mes demandes », parce que c'est ce que la planche dessine.
   *
   * Le TYPE vient de `h01/data` et n'est pas recopié : deux définitions du même
   * contrôle finiraient par diverger, et c'est littéralement la même rangée dans
   * la même maquette. La pastille teintée, elle, diffère — « Vous pouvez aider »
   * ici, « Toutes » là-bas — et c'est une valeur, pas un type.
   *
   * Sur cet écran, LES TROIS SONT DES LIENS, et aucune ne bascule : H04 est déjà
   * la portée « Vous pouvez aider », servie à son adresse propre. Une bascule y
   * serait un contrôle qui ne change rien — exactement le défaut que ce lot
   * répare. Voir `porteesDeH04` dans `entraide/appels.ts`.
   */
  readonly portees?: readonly PorteeFil[];
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES SUGGESTIONS — ELLES ÉTAIENT DEUX CARTES SERVIES À TOUT LE MONDE     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, sur la cohérence des deux planches : « si les deux divergent,
   * aligne-les. »
   *
   * MESURÉ AU NAVIGATEUR, aux deux largeurs : `GET /help/can-help` rendait SEPT
   * suggestions au membre de mesure, la portée « Vous pouvez aider » du fil en
   * affichait sept à 390 px, et cette page affichait « Dossier Visale refusé, que
   * faire ? » et « Relire une lettre de motivation » — les deux cartes de la
   * planche. Deux chemins vers la même liste, deux réponses différentes.
   *
   * De `GET /help/can-help` (§2.6), donc : les types d'aide déclarés au profil
   * plus les définitions d'étapes franchies, dans le rayon de ville, demandes
   * seulement, jamais les siennes, échéance proche d'abord.
   */
  readonly suggestions?: readonly LigneSuggestion[];
  /**
   * L'état vide, le MÊME que celui du fil — dessin compris. Il porte ici le cas
   * `NO_CRITERIA` : le membre qui n'a rien déclaré arrive sur cette page par le
   * panneau de gauche aussi bien que par la pastille, et il doit y lire la même
   * chose.
   */
  readonly vide?: EtatVide | null;
}

/**
 * Une suggestion, telle que la planche de H04 la dessine — et elle ne dessine
 * qu'UNE variante : une demande ouverte, fond blanc, trait gris, pied complet.
 * Rien de ce que `LigneDemande` porte pour ses trois états n'a de sens ici, et
 * c'est pour cela que ce type est le sien et non une réutilisation :
 * `can-help` ne rend que `status: 'OPEN'`, garanti par le `where` du service.
 */
export interface LigneSuggestion {
  readonly categorie: string;
  /**
   * LA PASTILLE TERRE CUITE, et c'est le champ qui porte l'écart du module.
   *
   * La planche écrit « Vous avez franchi l'étape Logement » sur une carte et
   * « Correspond à vos types d'aide » sur l'autre : elle dit POURQUOI chaque
   * demande est suggérée. `helpCardSchema` ne porte que `fromJourney`, et le
   * `where` du service permet d'en tirer exactement une moitié — voir
   * `ligneSuggestion` dans `entraide/appels.ts`. L'autre moitié manque, et elle
   * est REMONTÉE plutôt que devinée.
   */
  readonly motif: string;
  /** « échéance dans 2 j » quand `dueDate` existe, l'âge de la demande sinon. */
  readonly delai: string;
  readonly titre: string;
  readonly extrait: string;
  readonly href: string;
  readonly auteur: string;
  readonly auteurInitiales: string;
  readonly auteurFond: string;
  readonly auteurPhase: string;
  readonly reponses: string;
}
