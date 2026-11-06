'use client';

import { STAFF_SCOPES, type StaffRoleValue } from '@app/shared';
import { C, Carte, Etiquette } from '../ui';

/**
 * LA MATRICE DES RÔLES ET DES DROITS (15 §2.2) — en lecture seule, tirée de `STAFF_SCOPES` : l'écran ne peut donc pas
 * diverger de ce que le serveur applique. Chaque ligne est un périmètre, chaque colonne un rôle.
 */

export const ROLES_ORDRE: readonly { readonly valeur: StaffRoleValue; readonly libelle: string }[] = [
  { valeur: 'SUPER_ADMIN', libelle: 'Super-administrateur' },
  { valeur: 'CONTENT_ADMIN', libelle: 'Contenu' },
  { valeur: 'MODERATOR', libelle: 'Modération' },
  { valeur: 'SUPPORT', libelle: 'Support' },
];

export const PERIMETRES: Readonly<Record<keyof typeof STAFF_SCOPES, string>> = {
  staffAdmin: 'Comptes équipe, rôles, feature flags, paramètres sensibles',
  content: 'Modèles, référentiels, pages, annonces, alertes arnaques, partenaires',
  moderation: 'File de modération : masquer, avertir, suspendre',
  memberRead: 'Lire une fiche membre complète',
  rgpd: 'Export et suppression RGPD, remboursements',
  proReview: 'Valider les fiches professionnelles (justificatifs)',
  dashboard: 'Tableaux de bord, alertes et journal d’audit',
  settings: 'Paramètres système (le registre resserre clé par clé)',
  erase: 'Suppression définitive d’un compte et de ses contenus',
};

export interface LigneMatrice {
  readonly scope: keyof typeof STAFF_SCOPES;
  readonly libelle: string;
  readonly roles: ReadonlySet<StaffRoleValue>;
}

export function lignesMatrice(): readonly LigneMatrice[] {
  return (Object.keys(STAFF_SCOPES) as (keyof typeof STAFF_SCOPES)[]).map((scope) => ({
    scope,
    libelle: PERIMETRES[scope],
    roles: new Set(STAFF_SCOPES[scope] as readonly StaffRoleValue[]),
  }));
}

export function MatriceRoles() {
  const lignes = lignesMatrice();
  return (
    <Carte style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 4px' }}>
        <Etiquette>Rôles et droits</Etiquette>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: C.gris }}>
          Lecture seule. Cette matrice est celle que le serveur applique ; un rôle se change dans l’onglet Équipe (super-administrateur).
        </p>
      </div>
      <div data-admin-defile="" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '13px' }}>
          <caption className="admin-sr-seul">Droits de chaque rôle par périmètre</caption>
          <thead>
            <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              <th scope="col" style={{ padding: '12px 14px', fontWeight: 700 }}>Périmètre</th>
              {ROLES_ORDRE.map((r) => (
                <th key={r.valeur} scope="col" style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'center' }}>{r.libelle}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.scope} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                <th scope="row" style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'left' }}>{l.libelle}</th>
                {ROLES_ORDRE.map((r) => (
                  <td key={r.valeur} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: l.roles.has(r.valeur) ? C.vertFonce : C.grisClair }}>
                    <span aria-hidden="true">{l.roles.has(r.valeur) ? '✓' : '—'}</span>
                    <span className="admin-sr-seul">{l.roles.has(r.valeur) ? 'Autorisé' : 'Non autorisé'}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}
