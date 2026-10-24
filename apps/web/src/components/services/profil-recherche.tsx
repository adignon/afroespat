'use client';

import { useState, type CSSProperties } from 'react';
import { JOB_SEEKER_LIMITS } from '@app/shared';
import { useProfilRecherche } from '@/screens/services/use-profil-recherche';
import { Bloc, CHAMP, Interrupteur, Refus } from './champs';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — L'ONGLET « MON PROFIL DE RECHERCHE » (S04, lot E2)    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche S04 dessine la bande « Offres | Profils disponibles | Mon profil de
 * recherche » mais aucun contenu pour le troisième onglet. Le formulaire est
 * composé dans le langage visuel des cartes voisines, mesures relevées sur les
 * `.generated.tsx` de S04 et S05 :
 *
 *   · carte blanche au liseré `1px solid #E6EBE9`, rayon 22, retrait 24 (18 sur
 *     390 px), comme « PUBLIER UNE OFFRE » de S05 ;
 *   · étiquette de carte 10,5 px / 700 / interlettrage 1 px / `#8A958F` ;
 *   · champs, interrupteur et refus : ceux de `champs.tsx` (S03, S05, S08) ;
 *   · entrées retenues : pastille `#E3F0EB` / `#0F5C48`, 11 px / 700, rayon 999 —
 *     celle du genre d'une offre ; bouton principal `#16785E` de 48 px, rayon 14 ;
 *   · réussite : encart `#E3F0EB` ; refus : terre cuite `#B4581F`. Aucune couleur
 *     nouvelle, aucun rouge.
 *
 * Les quatre états : CHARGEMENT (lecture en cours), VIDE (« pas encore de profil »),
 * ERREUR (la lecture a échoué, avec « Réessayer »), SUCCÈS (profil enregistré).
 * Le geste est `PUT /me/job-seeker-profile` ; voir `use-profil-recherche.tsx`.
 */

/** Suggestions de contrat : de l'AIDE À LA SAISIE, jamais une liste fermée. */
const CONTRATS_COURANTS = ['CDI', 'CDD', 'Stage', 'Alternance', 'Intérim', 'Freelance'] as const;

const CARTE = (mobile: boolean): CSSProperties => ({
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '22px',
  padding: mobile ? '18px' : '24px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
});

const ETIQUETTE_CARTE: CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '1px',
  color: '#8A958F',
};

const BOUTON_PRINCIPAL: CSSProperties = {
  height: '48px',
  padding: '0 18px',
  borderRadius: '14px',
  background: '#16785E',
  color: '#fff',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  cursor: 'pointer',
};

const BOUTON_SECONDAIRE: CSSProperties = {
  ...BOUTON_PRINCIPAL,
  background: '#F2F5F4',
  color: '#16211D',
};

/** Une liste d'entrées libres : pastilles retirables, champ d'ajout, suggestions. */
function ListeLibre({
  libelle,
  nom,
  entrees,
  suggestions,
  placeholder,
  onAjouter,
  onRetirer,
}: {
  readonly libelle: string;
  readonly nom: string;
  readonly entrees: readonly string[];
  readonly suggestions?: readonly string[];
  readonly placeholder: string;
  readonly onAjouter: (valeur: string) => boolean;
  readonly onRetirer: (valeur: string) => void;
}) {
  const [saisie, setSaisie] = useState('');
  const ajouter = (valeur: string): void => {
    if (onAjouter(valeur)) setSaisie('');
  };
  const proposees = (suggestions ?? []).filter((s) => !entrees.some((e) => e.toLowerCase() === s.toLowerCase()));

  return (
    <Bloc libelle={libelle}>
      {entrees.length === 0 ? null : (
        <ul
          aria-label={libelle}
          data-profil-recherche-liste={nom}
          style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', listStyle: 'none', margin: '0 0 8px', padding: 0 }}
        >
          {entrees.map((e) => (
            <li
              key={e}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#E3F0EB',
                color: '#0F5C48',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 4px 4px 10px',
                borderRadius: '999px',
              }}
            >
              {e}
              <button
                type="button"
                aria-label={`Retirer ${e}`}
                onClick={() => {
                  onRetirer(e);
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'transparent',
                  color: '#0F5C48',
                  font: 'inherit',
                  fontSize: '13px',
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ajouter(saisie);
            }
          }}
          maxLength={JOB_SEEKER_LIMITS.itemMax}
          placeholder={placeholder}
          aria-label={`Ajouter : ${libelle}`}
          data-profil-recherche-saisie={nom}
          style={{ ...CHAMP, flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          onClick={() => {
            ajouter(saisie);
          }}
          disabled={saisie.trim() === ''}
          style={{ ...BOUTON_SECONDAIRE, opacity: saisie.trim() === '' ? 0.6 : 1 }}
        >
          Ajouter
        </button>
      </div>
      {proposees.length === 0 ? null : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
          {proposees.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                ajouter(s);
              }}
              style={{
                padding: '8px 13px',
                borderRadius: '999px',
                fontSize: '12.5px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: '#fff',
                color: '#16211D',
                border: '1px solid #E6EBE9',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </Bloc>
  );
}

export function FormulaireProfilRecherche({ mobile = false }: { readonly mobile?: boolean }) {
  const p = useProfilRecherche();

  if (p.phase === 'chargement') {
    return (
      <div role="status" aria-live="polite" data-profil-recherche="chargement" style={CARTE(mobile)}>
        <div style={ETIQUETTE_CARTE}>MON PROFIL DE RECHERCHE</div>
        <div style={{ fontSize: '13.5px', color: '#5D6B66' }}>Chargement de votre profil de recherche…</div>
      </div>
    );
  }

  if (p.phase === 'erreur') {
    return (
      <div role="alert" data-profil-recherche="erreur" style={CARTE(mobile)}>
        <div style={ETIQUETTE_CARTE}>MON PROFIL DE RECHERCHE</div>
        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#B4581F' }}>{p.erreur}</div>
        <div>
          <button type="button" onClick={p.onRecharger} style={BOUTON_SECONDAIRE}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      data-profil-recherche={p.existe ? 'rempli' : 'vide'}
      onSubmit={(e) => {
        e.preventDefault();
        p.onEnregistrer();
      }}
      style={CARTE(mobile)}
    >
      <div style={ETIQUETTE_CARTE}>MON PROFIL DE RECHERCHE</div>

      {p.existe ? null : (
        <div
          data-profil-recherche-vide=""
          style={{ background: '#F6F8F7', borderRadius: '14px', padding: '12px', fontSize: '12.5px', lineHeight: 1.5, color: '#5D6B66' }}
        >
          <strong style={{ color: '#16211D' }}>Vous n’avez pas encore de profil de recherche.</strong> Présentez en une
          ligne ce que vous cherchez : il apparaîtra dans « Profils disponibles » et les recruteurs pourront vous écrire.
        </div>
      )}

      <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#5D6B66' }}>
        Aucun CV n’est conservé sur la plateforme : envoyez-le vous-même en message à la personne qui vous contacte.
      </div>

      <Bloc libelle="Titre de votre recherche">
        <input
          type="text"
          value={p.titre}
          onChange={(e) => {
            p.onTitre(e.target.value);
          }}
          maxLength={JOB_SEEKER_LIMITS.headlineMax}
          placeholder="Assistante RH · alternance"
          aria-label="Titre de votre recherche"
          data-profil-recherche-titre=""
          style={CHAMP}
        />
        <div style={{ fontSize: '11.5px', color: '#8A958F', marginTop: '4px', textAlign: 'right' }}>
          {p.titre.trim().length} / {JOB_SEEKER_LIMITS.headlineMax}
        </div>
      </Bloc>

      <ListeLibre
        libelle="Secteurs"
        nom="secteurs"
        entrees={p.secteurs}
        placeholder="Comptabilité"
        onAjouter={(v) => p.onAjouter('secteurs', v)}
        onRetirer={(v) => {
          p.onRetirerEntree('secteurs', v);
        }}
      />

      <ListeLibre
        libelle="Types de contrat"
        nom="contrats"
        entrees={p.contrats}
        suggestions={CONTRATS_COURANTS}
        placeholder="CDI"
        onAjouter={(v) => p.onAjouter('contrats', v)}
        onRetirer={(v) => {
          p.onRetirerEntree('contrats', v);
        }}
      />

      <div style={{ background: '#F6F8F7', borderRadius: '16px', padding: '2px 14px' }}>
        <Interrupteur libelle="Visible dans « Profils disponibles »" allume={p.visible} onBascule={p.onVisible} />
      </div>

      <Refus texte={p.echec} />

      {p.succes === '' ? null : (
        <div
          role="status"
          data-profil-recherche-succes=""
          style={{ background: '#E3F0EB', color: '#0F5C48', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', fontWeight: 700, lineHeight: 1.5 }}
        >
          {p.succes}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={p.bloque}
          data-profil-recherche-enregistrer=""
          style={{ ...BOUTON_PRINCIPAL, flex: 1, opacity: p.bloque ? 0.6 : 1, cursor: p.bloque ? 'default' : 'pointer' }}
        >
          {p.occupe ? 'Enregistrement…' : p.existe ? 'Enregistrer les modifications' : 'Enregistrer mon profil'}
        </button>
        {p.existe ? (
          <button
            type="button"
            onClick={p.onRetirerProfil}
            disabled={p.occupe}
            data-profil-recherche-retirer=""
            style={{ ...BOUTON_SECONDAIRE, opacity: p.occupe ? 0.6 : 1 }}
          >
            Retirer mon profil
          </button>
        ) : null}
      </div>
    </form>
  );
}
