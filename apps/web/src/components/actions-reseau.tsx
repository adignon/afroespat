'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ActionsReseauView } from '@/screens/a08t/vivant';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ACTIONS DE L'EN-TÊTE D'UN RÉSEAU — REJOINDRE · OPTIONS · GÉRER          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Remplace le bouton "Réseau automatique" par Rejoindre pour les
 * nouveaux et quand on est déjà dans le groupe c'est un bouton "Option" dropdown
 * qui va afficher sourdine et quitter le réseau […] Si c'est un modérateur le
 * bouton gérer à côté. »
 *
 * ── CE QUI EST TRANSCRIT, ET D'OÙ ─────────────────────────────────────────
 *
 * Aucune mesure n'est choisie ici. Les boutons reprennent la paire que la
 * maquette dessine à cette place — « Réseau automatique » et « Sourdine », 42 px,
 * rayon 14, `#F2F5F4` — sur ordinateur, et sa jumelle de 390 px (40 px, rayon 12,
 * `flex: 1`). Le bouton VERT est celui de « Créer un événement du réseau »
 * (`#16785E` / `#fff`), la seule action primaire que la planche dessine dans un
 * en-tête de réseau. Le menu est celui du menu de rôle de l'onglet « Membres » :
 * 240 px, rayon 18, entrées de 42 px.
 *
 * ── QUATRE VARIANTES, POUR QUATRE PLACES DESSINÉES ────────────────────────
 *
 *   · `bandeau` — la paire des planches d'ordinateur de la vue membre ;
 *   · `mobile`  — la paire de la planche de 390 px de A08 ;
 *   · `options` — à côté de « Gérer le réseau », sur les planches de l'équipe ;
 *   · `rond`    — le rond « ··· » (ou la roue) en haut à droite des planches
 *     de 390 px : tout passe par son menu, « Rejoindre » et « Gérer » compris,
 *     parce qu'il n'y a pas de place pour un second bouton.
 *
 * ── L'ÉTAT DU MENU EST LOCAL, ET C'EST VOULU ──────────────────────────────
 *
 * `ScreenFrames` rend les DEUX cadres et n'en masque qu'un. Un état partagé
 * ouvrirait le menu dans les deux à la fois — et sur A08 mobile, où la paire et
 * le rond coexistent, deux menus d'un coup. Chaque instance tient donc le sien ;
 * les GESTES, eux, viennent tous du crochet (`useReseau`), et les deux
 * confirmations (sourdine, départ) sont posées une seule fois par l'écran.
 */
export function ActionsReseau({
  actions,
  variante = 'bandeau',
  rondStyle,
  children,
}: {
  readonly actions: ActionsReseauView;
  readonly variante?: 'bandeau' | 'mobile' | 'options' | 'rond';
  readonly rondStyle?: CSSProperties;
  readonly children?: ReactNode;
}) {
  /**
   * L'ANCRE DU MENU, EN COORDONNÉES DE FENÊTRE — et c'est mesuré : l'en-tête du
   * réseau est une carte `overflow: hidden` (son bandeau de couverture a des
   * coins arrondis). Un menu `absolute` sous le bouton y était COUPÉ au bord de
   * la carte : seule sa première entrée paraissait, « Quitter le réseau »
   * restait invisible. Le menu est donc `fixed`, posé sous le bouton d'après sa
   * position au moment du clic — piège n° 6 du mémo, dans l'autre sens.
   */
  const [ancre, setAncre] = useState<{ top: number; right: number } | null>(null);
  const ouvert = ancre !== null;
  const basculer = (e: MouseEvent<HTMLButtonElement>): void => {
    if (ancre !== null) {
      setAncre(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setAncre({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };
  const setOuvert = (o: boolean): void => {
    if (!o) setAncre(null);
  };

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAncre(null);
    };
    // Un menu `fixed` ne suit pas la page : il se referme au défilement plutôt
    // que de flotter loin du bouton qui l'a ouvert.
    const surDefilement = (): void => {
      setAncre(null);
    };
    window.addEventListener('keydown', surTouche);
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => {
      window.removeEventListener('keydown', surTouche);
      window.removeEventListener('scroll', surDefilement);
    };
  }, [ouvert]);

  if (actions.etat === 'chargement') {
    // Rien n'est montré tant que la fiche n'est pas revenue : un « Rejoindre »
    // affiché une seconde à un membre serait une invitation à un double appel.
    return variante === 'rond' ? <span style={{ ...rondStyle, visibility: 'hidden' }} /> : null;
  }

  const mobile = variante === 'mobile';
  const base: CSSProperties = mobile
    ? {
        flex: '1',
        height: '40px',
        borderRadius: '12px',
        background: '#F2F5F4',
        color: '#16211D',
        fontSize: '12.5px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        border: 'none',
        font: 'inherit',
        cursor: 'pointer',
        textDecoration: 'none',
      }
    : {
        height: '42px',
        padding: '0 16px',
        borderRadius: '14px',
        background: '#F2F5F4',
        color: '#16211D',
        border: 'none',
        font: 'inherit',
        fontSize: '13px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        textDecoration: 'none',
      };
  const vert: CSSProperties = { ...base, background: '#16785E', color: '#fff' };
  const eteint: CSSProperties = { ...base, color: '#8A958F', cursor: 'default' };

  const entreesMenu =
    ancre === null ? null : (
      <Menu
        actions={actions}
        avecPorte={variante === 'rond'}
        ancre={ancre}
        onFermer={() => {
          setOuvert(false);
        }}
      />
    );

  if (variante === 'rond') {
    return (
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={ouvert}
          aria-label="Options du réseau"
          data-reseau-options=""
          onClick={basculer}
          style={{ ...rondStyle, border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
        >
          {children}
        </button>
        {entreesMenu}
      </span>
    );
  }

  // ── Les portes d'entrée : passant, demande, invitation, attente, fermé ───────
  if (actions.etat !== 'membre') {
    if (variante === 'options') return null;
    const porte =
      actions.etat === 'passant' ? (
        <button
          type="button"
          onClick={actions.onRejoindre}
          disabled={actions.occupe}
          data-reseau-rejoindre=""
          style={{ ...vert, opacity: actions.occupe ? 0.55 : 1 }}
        >
          Rejoindre
        </button>
      ) : actions.etat === 'demande' ? (
        <button
          type="button"
          onClick={actions.onRejoindre}
          disabled={actions.occupe}
          data-reseau-rejoindre=""
          style={{ ...vert, opacity: actions.occupe ? 0.55 : 1 }}
        >
          Demander à rejoindre
        </button>
      ) : actions.etat === 'invite' ? (
        <button
          type="button"
          onClick={actions.onRejoindre}
          disabled={actions.occupe}
          data-reseau-rejoindre=""
          style={{ ...vert, opacity: actions.occupe ? 0.55 : 1 }}
        >
          Accepter l’invitation
        </button>
      ) : actions.etat === 'attente' ? (
        <span style={eteint} data-reseau-attente="">
          Demande envoyée
        </span>
      ) : (
        <span style={eteint}>Sur invitation</span>
      );
    return porte;
  }

  // ── Membre : « Options », et « Gérer » à côté pour l'équipe ───────────────────
  return (
    <>
      <span style={{ position: 'relative', display: 'flex', ...(mobile ? { flex: '1' } : {}) }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={ouvert}
          data-reseau-options=""
          onClick={basculer}
          style={mobile ? { ...base, width: '100%' } : base}
        >
          Options
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {entreesMenu}
      </span>
      {actions.equipe && variante !== 'options' ? (
        <Link href={actions.hrefGerer} data-reseau-gerer="" style={base}>
          Gérer
        </Link>
      ) : null}
    </>
  );
}

const ENTREE: CSSProperties = {
  height: '42px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '0 12px',
  borderRadius: '12px',
  fontSize: '13.5px',
  fontWeight: 600,
  color: '#16211D',
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: 'none',
  width: '100%',
  background: 'none',
  textAlign: 'left',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

function Icone({ d, couleur = '#16211D' }: { readonly d: string; readonly couleur?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** Les tracés : la cloche de la barre haute, la roue de « Gérer », la sortie. */
const CLOCHE = 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0';
const CLOCHE_BARREE = 'M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8M10 20a2 2 0 0 0 4 0M3 3l18 18';
const ROUE =
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4';
const SORTIE = 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H4';
const PLUS = 'M12 5v14M5 12h14';

function Menu({
  actions,
  avecPorte,
  ancre,
  onFermer,
}: {
  readonly actions: ActionsReseauView;
  readonly avecPorte: boolean;
  readonly ancre: { readonly top: number; readonly right: number };
  readonly onFermer: () => void;
}) {
  const membre = actions.etat === 'membre';
  const rejoignable =
    actions.etat === 'passant' || actions.etat === 'demande' || actions.etat === 'invite';
  return (
    <>
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onFermer}
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: 39,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'default',
        }}
      />
      <div
        role="menu"
        data-reseau-menu=""
        style={{
          position: 'fixed',
          zIndex: 40,
          right: `${String(ancre.right)}px`,
          top: `${String(ancre.top)}px`,
          width: '240px',
          background: '#fff',
          border: '1px solid #E6EBE9',
          borderRadius: '18px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {avecPorte && rejoignable ? (
          <button
            type="button"
            role="menuitem"
            disabled={actions.occupe}
            onClick={() => {
              onFermer();
              actions.onRejoindre();
            }}
            data-reseau-rejoindre=""
            style={{ ...ENTREE, color: '#16785E' }}
          >
            <Icone d={PLUS} couleur="#16785E" />
            {actions.etat === 'invite'
              ? 'Accepter l’invitation'
              : actions.etat === 'demande'
                ? 'Demander à rejoindre'
                : 'Rejoindre le réseau'}
          </button>
        ) : null}
        {avecPorte && actions.etat === 'attente' ? (
          <span style={{ ...ENTREE, color: '#8A958F', cursor: 'default' }}>Demande envoyée</span>
        ) : null}
        {avecPorte && actions.etat === 'ferme' ? (
          <span style={{ ...ENTREE, color: '#8A958F', cursor: 'default' }}>Sur invitation</span>
        ) : null}
        {avecPorte && actions.equipe ? (
          <Link href={actions.hrefGerer} role="menuitem" data-reseau-gerer="" style={ENTREE}>
            <Icone d={ROUE} />
            Gérer le réseau
          </Link>
        ) : null}
        {membre ? (
          <button
            type="button"
            role="menuitem"
            disabled={actions.occupe}
            onClick={() => {
              onFermer();
              actions.onSourdine();
            }}
            data-reseau-sourdine=""
            style={ENTREE}
          >
            <Icone d={actions.sourdineActive ? CLOCHE : CLOCHE_BARREE} />
            {actions.sourdineActive ? 'Réactiver les notifications' : 'Mettre en sourdine'}
          </button>
        ) : null}
        {membre && actions.peutQuitter ? (
          <button
            type="button"
            role="menuitem"
            disabled={actions.occupe}
            onClick={() => {
              onFermer();
              actions.onQuitter();
            }}
            data-reseau-quitter=""
            style={{ ...ENTREE, color: '#B4581F' }}
          >
            <Icone d={SORTIE} couleur="#B4581F" />
            Quitter le réseau
          </button>
        ) : null}
      </div>
    </>
  );
}
