'use client';

import type { ReactNode } from 'react';
import {
  GEOMETRIES,
  PanneauDeSection,
  PhrasePanneau,
  type GeometriePanneau,
} from './panneau-section';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CHOISIR SA VILLE — O02, DANS LE MÊME PANNEAU QUE LE PAYS                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La sélection de ville : utilise le panneau aussi. »
 *
 * ── CE QUE ÇA REMPLACE ────────────────────────────────────────────────────
 *
 * La planche pose, sous « Où vivez-vous ? », un champ de recherche et une liste
 * à plat. Ça marchait, et ça ne ressemblait plus au reste : le pays d'origine
 * juste au-dessus s'ouvre dans un panneau depuis que le porteur l'a demandé, et
 * deux manières de choisir un lieu sur le MÊME écran est précisément ce qu'il
 * corrige depuis plusieurs tours.
 *
 * Le champ de recherche N'EST PAS PERDU : il passe DANS le panneau, à sa taille
 * et avec sa loupe. C'est le même contrôle, déplacé — pas un nouveau.
 *
 * ── TOUT EST EMPRUNTÉ, Y COMPRIS LES LIGNES ──────────────────────────────
 *
 * La coque, le bouton de retour, le titre et la boîte de liste viennent de
 * `panneau-section.tsx`, qui les tient de cette même planche. Les LIGNES sont
 * celles que O02 dessine déjà pour ses villes, verbatim : 48 px sur ordinateur et
 * 46 px sur téléphone, rayon 12, `#E3F0EB` pour la ligne retenue, le nom en
 * 14 px / 600 et la pastille de droite en 12 px / 700 — « 128 membres » quand le
 * réseau est ouvert, aucune pastille sinon.
 */

/** Ce que l'écran sait d'une ville, une fois peinte. */
export interface VilleVue {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
  readonly bg: string;
  readonly fg: string;
  readonly metaFg: string;
  readonly metaBg: string;
  readonly onPick: () => void;
}

/** Une ligne de ville — celle de O02, à l'identique. */
function LigneVille({
  ville,
  retenue,
  geometrie,
}: {
  readonly ville: VilleVue;
  readonly retenue: boolean;
  readonly geometrie: GeometriePanneau;
}) {
  return (
    <button
      type="button"
      onClick={ville.onPick}
      aria-pressed={retenue}
      style={{
        ...geometrie.ligne,
        display: 'flex',
        alignItems: 'center',
        borderRadius: '12px',
        background: ville.bg,
        color: ville.fg,
        border: 'none',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        flexShrink: 0,
      }}
    >
      <span style={{ flex: '1', minWidth: '0', fontSize: '14px', fontWeight: 600 }}>
        {ville.name}
      </span>
      {ville.meta === '' ? null : (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: ville.metaFg,
            background: ville.metaBg,
            padding: '4px 10px',
            borderRadius: '999px',
            flexShrink: 0,
          }}
        >
          {ville.meta}
        </span>
      )}
    </button>
  );
}

export function SelecteurVille({
  ouvert,
  villes,
  villeId,
  recherche,
  onRecherche,
  variante,
  onFermer,
}: {
  readonly ouvert: boolean;
  readonly villes: readonly VilleVue[];
  readonly villeId: string | null;
  readonly recherche: string;
  readonly onRecherche: (event: { target: { value: string } }) => void;
  readonly variante: 'desktop' | 'mobile';
  readonly onFermer: () => void;
}) {
  const g = GEOMETRIES[variante];

  /**
   * LE CHAMP DE RECHERCHE, DÉPLACÉ TEL QUEL. Sa boîte est celle que O02 dessine
   * sous « Où vivez-vous ? » — `height:52px;padding:0 16px;border-radius:14px;
   * background:#fff;border:1.5px solid #16785E`, sa loupe de 17 px et son tracé
   * `circle(11,11,7) + m20 20-3.5-3.5`. Rien n'est redessiné : le contrôle change
   * d'endroit, pas de forme.
   */
  const entete: ReactNode = (
    <div
      style={{
        height: '52px',
        marginTop: '10px',
        padding: '0 16px',
        borderRadius: '14px',
        background: '#fff',
        border: '1.5px solid #16785E',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14.5px',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#5D6B66"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={recherche}
        onChange={onRecherche}
        placeholder="Votre ville"
        aria-label="Votre ville"
        autoComplete="address-level2"
        style={{
          flex: '1',
          minWidth: '0',
          border: 'none',
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
          outline: 'none',
          padding: 0,
        }}
      />
    </div>
  );

  return (
    <PanneauDeSection
      ouvert={ouvert}
      titre="Où vivez-vous ?"
      variante={variante}
      repere="ville"
      onFermer={onFermer}
      entete={entete}
    >
      {villes.length === 0 ? (
        /**
         * DEUX CAS, UN SEUL MOT — et c'est voulu : que la recherche ne trouve rien
         * ou que le référentiel soit vide, le membre lit la même chose, parce que
         * pour lui c'est la même situation. Aucune planche ne dessine cette phrase.
         */
        <PhrasePanneau>Aucune ville ne correspond.</PhrasePanneau>
      ) : (
        villes.map((v) => (
          <LigneVille key={v.id} ville={v} retenue={v.id === villeId} geometrie={g} />
        ))
      )}
    </PanneauDeSection>
  );
}
