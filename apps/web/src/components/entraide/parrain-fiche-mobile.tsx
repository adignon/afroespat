'use client';

import Link from 'next/link';
import type { H06Data } from '@/screens/h06/data';
import { BoutonDemander } from './parrainage-vivant';
import { SignalerArgent } from './signaler-argent';

/**
 * AJOUT — H06 sur téléphone : la fiche d'un parrain à 390 px.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ POURQUOI CE COMPOSANT EXISTE                                               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette (`05 Entraide`) ne dessine H06 qu'à 1440 px : sa planche « MOBILE »
 * montre la feuille de demande, pas la fiche. `ScreenFrames` servait donc le cadre
 * d'ordinateur à toutes les largeurs, et à 390 px la page débordait (400 px mesurés :
 * colonne gauche de 400 px + colonne droite de 300 px dans un écran de 390).
 *
 * Il est composé ici, à la main, avec LES MÊMES BRIQUES que le cadre d'ordinateur
 * — `BoutonDemander`, `SignalerArgent`, la pastille de disponibilité, la grille de
 * trois chiffres, les évaluations — et le langage visuel des cadres voisins :
 *
 *   · l'en-tête de H08 sur téléphone (pastille de retour 40 px `#EEF2F0`, titre 16 px
 *     gras tronqué) ;
 *   · le corps de H05 (gouttière de 16 px, cartes blanches `#E6EBE9`, rayon 22) ;
 *   · le pied collé de H04 : bouton plein `#16785E` de 44 px, rayon 14.
 *
 * AUCUNE COULEUR NOUVELLE, aucun rouge. Toutes les valeurs sont relevées dans
 * `screens/h06/desktop.generated.tsx` et `screens/h08/mobile.generated.tsx`.
 *
 * Les DONNÉES sont celles de l'ordinateur (`H06Data`, de `GET /mentors/:handle`) :
 * même requête, mêmes états (chargement / erreur gérés par `EcranDonnees`), mêmes
 * gestes (« Demander comme parrain », « Signaler »). Seule la mise en page change :
 * une colonne, sans rail ni colonne de droite.
 */
const CARTE = {
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '22px',
  flexShrink: 0,
} as const;

export function ParrainFicheMobile({ parrain, evaluations }: H06Data) {
  return (
    <main style={{ display: 'contents' }}>
      <div
        style={{
          padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fff',
          borderBottom: '1px solid #E6EBE9',
          flexShrink: 0,
        }}
      >
        <Link
          href="/parrainage"
          aria-label="Retour aux parrains"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '999px',
            background: '#EEF2F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <span
          style={{
            fontSize: '16px',
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Fiche du parrain
        </span>
      </div>

      <div style={{ flexGrow: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
        <div style={{ ...CARTE, padding: '10px' }}>
          <div
            style={{
              position: 'relative',
              height: '168px',
              borderRadius: '16px',
              background: '#16785E1F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '104px',
                height: '104px',
                borderRadius: '999px',
                background: 'repeating-linear-gradient(135deg,#DCE6E1 0 12px,#D2DED8 12px 24px)',
                border: '5px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 800,
                color: '#16785E',
              }}
            >
              {parrain.initiales}
            </div>
            <span style={{ position: 'absolute', top: '10px', right: '10px' }}>
              <span
                style={{
                  background: parrain.dispo.fond,
                  color: parrain.dispo.texte,
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                }}
              >
                {parrain.dispo.libelle}
              </span>
            </span>
          </div>
          <div style={{ padding: '16px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '21px',
                fontWeight: 800,
                letterSpacing: '-0.6px',
                maxWidth: '100%',
                overflowWrap: 'anywhere',
              }}
            >
              {parrain.nom}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#16785E" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" />
              </svg>
            </h1>
            <div style={{ fontSize: '13px', color: '#8A958F', marginTop: '4px' }}>{parrain.situation}</div>
            <p style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 1.65, overflowWrap: 'anywhere' }}>{parrain.bio}</p>
            {parrain.types.length > 0 ? (
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {parrain.types.map((t) => (
                  <span
                    key={t}
                    style={{ background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginTop: '16px', width: '100%', textAlign: 'left' }}>
              {[
                { valeur: String(parrain.menes), libelle: 'parrainages menés' },
                { valeur: parrain.note, libelle: 'note moyenne' },
                { valeur: '3 mois', libelle: 'durée habituelle' },
              ].map((c) => (
                <div key={c.libelle} style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '18px', padding: '12px' }}>
                  <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.6px', color: '#16211D', whiteSpace: 'nowrap' }}>{c.valeur}</div>
                  <div style={{ fontSize: '11.5px', color: '#5D6B66', marginTop: '2px' }}>{c.libelle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...CARTE, padding: '16px 18px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>ÉVALUATIONS</div>
          {evaluations.map((e, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #F0F3F2' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <svg key={n} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E0733A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                  </svg>
                ))}
              </div>
              <div style={{ fontSize: '13.5px', marginTop: '4px', overflowWrap: 'anywhere' }}>« {e.commentaire} »</div>
              <div style={{ fontSize: '12px', color: '#8A958F', marginTop: '2px' }}>{e.auteur}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#FDF0E7', borderRadius: '22px', padding: '16px', flexShrink: 0 }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#B4581F' }}>RÈGLE</div>
          <div style={{ fontSize: '13px', lineHeight: 1.55, marginTop: '6px' }}>Aucun versement entre membres pour une démarche administrative.</div>
          <SignalerArgent
            style={{ display: 'inline-block', marginTop: '8px', fontSize: '12.5px', fontWeight: 700, color: '#B4581F' }}
            sujet={parrain.signalement}
          />
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          flexShrink: 0,
          background: '#fff',
          borderTop: '1px solid #E6EBE9',
          padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <BoutonDemander
          handle={parrain.handle}
          nom={parrain.nom}
          complet={parrain.complet}
          libelle={`Demander comme ${parrain.appellation}`}
          style={{
            height: '44px',
            padding: '0 18px',
            borderRadius: '14px',
            background: '#16785E',
            color: '#fff',
            border: 'none',
            font: 'inherit',
            fontSize: '13.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            width: '100%',
          }}
        />
        <div style={{ fontSize: '12px', color: '#5D6B66', textAlign: 'center', marginTop: '8px' }}>Réponse sous 7 jours</div>
      </div>
    </main>
  );
}
