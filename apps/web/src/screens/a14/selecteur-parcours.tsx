'use client';

import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';
import type { EtapeVue, ParcoursVue } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SÉLECTEUR DE PARCOURS — LE SEUL DESSIN DE CE LOT, ET IL EST EMPRUNTÉ    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, mot pour mot : « il faut un bouton sélectionner un parcours (avec un
 * chevron right à la fin qui affiche un modal dans la page avec les parcours et leur
 * description et on peut sélectionner) qui va afficher la liste des parcours
 * disponible et il sélectionne un, ainsi les étapes par rapport à ce parcours
 * s'affiche dans la liste des étapes. »
 *
 * ── POURQUOI CE FICHIER EXISTE, ALORS QUE RIEN NE SE DESSINE À LA MAIN ──────
 *
 * La règle du porteur est « NE RÉÉCRIS JAMAIS LA MAQUETTE : tout passe par
 * `tools/screens/*.mjs` ». Elle tient tant que le contrôle EST dessiné quelque part.
 * Celui-ci ne l'est pas : la maquette de A14 ne dessine ni ce bouton ni cette
 * fenêtre, et le transcodeur ne peut pas transformer ce qui n'existe pas. Il n'y
 * avait que trois issues, et il faut dire pourquoi c'est celle-ci :
 *
 *   · ÉCRIRE DANS `docs/template/` — interdit, `docs/` est en lecture seule ;
 *   · DÉCLARER LE DESSIN DANS `donnees` — refusé par le troisième contrôle
 *     d'`applyData`, et à raison : « ce qui reste de `devient` […] doit être fait de
 *     fragments DESSINÉS DANS `noeud` ». Un bouton qui n'est nulle part n'y est pas,
 *     et forcer le passage demanderait de déclarer tout son balisage en `texte`,
 *     c'est-à-dire de faire passer du dessin pour une phrase du porteur ;
 *   · ÉCRIRE LE DESSIN ICI, EN EMPRUNTANT CHAQUE VALEUR. C'est ce qui est fait, et
 *     la discipline est celle d'`applyBorrows` : chaque nombre, chaque couleur et
 *     chaque tracé porte en commentaire L'ENDROIT de la maquette d'où il vient. Le
 *     transcodeur, lui, ne fait que ménager la place (`{{ parcoursSelecteur }}`,
 *     posé au-dessus de la liste d'étapes — là où le porteur l'a demandé).
 *
 * AUCUNE VALEUR N'EST INVENTÉE, et le seul texte qui ne vient d'aucune planche est
 * « Sélectionner un parcours » — ce sont les mots du porteur, cités ci-dessus.
 * « Choisir un parcours » aurait été une invention ; sa phrase n'en est pas une.
 *
 * ── LA FENÊTRE EST CELLE DU MODULE, PAS UNE NOUVELLE ───────────────────────
 *
 * « Pour le modal, reprends la forme des fenêtres existantes du module. » La forme
 * est donc celle de A01P (« Partager »), DESSINÉE DANS LA MÊME MAQUETTE
 * (`03 Accueil v2.dc.html`) et montée par le même composant `Modal` que les sept
 * autres fenêtres du dépôt — voile, feuille du bas sur téléphone, fenêtre centrée de
 * 520 px sur ordinateur, poignée, croix. Le comportement (Échap, piège au clavier,
 * retour du focus, blocage du défilement) n'est pas réécrit : il est déjà là.
 *
 * ── LE BOUTON ET LA FENÊTRE SONT DEUX EXPORTS, ET C'EST UNE NÉCESSITÉ ──────
 *
 * `ScreenFrames` rend LES DEUX cadres et masque l'un en CSS : tout ce qui voyage
 * dans les prises existe donc DEUX fois dans le document. Si la fenêtre partait avec
 * le bouton, deux `Modal` s'ouvriraient, et `modal.tsx` dit exactement ce que ça
 * coûte : « deux fois le même `id` dans un document rend `aria-labelledby` ambigu
 * […] La boîte de dialogue perdrait son nom ».
 *
 * Le bouton voyage donc dans les cadres (dédoublé, sans identifiant, ce qui est sans
 * conséquence) et la fenêtre est montée UNE FOIS par la page, à côté de
 * `ScreenFrames`. C'est la même séparation que pour le sélecteur de fichier.
 */

/** L'identifiant du titre de la fenêtre, pour son `aria-labelledby`. */
const TITRE_ID = 'a14p-titre';

/** Celui de la fenêtre des ÉTAPES — deux fenêtres, deux noms, jamais le même id. */
const TITRE_ETAPE_ID = 'a14e-titre';

/**
 * LE BOUTON, posé au-dessus de la liste d'étapes.
 *
 * Sa boîte est celle d'une LIGNE D'ÉTAPE NON CHOISIE du même panneau — la maquette
 * de A14 l'écrit dans son `renderVals()` (`bg: a.on?'#E3F0EB':'#fff'`,
 * `bd: a.on?'1.5px solid #16785E':'1px solid #E6EBE9'`) et dans son balisage
 * (`display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px`).
 * C'est voulu : ce bouton COMMANDE cette liste, il doit lui appartenir à l'œil.
 *
 * Le libellé reprend le style du titre d'une ligne d'étape
 * (`font-size:14px;font-weight:700`), et la seconde ligne celui de son sous-titre
 * (`font-size:12px;color:#5D6B66;margin-top:1px`).
 *
 * LE CHEVRON EST CELUI DE LA MAQUETTE, verbatim : `03 Accueil v2.dc.html` dessine
 * `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A958F"
 * stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>`. Sa
 * teinte, `#8A958F`, est celle des étiquettes de ce panneau (« MON PARCOURS · … »,
 * « SUJETS »), donc elle ne crée aucune paire de contraste nouvelle.
 */
export function BoutonParcours({
  nom,
  onOuvrir,
}: {
  /** Le parcours choisi, ou `null` : la seconde ligne le dit. */
  readonly nom: string | null;
  readonly onOuvrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-haspopup="dialog"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '16px',
        background: '#fff',
        border: '1px solid #E6EBE9',
        fontFamily: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ flex: '1', minWidth: '0' }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>
          Sélectionner un parcours
        </span>
        <span
          style={{ display: 'block', fontSize: '12px', color: '#5D6B66', marginTop: '1px' }}
        >
          {nom ?? 'Aucun pour l’instant'}
        </span>
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8A958F"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

/**
 * UNE LIGNE DE LA FENÊTRE — un type de parcours, avec son détail et sa coche.
 *
 * Même boîte que la ligne d'étape de A14, coche comprise : `width:24px;height:24px;
 * border-radius:999px` sur `#16785E` quand elle est choisie, et le tracé
 * `m5 12 4.5 4.5L19 7` que la maquette dessine dedans.
 */
function LigneParcours({
  p,
  onChoisir,
}: {
  readonly p: ParcoursVue;
  readonly onChoisir: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoisir(p.id)}
      aria-pressed={p.on}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '16px',
        background: p.on ? '#E3F0EB' : '#fff',
        border: p.on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
        fontFamily: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ flex: '1', minWidth: '0' }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{p.nom}</span>
        <span
          style={{ display: 'block', fontSize: '12px', color: '#5D6B66', marginTop: '1px' }}
        >
          {p.detail}
        </span>
      </span>
      <span
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '999px',
          background: p.on ? '#16785E' : '#fff',
          border: p.on ? 'none' : '1.5px solid #CBD5D1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      </span>
    </button>
  );
}

/**
 * LE CORPS DE LA FENÊTRE, partagé par ses deux formes.
 *
 * ── TROIS ÉTATS, ET AUCUN N'EST SILENCIEUX ────────────────────────────────
 *
 * Une liste qui n'arrive pas, une liste vide et une liste pleine ne se ressemblent
 * pas, et confondre les deux premières est le défaut qui fait croire à un écran
 * cassé. Les deux phrases d'attente et d'absence sont écrites ici, et il faut le
 * dire : aucune maquette ne les dessine, parce qu'aucune maquette ne dessine cette
 * fenêtre. Elles sont volontairement sèches et factuelles.
 */
function CorpsParcours({
  parcours,
  charge,
  erreur,
  onChoisir,
}: {
  readonly parcours: readonly ParcoursVue[];
  readonly charge: boolean;
  readonly erreur: string | null;
  readonly onChoisir: (id: string) => void;
}) {
  if (erreur !== null) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: '#5D6B66' }} role="alert">
        {erreur}
      </p>
    );
  }
  if (charge) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: '#5D6B66' }}>
        Chargement des parcours…
      </p>
    );
  }
  if (parcours.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: '#5D6B66' }}>
        Aucun parcours n’est proposé pour votre pays.
      </p>
    );
  }
  return (
    <>
      {parcours.map((p) => (
        <LigneParcours key={p.id} p={p} onChoisir={onChoisir} />
      ))}
    </>
  );
}

/**
 * LA FENÊTRE — « fenêtre sur web, feuille sur mobile », comme les sept autres.
 *
 * Les deux coques sont celles de A01P, de la MÊME maquette (`03 Accueil v2.dc.html`,
 * section A01P, les deux planches) :
 *
 *   · le voile — `position:fixed;inset:0;background:rgba(22,33,29,.55)` ;
 *   · la feuille — `position:fixed;left:0;right:0;bottom:0;background:#fff;
 *     border-radius:28px 28px 0 0;padding:10px 18px 28px;display:flex;
 *     flex-direction:column;gap:16px`, et sa poignée de 40 × 5 px en `#DDE3E0` ;
 *   · la fenêtre — `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
 *     width:520px;background:#fff;border-radius:28px;padding:24px;display:flex;
 *     flex-direction:column;gap:18px`, son titre en 20 px / 800 et sa croix de
 *     40 px sur `#F2F5F4` portant le tracé `M18 6 6 18M6 6l12 12`.
 *
 * `data-modal-overlay`, `data-modal-panel` et `data-modal-close` sont les attributs
 * que `Modal` écoute : la fermeture est DÉLÉGUÉE, exactement comme pour les fenêtres
 * transcodées, et aucun `onClick` de fermeture n'est écrit ici.
 */
export function FenetreParcours({
  ouvert,
  onFermer,
  onChoisir,
  parcours,
  charge,
  erreur,
}: {
  readonly ouvert: boolean;
  readonly onFermer: () => void;
  readonly onChoisir: (id: string) => void;
  readonly parcours: readonly ParcoursVue[];
  readonly charge: boolean;
  readonly erreur: string | null;
}) {
  const corps = (
    <CorpsParcours
      parcours={parcours}
      charge={charge}
      erreur={erreur}
      onChoisir={onChoisir}
    />
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE PANNEAU EST MAINTENANT `PanneauFenetre`, ET PLUS DU DESSIN À LA MAIN  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Les deux coques écrites ici n'avaient NI `maxHeight` NI défilement : six
   * parcours et leurs descriptions poussaient le titre hors de l'écran et le bas
   * du panneau hors d'atteinte. Le porteur l'a vu, et a demandé un composant
   * réutilisable plutôt qu'un rustine de plus.
   *
   * `PanneauFenetre` porte exactement le même dessin — c'est celui de A01P,
   * emprunté à la même maquette — et il range en plus les trois zones : en-tête
   * fixe, contenu qui défile, actions fixes.
   */
  return (
    <Modal
      open={ouvert}
      onClose={onFermer}
      titleId={TITRE_ID}
      name="A14P"
      desktop={
        <PanneauFenetre titreId={TITRE_ID} titre="Sélectionner un parcours">
          {corps}
        </PanneauFenetre>
      }
      mobile={
        <PanneauFenetre titreId={TITRE_ID} titre="Sélectionner un parcours" feuille>
          {corps}
        </PanneauFenetre>
      }
    />
  );
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAPE SE CHOISIT DANS UNE FENÊTRE, COMME LE PARCOURS                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour la section "MON PARCOURS" avec la section des étapes je
 * propose de faire comme la section qui le précède et mettre un chevron et
 * afficher un modal de sélection d'une étape. »
 *
 * C'est donc EXACTEMENT le même contrôle que le sélecteur de parcours posé juste
 * au-dessus — même bouton, même chevron, même fenêtre, même `Modal`. Il n'y avait
 * rien à dessiner : il y avait à réemployer.
 *
 * ── CE QUE ÇA REMPLACE, ET POURQUOI C'EST MIEUX ───────────────────────────
 *
 * La liste était posée à plat dans le panneau : quinze étapes, dont certaines
 * portent une description de quatre lignes. Elle occupait tout l'écran et
 * repoussait les sujets et le bouton « Continuer » hors de vue — c'est d'ailleurs
 * ce qui avait rendu le défilement du panneau nécessaire. Dans une fenêtre, elle
 * défile chez elle.
 */
export function BoutonEtape({
  nom,
  onOuvrir,
}: {
  /** L'étape retenue, ou `null` : la seconde ligne le dit. */
  readonly nom: string | null;
  readonly onOuvrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-haspopup="dialog"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '16px',
        background: '#fff',
        border: '1px solid #E6EBE9',
        fontFamily: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ flex: '1', minWidth: '0' }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>
          Sélectionner une étape
        </span>
        <span
          style={{ display: 'block', fontSize: '12px', color: '#5D6B66', marginTop: '1px' }}
        >
          {nom ?? 'Aucune pour l’instant'}
        </span>
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8A958F"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

/** Une ligne d'étape — celle que la maquette dessine dans le panneau, verbatim. */
function LigneEtape({
  etape,
  onChoisir,
}: {
  readonly etape: EtapeVue;
  readonly onChoisir: (stepDefinitionId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoisir(etape.stepDefinitionId)}
      aria-pressed={etape.on}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '16px',
        background: etape.bg,
        border: etape.bd,
        fontFamily: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ flex: '1', minWidth: '0' }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{etape.t}</span>
        {etape.s !== '' && (
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              color: '#5D6B66',
              marginTop: '1px',
              lineHeight: '1.45',
            }}
          >
            {etape.s}
          </span>
        )}
      </span>
      <span
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '999px',
          background: etape.cBg,
          border: etape.cBd,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      </span>
    </button>
  );
}

export function FenetreEtape({
  ouvert,
  onFermer,
  onChoisir,
  etapes,
  recherche,
  onRecherche,
}: {
  readonly ouvert: boolean;
  readonly onFermer: () => void;
  readonly onChoisir: (stepDefinitionId: string) => void;
  readonly etapes: readonly EtapeVue[];
  readonly recherche: string;
  readonly onRecherche: (event: { target: { value: string } }) => void;
}) {
  /**
   * LA RECHERCHE SUIT L'ÉTAPE DANS SA FENÊTRE. La planche la dessine au-dessus
   * des deux listes et promet de chercher « une étape OU un sujet » ; les sujets
   * restent dans le panneau, les étapes partent ici, donc le champ les suit. Sa
   * boîte est celle de la planche, verbatim.
   */
  const corps = (
    <>
      <div
        style={{
          height: '44px',
          borderRadius: '999px',
          background: '#F2F5F4',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#8A958F',
          flexShrink: 0,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          value={recherche}
          onChange={onRecherche}
          placeholder="Rechercher une étape"
          aria-label="Rechercher une étape"
          data-saisie-sur-gris=""
          style={{
            flex: '1',
            minWidth: '0',
            border: 'none',
            background: 'transparent',
            font: 'inherit',
            color: '#16211D',
            outline: 'none',
            padding: 0,
          }}
        />
      </div>
      <div
        style={{
          flex: '1',
          minHeight: '0',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {etapes.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#5D6B66' }}>
            Aucune étape ne correspond.
          </p>
        ) : (
          etapes.map((e) => (
            <LigneEtape key={e.stepDefinitionId} etape={e} onChoisir={onChoisir} />
          ))
        )}
      </div>
    </>
  );

  /**
   * MÊME COQUE QUE LE SÉLECTEUR DE PARCOURS, et pour la même raison : quinze
   * étapes, dont certaines portent quatre lignes de description, poussaient le
   * titre hors de l'écran. `PanneauFenetre` range les trois zones ; le champ de
   * recherche défile AVEC la liste parce qu'il lui appartient — c'est la planche
   * qui le pose au-dessus des listes, pas en en-tête.
   */
  return (
    <Modal
      open={ouvert}
      onClose={onFermer}
      titleId={TITRE_ETAPE_ID}
      name="A14E"
      desktop={
        <PanneauFenetre titreId={TITRE_ETAPE_ID} titre="Sélectionner une étape">
          {corps}
        </PanneauFenetre>
      }
      mobile={
        <PanneauFenetre titreId={TITRE_ETAPE_ID} titre="Sélectionner une étape" feuille>
          {corps}
        </PanneauFenetre>
      }
    />
  );
}
