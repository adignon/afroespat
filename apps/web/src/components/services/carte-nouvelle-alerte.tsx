'use client';

import type { FormulaireAlerteView } from '@/screens/services/use-alertes';
import { Bloc, CHAMP, Pastilles, Refus } from './champs';

/**
 * AJOUT — la carte « NOUVELLE ALERTE » de S10, aux deux largeurs.
 *
 * La planche de 1 440 px la dessine (genre, quartiers, budget, type de bien, bouton
 * « Enregistrer l'alerte ») ; celle de 390 px NE LA DESSINE PAS : un téléphone
 * pouvait lister ses alertes mais jamais en créer. Ce composant la pose aux deux
 * largeurs, avec le châssis de la carte de la planche d'ordinateur (blanc, liseré
 * `#E6EBE9`, rayon 22, retrait 18 ; titre 10,5 px / 700 / `1px`) et le bouton vert
 * `#16785E` de 48 px au rayon 14.
 *
 * Les champs suivent le genre (`alertCriteriaSchema`) : logement → type, ville,
 * budget ; emploi → secteur, contrat. « Quartiers » devient « Ville » : l'alerte se
 * fonde sur `cityId` (il n'y a pas de critère de quartier côté serveur).
 */
const GENRES = [
  { valeur: 'HOUSING', libelle: 'Logement' },
  { valeur: 'JOB', libelle: 'Emploi' },
] as const;

const TYPES = [
  { valeur: '', libelle: 'Tous' },
  { valeur: 'FLATSHARE', libelle: 'Colocation' },
  { valeur: 'RENT', libelle: 'Location' },
  { valeur: 'TEMPORARY', libelle: 'Temporaire' },
] as const;

export function CarteNouvelleAlerte({ f }: { readonly f: FormulaireAlerteView }) {
  return (
    <div
      id="nouvelle-alerte"
      data-nouvelle-alerte=""
      style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0 }}
    >
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>NOUVELLE ALERTE</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        <Pastilles valeurs={GENRES} valeur={f.genre} onChoisir={f.onGenre} libelle="Genre d’alerte" />

        {f.genre === 'HOUSING' ? (
          <>
            <Pastilles
              valeurs={TYPES}
              valeur={f.logementKind}
              onChoisir={(v) => {
                f.onLogementKind(v as typeof f.logementKind);
              }}
              libelle="Type de logement"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <Bloc libelle="Ville">
                <select value={f.villeId} onChange={f.onVille} aria-label="Ville" data-alerte-ville="" style={CHAMP}>
                  <option value="">Toutes les villes</option>
                  {f.villes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nom}
                    </option>
                  ))}
                </select>
              </Bloc>
              <Bloc libelle="Budget maximum">
                <input type="text" inputMode="decimal" value={f.budget} onChange={f.onBudget} placeholder="500 €" aria-label="Budget maximum" data-alerte-budget="" style={CHAMP} />
              </Bloc>
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <Bloc libelle="Secteur">
              <input type="text" value={f.secteur} onChange={f.onSecteur} maxLength={80} placeholder="Restauration" aria-label="Secteur" data-alerte-secteur="" style={CHAMP} />
            </Bloc>
            <Bloc libelle="Type de contrat">
              <input type="text" value={f.contrat} onChange={f.onContrat} maxLength={80} placeholder="CDI" aria-label="Type de contrat" data-alerte-contrat="" style={CHAMP} />
            </Bloc>
          </div>
        )}

        <Refus texte={f.echec} />
        {f.succes === '' ? null : (
          <p role="status" data-alerte-succes="" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#0F5C48' }}>
            {f.succes}
          </p>
        )}

        <button
          type="button"
          onClick={f.onEnregistrer}
          disabled={f.occupe}
          data-alerte-enregistrer=""
          style={{
            padding: '0 18px',
            borderRadius: '14px',
            background: '#16785E',
            color: '#fff',
            border: 'none',
            font: 'inherit',
            fontSize: '13.5px',
            fontWeight: 700,
            height: '48px',
            width: '100%',
            cursor: 'pointer',
            opacity: f.occupe ? 0.55 : 1,
          }}
        >
          Enregistrer l’alerte
        </button>
      </div>
    </div>
  );
}
