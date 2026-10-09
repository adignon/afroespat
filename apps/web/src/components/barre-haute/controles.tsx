'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useCompteursBarre } from './compteurs';
import { FenetreRaccourcis } from './raccourcis';
import { PanneauSuggestions, useSuggestions } from './suggestions';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES QUATRE CONTRÔLES DE LA BARRE HAUTE                                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Corrige la top bar qui n'est pas du tout dynamique en termes de
 * données, de liens et autres, donc simplement non fonctionnelle. »
 *
 * MESURÉ : la barre ne portait qu'un seul nœud nommé, le mot « Diaspora ». La
 * recherche était un `<div>` de texte, le `+` et les deux icônes des `<span>`
 * sans geste, et la pastille d'alerte était peinte en dur.
 *
 * ── POURQUOI CES COMPOSANTS REÇOIVENT LEUR STYLE ──────────────────────────
 *
 * La barre est dessinée dans SOIXANTE-CINQ planches, et leurs styles ne sont pas
 * tous identiques au pixel — quelques écrans changent une couleur de fond ou un
 * écart. Si ces composants portaient leur propre dessin, la génération
 * remplacerait soixante-cinq dessins par un seul, et les écarts voulus par la
 * maquette disparaîtraient sans qu'on le voie.
 *
 * Le transcodeur passe donc le style DESSINÉ tel quel, et ces composants n'y
 * ajoutent que ce qu'un `<span>` n'a pas : un rôle, un nom, un geste, et les
 * remises à zéro qu'un `<button>` exige.
 */

/** Ce qu'un `<button>` ou un `<a>` doit défaire du style d'un `<span>`. */
const RESET: CSSProperties = {
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  textDecoration: 'none',
  cursor: 'pointer',
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE CHAMP DE RECHERCHE — UN `<form>` QUI SE SUFFIT                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Il mène à `/recherche?q=…`, route qui existe et que `GET /search` sert.
 *
 * ── PAS DE `useRouter`, ET C'EST UNE LEÇON MESURÉE ────────────────────────
 *
 * La première version poussait l'adresse avec le routeur, pour éviter un
 * rechargement. Elle a fait tomber `declencheur.test.tsx` D'UN SEUL COUP :
 * « invariant expected app router to be mounted ». Ce test rend un écran généré
 * dans jsdom, sans contexte de routeur — et il ne collectait plus AUCUN cas, le
 * total passant de 336 à 324 sans qu'une assertion rougisse.
 *
 * Un `<form method="get">` fait exactement ce qu'il faut, sans contexte, sans
 * JavaScript, et avec le comportement que tout le monde attend d'une barre de
 * recherche : la touche Entrée emmène sur la page des résultats. La navigation
 * est complète plutôt que côté client — on CHANGE de page, c'est le geste même.
 *
 * ── ET MAINTENANT IL PROPOSE PENDANT QU'ON TAPE ───────────────────────────
 *
 * Le porteur : « Lorsqu'on tape dans le champ, les propositions sous l'input
 * doivent s'afficher et permettre d'aller directement sur un élément. » Le
 * mécanisme — frein, requête périmée jetée, seuil partagé — est dans
 * `suggestions.tsx` ; ce qui est ici, c'est le clavier et la fermeture.
 *
 * LA FLÈCHE BASSE PUIS ENTRÉE N'ENVOIE PAS LE FORMULAIRE, elle ouvre l'élément
 * désigné. Sans `preventDefault`, les deux partiraient : la page de résultats
 * d'abord, puis l'élément — ou l'inverse, selon le navigateur.
 *
 * `window.location.assign` ET NON `useRouter` : c'est la leçon mesurée ci-dessus,
 * et elle vaut toujours. Ce composant est rendu dans douze tests qui n'ont pas de
 * contexte de routeur ; une navigation complète est d'ailleurs ce que le formulaire
 * fait déjà de son côté, donc les deux chemins se comportent pareil.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ DEUX PRISES FACULTATIVES, POUR LA PAGE DE RECHERCHE DU TÉLÉPHONE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le top button de recherche sur mobile ne marche pas. Ça doit
 * afficher une page de recherche et un input en haut pour le texte avec un
 * bouton de recherche qui permettra de lancer la recherche. »
 *
 * `valeurInitiale` — la barre haute part TOUJOURS vide, et c'est juste : on y
 * tape une nouvelle recherche. Sur `/recherche?q=lyon`, le même champ vide
 * effacerait la requête qu'on vient de faire, et la page afficherait des
 * résultats pour un mot que son champ ne montre plus.
 *
 * `avecBouton` — à 1440 px, la touche Entrée suffit et la maquette ne dessine
 * aucun bouton. Sur un téléphone, le clavier logiciel montre bien une loupe,
 * mais le porteur demande un bouton VISIBLE, et il a raison : rien à l'écran ne
 * disait comment lancer la recherche. Les deux prises sont facultatives pour que
 * les soixante-cinq barres hautes déjà posées ne changent pas d'un pixel.
 */
export function ChampRecherche({
  style,
  valeurInitiale = '',
  avecBouton = false,
}: {
  readonly style: CSSProperties;
  readonly valeurInitiale?: string;
  readonly avecBouton?: boolean;
}) {
  const [texte, setTexte] = useState(valeurInitiale);
  const [ouvert, setOuvert] = useState(false);
  const [designe, setDesigne] = useState(-1);
  const propositions = useSuggestions(texte);
  const visibles = ouvert ? propositions : [];

  const adresseDe = (i: number): string | null => {
    const s = visibles[i];
    if (s === undefined) return null;
    return s.url ?? `/recherche?q=${encodeURIComponent(s.title)}`;
  };

  return (
    <form
      action="/recherche"
      method="get"
      style={{ ...style, position: 'relative' }}
      role="search"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOuvert(false);
          setDesigne(-1);
          return;
        }
        if (visibles.length === 0) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setDesigne((d) => (d + 1) % visibles.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setDesigne((d) => (d <= 0 ? visibles.length - 1 : d - 1));
          return;
        }
        if (event.key === 'Enter' && designe >= 0) {
          const vers = adresseDe(designe);
          if (vers !== null) {
            event.preventDefault();
            window.location.assign(vers);
          }
        }
      }}
      /**
       * LA FERMETURE AU DÉPART DU FOYER, et le `relatedTarget` n'est pas un détail :
       * cliquer une proposition déplace le foyer DANS le panneau, donc `blur` part
       * avant le `click`. Fermer sans regarder où va le foyer démonterait le lien
       * avant qu'il soit suivi — la proposition serait inatteignable à la souris.
       */
      onBlur={(event) => {
        const vers = event.relatedTarget;
        if (vers instanceof Node && event.currentTarget.contains(vers)) return;
        setOuvert(false);
        setDesigne(-1);
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4" />
      </svg>
      <input
        /**
         * ╔══════════════════════════════════════════════════════════════════════╗
         * ║ `text` ET NON `search` — POUR DESSINER LA CROIX NOUS-MÊMES          ║
         * ╚══════════════════════════════════════════════════════════════════════╝
         *
         * Le porteur : « pour l'icône "x" que tu mets dans le champ recherche,
         * c'est pas beau, c'est un emoji » — puis : « non, utilise les icônes de
         * Feather comme j'ai dit ».
         *
         * Je n'avais posé AUCUNE icône : c'est le navigateur qui dessine son
         * bouton d'effacement sur `type="search"`, et il le dessine comme il veut,
         * d'un navigateur à l'autre. On ne peut ni le styler ni le remplacer.
         *
         * On ne demande donc plus ce type, et la croix est dessinée juste en
         * dessous — en Feather, comme les cinquante et une autres croix du dépôt.
         */
        type="text"
        name="q"
        value={texte}
        onChange={(event) => {
          setTexte(event.target.value);
          setOuvert(true);
          setDesigne(-1);
        }}
        onFocus={() => setOuvert(true)}
        placeholder="Rechercher dans la diaspora"
        aria-label="Rechercher dans la diaspora"
        role="combobox"
        aria-expanded={visibles.length > 0}
        /**
         * `aria-controls` SEULEMENT QUAND LE PANNEAU EXISTE.
         *
         * Un `aria-controls` qui désigne un identifiant absent est une violation
         * (`aria-valid-attr-value`) : le lecteur d'écran annonce un contrôle qui
         * pilote quelque chose d'introuvable. Le panneau n'est monté que s'il y a
         * des propositions — voir `PanneauSuggestions` — donc l'attribut suit.
         */
        {...(visibles.length > 0 ? { 'aria-controls': 'barre-recherche-propositions' } : {})}
        aria-autocomplete="list"
        autoComplete="off"
        data-saisie-sur-gris=""
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          color: '#16211D',
          outline: 'none',
          padding: 0,
        }}
      />
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ EFFACER — LA CROIX DE FEATHER, CELLE DE TOUT LE DÉPÔT                ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * `x` de Feather : deux segments croisés dans une boîte de 24, trait de 2,
       * bouts arrondis. C'est EXACTEMENT le tracé que les planches emploient déjà
       * pour leurs cinquante et une croix de fermeture — la maquette est dessinée
       * sur cette grammaire, et la croix d'effacement la rejoint plutôt que d'en
       * inventer une.
       *
       * Elle n'apparaît QUE s'il y a quelque chose à effacer : une croix sur un
       * champ vide propose un geste sans effet.
       */}
      {texte === '' ? null : (
        <button
          type="button"
          onClick={() => setTexte('')}
          aria-label="Effacer la recherche"
          data-recherche-effacer=""
          style={{
            width: '24px',
            height: '24px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: '#8A958F',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      {/**
       * LE BOUTON DE RECHERCHE — le rond vert de 44 px que les maquettes
       * dessinent pour toute action d'envoi (l'envoi de commentaire de A01C
       * mobile en est le dessin exact : `44px / 999px / #16785E`). On ne dessine
       * donc pas un bouton de plus : on reprend celui du système.
       *
       * `type="submit"` : il envoie le formulaire, exactement comme la touche
       * Entrée. Aucun chemin de navigation en double.
       */}
      {avecBouton ? (
        <button
          type="submit"
          aria-label="Lancer la recherche"
          data-recherche-lancer=""
          style={{
            width: '44px',
            height: '44px',
            flexShrink: 0,
            borderRadius: '999px',
            background: '#16785E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            padding: 0,
            marginRight: '-12px',
            cursor: 'pointer',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
      ) : null}
      <PanneauSuggestions
        items={visibles}
        requete={texte}
        indexActif={designe}
        surChoix={() => {
          setOuvert(false);
          setDesigne(-1);
        }}
      />
    </form>
  );
}

/**
 * LE « + ». Il ouvre la fenêtre de raccourcis — « c'est donc un raccourci », dit
 * le porteur — et n'emmène nulle part de lui-même.
 */
export function BoutonCreer({ style, children }: {
  readonly style: CSSProperties;
  readonly children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Créer"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        data-barre-creer=""
        style={{ ...style, ...RESET }}
      >
        {children}
      </button>
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LA FENÊTRE N'EXISTE QUE SI ON L'A OUVERTE                           ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Deux raisons, et la seconde est une mesure.
       *
       * D'abord le bon sens : ce bouton est sur SOIXANTE-CINQ planches. Monter une
       * boîte de dialogue fermée sur chaque page du produit, avec son piège de
       * tabulation et son écoute de la largeur, est un coût que personne n'a
       * demandé.
       *
       * Ensuite la mesure : `Modal` lit `window.matchMedia` DÈS SON MONTAGE, pour
       * choisir entre la feuille du bas et la fenêtre centrée. jsdom ne l'implémente
       * pas, et `declencheur.test.tsx` — qui rend un écran généré — tombait d'un
       * coup : « window.matchMedia is not a function », zéro cas collecté. Le jour
       * où un autre composant en aura besoin dans un test, c'est à la configuration
       * de vitest de le fournir ; ici, il n'y a simplement rien à monter.
       */}
      {ouvert ? <FenetreRaccourcis ouvert onFermer={() => setOuvert(false)} /> : null}
    </>
  );
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX ICÔNES À PASTILLE — ET LA PASTILLE DISAIT N'IMPORTE QUOI         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine la pastille orange EN DUR, sur l'icône des messages. Elle
 * annonçait donc du non-lu à tout le monde, y compris à un compte neuf qui n'a
 * jamais reçu un message. C'est le même défaut que « 890 membres » sur l'en-tête
 * de réseau : un exemple de maquette pris pour une donnée.
 *
 * Elle n'est plus peinte que s'il y a quelque chose à annoncer, et elle PORTE LE
 * NOMBRE dans le nom accessible du lien — une pastille de neuf pixels ne dit rien
 * à un lecteur d'écran.
 */
export type FormePastille = 'point' | 'nombre';

export function LienAvecPastille({ style, vers, nom, compte, forme, children }: {
  readonly style: CSSProperties;
  readonly vers: string;
  readonly nom: string;
  readonly compte: number;
  /**
   * LA FORME QUE LA PLANCHE DESSINE. Les maquettes en emploient DEUX pour la
   * même idée : un point de neuf pixels, et une capsule portant un nombre. Le
   * transcodeur relève celle du nœud qu'il remplace et la passe ici — on ne
   * choisit pas à sa place, et le fil garde sa capsule chiffrée là où il en
   * dessine une.
   */
  readonly forme: FormePastille;
  readonly children: ReactNode;
}) {
  const etiquette = compte > 0 ? `${nom} — ${String(compte)} non lus` : nom;

  return (
    <Link href={vers} aria-label={etiquette} style={{ ...style, ...RESET }} data-barre-lien={vers}>
      {children}
      {compte > 0 ? (
        <span
          aria-hidden="true"
          data-barre-pastille={forme}
          style={
            forme === 'nombre'
              ? {
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 5px',
                  borderRadius: '999px',
                  background: '#E0733A',
                  color: '#fff',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #F6F8F7',
                }
              : {
                  position: 'absolute',
                  top: '2px',
                  right: '3px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '999px',
                  background: '#E0733A',
                  border: '2px solid #F6F8F7',
                }
          }
        >
          {/* `99+` : au-delà, la capsule s'allongerait jusqu'à sortir de l'icône. */}
          {forme === 'nombre' ? (compte > 99 ? '99+' : String(compte)) : null}
        </span>
      ) : null}
    </Link>
  );
}

/** L'icône des messages, avec son compte réel. */
export function LienMessages({ style, forme, children }: {
  readonly style: CSSProperties;
  readonly forme: FormePastille;
  readonly children: ReactNode;
}) {
  const { messages } = useCompteursBarre();
  return (
    <LienAvecPastille
      style={style}
      vers="/messages"
      nom="Messages"
      compte={messages}
      forme={forme}
    >
      {children}
    </LienAvecPastille>
  );
}

/** L'icône des notifications, avec son compte réel. */
export function LienNotifications({ style, forme, children }: {
  readonly style: CSSProperties;
  readonly forme: FormePastille;
  readonly children: ReactNode;
}) {
  const { notifications } = useCompteursBarre();
  return (
    <LienAvecPastille
      style={style}
      vers="/notifications"
      nom="Notifications"
      compte={notifications}
      forme={forme}
    >
      {children}
    </LienAvecPastille>
  );
}
