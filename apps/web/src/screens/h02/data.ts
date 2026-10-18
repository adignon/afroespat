import type { ActionDemande, ActionReponse } from '../entraide/actions-types';
import type { BandeauEntraide, MembreDessine } from '../entraide/data';

/**
 * H02 — une demande en détail (`/entraide/:id`), de `GET /help/:id`.
 *
 * `parcours` est NULLABLE, et la déclaration d'écran le met sous `<sc-if>` : une
 * demande qui ne vient pas d'un parcours ne doit pas afficher « Étape undefined ».
 *
 * RÈGLE DURE (§2.5, 04 §2) : `type` est le TYPE de parcours — « Études » — et
 * JAMAIS son titre personnel. `journeyContext` ne porte pas ce titre, et
 * `helpJourneyContextSchema` est `.strict()` pour qu'un champ greffé le refuse au
 * lieu de le dépouiller en silence.
 */
export interface ContexteParcours {
  /**
   * PAS DE `rang` : la maquette écrit « Étape 7 », mais `journeyContext` ne porte
   * aucun rang d'étape. Le numéro a disparu de la liaison plutôt que d'être
   * composé — « Étape 1 » faux se lirait comme une information.
   */
  readonly etape: string;
  readonly type: string;
  readonly jours: number;
}

/**
 * Une réponse publique.
 *
 * `marquee` et `peutMarquer` sont les DEUX variantes que la maquette dessine : la
 * pastille remplie pour celle qui a aidé, la détourée pour celles que l'auteur
 * peut encore marquer. Les deux sont FAUX en même temps pour un lecteur qui n'est
 * pas l'auteur d'une demande déjà résolue — et c'est juste : la maquette ne dessine
 * alors aucune pastille sur cette ligne.
 */
export interface ReponsePublique {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur […] partout
   * où le nom est affiché ». Les noms dessinés dans les cadres étaient des
   * `<span>` et aucun ne menait au profil.
   *
   * FACULTATIVE : le cadre ne pose le lien que si la ligne porte une adresse.
   * Sans elle, le nom reste nu — exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly fond: string;
  readonly initiales: string;
  readonly nom: string;
  /** « · il y a 1 h », avec le point médian que la maquette écrit. */
  readonly age: string;
  readonly corps: string;
  readonly marquee: boolean;
  /** Les gestes sur cette réponse (marquer, modifier, supprimer, signaler). */
  readonly action: ActionReponse;
  /** `canMarkHelpful` : l'auteur, sur une demande OUVERTE, et pas sa propre réponse. */
  readonly peutMarquer: boolean;
}

export interface H02Data extends BandeauEntraide {
  /** Les gestes de l'auteur et du lecteur sur la demande (modifier, résoudre, rouvrir, répondre…). */
  readonly action: ActionDemande;
  readonly demande: {
    readonly titre: string;
    readonly corps: string;
    /**
     * L'extrait TRONQUÉ PAR LE SERVEUR à 280 caractères (`excerpt`), pour le cadre
     * mobile — qui abrège le corps à la main dans la maquette. On ne retronque pas
     * ici : §5 a décidé la longueur, et la refaire côté écran ferait deux règles.
     */
    readonly extrait: string;
    readonly auteur: MembreDessine;
    /** Le nombre de réponses VISIBLES, pas `responseCount` : voir `appels.ts`. */
    readonly nbReponses: number;
    readonly parcours: ContexteParcours | null;
    /**
     * Le bandeau « APRÈS RÉSOLUTION », et `null` tant que la demande est ouverte.
     *
     * TROUVÉ AU NAVIGATEUR : la planche nommait « Sandra M. » EN DUR dans ce
     * bandeau, affiché à tous les lecteurs de toutes les demandes. Lier les
     * réponses sans lier ce bandeau laissait l'écran nommer une personne qui n'a
     * rien à voir avec la demande affichée.
     */
    readonly resolue: { readonly aidant: string } | null;
  };
  readonly reponses: readonly ReponsePublique[];
}
