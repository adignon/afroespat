'use client';

import type { FormulaireFicheProView } from '@/screens/services/use-ma-fiche-pro';
import { Bloc, CHAMP, Refus } from './champs';

/**
 * AJOUT — les champs de « Créer ma fiche pro » (S08), aux deux largeurs.
 *
 * La maquette dessine métier, nom commercial, description, tarifs, méthode de
 * contact, villes et justificatif en `<div>` d'exemple (« Avocate », « Cabinet
 * Bah »), à 1 440 px ; la planche de 390 px n'en dessine que quatre. Ce composant
 * pose, aux deux largeurs, les champs que `proProfileSchema` demande, avec les
 * mesures de `champs.tsx`. Ce que la maquette ne dessine pas et qu'on AJOUTE : le
 * SIRET (facultatif, 14 chiffres) et la carte d'état « AUCUNE FICHE / EN ATTENTE /
 * VALIDÉE / REFUSÉE ».
 *
 * Le bouton « Envoyer pour validation » est CELUI DE LA MAQUETTE, câblé par
 * l'adaptation. Le téléphone n'est jamais demandé (10 §4.1).
 */
export function ChampsFichePro({ f, mobile = false }: { readonly f: FormulaireFicheProView; readonly mobile?: boolean }) {
  const dispo = f.villes.filter((v) => !f.villesChoisies.some((c) => c.id === v.id));
  return (
    <div data-champs-fiche-pro="" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {f.chargement ? null : (
        <div
          role="status"
          data-fiche-etat=""
          style={{ background: f.existe ? '#E3F0EB' : '#FBE3D4', color: f.existe ? '#0F5C48' : '#B4581F', borderRadius: '14px', padding: '10px 14px', fontSize: '13px', fontWeight: 700 }}
        >
          {f.existe ? `Votre fiche : ${f.etat.toLowerCase()}` : 'Aucune fiche pour l’instant — remplissez-la ci-dessous.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <Bloc libelle="Métier">
          <select value={f.metierId} onChange={f.onMetier} aria-label="Métier" data-fiche-metier="" style={CHAMP}>
            <option value="">Choisir un métier</option>
            {f.metiers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </Bloc>
        <Bloc libelle="Nom commercial">
          <input type="text" value={f.nomCommercial} onChange={f.onNomCommercial} maxLength={160} placeholder="Cabinet Bah" aria-label="Nom commercial" data-fiche-nom="" style={CHAMP} />
        </Bloc>
      </div>

      <Bloc libelle="Description">
        <textarea value={f.description} onChange={f.onDescription} rows={4} maxLength={f.descriptionMax} placeholder="Titres de séjour, recours…" aria-label="Description" data-fiche-description="" style={{ ...CHAMP, resize: 'vertical' }} />
      </Bloc>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <Bloc libelle="Tarifs indicatifs">
          <input type="text" value={f.tarifs} onChange={f.onTarifs} maxLength={300} placeholder="Consultation dès 80 €" aria-label="Tarifs indicatifs" data-fiche-tarifs="" style={CHAMP} />
        </Bloc>
        <Bloc libelle="Méthode de contact">
          <select value={f.methode} onChange={f.onMethode} aria-label="Méthode de contact" data-fiche-methode="" style={CHAMP}>
            {f.methodes.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
          </select>
          {f.aideMethode === '' ? null : <div style={{ fontSize: '11.5px', color: '#8A958F', marginTop: '6px' }}>{f.aideMethode}</div>}
        </Bloc>
      </div>

      <Bloc libelle="SIRET (facultatif)">
        <input type="text" inputMode="numeric" value={f.siret} onChange={f.onSiret} maxLength={14} placeholder="14 chiffres" aria-label="SIRET" data-fiche-siret="" style={CHAMP} />
      </Bloc>

      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Villes couvertes · 1 à {f.villesMax}</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {f.villesChoisies.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-label={`Retirer ${v.nom}`}
              onClick={() => {
                f.onRetirerVille(v.id);
              }}
              data-fiche-ville=""
              style={{ padding: '8px 13px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, background: '#fff', color: '#16211D', border: '1px solid #E6EBE9', font: 'inherit', cursor: 'pointer' }}
            >
              {v.nom} ×
            </button>
          ))}
          {f.villesChoisies.length >= f.villesMax ? null : (
            <select
              value=""
              onChange={f.onAjouterVille}
              aria-label="Ajouter une ville"
              data-fiche-ajouter-ville=""
              style={{ padding: '8px 13px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, background: '#fff', color: '#16785E', border: '1px solid #E6EBE9', font: 'inherit', cursor: 'pointer' }}
            >
              <option value="">+ Ajouter</option>
              {dispo.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nom}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <label
        data-fiche-justificatif=""
        style={{ border: '1.5px dashed #CBD5D1', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer', background: f.justificatifDepose ? '#EFF7F3' : '#fff' }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: f.justificatifDepose ? '#0F5C48' : '#16211D' }}>
          {f.justificatif !== ''
            ? `Justificatif déposé : ${f.justificatif}`
            : f.justificatifDepose
              ? 'Justificatif déjà déposé (déposer un autre le remplace)'
              : 'Déposer le justificatif (extrait SIRENE, attestation, carte professionnelle)'}
        </span>
        <span style={{ fontSize: '11.5px', color: '#8A958F' }}>Il n’est jamais affiché : seule l’équipe le consulte.</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            f.onJustificatif(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
      </label>

      <Refus texte={f.echec} />
      {f.succes === '' ? null : (
        <p role="status" data-fiche-succes="" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#0F5C48' }}>
          {f.succes}
        </p>
      )}
    </div>
  );
}
