'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { C, Pastille } from './ui';
import { useEquipe } from './session-equipe';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LA BARRE HAUTE DE L'ÉQUIPE, VIVANTE                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Remplace la barre de la maquette (60 px, collante, fond `#F6F8F7`) : une recherche
 * inerte, deux pastilles « Lyon ▾ » et « 30 derniers jours ▾ » sans geste, et un
 * avatar « RA » écrit en dur.
 *
 *   · la recherche mène à la fiche membre (`/admin/membres?q=…`) — c'est ce que 15
 *     §3.1 en fait : la barre cherche un membre, par pseudo, nom, e-mail ou numéro
 *     (l'empreinte HMAC, jamais le numéro affiché) ;
 *   · « Lyon » et « 30 derniers jours » DISPARAISSENT : aucun écran ne filtre par
 *     ville ni par période, elles ne faisaient rien et laissaient croire le contraire
 *     (« chaque bouton dessiné fait quelque chose de réel, ou disparaît ») ;
 *   · l'avatar porte les initiales de la session et ouvre un menu — le nom, le rôle,
 *     « Se déconnecter » (la maquette n'en dessine aucun, et sans lui on ne pouvait
 *     pas fermer sa session).
 *
 * La géométrie est celle de la maquette : hauteur 64, collante, `zIndex: 20`, champ
 * de 40 px en pilule `#EEF2F0`, avatar rond de 36 px `#0F5C48`.
 */

const ROLES: Record<string, string> = {
  SUPER_ADMIN: 'Super-administrateur',
  CONTENT_ADMIN: 'Contenu',
  MODERATOR: 'Modération',
  SUPPORT: 'Support',
};

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m.length > 0);
  if (mots.length === 0) return '·';
  return mots
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('');
}

export function BarreAdmin() {
  const router = useRouter();
  const { equipe, deconnecter } = useEquipe();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);

  return (
    <div
      data-admin-bar=""
      style={{ height: '64px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 20, background: C.fond }}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const v = q.trim();
          if (v.length >= 2) router.push(`/admin/membres?q=${encodeURIComponent(v)}`);
        }}
        style={{ flex: '0 1 360px', minWidth: 0 }}
      >
        <label
          style={{ height: '40px', borderRadius: '999px', background: C.aplat, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', color: C.grisClair, fontSize: '13px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4" />
          </svg>
          <input
            aria-label="Rechercher un membre"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un membre"
            style={{ border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: C.encre, width: '100%', minWidth: 0 }}
          />
        </label>
      </form>
      <span style={{ flex: '1' }} />
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="Mon compte"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          style={{ width: '36px', height: '36px', borderRadius: '999px', background: C.vertFonce, color: '#fff', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {equipe === null ? '·' : initiales(equipe.nom)}
        </button>
        {menu ? (
          <div
            role="menu"
            style={{ position: 'absolute', right: 0, top: '44px', width: '240px', background: '#fff', border: `1px solid ${C.trait}`, borderRadius: '18px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 30 }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{equipe?.nom ?? '…'}</div>
            {equipe === null ? null : <Pastille ton="vert">{ROLES[equipe.role] ?? equipe.role}</Pastille>}
            <button
              type="button"
              role="menuitem"
              onClick={() => void deconnecter()}
              style={{ height: '40px', borderRadius: '12px', border: 'none', background: C.aplat, color: C.encre, font: 'inherit', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
            >
              Se déconnecter
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
