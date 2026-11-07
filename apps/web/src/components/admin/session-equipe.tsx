'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STAFF_SCOPES, adminStaffSessionResponseSchema, loggedOutSchema, type StaffRoleValue } from '@app/shared';
import Link from 'next/link';
import { ApiError, staffApi } from '@/lib/api/index';
import { entreeDuChemin, peutOuvrir, quiPeut } from './navigation-admin';
import { sessionRetablie, surSessionPerdue, urlConnexion } from '@/lib/api/staff-session';

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

  /** Session perdue en cours de route (inactivité, 8 h, révocation) : un seul renvoi, avec la page d'origine en `suite`. */
  useEffect(
    () =>
      surSessionPerdue((url) => {
        setEquipe(null);
        router.replace(url);
      }),
    [router],
  );

  useEffect(() => {
    if (surConnexion) return;
    let annule = false;
    staffApi.post('/auth/session', adminStaffSessionResponseSchema).then(
      (s) => {
        if (!annule) sessionRetablie();
        if (!annule) setEquipe({ staffId: s.staffId, role: s.role, nom: s.displayName ?? '' });
      },
      (erreur: unknown) => {
        if (annule) return;
        if (erreur instanceof ApiError && erreur.status === 401) router.replace(urlConnexion(chemin, false));
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
  /**
   * RIEN N'EST MONTRÉ AVANT QUE LA SESSION SOIT CONNUE.
   *
   * Constat : sans session, le tableau de bord s'affichait quelques secondes, puis la page de connexion le remplaçait
   * (la réponse 401 n'arrive qu'après le premier rendu). Les écrans d'administration n'apparaissent donc qu'une fois
   * l'équipe identifiée ; d'ici là, un simple rond d'attente. La page de connexion, elle, s'affiche tout de suite.
   */
  const ici = entreeDuChemin(chemin);
  const interdit = !surConnexion && equipe !== null && ici !== null && !peutOuvrir(equipe.role, ici.entree);
  const contenu = surConnexion ? children : equipe === null ? <AttenteSession /> : interdit && ici !== null ? <AccesReserve libelle={ici.entree.libelle} qui={quiPeut(ici.entree.roles ?? ici.entree.scope)} /> : children;
  return <Ctx.Provider value={valeur}>{contenu}</Ctx.Provider>;
}

/**
 * GARDE DE ROUTE CÔTÉ ÉCRAN : un rôle qui ouvre une adresse que le rail lui cache voit le motif, pas une page de lectures
 * refusées l'une après l'autre. Ce n'est qu'une explication — le serveur reste le seul juge.
 */
export function AccesReserve({ libelle, qui }: { readonly libelle: string; readonly qui: string }) {
  return (
    <main id="contenu-admin" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F6F8F7', padding: '24px' }}>
      <div role="alert" style={{ maxWidth: '460px', background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Accès réservé à {qui}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#5D6B66' }}>
          La page « {libelle} » n’est pas ouverte à votre rôle. Si vous en avez besoin, demandez à un administrateur d’ajuster votre rôle.
        </p>
        <Link href="/admin" style={{ fontSize: '14px', fontWeight: 700, color: '#0F5C48' }}>
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}

function AttenteSession() {
  return (
    <div role="status" aria-label="Vérification de la session" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F6F8F7' }}>
      <span style={{ width: 28, height: 28, boxSizing: 'border-box', border: '3px solid #16785E', borderRightColor: 'transparent', borderRadius: '50%', animation: 'rond-bouton 0.7s linear infinite' }} />
    </div>
  );
}
