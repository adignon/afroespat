'use client';

import { GENRES_EMPLOI, type FormulaireOffreView } from '@/screens/services/use-offre';
import { Bloc, CHAMP, Interrupteur, Pastilles, Refus } from './champs';

/**
 * AJOUT — les champs de « PUBLIER UNE OFFRE » (S05), aux deux largeurs.
 *
 * La planche de 1 440 px dessine intitulé, entreprise, ville, lien de candidature
 * et la ligne « Sponsoriser 14 jours » ; celle de 390 px ne dessine aucun formulaire
 * (la planche mobile n'est que le détail d'une offre). Ce composant pose, aux deux
 * largeurs, les champs que `createJobSchema` demande, avec les mesures de
 * `champs.tsx` : un téléphone peut donc publier une offre.
 *
 * Ce que la maquette ne dessine pas et qu'on AJOUTE : le genre (emploi, stage,
 * alternance, mission), le secteur, le contrat et la description (30 caractères au
 * moins : `createJobSchema`). Le bouton « Publier l'offre » est CELUI DE LA MAQUETTE,
 * câblé par l'adaptation.
 */
export function ChampsOffre({ f, mobile = false }: { readonly f: FormulaireOffreView; readonly mobile?: boolean }) {
  return (
    <div data-champs-offre="" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Pastilles valeurs={GENRES_EMPLOI} valeur={f.kind} onChoisir={f.onKind} libelle="Genre d’offre" />
      <Bloc libelle="Intitulé">
        <input type="text" value={f.titre} onChange={f.onTitre} maxLength={140} placeholder="Comptable junior" aria-label="Intitulé" data-offre-titre="" style={CHAMP} />
      </Bloc>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <Bloc libelle="Entreprise">
          <input type="text" value={f.entreprise} onChange={f.onEntreprise} maxLength={160} placeholder="Cabinet Arvel" aria-label="Entreprise" data-offre-entreprise="" style={CHAMP} />
        </Bloc>
        <Bloc libelle="Ville (facultative)">
          <select value={f.villeId} onChange={f.onVille} aria-label="Ville" data-offre-ville="" style={CHAMP}>
            <option value="">National ou télétravail</option>
            {f.villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
        </Bloc>
        <Bloc libelle="Contrat">
          <input type="text" value={f.contrat} onChange={f.onContrat} maxLength={80} placeholder="CDI" aria-label="Contrat" data-offre-contrat="" style={CHAMP} />
        </Bloc>
        <Bloc libelle="Secteur">
          <input type="text" value={f.secteur} onChange={f.onSecteur} maxLength={80} placeholder="Comptabilité" aria-label="Secteur" data-offre-secteur="" style={CHAMP} />
        </Bloc>
      </div>
      <Bloc libelle="Description">
        <textarea value={f.description} onChange={f.onDescription} rows={5} maxLength={5000} placeholder="Missions, profil recherché… (30 caractères au moins)" aria-label="Description" data-offre-description="" style={{ ...CHAMP, resize: 'vertical' }} />
      </Bloc>
      <Bloc libelle="Lien de candidature">
        <input type="url" value={f.lien} onChange={f.onLien} maxLength={500} placeholder="https://…" aria-label="Lien de candidature" data-offre-lien="" style={CHAMP} />
      </Bloc>
      <div style={{ background: '#FBE3D4', borderRadius: '16px', padding: '2px 14px' }}>
        <Interrupteur libelle="Sponsoriser 14 jours" allume={f.sponsoriser} onBascule={f.onSponsoriser} />
        <div style={{ fontSize: '12px', color: '#5D6B66', paddingBottom: '10px' }}>La mention « Sponsorisée » est toujours affichée sur l’offre.</div>
      </div>
      <Refus texte={f.echec} />
    </div>
  );
}
