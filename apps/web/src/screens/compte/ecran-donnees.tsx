'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError, displayMessageFor } from '@/lib/api/index';

/**
 * LA COQUILLE QUI CHARGE — les trois états obligatoires de T1, et rien de plus.
 *
 * ── POURQUOI UN COMPOSANT CLIENT ────────────────────────────────────────────
 *
 * Le jeton d'accès vit en MÉMOIRE, dans la clôture de `lib/api/session.ts`, et il
 * n'existe que dans le navigateur — c'est la décision de `session.ts` et elle est
 * juste : « écrire le jeton d'accès dans un stockage lisible par JavaScript
 * rendrait ce soin inutile ». Un composant serveur n'a donc aucun moyen d'appeler
 * `/me` au nom du membre. Les dix écrans du module chargent côté client.
 *
 * Il n'y a rien à faire pour reprendre la session : le jeton meurt au
 * rechargement, le premier appel prend un `401`, et le TRANSPORT rafraîchit par le
 * cookie `httpOnly` puis rejoue — une fois, partagé en vol. Appeler
 * `resumeSession()` ici ajouterait un aller-retour au chargement de chaque page
 * pour refaire ce que le socle fait déjà, et deux rotations simultanées du jeton de
 * rafraîchissement sont exactement ce que `refreshOnce` existe pour empêcher.
 *
 * ── LA LIBERTÉ PRISE, ET ELLE EST DÉCLARÉE ──────────────────────────────────
 *
 * `08 Compte` NE DESSINE NI ATTENTE NI ÉCHEC. Aucune de ses planches ne montre un
 * squelette, un sablier ou un bandeau d'erreur. Les deux états ci-dessous sont donc
 * la seule chose de ces écrans qui ne soit pas transcodée, et il faut le dire —
 * c'est la même exigence d'honnêteté que le `⚠` du générateur pour un texte fourni
 * par le porteur.
 *
 * Ils sont réduits au strict nécessaire et n'emploient QUE des jetons de la
 * maquette : le fond `#F6F8F7` de `ScreenFrames`, le gris de texte `#5D6B66` et le
 * vert `#0F5C48` de ses liens. Aucune couleur n'est assombrie. Et ils sont ANNONCÉS
 * — `role="status"` pour l'attente, `role="alert"` pour l'échec — parce qu'un écran
 * qui change sans le dire est un écran qu'un lecteur d'écran ne suit pas.
 *
 * ── CE QUI EST DÉCIDÉ SUR `error.code`, ET JAMAIS SUR LE MESSAGE ─────────────
 *
 * `displayMessageFor` rend la phrase française pour n'importe quel échec, et elle
 * sait déjà ce que le front ne doit pas refaire :
 *
 *   · sur un `429`, elle n'affiche PAS le message du serveur — il dit « patientez
 *     un instant » pour une heure d'attente, trois routes de ce projet étant
 *     chiffrées à l'HEURE. Rien ne réessaie ici : rejouer un `429` le transforme
 *     en boucle ;
 *   · un `ApiShapeError` est un INCIDENT, pas une règle métier, et il n'hérite pas
 *     d'`ApiError` précisément pour qu'on ne puisse pas le confondre. Il est donc
 *     journalisé en console, là où un développeur le verra, avec la phrase
 *     générique à l'écran — le membre n'a rien à faire d'un contrat cassé ;
 *   · un `401` définitif veut dire « reconnectez-vous », et l'écran offre le lien
 *     plutôt que de laisser lire une erreur sans issue.
 */

type Etat<T> = { readonly phase: 'attente' } | { readonly phase: 'prêt'; readonly donnees: T } | { readonly phase: 'échec'; readonly erreur: unknown };

/**
 * Charge une fois, au montage.
 *
 * `annule` n'est pas une précaution de style : en développement, React monte
 * chaque composant deux fois, et sans lui le second démontage écrirait dans l'état
 * d'un composant parti — un avertissement que l'on finit par ignorer, donc une
 * vraie erreur que l'on n'aurait plus vue.
 */
export function useDonnees<T>(charger: () => Promise<T>): Etat<T> {
  const [etat, setEtat] = useState<Etat<T>>({ phase: 'attente' });

  useEffect(() => {
    let annule = false;
    charger().then(
      (donnees) => {
        if (!annule) setEtat({ phase: 'prêt', donnees });
      },
      (erreur: unknown) => {
        if (annule) return;
        /**
         * AUCUN `console.error` ICI, et ce n'est pas un oubli : `no-console` est
         * `error` dans la configuration de lint du dépôt, pour le code applicatif et
         * délibérément — cent vingt-quatre écrans qui journalisent chacun à leur
         * façon finissent par écrire n'importe quoi dans la console d'un membre.
         *
         * Le contrat cassé ne se perd pas pour autant : `ApiShapeError` porte la
         * route et le champ fautif, il remonte tel quel dans l'état, et
         * `displayMessageFor` le distingue d'une règle métier — il n'hérite PAS
         * d'`ApiError`, ce qui interdit structurellement de le prendre pour l'autre.
         * Le brancher sur un rapporteur d'incident est un geste d'application, pas
         * d'écran : il se fait une fois, au niveau du `layout`.
         */
        setEtat({ phase: 'échec', erreur });
      },
    );
    return () => {
      annule = true;
    };
    /**
     * `charger` EST DANS LES DÉPENDANCES, et il doit y être.
     *
     * La version précédente déclarait `[]` et désactivait la règle par un
     * commentaire — lequel nommait d'ailleurs une règle absente de la configuration,
     * donc ne désactivait rien. C'était un aveu déguisé : « je sais que la
     * dépendance manque ».
     *
     * Elle ne manque plus, et rien ne boucle, parce que les appelants fournissent une
     * fonction STABLE : les neuf pages passent une fonction de module
     * (`chargerK01`…), et K02 — la seule dont l'appel dépend d'un paramètre de route —
     * passe un `useCallback` mémoïsé sur le pseudo. Un appelant qui fournirait une
     * fonction anonyme rechargerait en boucle, et c'est une propriété qu'on veut
     * VISIBLE plutôt que masquée : la boucle se voit tout de suite, un rechargement
     * manqué ne se voit jamais.
     */
  }, [charger]);

  return etat;
}

const CADRE: React.CSSProperties = {
  minHeight: '60vh',
  background: '#F6F8F7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  textAlign: 'center',
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DÉFAUT QUE CE PANNEAU CORRIGE — UN CHARGEMENT RATÉ ENFERMAIT LE MEMBRE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La branche d'échec rendait un `<div>` qui REMPLAÇAIT le cadre entier. Le membre
 * lisait « Une erreur est survenue de notre côté » et n'avait PLUS AUCUNE
 * navigation : ni rail, ni panneau, ni barre basse. La seule sortie était le
 * bouton retour du navigateur. Le lien « Se reconnecter » n'apparaît que sur
 * 401/403, donc jamais sur une erreur serveur ni sur une coupure réseau — les deux
 * cas les plus courants.
 *
 * ── CE QUI N'EST PAS ATTEIGNABLE D'ICI, ET POURQUOI ─────────────────────────
 *
 * « Ne remplacer que la zone de contenu » n'est PAS faisable depuis ce composant,
 * et ce n'est pas un manque de soin : LE RAIL EST DANS LE MÊME BLOC TRANSCODÉ QUE
 * LE CONTENU. Les cadres générés (`*.generated.tsx`) sont une seule arborescence
 * par planche — le rail de 76 px, le panneau de section, l'en-tête de recherche et
 * le fil y sont frères dans le même `<div>` — et ce bloc est rendu par
 * `children(donnees)`, donc il EXIGE les données qui viennent précisément de
 * manquer. Il n'existe aucun composant de squelette séparé :
 * `apps/web/src/components/` ne contient que `garde-session`, `level-invitation`,
 * `modal`, `notifications` et `session-boot`. Dessiner un rail ici serait
 * RÉÉCRIRE une maquette, ce que le porteur a interdit.
 *
 * ── LA FORME MINIMALE RETENUE ──────────────────────────────────────────────
 *
 * Rendre au membre une SORTIE, sans inventer de dessin :
 *
 *   · « Réessayer », parce qu'une coupure réseau est le cas le plus fréquent et
 *     qu'un rechargement de page ferait perdre le contexte. Il REMONTE le
 *     chargeur (voir la clé d'essai dans `EcranDonnees`) au lieu de rejouer
 *     l'appel à la main : un seul chemin de chargement, donc un seul à tenir ;
 *   · les QUATRE destinations du squelette membre, telles qu'elles sont déclarées
 *     pour le rail et pour la barre basse du mobile (`tools/squelette-membre.mjs`
 *     et `tools/barre-basse.mjs`). Elles sont RECOPIÉES, pas choisies : ce sont
 *     les mêmes quatre que la maquette dessine. La cinquième du rail (Agenda) y
 *     est aussi — ce panneau sert les sept modules, dont l'Agenda ;
 *   · « Se reconnecter » reste, et seulement sur 401/403, où c'est la vraie
 *     action.
 *
 * Aucune couleur n'est assombrie : le fond `#F6F8F7` de `ScreenFrames`, le gris de
 * texte `#5D6B66` et le vert `#0F5C48` des liens de la maquette, et rien d'autre.
 * `role="alert"` est conservé.
 */
const SORTIES = [
  ['Accueil', '/accueil'],
  ['Parcours', '/parcours'],
  ['Entraide', '/entraide'],
  ['Services', '/services/logement'],
  ['Agenda', '/agenda'],
] as const;

const LIEN: React.CSSProperties = { color: '#0F5C48', fontWeight: 700 };

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DÉFAUT PLUS LARGE — L'ATTENTE VIDAIT AUSSI LE RENDU SERVEUR              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au HTML servi, sans exécuter le JavaScript — la seule mesure qui vaut
 * pour cette règle :
 *
 *     /accueil            200  rail servi : les cinq destinations
 *     /parcours           200  rail : AUCUN — « DisaporyPlus · Chargement… »
 *     /entraide           200  rail : AUCUN
 *     /services/logement  200  rail : AUCUN
 *     /agenda             200  rail : AUCUN
 *
 * Le rail EST déclaré sur ces cadres, et les cinq `<a href>` sont bien dans le
 * `*.generated.tsx`. Ce n'est donc pas un lien mort — c'est le CADRE qui n'atteint
 * jamais le navigateur : la branche d'attente le remplaçait par une phrase, comme
 * la branche d'échec le remplaçait par un message.
 *
 * ── LE MOTIF JUSTE EXISTE DÉJÀ DANS LE DÉPÔT : `/accueil` ──────────────────
 *
 * `app/(app)/accueil/page.tsx` rend son cadre IMMÉDIATEMENT avec le DESSIN que la
 * maquette calcule (`rail`, `panelFil`, `shortcuts`, les filtres, les onglets),
 * importé de `screens/a01/data.ts`, et ne prend de l'API que le CONTENU
 * (`feedPosts`, `stories`, `events`…). Son commentaire le dit : ce dessin « n'a
 * aucune raison de venir du serveur ».
 *
 * `squelette` porte ce motif ici. Quand un appelant le fournit :
 *
 *   · le cadre est rendu TOUT DE SUITE, avec ses listes vides — donc le rail, le
 *     panneau de section, la barre basse et l'en-tête de recherche sont dans le
 *     HTML servi, et ils cliquent ;
 *   · l'attente et l'échec deviennent une BANDE, posée en `position: fixed` au bas
 *     de la fenêtre. Fixe, et pas dans le flux : une bande dans le flux
 *     descendrait tout le cadre de sa hauteur à chaque chargement, donc
 *     déplacerait le dessin de la maquette — exactement ce qu'on ne fait pas ici.
 *
 * Quand il n'est PAS fourni, le comportement ne change pas d'un pixel : les quatre
 * pages corrigées par ce lot le passent, les autres non. C'est ce qui permet de
 * réparer quatre routes sans toucher aux quarante qui restent — et celles-là sont
 * REMONTÉES, pas oubliées.
 *
 * Aucune couleur n'est assombrie : fond `#fff`, bordure `#E6EBE9`, texte `#5D6B66`,
 * lien `#0F5C48` — tous de la maquette.
 */
const BANDE: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA BANDE A CACHÉ LA BARRE D'ONGLETS DU MOBILE, ET LE TEST L'A ATTRAPÉE    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Posée à `bottom: 16px`, elle se superposait EXACTEMENT à la barre d'onglets
   * basse — qui est, sur un téléphone, la SEULE navigation de la page. Mesuré :
   * « /entraide · clic sur Services » expirait au bout de trois minutes, parce
   * que Playwright attend qu'un élément reçoive vraiment le clic et que la bande
   * l'interceptait. Les trois autres onglets passaient, selon la largeur du texte
   * de la bande — un échec qui ressemblait à de l'intermittence.
   *
   * C'était EXACTEMENT LE DÉFAUT QUE CE LOT CORRIGE, reproduit par le correctif :
   * le membre voyait son cadre, et ne pouvait plus en sortir au doigt.
   *
   * DEUX MESURES, et les deux sont nécessaires :
   *
   *   · remontée AU-DESSUS de la barre (54 px de ligne + 6 px de marge + le
   *     retrait de sécurité du téléphone, arrondi à 96 px). Ce n'est pas qu'une
   *     question de clic : une bande POSÉE SUR la navigation la cache aussi à
   *     l'œil, et c'est le reproche d'origine du porteur ;
   *   · `pointerEvents: 'none'` sur la bande : un bandeau d'INFORMATION n'a aucune
   *     raison d'avaler un clic. Seuls ses contrôles le reprennent
   *     (`pointerEvents: 'auto'` sur « Réessayer » et « Se reconnecter »), parce
   *     qu'eux doivent être cliquables.
   *
   * La ceinture ET la bretelle : si une maquette future rallonge la barre, la
   * bande ne reprendra pas le clic pour autant.
   */
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
  transform: 'translateX(-50%)',
  zIndex: 20,
  maxWidth: 'calc(100vw - 32px)',
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '14px',
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '13px',
  color: '#5D6B66',
  pointerEvents: 'none',
};

/** Ce que la bande laisse cliquable : ses contrôles, et rien d'autre. */
const DANS_LA_BANDE: React.CSSProperties = { pointerEvents: 'auto' };

const BOUTON_LIEN: React.CSSProperties = {
  border: 'none',
  background: 'none',
  padding: '0',
  font: 'inherit',
  cursor: 'pointer',
  ...LIEN,
};

/**
 * Le panneau d'échec, EXPORTÉ parce que deux modules l'affichaient en double.
 *
 * `screens/parcours/ecran-donnees.tsx` portait sa propre fonction `Echec`,
 * identique à celle-ci au caractère près — même `CADRE`, même `displayMessageFor`,
 * même garde 401/403. Le brief de ce lot ne nommait qu'un seul fichier ; la mesure
 * en a trouvé DEUX. Corriger l'un et pas l'autre aurait laissé les douze écrans de
 * Parcours exactement aussi fermés qu'avant, et la seconde copie n'aurait plus eu
 * personne pour la relire.
 */
export function PanneauEchec({
  erreur,
  onReessayer,
}: {
  readonly erreur: unknown;
  readonly onReessayer: () => void;
}) {
  const perdue = erreur instanceof ApiError && (erreur.status === 401 || erreur.status === 403);
  return (
    <div style={CADRE} role="alert">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <span style={{ fontSize: '14px', color: '#5D6B66' }}>
          {displayMessageFor(erreur)}
          {perdue ? (
            <>
              {' '}
              <a href="/connexion" style={LIEN}>
                Se reconnecter
              </a>
            </>
          ) : null}
        </span>
        <button type="button" onClick={onReessayer} style={{ ...BOUTON_LIEN, fontSize: '14px' }}>
          Réessayer
        </button>
        {/*
         * LA SORTIE. `aria-label` nomme le groupe pour qu'un lecteur d'écran ne
         * lise pas cinq liens sans dire à quoi ils servent — l'écran qui les porte
         * n'a plus ni rail ni barre basse, donc rien d'autre ne l'annonce.
         */}
        <nav
          aria-label="Aller ailleurs"
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            fontSize: '13px',
          }}
        >
          {SORTIES.map(([libelle, vers]) => (
            <a key={vers} href={vers} style={LIEN}>
              {libelle}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** L'attente, quand le cadre est à l'écran : une bande, et rien qui se déplace. */
export function BandeAttente({ texte }: { readonly texte: string }) {
  return (
    <div style={BANDE} role="status" aria-live="polite">
      <span>{texte}</span>
    </div>
  );
}

/**
 * L'échec, quand le cadre est à l'écran.
 *
 * Pas de liens de sortie ici, et c'est délibéré : le rail, le panneau et la barre
 * basse du mobile sont SOUS cette bande, servis par le cadre, et ils cliquent. Les
 * répéter serait ajouter du dessin que la maquette n'a pas. La bande ne porte donc
 * que ce que le cadre ne peut pas dire : ce qui a échoué, et comment réessayer.
 */
export function BandeEchec({
  erreur,
  onReessayer,
}: {
  readonly erreur: unknown;
  readonly onReessayer: () => void;
}) {
  const perdue = erreur instanceof ApiError && (erreur.status === 401 || erreur.status === 403);
  return (
    <div style={BANDE} role="alert">
      <span>{displayMessageFor(erreur)}</span>
      {perdue ? (
        <a href="/connexion" style={{ ...LIEN, ...DANS_LA_BANDE }}>
          Se reconnecter
        </a>
      ) : null}
      <button
        type="button"
        onClick={onReessayer}
        style={{ ...BOUTON_LIEN, ...DANS_LA_BANDE }}
      >
        Réessayer
      </button>
    </div>
  );
}

/**
 * L'écran d'un module qui lit l'API, une fois ses données là.
 *
 * `children` reçoit les données : les cadres transcodés les lisent en propriétés,
 * et cette coquille ne connaît ni leur forme ni leur nombre.
 *
 * ── `attente` : POURQUOI CE COMPOSANT EST SORTI DU SEUL MODULE COMPTE ───────
 *
 * Il a été écrit pour les dix écrans de `08 Compte`, et son texte d'attente le
 * disait : « Chargement de votre compte… ». Les dix écrans de `06 Services` le
 * réemploient maintenant — ils ont les mêmes trois états obligatoires de T1, la
 * même raison d'être clients (le jeton vit en mémoire) et la même décision sur
 * `error.code`. Le RECOPIER aurait fait deux coquilles à corriger ensemble, et
 * l'histoire de `charger` dans les dépendances de l'effet aurait dû être réécrite
 * dans la seconde.
 *
 * Seul le texte d'attente n'était pas partageable : « Chargement de votre
 * compte… » est faux sur une liste d'annonces. Il devient donc un paramètre, dont
 * le DÉFAUT est celui du module Compte — ses dix pages n'ont pas bougé, et ce
 * défaut est ce qui le garantit plutôt qu'une relecture.
 */
export function EcranDonnees<T>(proprietes: {
  readonly charger: () => Promise<T>;
  readonly children: (donnees: T) => ReactNode;
  readonly attente?: string;
  /** Voir `bandeAttente` plus bas : l'écran dit lui-même qu'il attend. */
  readonly bandeAttente?: boolean;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE DESSIN, DISPONIBLE AVANT LA DONNÉE — ET IL EST OBLIGATOIRE            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il a d'abord été FACULTATIF, pour corriger quatre routes sans toucher aux
   * trente-deux autres. C'était une erreur, et la raison est mécanique : une
   * coquille vide répond `200`. Aucun test de statut ne la voit, aucun type ne la
   * refuse, rien ne rougit — on ne s'en aperçoit qu'en OUVRANT le produit, ce que
   * personne ne fait à chaque lot. C'est exactement ainsi que dix-huit routes
   * membre ont servi quatre mots pendant des lots entiers.
   *
   * Obligatoire, `tsc` refuse l'oubli au prochain écran branché. Le coût est un
   * objet de valeurs vides par écran ; le trou rouvert coûterait un lot entier.
   *
   * CE QU'IL DOIT PORTER : le DESSIN que la maquette calcule, et rien de plus —
   * des listes vides, des chaînes vides, et un TIRET CADRATIN là où un titre est
   * promu en `<h1>` ou sert de nom à un lien (axe-core refuse les deux vides, en
   * `serious`). Jamais un `0` qui se lirait comme un vrai compte, jamais une
   * valeur empruntée à quelqu'un d'autre.
   */
  readonly squelette: T;
}) {
  /**
   * ─── « RÉESSAYER » REMONTE LE CHARGEUR, IL NE REJOUE PAS L'APPEL ──────────
   *
   * La clé d'essai est posée sur le composant qui tient `useDonnees` : la changer
   * le DÉMONTE et le REMONTE, donc l'effet de chargement repart par le chemin
   * normal — celui qui a le garde de double montage, la dépendance `charger`
   * assumée et le traitement d'erreur. Un second chemin « rejouer l'appel ici »
   * aurait fait deux codes de chargement, dont un moins relu.
   *
   * Ce n'est pas un rechargement de page : `window.location.reload()` aurait
   * perdu l'état des autres composants montés — la fenêtre ouverte, le volet
   * courant, le défilement — pour une coupure réseau d'une seconde.
   */
  const [essai, setEssai] = useState(0);
  const reessayer = useCallback(() => setEssai((n) => n + 1), []);
  return <Chargement<T> key={essai} {...proprietes} onReessayer={reessayer} />;
}

function Chargement<T>({
  charger,
  children,
  attente = 'Chargement de votre compte…',
  bandeAttente = true,
  squelette,
  onReessayer,
}: {
  readonly charger: () => Promise<T>;
  readonly children: (donnees: T) => ReactNode;
  /**
   * LA PHRASE D'ATTENTE, parce que cette coquille sert désormais DEUX modules.
   *
   * Elle est née pour les dix écrans du Compte et dit « Chargement de votre
   * compte… » par défaut, ce qui reste exact pour eux et ne change rien à ce
   * qu'ils affichent. La messagerie, la recherche et les notifications
   * l'emploient aussi — le mécanisme est le même, et en écrire un second
   * donnerait deux traitements d'erreur à tenir à jour, donc un des deux faux.
   *
   * Mais afficher « Chargement de votre compte… » sur `/messages` serait un
   * texte d'interface faux, et un lecteur d'écran l'annoncerait tel quel. D'où ce
   * paramètre : il est FACULTATIF, son défaut est l'ancienne phrase mot pour mot,
   * et aucun appelant existant ne change de comportement.
   */  readonly attente?: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ QUAND L'ÉCRAN SAIT MIEUX QUE LA BANDE OÙ DIRE « ÇA CHARGE »             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, sur la recherche : « le loader qui dit que la recherche est en
   * cours est placé en bas. Mal placé. »
   *
   * Il a raison POUR CET ÉCRAN, et la bande a raison pour les quarante autres. Le
   * choix d'une bande fixe en bas est motivé juste au-dessus et il tient : une
   * attente dans le FLUX descendrait tout le cadre de sa hauteur, donc déplacerait
   * le dessin de la maquette à chaque chargement. Sur un écran de compte ou de
   * services, où le contenu est déjà dessiné et où l'attente ne concerne qu'un
   * rafraîchissement, c'est le bon compromis.
   *
   * LA RECHERCHE EST DIFFÉRENTE, et d'une façon qui se nomme : son cadre a un
   * ENDROIT VIDE qui attend justement cette réponse — la colonne de résultats. Y
   * mettre « Recherche en cours… » ne déplace rien, puisque la place est déjà là ;
   * et une phrase collée en bas de la fenêtre, à huit cents pixels de l'endroit
   * qu'on regarde, ne dit pas ce qu'elle veut dire.
   *
   * `true` par défaut : les quarante écrans qui emploient cette coquille ne
   * bougent pas d'un pixel. Celui qui passe `false` prend la charge de dire
   * lui-même qu'il attend — et s'il ne le fait pas, il n'affiche RIEN, ce qui est
   * pire. C'est pour cela que ce drapeau se déclare, et ne se devine pas.
   */
  readonly bandeAttente?: boolean;
  readonly squelette: T;
  readonly onReessayer: () => void;
}) {
  const etat = useDonnees(charger);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UN SEUL CHEMIN DE RENDU, ET LA BANDE EST UN FRÈRE DU CADRE               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `children(donnees)` est appelé TOUJOURS, avec la donnée si elle est là et le
   * squelette sinon. Il n'y a plus de retour anticipé, donc plus de branche où le
   * cadre pourrait disparaître — c'est ce qui rend la correction difficile à
   * défaire par accident.
   *
   * LA BANDE EST POSÉE EN FRÈRE, dans un fragment, JAMAIS EN PARENT. Un conteneur
   * intercalé entre la page et le cadre casserait le `position: sticky` de
   * l'en-tête de recherche et des deux colonnes — la règle que le porteur a
   * demandée et que `e2e/shell.spec.ts` garde. Et elle est en `position: fixed`,
   * donc elle ne déplace rien : une bande dans le flux descendrait tout le cadre
   * de sa hauteur à chaque chargement.
   */
  const donnees = etat.phase === 'prêt' ? etat.donnees : squelette;

  return (
    <>
      {children(donnees)}
      {etat.phase === 'attente' && bandeAttente ? <BandeAttente texte={attente} /> : null}
      {etat.phase === 'échec' ? (
        <BandeEchec erreur={etat.erreur} onReessayer={onReessayer} />
      ) : null}
    </>
  );
}
