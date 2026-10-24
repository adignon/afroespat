'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { FiltreVivant, MembreVivant } from '@/screens/villes/data';
import { EtatVide } from '@/components/etat-vide';

/**
 * AJOUT — l'Annuaire des membres, sur ordinateur (A11).
 *
 * La maquette dessine, à 1 440 px, la bascule « Carte | Annuaire » mais seule la
 * carte y a un contenu ; l'annuaire n'est dessiné qu'à 390 px. Plutôt qu'un
 * bouton « Annuaire » qui ne mène nulle part sur ordinateur, ce composant pose la
 * MÊME liste dans le cadre de la carte, avec les cartes de membre de la planche
 * mobile — relevées à l'identique : carte blanche au liseré `#E6EBE9`, rayon 20,
 * retrait 14, avatar de 44 px, pastille verte « Disponible pour aider »
 * `#E3F0EB` / `#0F5C48`, puces grises `#F2F5F4` — rangées en grille.
 *
 * Les filtres sont les pastilles de la même planche (`dirFilters`) : un filtre
 * qui a des options s'ouvre en liste native (posée EN TRANSPARENCE sur la
 * pastille, donc accessible au clavier et sur téléphone) ; les autres basculent.
 */
const PASTILLE: CSSProperties = {
  padding: '7px 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  position: 'relative',
  font: 'inherit',
  cursor: 'pointer',
};

export function PastilleFiltre({ f, style }: { readonly f: FiltreVivant; readonly style?: CSSProperties }) {
  const base: CSSProperties = {
    ...PASTILLE,
    fontSize: '12px',
    fontWeight: 600,
    background: f.bg,
    color: f.fg,
    border: `1px solid ${f.bd}`,
    ...style,
  };
  if (f.options === null) {
    return (
      <button type="button" onClick={() => { f.onChange(''); }} aria-pressed={f.valeur !== ''} data-annuaire-filtre={f.label} style={base}>
        {f.label}
      </button>
    );
  }
  return (
    <label style={{ ...base, display: 'inline-block' }} data-annuaire-filtre={f.label}>
      {f.label}
      <select
        value={f.valeur}
        aria-label={f.label}
        onChange={(e) => { f.onChange(e.target.value); }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', font: 'inherit' }}
      >
        {f.options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CarteMembreAnnuaire({ m }: { readonly m: MembreVivant }) {
  const avatar = (
    <span
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '999px',
        background: m.bg,
        color: '#fff',
        fontSize: '12px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {m.i}
    </span>
  );
  return (
    <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '20px', padding: '14px' }} data-annuaire-membre="">
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {m.profil === undefined ? avatar : (
          <Link href={m.profil} aria-label={`Voir le profil de ${m.name}`} style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}>
            {avatar}
          </Link>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 700 }}>
            {m.profil === undefined ? m.name : (
              <Link href={m.profil} style={{ color: 'inherit', textDecoration: 'none' }}>{m.name}</Link>
            )}
          </span>
          <span style={{ display: 'block', fontSize: '12px', color: '#8A958F' }}>{m.sub}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        {m.help ? (
          <span style={{ background: '#E3F0EB', color: '#0F5C48', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>
            Disponible pour aider
          </span>
        ) : null}
        {m.skills.map((s) => (
          <span key={s} style={{ background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnnuaireVilles({
  membres,
  filtres,
  aPlus,
  onPlus,
}: {
  readonly membres: readonly MembreVivant[];
  readonly filtres: readonly FiltreVivant[];
  readonly aPlus: boolean;
  readonly onPlus: () => void;
}) {
  return (
    <div data-annuaire-villes="" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '18px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {filtres.map((f) => (
          <PastilleFiltre key={f.label} f={f} />
        ))}
      </div>
      {membres.length === 0 ? (
        <EtatVide texte="Aucun membre ne correspond à ces filtres." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {membres.map((m) => (
            <CarteMembreAnnuaire key={m.handle ?? m.name} m={m} />
          ))}
        </div>
      )}
      {aPlus ? (
        <button
          type="button"
          onClick={onPlus}
          data-annuaire-plus=""
          style={{ display: 'block', margin: '16px auto 0', border: 'none', background: '#F2F5F4', borderRadius: '999px', padding: '10px 18px', font: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
        >
          Voir plus
        </button>
      ) : null}
    </div>
  );
}
