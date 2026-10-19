'use client';

import type { CSSProperties } from 'react';
import type { FormulaireAnnonceView } from '@/screens/services/use-publication';
import { Bloc, CHAMP, Interrupteur, Pastilles, Refus } from './champs';

/**
 * AJOUT — le formulaire « Publier une annonce » (S03), aux DEUX largeurs.
 *
 * La planche de 1 440 px dessine tous les champs en `<div>` ; celle de 390 px n'en
 * dessine que quatre (Titre, Loyer, Dispo, deux photos) et ne dit rien de la
 * description, de la ville, du quartier, de la durée ni du meublé — que
 * `createHousingSchema` exige ou accepte. Sans eux, aucune annonce ne pourrait être
 * publiée depuis un téléphone. Le composant pose donc, aux deux largeurs, les champs
 * du serveur, avec les mesures relevées sur la planche d'ordinateur (voir
 * `champs.tsx`) ; à 390 px ils s'empilent sur une colonne.
 *
 * Le bouton « Publier » (ou « Enregistrer ») est CELUI DE LA MAQUETTE, câblé par
 * l'adaptation : ce composant ne le redessine pas.
 *
 * FORMULAIRE GRISÉ (10 §2.1) : quand le serveur dit que ce membre ne peut pas
 * publier, les champs sont éteints et la phrase du serveur s'écrit au-dessus.
 */
const TUILE: CSSProperties = {
  position: 'relative',
  height: '90px',
  borderRadius: '14px',
  overflow: 'hidden',
  background: 'repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px)',
};

export function ChampsAnnonce({ f, mobile = false }: { readonly f: FormulaireAnnonceView; readonly mobile?: boolean }) {
  const offre = f.sens === 'OFFRE';
  return (
    <fieldset
      disabled={f.grise}
      data-champs-annonce=""
      style={{
        border: 'none',
        margin: 0,
        padding: 0,
        minWidth: 0,
        opacity: f.grise ? 0.55 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {f.grise ? (
        <div role="status" data-publier-grise="" style={{ background: '#FBE3D4', color: '#B4581F', borderRadius: '14px', padding: '12px 14px', fontSize: '13px', fontWeight: 700, lineHeight: 1.5, opacity: 1 }}>
          {f.phraseGrise}
        </div>
      ) : null}

      {f.modification ? null : (
        <div style={{ display: 'flex', gap: '4px', background: '#EEF2F0', borderRadius: '14px', padding: '4px', alignSelf: 'flex-start' }}>
          {(['OFFRE', 'RECHERCHE'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={f.sens === s}
              onClick={() => {
                f.onSens(s);
              }}
              style={{
                padding: '9px 16px',
                borderRadius: '11px',
                fontSize: '13px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                border: 'none',
                font: 'inherit',
                cursor: 'pointer',
                background: f.sens === s ? '#fff' : 'transparent',
                color: f.sens === s ? '#16211D' : '#5D6B66',
              }}
            >
              {s === 'OFFRE' ? 'Je propose' : 'Je recherche'}
            </button>
          ))}
        </div>
      )}

      {f.modification ? null : (
        <Pastilles valeurs={f.genres} valeur={f.kind} onChoisir={f.onKind} libelle="Genre d’annonce" />
      )}

      <Bloc libelle="Titre">
        <input type="text" value={f.titre} onChange={f.onTitre} maxLength={120} placeholder="Studio meublé Lyon 7e" aria-label="Titre" data-annonce-titre="" style={CHAMP} />
      </Bloc>

      <Bloc libelle="Description">
        <textarea value={f.description} onChange={f.onDescription} rows={4} maxLength={3000} placeholder="Cuisine équipée, 5 min du métro…" aria-label="Description" data-annonce-description="" style={{ ...CHAMP, resize: 'vertical' }} />
      </Bloc>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <Bloc libelle="Ville">
          <select value={f.villeId} onChange={f.onVille} aria-label="Ville" data-annonce-ville="" style={CHAMP}>
            <option value="">Choisir une ville</option>
            {f.villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
        </Bloc>
        <Bloc libelle="Quartier">
          <input type="text" value={f.quartier} onChange={f.onQuartier} maxLength={120} placeholder="7e · Jean Macé" aria-label="Quartier" data-annonce-quartier="" style={CHAMP} />
        </Bloc>
        <Bloc libelle={offre ? 'Loyer charges comprises' : 'Budget maximum'}>
          <input type="text" inputMode="decimal" value={f.loyer} onChange={f.onLoyer} placeholder="620 €" aria-label="Loyer" data-annonce-loyer="" style={CHAMP} />
        </Bloc>
        <Bloc libelle="Disponible à partir du">
          <input type="date" value={f.disponible} onChange={f.onDisponible} aria-label="Disponible à partir du" data-annonce-disponible="" style={CHAMP} />
        </Bloc>
        <Bloc libelle="Durée (en mois)">
          <input type="number" min={1} max={120} value={f.duree} onChange={f.onDuree} placeholder="12" aria-label="Durée en mois" data-annonce-duree="" style={CHAMP} />
        </Bloc>
        <div style={{ paddingTop: mobile ? 0 : '22px' }}>
          <Interrupteur libelle="Meublé" allume={f.meuble} onBascule={f.onMeuble} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px' }}>
          Photos · 1 à {f.photosMax}
          {offre ? '' : ' (facultatives)'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: '8px' }}>
          {f.photos.map((p) => (
            <div key={p.id} style={{ ...TUILE, backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} role="img" aria-label={p.nom}>
              <button
                type="button"
                aria-label={`Retirer la photo ${p.nom}`}
                onClick={() => {
                  f.onRetirerPhoto(p.id);
                }}
                style={{ position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,.92)', cursor: 'pointer', font: 'inherit', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
          {f.photos.length >= f.photosMax ? null : (
            <label
              data-annonce-photos=""
              style={{ height: '90px', borderRadius: '14px', border: '1.5px dashed #CBD5D1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 700, color: '#5D6B66', cursor: 'pointer', textAlign: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Ajouter
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  f.onPhotos(e.target.files);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
        {f.modification ? (
          <div style={{ fontSize: '11.5px', color: '#8A958F', marginTop: '6px' }}>
            Sans nouvelle photo, celles de l’annonce sont conservées.
          </div>
        ) : null}
      </div>

      <Refus texte={f.echec} />
    </fieldset>
  );
}
