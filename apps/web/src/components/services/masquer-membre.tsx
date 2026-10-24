'use client';

import type { VivantAnnonce } from '@/screens/services/use-annonce-logement';
import { Bloc, CHAMP } from './champs';

/**
 * AJOUT — « Masquer à un membre » (10 §2.3, `POST /housing/:id/hide-from`).
 *
 * La maquette dessine l'annonce VUE PAR UN LECTEUR (« Contacter », « Signaler ») ; elle
 * ne dessine pas ce que voit son AUTEUR. L'auteur ne se contacte pas lui-même : à la
 * place des deux boutons, ce bloc lui laisse désigner un membre (par son pseudo) à qui
 * l'annonce n'apparaîtra plus. Ce n'est PAS un blocage : la messagerie et le profil de
 * ce membre ne bougent pas, et les autres annonces de l'auteur restent visibles.
 *
 * Mesures : le châssis de la carte de la colonne de contexte de S02 (blanc, liseré
 * `#E6EBE9`, rayon 22, retrait 18), le champ et le bouton de `champs.tsx`.
 */
export function MasquerMembre({ v }: { readonly v: VivantAnnonce }) {
  return (
    <div
      data-masquer-membre=""
      style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>VOTRE ANNONCE</div>
      <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#5D6B66' }}>
        Vous pouvez la masquer à un membre précis, sans le bloquer.
      </div>
      <Bloc libelle="Pseudo du membre">
        <input type="text" value={v.masque} onChange={v.onMasque} placeholder="@pseudo" aria-label="Pseudo du membre" data-masque-pseudo="" style={CHAMP} />
      </Bloc>
      <button
        type="button"
        onClick={v.onMasquer}
        disabled={v.occupe || v.masque.trim() === ''}
        data-masquer=""
        style={{
          height: '44px',
          padding: '0 18px',
          borderRadius: '14px',
          background: '#fff',
          color: '#16211D',
          border: '1px solid #E6EBE9',
          font: 'inherit',
          fontSize: '13.5px',
          fontWeight: 700,
          cursor: 'pointer',
          opacity: v.occupe || v.masque.trim() === '' ? 0.55 : 1,
        }}
      >
        Masquer à ce membre
      </button>
    </div>
  );
}
