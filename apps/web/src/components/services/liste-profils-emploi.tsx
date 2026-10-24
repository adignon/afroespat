'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiFailure } from '@/lib/api/index';
import { chargerProfilsSuivants } from '@/screens/services/appels';
import type { VivantProfils } from '@/screens/services/use-contacter-membre';
import type { CarteProfil } from '@/screens/s04/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — L'ONGLET « PROFILS DISPONIBLES » (S04, lot E2)        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche d'ordinateur ne montre les profils que dans une carte de 300 px à droite,
 * et celle de 390 px ne les montre pas du tout. L'onglet « Profils disponibles » les
 * montre en pleine colonne, aux deux largeurs, avec les gestes de la carte voisine :
 *
 *   · la carte d'une offre de S04 (blanche, liseré `#E6EBE9`, rayon 22, retrait 18) ;
 *   · l'avatar rond, le nom (lien vers le profil public) et la pastille « vérifié »
 *     de la carte « PROFILS DISPONIBLES » ; les secteurs et contrats en pastilles
 *     grises `#F2F5F4` / `#5D6B66`, comme le contrat et le secteur d'une offre ;
 *   · « Contacter » : le bouton `#F2F5F4` de la même carte, il ouvre la conversation.
 *
 * États : VIDE (aucun profil publié — et l'invitation à publier le sien), « Voir plus »
 * (page suivante, avec son chargement et son échec). Le chargement initial et l'erreur
 * de la première page sont ceux de tout l'écran (`EcranDonnees`).
 */
export function ListeProfilsEmploi({
  profils,
  suite,
  vivant,
}: {
  readonly profils: readonly CarteProfil[];
  readonly suite: string | null;
  readonly vivant: VivantProfils;
}) {
  const [ajoutes, setAjoutes] = useState<readonly CarteProfil[]>([]);
  const [curseur, setCurseur] = useState<string | null>(suite);
  const [enVol, setEnVol] = useState(false);
  const [echec, setEchec] = useState('');

  const tous = [...profils, ...ajoutes];

  const voirPlus = (): void => {
    if (curseur === null || enVol) return;
    setEnVol(true);
    setEchec('');
    chargerProfilsSuivants(curseur, tous.length)
      .then((page) => {
        setAjoutes((a) => [...a, ...page.liste]);
        setCurseur(page.suite);
      })
      .catch((cause: unknown) => {
        setEchec(cause instanceof ApiFailure ? cause.displayMessage : 'Les profils suivants n’ont pas pu être chargés.');
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  if (tous.length === 0) {
    return (
      <div
        data-profils-emploi="vide"
        style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0 }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700 }}>Aucun profil disponible pour le moment</div>
        <div style={{ fontSize: '13px', color: '#5D6B66', marginTop: '4px', lineHeight: 1.5 }}>
          Les membres qui cherchent un emploi, un stage ou une alternance publient ici leur profil de recherche.
        </div>
        <Link
          href="/services/emploi?onglet=recherche"
          style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', fontWeight: 700, color: '#16785E', textDecoration: 'none' }}
        >
          Publier mon profil de recherche
        </Link>
      </div>
    );
  }

  return (
    <div data-profils-emploi="liste" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {tous.map((p) => (
        <div
          key={p.handle}
          style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {p.profil === undefined ? (
              <Avatar p={p} />
            ) : (
              <Link href={p.profil} data-avatar-profil="" aria-label={`Voir le profil de ${p.nom}`} style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}>
                <Avatar p={p} />
              </Link>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 700 }}>
                {p.profil === undefined ? (
                  p.nom
                ) : (
                  <Link href={p.profil} data-nom-profil="" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {p.nom}
                  </Link>
                )}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" />
                </svg>
              </span>
              <span style={{ display: 'block', fontSize: '12px', color: '#8A958F' }}>{p.ville ?? 'Ville non renseignée'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                vivant.onContacter(p.handle, p.prenom);
              }}
              disabled={vivant.occupe}
              style={{ borderRadius: '14px', background: '#F2F5F4', color: '#16211D', border: 'none', font: 'inherit', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap', flexShrink: 0, height: '34px', padding: '0 12px', fontSize: '12px', cursor: 'pointer' }}
            >
              Contacter
            </button>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '12px' }}>{p.titre}</div>
          {p.secteurs.length + p.contrats.length === 0 ? null : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
              {[...p.contrats, ...p.secteurs].map((e) => (
                <span
                  key={e}
                  style={{ background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}
                >
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {echec === '' ? null : (
        <p role="alert" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#B4581F' }}>
          {echec}
        </p>
      )}
      {curseur === null ? null : (
        <button
          type="button"
          onClick={voirPlus}
          disabled={enVol}
          data-profils-emploi-plus=""
          style={{ height: '44px', padding: '0 18px', borderRadius: '14px', background: '#F2F5F4', color: '#16211D', border: 'none', font: 'inherit', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', opacity: enVol ? 0.6 : 1 }}
        >
          {enVol ? 'Chargement…' : 'Voir plus de profils'}
        </button>
      )}
    </div>
  );
}

function Avatar({ p }: { readonly p: CarteProfil }) {
  return (
    <span
      style={{ width: '34px', height: '34px', borderRadius: '999px', background: p.fond, color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      {p.initiales}
    </span>
  );
}
