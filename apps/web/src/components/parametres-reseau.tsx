'use client';

import type { PilotageReseauView } from '@/screens/a08t/vivant';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES PARAMÈTRES D'UN RÉSEAU — CE QUE LA MAQUETTE NE DESSINE PAS             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Deux morceaux, dans le dessin de la carte « PARAMÈTRES » de « Gérer » (1036 px)
 * — rangées de 12 px séparées d'un filet `#F0F3F2`, titres 13,5 px gras, sous-
 * titres 12 px gris, interrupteurs 46 × 26 :
 *
 *   · `PorteeValidation` — sous l'interrupteur « Validation », le CHOIX que le
 *     porteur a demandé : « valider toutes les publications, valider X
 *     publications pour chaque membre ». Deux pastilles, et un compteur − N +
 *     pour le second mode. Rien quand la validation est éteinte.
 *
 *   · `ParametresReseauMobile` — la carte entière pour 390 px. La planche du
 *     téléphone dessine une pastille « Paramètres » qui menait à une section
 *     VIDE : le propriétaire ne pouvait rien régler depuis son téléphone. Elle
 *     reprend les trois interrupteurs, la portée et la visibilité, avec les
 *     mêmes prises que l'ordinateur.
 *
 * Les deux sont des AJOUTS, validés par le porteur. Les gestes sont ceux de
 * `pilotage.parametres`, calculés par `use-reseau.ts` : le serveur reste juge
 * (seul le propriétaire change la visibilité, l'équipe le reste).
 */
type Parametres = PilotageReseauView['parametres'];

const PASTILLE = (on: boolean) =>
  ({
    // `font` d'abord : posé après, ce raccourci écraserait taille et graisse.
    font: 'inherit',
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    border: `1px solid ${on ? '#16785E' : '#E6EBE9'}`,
    background: on ? '#E3F0EB' : '#fff',
    color: on ? '#0F5C48' : '#16211D',
    cursor: 'pointer',
  }) as const;

const ROND = {
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  border: '1px solid #E6EBE9',
  background: '#fff',
  color: '#16211D',
  fontSize: '15px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  cursor: 'pointer',
} as const;

export function PorteeValidation({ p }: { readonly p: Parametres }) {
  if (!p.validation) return null;
  const premieres = p.validationPortee === 'FIRST_POSTS';
  return (
    <div
      data-gerer-portee=""
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '0 0 12px',
        borderBottom: '1px solid #F0F3F2',
      }}
    >
      <button
        type="button"
        aria-pressed={!premieres}
        disabled={p.occupe}
        onClick={() => {
          p.onPortee('ALL');
        }}
        data-gerer-portee-choix="ALL"
        style={PASTILLE(!premieres)}
      >
        Toutes les publications
      </button>
      <button
        type="button"
        aria-pressed={premieres}
        disabled={p.occupe}
        onClick={() => {
          p.onPortee('FIRST_POSTS');
        }}
        data-gerer-portee-choix="FIRST_POSTS"
        style={PASTILLE(premieres)}
      >
        Les premières de chaque membre
      </button>
      {premieres ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#5D6B66' }}>
          <button
            type="button"
            aria-label="Une publication de moins"
            disabled={p.occupe || p.validationNombre <= 1}
            onClick={() => {
              p.onNombre(-1);
            }}
            data-gerer-nombre="moins"
            style={ROND}
          >
            −
          </button>
          <strong style={{ color: '#16211D', minWidth: '18px', textAlign: 'center' }} data-gerer-nombre-valeur="">
            {p.validationNombre}
          </strong>
          <button
            type="button"
            aria-label="Une publication de plus"
            disabled={p.occupe || p.validationNombre >= p.validationNombreMax}
            onClick={() => {
              p.onNombre(1);
            }}
            data-gerer-nombre="plus"
            style={ROND}
          >
            +
          </button>
          {p.validationNombre === 1 ? 'publication' : 'publications'}
        </span>
      ) : null}
    </div>
  );
}

function Interrupteur({
  on,
  libelle,
  onClick,
  occupe,
  nom,
}: {
  readonly on: boolean;
  readonly libelle: string;
  readonly onClick: () => void;
  readonly occupe: boolean;
  readonly nom: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={libelle}
      onClick={onClick}
      disabled={occupe}
      data-gerer-parametre={nom}
      style={{
        width: '46px',
        height: '26px',
        borderRadius: '999px',
        backgroundColor: on ? '#16785E' : '#CBD5D1',
        position: 'relative',
        flexShrink: 0,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: on ? '23px' : '3px',
          width: '20px',
          height: '20px',
          borderRadius: '999px',
          background: '#fff',
        }}
      />
    </button>
  );
}

function Rangee({
  titre,
  sous,
  children,
}: {
  readonly titre: string;
  readonly sous: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #F0F3F2' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{titre}</div>
        <div style={{ fontSize: '12px', color: '#5D6B66', marginTop: '2px' }}>{sous}</div>
      </div>
      {children}
    </div>
  );
}

export function ParametresReseauMobile({ p }: { readonly p: Parametres }) {
  return (
    <div data-gerer-parametres-mobile="" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F', flexShrink: 0 }}>
        PARAMÈTRES
      </div>
      <div
        style={{
          background: '#fff',
          border: '1px solid #E6EBE9',
          borderRadius: '18px',
          padding: '4px 14px',
          marginTop: '8px',
        }}
      >
        <Rangee titre="Validation des publications" sous={p.validationSous}>
          <Interrupteur
            on={p.validation}
            libelle="Validation des publications"
            onClick={p.onValidation}
            occupe={p.occupe}
            nom="validation"
          />
        </Rangee>
        <PorteeValidation p={p} />
        <Rangee titre="Sondages ouverts aux membres" sous="Sinon, seule l’équipe crée des sondages.">
          <Interrupteur on={p.sondages} libelle="Sondages ouverts aux membres" onClick={p.onSondages} occupe={p.occupe} nom="sondages" />
        </Rangee>
        <Rangee titre="Album ouvert aux membres" sous="Les membres ajoutent des photos aux albums existants.">
          <Interrupteur on={p.album} libelle="Album ouvert aux membres" onClick={p.onAlbum} occupe={p.occupe} nom="album" />
        </Rangee>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Visibilité</div>
            <div style={{ fontSize: '12px', color: '#8A958F' }}>{p.visibiliteSous}</div>
          </div>
          {p.visibiliteFixe ? (
            <span style={{ background: '#F2F5F4', color: '#8A958F', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
              {p.visibilite}
            </span>
          ) : (
            <select
              value={p.visibiliteValeur}
              onChange={p.onVisibilite}
              disabled={p.occupe}
              aria-label="La visibilité du réseau"
              data-gerer-visibilite=""
              style={{ background: '#F2F5F4', color: '#16211D', padding: '4px 10px', borderRadius: '999px', border: '1px solid #E6EBE9', font: 'inherit', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              {p.visibilites.map((v) => (
                <option key={v.valeur} value={v.valeur}>
                  {v.libelle}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
