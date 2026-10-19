'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STAFF_SCOPES, adminStaffSessionResponseSchema, loggedOutSchema, type StaffRoleValue } from '@app/shared';
import { ApiError, staffApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LA SESSION D'ÉQUIPE, LUE UNE FOIS POUR TOUTES LES PAGES D'ÉQUIPE    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le cookie `dp_staff` est `HttpOnly` : le front ne peut pas le lire, et il n'existe
 * aucun équivalent d'`hasAccessToken()` côté équipe. Ce fournisseur demande donc au
 * serveur « qui suis-je ? » (`POST /admin/auth/session`) au montage de l'application
 * d'équipe, et en tire deux choses :
 *
 *   · le RÔLE, pour ÉTEINDRE les boutons que ce rôle ne peut pas employer (§2.2) —
 *     jamais pour autoriser : le serveur décide, `peut()` ne fait que prévenir ;
 *   · l'absence de session : `401 STAFF_SESSION_REQUIRED` renvoie vers
 *     `/admin/connexion`. Aucune page d'équipe ne s'ouvre sans connexion.
 *
 * Ce module n'importe QUE `staffApi` : la règle dure §2.1 (hermétisme des deux
 * domaines) tient jusque dans cette couche, comme dans `screens/administration`.
 */

export interface Equipe {
  readonly staffId: string;
  readonly role: StaffRoleValue;
  readonly nom: string;
}

interface Contexte {
  readonly equipe: Equipe | null;
  readonly deconnecter: () => Promise<void>;
}

const Ctx = createContext<Contexte>({ equipe: null, deconnecter: () => Promise.resolve() });

export const useEquipe = (): Contexte => useContext(Ctx);

/** Le rôle de la session couvre-t-il ce périmètre du §2.2 ? Faux tant que la session n'est pas lue. */
export function useDroit(scope: keyof typeof STAFF_SCOPES): boolean {
  const { equipe } = useEquipe();
  return equipe !== null && (STAFF_SCOPES[scope] as readonly string[]).includes(equipe.role);
}

export function FournisseurEquipe({ children }: { readonly children: ReactNode }) {
  const chemin = usePathname();
  const router = useRouter();
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const surConnexion = chemin.startsWith('/admin/connexion');

  useEffect(() => {
    if (surConnexion) return;
    let annule = false;
    staffApi.post('/auth/session', adminStaffSessionResponseSchema).then(
      (s) => {
        if (!annule) setEquipe({ staffId: s.staffId, role: s.role, nom: s.displayName ?? '' });
      },
      (erreur: unknown) => {
        if (annule) return;
        if (erreur instanceof ApiError && erreur.status === 401) router.replace('/admin/connexion');
      },
    );
    return () => {
      annule = true;
    };
  }, [surConnexion, router]);

  const deconnecter = useCallback(async () => {
    try {
      await staffApi.post('/auth/logout', loggedOutSchema);
    } finally {
      setEquipe(null);
      router.replace('/admin/connexion');
    }
  }, [router]);

  const valeur = useMemo(() => ({ equipe, deconnecter }), [equipe, deconnecter]);
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}
