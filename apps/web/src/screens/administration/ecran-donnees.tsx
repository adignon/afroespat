'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, displayMessageFor } from '@/lib/api/index';

/**
 * LA COQUILLE QUI CHARGE, VERSION ÉQUIPE — les trois états de T1, et rien de plus.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE FICHIER EST UN JUMEAU DE `screens/compte/ecran-donnees.tsx`, ET C'EN  │
 * │ EST UN DÉLIBÉRÉMENT — PAS UN COPIER-COLLER PARESSEUX.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La tentation était de mutualiser les deux en un seul composant paramétré par
 * « où renvoyer quand la session est perdue ». Elle est refusée, et la raison est
 * la même que celle qui fait vivre ces écrans dans `(admin)` plutôt que dans
 * `(app)` : 15 §2.1 est une règle dure, les deux domaines sont HERMÉTIQUES, et un
 * composant partagé serait le premier endroit où un `fetchMe()` « juste pour
 * afficher le nom » viendrait se greffer. Il aurait alors fallu que la coquille
 * d'équipe importe, par transitivité, le magasin du jeton de membre — c'est-à-dire
 * défaire le TROISIÈME fait de l'étanchéité (`lib/api/domains.ts`), celui qui rend
 * `CROSS_DOMAIN_TOKEN` inatteignable.
 *
 * Ce fichier n'importe donc rien du domaine membre : ni `session.ts`, ni
 * `member.ts`, ni `fetchMe`. Il ne connaît qu'`ApiError` et `displayMessageFor`,
 * qui sont du socle commun et ne portent aucun jeton.
 *
 * ── CE QUI DIFFÈRE VRAIMENT DU JUMEAU, ET CE N'EST PAS QUE LE TEXTE ─────────
 *
 *   · le renvoi va vers `/admin/connexion`, jamais vers `/connexion`. Renvoyer un
 *     membre de l'équipe vers la connexion des membres lui ferait essayer ses
 *     identifiants d'équipe sur l'application membres — ce que la règle dure
 *     interdit, et ce que le serveur refuserait, mais autant ne pas l'y inviter ;
 *   · il n'y a RIEN à rafraîchir. Une session d'équipe n'a pas de jeton de
 *     rafraîchissement : elle se prolonge à l'activité, côté serveur
 *     (`StaffGuard.slideExpiry`, 30 min glissantes dans une borne de 8 h). Un
 *     `401 STAFF_SESSION_REQUIRED` veut donc dire « c'est fini, reconnectez-vous »,
 *     et rejouer ne changerait rien — voir l'en-tête de `lib/api/staff.ts` ;
 *   · le `403` d'ici n'est PAS celui du jumeau. Côté membre, un `403` est en
 *     général `LEVEL_REQUIRED`, une invitation à monter de niveau. Côté équipe,
 *     c'est `STAFF_ROLE_REQUIRED` : le rôle ne couvre pas la route, et il n'y a
 *     rien à faire — ni monter de niveau, ni se reconnecter. On affiche donc le
 *     refus SANS lien de reconnexion, parce qu'un lien qui ne répare rien fait
 *     tourner en rond.
 *
 * ── ON DÉCIDE SUR `error.code`, JAMAIS SUR LE STATUT ────────────────────────
 *
 * Et dans ce module c'est mesuré, pas théorique : deux codes de ce projet portent
 * DEUX statuts selon le module — `FORBIDDEN_WORD` en 400 chez les pros et 422 chez
 * les guides, `WEBHOOK_SIGNATURE_INVALID` en 401 chez Didit et 400 chez Stripe. Un
 * aiguillage sur le statut est donc faux par construction ici.
 *
 * Le seul endroit où le statut est lu ci-dessous est le `401`, et il l'est EN PLUS
 * du code, jamais à sa place : c'est `STAFF_SESSION_REQUIRED` qui décide, et le
 * statut ne sert qu'à ne pas rater une session finie annoncée autrement.
 */

type Etat<T> =
  | { readonly phase: 'attente' }
  | { readonly phase: 'prêt'; readonly donnees: T }
  | { readonly phase: 'échec'; readonly erreur: unknown };

/**
 * Charge une fois, au montage.
 *
 * `annule` n'est pas une précaution de style : en développement, React monte
 * chaque composant deux fois, et sans lui le second démontage écrirait dans l'état
 * d'un composant parti.
 *
 * `charger` EST dans les dépendances, et les appelants fournissent une fonction
 * STABLE (une fonction de module, ou un `useCallback` mémoïsé). Un appelant qui
 * passerait une fonction anonyme rechargerait en boucle — propriété qu'on veut
 * VISIBLE plutôt que masquée par un tableau de dépendances vide.
 */
export function useDonneesEquipe<T>(charger: () => Promise<T>): Etat<T> {
  const [etat, setEtat] = useState<Etat<T>>({ phase: 'attente' });

  useEffect(() => {
    let annule = false;
    charger().then(
      (donnees) => {
        if (!annule) setEtat({ phase: 'prêt', donnees });
      },
      (erreur: unknown) => {
        /**
         * AUCUN `console.error` : `no-console` est `error` dans la configuration de
         * lint, pour le code applicatif et délibérément. Le contrat cassé ne se perd
         * pas — `ApiShapeError` porte la route et le champ fautif, il remonte tel
         * quel dans l'état, et `displayMessageFor` le distingue d'une règle métier
         * puisqu'il n'hérite PAS d'`ApiError`.
         */
        if (!annule) setEtat({ phase: 'échec', erreur });
      },
    );
    return () => {
      annule = true;
    };
  }, [charger]);

  return etat;
}

/**
 * LE BANDEAU D'ATTENTE ET D'ÉCHEC — ET IL NE REMPLACE PLUS RIEN.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE QUI ÉTAIT ICI ÉTAIT LE DÉFAUT. Un `CADRE` en `minHeight: 60vh` était  │
 * │ rendu À LA PLACE de l'écran entier, rail compris, dans les DEUX états    │
 * │ non prêts. Mesuré sans exécuter de JavaScript : cinq des dix routes      │
 * │ d'équipe — exactement les cinq qui lisent des données — servaient DEUX   │
 * │ mots visibles et ZÉRO entrée de rail. Et la branche d'échec était la     │
 * │ plus coûteuse des deux : un chargement raté laissait le membre de        │
 * │ l'équipe SANS AUCUNE NAVIGATION, sans sortie hors du bouton retour.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le cadre se rend donc maintenant TOUT DE SUITE, avec le dessin que la maquette
 * calcule, et ces deux états ne sont plus qu'un bandeau POSÉ À CÔTÉ de lui. C'est
 * le motif d'`app/(app)/accueil/page.tsx`, pas une invention : « ce qui reste
 * importé de `data.ts` est le DESSIN que la maquette calcule […] et il n'a aucune
 * raison de venir du serveur ».
 *
 * LIBERTÉ PRISE, ET ELLE EST DÉCLARÉE : `10 Administration` NE DESSINE NI ATTENTE
 * NI ÉCHEC — aucune de ses dix-huit planches ne montre un squelette, un sablier ou
 * un bandeau d'erreur. Ces deux états sont donc la seule chose de ces écrans qui ne
 * soit pas transcodée, et la liberté est bornée à ce bandeau : le rail, l'en-tête
 * de recherche et les colonnes sortent du cadre généré et rien ici ne les touche.
 *
 * ── POURQUOI `fixed`, ET POURQUOI EN BAS ────────────────────────────────────
 *
 * `position: fixed` parce qu'un bandeau dans le flux DÉPLACERAIT la planche de sa
 * hauteur, puis la remonterait quand la réponse arrive : un saut visible sur
 * chaque chargement de chaque écran d'équipe.
 *
 * EN BAS parce que l'en-tête de recherche de la maquette est `position: sticky;
 * top: 0`, avec `zIndex: 20` : un bandeau en haut le recouvrirait. Le `zIndex: 60`
 * d'ici le place au-dessus du contenu sans avoir à toucher à celui de la maquette.
 *
 * Et il est posé en FRÈRE du cadre, dans un fragment — jamais en PARENT. Un
 * conteneur intercalé portant un `transform` ou un `overflow` suffirait à casser le
 * `sticky` de l'en-tête sans qu'aucun type ne s'en plaigne ; c'est la mise en garde
 * déjà écrite dans `app/(app)/accueil/page.tsx`, et elle vaut ici.
 *
 * Il n'emploie QUE des jetons de la maquette : le blanc et la bordure `#E6EBE9` de
 * ses cartes, leur rayon de 22 px, le gris de texte `#5D6B66` et le vert `#0F5C48`
 * de ses liens. Aucune couleur n'est assombrie, et AUCUNE OMBRE PORTÉE n'est
 * ajoutée — T1 §2.3 est une règle dure, et une carte flottante est précisément
 * l'endroit où l'on serait tenté d'en mettre une.
 */
const BANDEAU: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: '16px',
  zIndex: 60,
  maxWidth: 'min(560px, calc(100vw - 32px))',
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '22px',
  padding: '10px 18px',
  fontSize: '14px',
  color: '#5D6B66',
  textAlign: 'center',
};

/** La session d'équipe est-elle finie — donc faut-il repasser par la connexion ? */
function sessionFinie(erreur: unknown): boolean {
  if (!(erreur instanceof ApiError)) return false;
  /**
   * SUR LE CODE D'ABORD. `STAFF_SESSION_REQUIRED` est le seul refus que la
   * connexion répare : il couvre les six sites de `StaffGuard` — pas de cookie,
   * session inconnue, révoquée, expirée (inactivité ou borne de 8 h), compte
   * désactivé.
   *
   * `CROSS_DOMAIN_TOKEN` est VOLONTAIREMENT ABSENT de cette liste, et c'est le
   * point qui compte : il porte le MÊME statut 401 et le MÊME message serveur
   * (« Session équipe requise. »), donc un aiguillage sur le statut ou sur le
   * message le confondrait avec une session finie. Or ce n'en est pas une — c'est
   * un DÉFAUT DE CODE, un jeton de membre parti sur une route d'équipe. Offrir
   * « Se reconnecter » dessus masquerait le bogue derrière un geste inutile.
   *
   * Et il ne peut pas arriver depuis ce front : `staffApi` n'a aucun chemin de code
   * qui produise un en-tête `Authorization`. S'il arrivait quand même, c'est que
   * l'étanchéité a été défaite, et l'écran doit le MONTRER, pas le couvrir.
   */
  if (erreur.code === 'STAFF_SESSION_REQUIRED') return true;
  /**
   * `STAFF_ROLE_REQUIRED` (403) ne se répare pas en se reconnectant : la session
   * est bonne, c'est le RÔLE qui ne couvre pas la route (§2.2). Pas de lien.
   */
  if (erreur.code === 'STAFF_ROLE_REQUIRED' || erreur.code === 'STAFF_IP_NOT_ALLOWED') return false;
  if (erreur.code === 'CROSS_DOMAIN_TOKEN') return false;
  /** Un 401 annoncé autrement reste une session à refaire : le code passe d'abord. */
  return erreur.status === 401;
}

export function EcranDonneesEquipe<T>({
  charger,
  squelette,
  children,
}: {
  readonly charger: () => Promise<T>;
  /**
   * LES PROPS D'ATTENTE DU CADRE — le DESSIN, jamais la donnée.
   *
   * Cette prop est OBLIGATOIRE, et c'est la moitié de la correction. Facultative,
   * elle serait omise au prochain écran branché et la coquille vide reviendrait
   * exactement là — sans que rien ne le dise, puisque la page répondrait toujours
   * 200. En l'exigeant, `tsc` refuse l'oubli.
   *
   * Les six valeurs vivent dans `screens/administration/data.ts`, à côté des types
   * qu'elles remplissent (`SQUELETTE_D02` … `SQUELETTE_D16`), parce que c'est le
   * fichier du dessin — même place que `rail` et `panelFil` pour l'accueil.
   */
  readonly squelette: T;
  readonly children: (donnees: T) => ReactNode;
}) {
  const etat = useDonneesEquipe(charger);

  /**
   * LE CADRE EST RENDU DANS LES TROIS ÉTATS. Il n'y a plus de `return` précoce, et
   * c'est tout le correctif : les deux états non prêts prennent les props
   * d'attente, et ne retirent RIEN de l'écran.
   *
   * L'échec prend le squelette lui aussi, délibérément : garder à l'écran les
   * données d'un chargement précédent ferait lire comme vrai un tableau que le
   * serveur vient de refuser de confirmer.
   */
  const donnees = etat.phase === 'prêt' ? etat.donnees : squelette;

  return (
    <>
      {children(donnees)}
      {etat.phase === 'attente' ? (
        <div style={BANDEAU} role="status" aria-live="polite">
          Chargement…
        </div>
      ) : null}
      {etat.phase === 'échec' ? (
        <div style={BANDEAU} role="alert">
          {displayMessageFor(etat.erreur)}
          {sessionFinie(etat.erreur) ? (
            <>
              {' '}
              <a href="/admin/connexion" style={{ color: '#0F5C48', fontWeight: 700 }}>
                Se reconnecter
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
