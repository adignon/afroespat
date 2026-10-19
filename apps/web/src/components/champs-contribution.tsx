'use client';

import type { CSSProperties } from 'react';
import type { ContributionView } from '@/screens/villes/data';

/**
 * AJOUT — les champs de la fenêtre « Contribuer » (A12C), pour les QUATRE genres.
 *
 * La maquette dessine des champs en `<div>` — ils ne se saisissent pas —, et elle
 * ne dessine pas tous les formulaires : à 1 440 px l'étape 2 n'existe que pour le
 * « Produit du pays » et le « Budget réel » ; à 390 px la feuille ne porte que les
 * champs du bon plan. Ce composant pose, dans chaque cas, les champs du genre
 * choisi, avec les mesures RELEVÉES sur les planches voisines :
 *
 *   · étiquette 12,5 px / 700, 6 px de marge basse ;
 *   · champ : 46 px au moins, rayon 14, liseré `1px solid #E6EBE9` (le champ
 *     actif `1.5px solid #16785E`), retrait `12px 14px`, 14 px ;
 *   · ligne de budget : libellé sur `#F6F8F7` (44 px, rayon 12) et montant
 *     (110 px, aligné à droite, 14 px / 700) ;
 *   · « Ajouter une ligne » : 13 px / 700 vert, icône « + ».
 *
 * Les bornes (longueurs maximales) viennent de `CITY_TIP_MAX_BODY`, lues dans
 * `contribution.max` — jamais recopiées. Ce qui n'est PAS repris de la maquette, et
 * pourquoi : la « Catégorie » et « Ajouter une photo » du produit du pays (le
 * modèle `city_tips` ne porte ni catégorie ni média), et le « Profil » du budget
 * (aucune colonne). Une case sans effet est pire qu'une case absente.
 */
const ETIQUETTE: CSSProperties = { fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' };

const CHAMP: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '46px',
  borderRadius: '14px',
  border: '1px solid #E6EBE9',
  background: '#fff',
  padding: '12px 14px',
  fontSize: '14px',
  font: 'inherit',
  color: '#16211D',
  outline: 'none',
};

const LIGNE_LIBELLE: CSSProperties = {
  height: '44px',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '12px',
  background: '#F6F8F7',
  border: 'none',
  padding: '0 14px',
  fontSize: '13.5px',
  fontWeight: 600,
  font: 'inherit',
  color: '#16211D',
  outline: 'none',
};

const LIGNE_MONTANT: CSSProperties = {
  height: '44px',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '12px',
  border: '1px solid #E6EBE9',
  background: '#fff',
  padding: '0 12px',
  textAlign: 'right',
  fontSize: '14px',
  fontWeight: 700,
  font: 'inherit',
  color: '#16211D',
  outline: 'none',
};

export function ChampsContribution({ c, ville }: { readonly c: ContributionView; readonly ville: string }) {
  return (
    <div data-champs-contribution={c.type} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {c.type === 'TIP' ? (
        <>
          <div>
            <div style={ETIQUETTE}>Votre bon plan</div>
            <input
              type="text"
              value={c.titre}
              onChange={c.onTitre}
              maxLength={120}
              placeholder="Abonnement TCL à 25 € pour les moins de 26 ans"
              aria-label="Votre bon plan"
              data-contribution-titre=""
              style={CHAMP}
            />
          </div>
          <div>
            <div style={ETIQUETTE}>Détail</div>
            <textarea
              value={c.texte}
              onChange={c.onTexte}
              rows={3}
              maxLength={c.max.TIP}
              placeholder="Demandez-le en agence avec votre carte…"
              aria-label="Détail"
              data-contribution-texte=""
              style={{ ...CHAMP, resize: 'vertical' }}
            />
          </div>
        </>
      ) : null}

      {c.type === 'SHOP' ? (
        <>
          <div>
            <div style={ETIQUETTE}>Nom du lieu</div>
            <input
              type="text"
              value={c.lieu}
              onChange={c.onLieu}
              maxLength={160}
              placeholder="Wax et Saveurs"
              aria-label="Nom du lieu"
              data-contribution-lieu=""
              style={CHAMP}
            />
          </div>
          <div>
            <div style={ETIQUETTE}>Adresse</div>
            <input
              type="text"
              value={c.adresse}
              onChange={c.onAdresse}
              maxLength={400}
              placeholder={`12 rue Paul-Bert, ${ville}`}
              aria-label="Adresse"
              data-contribution-adresse=""
              style={CHAMP}
            />
            <div style={{ fontSize: '11.5px', color: '#8A958F', marginTop: '6px' }}>
              Adresse en texte libre, jamais géolocalisée.
            </div>
          </div>
          <div>
            <div style={ETIQUETTE}>Ce qu’on y trouve</div>
            <textarea
              value={c.texte}
              onChange={c.onTexte}
              rows={3}
              maxLength={c.max.SHOP}
              placeholder="Attiéké frais le samedi, gari…"
              aria-label="Ce qu’on y trouve"
              data-contribution-texte=""
              style={{ ...CHAMP, resize: 'vertical' }}
            />
          </div>
        </>
      ) : null}

      {c.type === 'TESTIMONY' ? (
        <div>
          <div style={ETIQUETTE}>Votre installation</div>
          <textarea
            value={c.texte}
            onChange={c.onTexte}
            rows={5}
            maxLength={c.max.TESTIMONY}
            placeholder="Comment s’est passée votre arrivée à…"
            aria-label="Votre témoignage"
            data-contribution-texte=""
            style={{ ...CHAMP, resize: 'vertical' }}
          />
        </div>
      ) : null}

      {c.type === 'BUDGET' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '8px' }}>
            {c.lignes.map((l, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <input
                  type="text"
                  value={l.libelle}
                  onChange={(e) => { c.onLigne(i, 'libelle', e.target.value); }}
                  maxLength={c.max.BUDGET}
                  placeholder={['Loyer', 'Courses', 'Transport', 'Téléphone'][i] ?? 'Dépense'}
                  aria-label={`Ligne ${i + 1} : libellé`}
                  data-contribution-libelle=""
                  style={LIGNE_LIBELLE}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={l.montant}
                  onChange={(e) => { c.onLigne(i, 'montant', e.target.value); }}
                  placeholder="0 €"
                  aria-label={`Ligne ${i + 1} : montant en euros`}
                  data-contribution-montant=""
                  style={LIGNE_MONTANT}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={c.onAjouterLigne}
            data-contribution-ajouter-ligne=""
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#16785E', border: 'none', background: 'none', padding: 0, font: 'inherit', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16785E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ajouter une ligne
          </button>
          <div style={{ background: '#F3F7F5', borderRadius: '14px', padding: '12px 14px', fontSize: '12.5px', color: '#0F5C48', lineHeight: 1.5 }}>
            Votre budget est anonymisé : seule la médiane de tous les membres est affichée en tête, et vos lignes ne portent pas votre nom.
          </div>
        </>
      ) : null}

      {c.echec === '' ? null : (
        <p role="alert" data-contribution-echec="" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#B4581F' }}>
          {c.echec}
        </p>
      )}
    </div>
  );
}
