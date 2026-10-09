'use client';

import type { PlacesCity, PlacesCountry } from '@app/shared';
import { Modal } from '@/components/modal';
import { SelecteurPays } from '@/screens/onboarding/selecteur-pays';
import { drapeauDe } from '@/screens/onboarding/drapeau';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CHOISIR LA VILLE QUI VERRA LA STORY — ÉTAPE 3                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, mot pour mot : « ça affiche un modal de toutes les villes rangées
 * par pays. Donc ce modal contient en haut un champ de recherche avec bordure
 * rounded et à côté un bouton pays aussi rounded qui va afficher le slide left
 * des pays, une fois un pays sélectionné les villes du pays s'affiche.
 * L'utilisateur peut sélectionner donc une ville. »
 *
 * ── TROIS CHOSES SONT RÉUTILISÉES, ET AUCUNE N'EST RÉÉCRITE ───────────────
 *
 *   · LA FENÊTRE est `components/modal.tsx` — celle des huit autres : voile,
 *     feuille du bas sur téléphone, boîte centrée sur ordinateur, Échap, piège au
 *     clavier, retour du focus. C'est bien « un modal », comme le porteur l'a dit
 *     cette fois-ci ;
 *   · LE PANNEAU DES PAYS est `screens/onboarding/selecteur-pays.tsx`, construit
 *     pour O02 — un panneau `position: absolute; inset: 0` qui RECOUVRE son
 *     conteneur en glissant depuis la droite. Le porteur demande ici « le slide
 *     left des pays » : c'est littéralement le même contrôle, et le monter deux
 *     fois aurait fait deux dessins qui divergent ;
 *   · LES DRAPEAUX viennent de `drapeau.ts`, dérivés de l'ISO 3166-1.
 *
 * Le conteneur que le panneau recouvre est LA FENÊTRE elle-même : son panneau
 * passe en `position: relative`, et le glissement reste donc borné à la boîte —
 * il ne recouvre pas la page, ce qui serait une seconde fenêtre par-dessus la
 * première.
 *
 * ── D'OÙ VIENT CHAQUE VALEUR DESSINÉE ──────────────────────────────────────
 *
 * De `03 Accueil v2.dc.html`, section A14, c'est-à-dire de l'écran qui ouvre
 * cette fenêtre :
 *
 *   · le champ de recherche — la barre « Rechercher une étape ou un sujet » de
 *     l'étape 2, verbatim : `height:44px;border-radius:999px;background:#F2F5F4;
 *     padding:0 16px;font-size:13.5px;color:#8A958F`, sa loupe de 16 px et son
 *     tracé `circle(11,11,7) + m20 20-3.5-3.5`. « Bordure rounded », demandée par
 *     le porteur : c'est exactement ce que cette barre est ;
 *   · le bouton de pays — même hauteur et même rayon que le champ, sur la coque
 *     d'une ligne d'étape NON retenue (`background:#fff;border:1px solid #E6EBE9`)
 *     et le chevron droit `m9 18 6-6-6-6` en `#8A958F` que `selecteur-parcours`
 *     emploie déjà pour « ouvre une fenêtre » ;
 *   · les lignes de ville — la liste de villes de O02
 *     (`01 Accès et Onboarding.dc.html`), verbatim : 48 px, rayon 12, écart 12,
 *     retrait `0 12px`, `#E3F0EB` pour la ligne retenue, le nom en 14 px / 600 et
 *     la pastille de droite en 12 px / 700. C'est la seule liste de villes que le
 *     dossier dessine, et s'en écarter aurait créé une deuxième manière de
 *     montrer une ville.
 *
 * ── LES TEXTES NON DESSINÉS, ET ILS SONT TROIS ────────────────────────────
 *
 * « Rechercher une ville », « Chargement des villes… » et « Aucune ville dans ce
 * pays. » Aucune planche ne dessine cette fenêtre, donc aucune ne les porte. Ils
 * sont volontairement secs, et REMONTÉS au porteur.
 *
 * Le titre, lui, est DESSINÉ : « QUI LE VOIT » est l'étiquette que la maquette
 * pose au-dessus des deux onglets d'audience. La fenêtre reprend ces mots.
 */

const TITRE_ID = 'a14v-titre';

/** La ligne d'une ville — la liste de O02, à l'identique. */
function LigneVille({
  ville,
  retenue,
  onChoisir,
}: {
  readonly ville: PlacesCity;
  readonly retenue: boolean;
  readonly onChoisir: (ville: PlacesCity) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoisir(ville)}
      aria-pressed={retenue}
      style={{
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 12px',
        borderRadius: '12px',
        background: retenue ? '#E3F0EB' : 'transparent',
        /** Une ville sans réseau ouvert se lit en gris — comme à l'inscription. */
        color: ville.isActive || retenue ? '#16211D' : '#8A958F',
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
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: retenue ? '#0F5C48' : ville.isActive ? '#5D6B66' : '#8A958F',
          background: retenue ? '#fff' : '#F2F5F4',
          padding: '4px 10px',
          borderRadius: '999px',
          flexShrink: 0,
        }}
      >
        {ville.isActive ? `${String(ville.memberCount)} membres` : 'bientôt'}
      </span>
    </button>
  );
}

/** Le corps de la fenêtre, partagé par ses deux coques. */
function Corps({
  recherche,
  onRecherche,
  pays,
  onOuvrirPays,
  villes,
  villeId,
  onChoisirVille,
  charge,
  erreur,
}: {
  readonly recherche: string;
  readonly onRecherche: (texte: string) => void;
  readonly pays: PlacesCountry | null;
  readonly onOuvrirPays: () => void;
  readonly villes: readonly PlacesCity[];
  readonly villeId: string | null;
  readonly onChoisirVille: (ville: PlacesCity) => void;
  readonly charge: boolean;
  readonly erreur: string | null;
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <div
          style={{
            flex: '1',
            minWidth: '0',
            height: '44px',
            borderRadius: '999px',
            background: '#F2F5F4',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            color: '#8A958F',
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
            onChange={(event) => onRecherche(event.target.value)}
            placeholder="Rechercher une ville"
            aria-label="Rechercher une ville"
            data-saisie-sur-gris=""
            style={{
              flex: '1',
              minWidth: '0',
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              // L'encre, et non le gris du contenant : voir `A14_RECHERCHE`.
              color: '#16211D',
              outline: 'none',
              padding: 0,
            }}
          />
        </div>
        <button
          type="button"
          onClick={onOuvrirPays}
          aria-haspopup="dialog"
          data-bouton-pays=""
          style={{
            height: '44px',
            borderRadius: '999px',
            background: '#fff',
            border: '1px solid #E6EBE9',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 700,
            color: '#16211D',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1 }}>
            {pays === null ? '' : drapeauDe(pays.iso2)}
          </span>
          {pays?.nameFr ?? 'Pays'}
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
      </div>

      <div
        style={{
          flex: '1',
          minHeight: '0',
          overflowY: 'auto',
          border: '1px solid #EAEEEC',
          borderRadius: '16px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {erreur !== null ? (
          <p style={{ margin: 0, padding: '12px', fontSize: '13px', color: '#5D6B66' }} role="alert">
            {erreur}
          </p>
        ) : charge ? (
          <p style={{ margin: 0, padding: '12px', fontSize: '13px', color: '#5D6B66' }}>
            Chargement des villes…
          </p>
        ) : villes.length === 0 ? (
          <p style={{ margin: 0, padding: '12px', fontSize: '13px', color: '#5D6B66' }}>
            Aucune ville dans ce pays.
          </p>
        ) : (
          villes.map((v) => (
            <LigneVille
              key={v.id}
              ville={v}
              retenue={v.id === villeId}
              onChoisir={onChoisirVille}
            />
          ))
        )}
      </div>
    </>
  );
}

/** La croix de fermeture — celle que les huit autres fenêtres dessinent. */
function Croix() {
  return (
    <button
      type="button"
      aria-label="Fermer"
      data-modal-close=""
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '999px',
        background: '#F2F5F4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        padding: 0,
        fontFamily: 'inherit',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#16211D"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function SelecteurVille({
  ouvert,
  onFermer,
  recherche,
  onRecherche,
  paysOptions,
  pays,
  paysOuvert,
  onOuvrirPays,
  onFermerPays,
  onChoisirPays,
  villes,
  villeId,
  onChoisirVille,
  charge,
  erreur,
}: {
  readonly ouvert: boolean;
  readonly onFermer: () => void;
  readonly recherche: string;
  readonly onRecherche: (texte: string) => void;
  readonly paysOptions: readonly PlacesCountry[];
  readonly pays: PlacesCountry | null;
  readonly paysOuvert: boolean;
  readonly onOuvrirPays: () => void;
  readonly onFermerPays: () => void;
  readonly onChoisirPays: (iso2: string) => void;
  readonly villes: readonly PlacesCity[];
  readonly villeId: string | null;
  readonly onChoisirVille: (ville: PlacesCity) => void;
  readonly charge: boolean;
  readonly erreur: string | null;
}) {
  const corps = (
    <Corps
      recherche={recherche}
      onRecherche={onRecherche}
      pays={pays}
      onOuvrirPays={onOuvrirPays}
      villes={villes}
      villeId={villeId}
      onChoisirVille={onChoisirVille}
      charge={charge}
      erreur={erreur}
    />
  );

  /**
   * LE PANNEAU DES PAYS, celui de O02. Il se cale sur la boîte de la fenêtre,
   * qui passe donc en `position: relative` — sans quoi il se calerait sur la
   * PAGE et recouvrirait tout, c'est-à-dire exactement ce que le porteur a
   * refusé pour O02.
   *
   * `variante="desktop"` dans les DEUX coques : cette variante est la coque
   * BLANCHE à retrait, et le fond d'une fenêtre est blanc des deux côtés. La
   * variante mobile, elle, est faite pour une page sans carte.
   */
  const panneauPays = (
    <SelecteurPays
      ouvert={paysOuvert}
      pays={paysOptions.map((c) => ({
        id: c.id,
        iso2: c.iso2,
        nameFr: c.nameFr,
        dialCode: c.dialCode,
      }))}
      choisiIso2={pays?.iso2 ?? ''}
      variante="desktop"
      onChoisir={onChoisirPays}
      onFermer={onFermerPays}
    />
  );

  return (
    <Modal
      open={ouvert}
      onClose={onFermer}
      titleId={TITRE_ID}
      name="A14V"
      desktop={
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)' }}
            data-modal-overlay=""
          />
          <div
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: '520px',
              /** Bornée pour que la liste défile DANS la fenêtre, pas la page. */
              maxHeight: '70vh',
              background: '#fff',
              borderRadius: '28px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflow: 'hidden',
            }}
            data-modal-panel=""
          >
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <h2
                id={TITRE_ID}
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                  flex: '1',
                }}
              >
                Qui le voit
              </h2>
              <Croix />
            </div>
            {corps}
            {panneauPays}
          </div>
        </>
      }
      mobile={
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)' }}
            data-modal-overlay=""
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '80vh',
              background: '#fff',
              borderRadius: '28px 28px 0 0',
              padding: '10px 18px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflow: 'hidden',
            }}
            data-modal-panel=""
          >
            <button
              type="button"
              aria-label="Fermer"
              data-modal-close=""
              style={{
                alignSelf: 'center',
                width: '40px',
                height: '5px',
                borderRadius: '999px',
                background: '#DDE3E0',
                border: 'none',
                // 44 px de cible sans que la poignée grossisse — voir A14P.
                padding: '10px 24px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxSizing: 'content-box',
                marginTop: 0,
                backgroundClip: 'content-box',
                flexShrink: 0,
              }}
            />
            <h2
              id={TITRE_ID}
              style={{ margin: 0, fontSize: '18px', fontWeight: 800, flexShrink: 0 }}
            >
              Qui le voit
            </h2>
            {corps}
            {panneauPays}
          </div>
        </>
      }
    />
  );
}
