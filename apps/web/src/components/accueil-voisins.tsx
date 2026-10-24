'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  CONNECTION_MESSAGE_MIN,
  connectionSuggestionsResponseSchema,
  mentorsResponseSchema,
} from '@app/shared';
import { z } from 'zod';
import { ApiError, memberApi } from '@/lib/api/index';
import { fondAvatar } from '@/lib/avatar';
import { useMembreBarre } from '@/components/barre-haute/membre';
import { notifyError, notifySuccess } from '@/components/notifications';
import { avatarColor, initials } from '@/screens/accueil/from-api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT (hors maquette) — LES DEUX CARTES DE LA COLONNE DROITE DE /accueil   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Constat de l'audit (A01, 1440 px) :
 *   · « Saluer », deux boutons sans gestionnaire dans « NOUVEAUX ARRIVANTS » ;
 *   · « PARRAINS ET CONTACTS » : un titre seul. La carte ne montrait que les
 *     contacts EN LIGNE (`GET /feed/sidebar`), donc rien pour quelqu'un qui n'a
 *     encore ni contact ni parrain connecté.
 *
 * ── « SALUER » = UNE DEMANDE DE CONTACT AVEC UN MOT D'ACCUEIL ───────────────
 *
 * `POST /connection-requests` est ouverte dès le niveau 0 (« ajouter des
 * contacts »), alors qu'un message direct demande le niveau 1 : saluer ne doit
 * pas être refusé à celui qu'on veut justement accueillir. Le mot d'accueil est
 * celui que le serveur propose (`newArrivals.greetingHint`), et à défaut une
 * phrase qui respecte le minimum de `CONNECTION_MESSAGE_MIN`. États : envoi en
 * cours, « Demande envoyée » (verrouillé), « Déjà en contact » (409
 * ALREADY_CONNECTED), « Demande en attente » (409 REQUEST_PENDING), et pour toute
 * autre erreur (limite quotidienne, blocage, niveau) la phrase du serveur, dans
 * la notification — le bouton reste disponible pour réessayer.
 *
 * ── LA CARTE « PARRAINS ET CONTACTS » ───────────────────────────────────────
 *
 * Les contacts en ligne gardent leur dessin. Quand il n'y en a aucun, la carte
 * ne reste pas muette : elle lit `GET /mentors` (parrains disponibles) et
 * `GET /me/connection-suggestions`, chaque ligne menant au profil, et dit
 * honnêtement « Personne à suggérer pour le moment » quand les deux sont vides.
 * Aucune valeur n'est inventée : tout vient des deux routes.
 */

export const MOT_PAR_DEFAUT = 'Bienvenue ! Si vous avez une question sur la ville, écrivez-moi.';

type Etat = 'repos' | 'envoi' | 'envoyee' | 'contact' | 'attente';

export function BoutonSaluer({
  handle,
  nom,
  mot,
  style,
}: {
  readonly handle: string | null | undefined;
  readonly nom: string;
  readonly mot?: string | undefined;
  readonly style: CSSProperties;
}) {
  const [etat, setEtat] = useState<Etat>('repos');
  const message =
    mot !== undefined && mot.trim().length >= CONNECTION_MESSAGE_MIN ? mot.trim() : MOT_PAR_DEFAUT;

  const saluer = () => {
    if (handle === null || handle === undefined || etat !== 'repos') return;
    setEtat('envoi');
    memberApi
      .post('/connection-requests', z.unknown(), { body: { toHandle: handle, message } })
      .then(() => {
        setEtat('envoyee');
        notifySuccess(`Votre demande est partie à ${nom}.`);
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.code === 'ALREADY_CONNECTED') {
          setEtat('contact');
          return;
        }
        if (cause instanceof ApiError && cause.code === 'REQUEST_PENDING') {
          setEtat('attente');
          return;
        }
        setEtat('repos');
        notifyError(cause instanceof ApiError ? cause.displayMessage : 'La demande n’a pas pu partir.');
      });
  };

  const libelle: Record<Etat, string> = {
    repos: 'Saluer',
    envoi: 'Envoi…',
    envoyee: 'Demande envoyée',
    contact: 'Déjà en contact',
    attente: 'Demande en attente',
  };
  const verrouille = etat !== 'repos';
  return (
    <button
      type="button"
      onClick={saluer}
      disabled={handle === null || handle === undefined || verrouille}
      aria-live="polite"
      data-arrivant-saluer=""
      data-etat={etat}
      style={{
        ...style,
        cursor: verrouille ? 'default' : 'pointer',
        ...(etat === 'repos' || etat === 'envoi'
          ? {}
          : { backgroundColor: '#E3F0EB', color: '#0F5C48', whiteSpace: 'nowrap' }),
      }}
    >
      {libelle[etat]}
    </button>
  );
}

interface Ligne {
  readonly cle: string;
  readonly nom: string;
  readonly handle: string;
  readonly sous: string;
  readonly i: string;
  readonly fond: string;
}

function ligneDe(handle: string, nom: string, avatar: string | null, sous: string, cle: string): Ligne {
  const photo = fondAvatar(avatar === null ? null : avatar.startsWith('/') ? avatar : `/media/${avatar}`);
  return {
    cle,
    nom,
    handle,
    sous,
    i: photo === null ? initials(nom) : '',
    fond: photo ?? avatarColor(handle),
  };
}

/**
 * Sous les contacts en ligne : parrains disponibles puis suggestions de contact.
 * Ne demande rien quand des contacts sont déjà affichés (`actif` faux).
 */
export function SuggestionsParrains({ actif }: { readonly actif: boolean }) {
  const moi = useMembreBarre();
  const [etat, setEtat] = useState<'chargement' | 'ok' | 'echec'>('chargement');
  const [lignes, setLignes] = useState<readonly Ligne[]>([]);

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    Promise.all([
      memberApi.get('/mentors?limit=6', mentorsResponseSchema),
      memberApi.get('/me/connection-suggestions', connectionSuggestionsResponseSchema),
    ]).then(
      ([parrains, suggestions]) => {
        if (!vivant) return;
        const vus = new Set<string>();
        const out: Ligne[] = [];
        for (const m of parrains.items) {
          if (!m.isAvailable || m.handle === moi?.handle || vus.has(m.handle)) continue;
          vus.add(m.handle);
          out.push(
            ligneDe(m.handle, m.displayName, m.avatarUrl, `Parrain·e${m.city === null ? '' : ` · ${m.city.name}`}`, `p-${m.userId}`),
          );
        }
        for (const s of suggestions.items) {
          if (vus.has(s.user.handle)) continue;
          vus.add(s.user.handle);
          out.push(ligneDe(s.user.handle, s.user.displayName, null, s.reason, `s-${s.refId}-${s.user.id}`));
        }
        setLignes(out.slice(0, 5));
        setEtat('ok');
      },
      () => {
        if (vivant) setEtat('echec');
      },
    );
    return () => {
      vivant = false;
    };
  }, [actif, moi?.handle]);

  if (!actif) return null;
  const texte: CSSProperties = { marginTop: '12px', fontSize: '12.5px', lineHeight: 1.5, color: '#5D6B66' };
  if (etat === 'chargement') return <div style={texte} role="status">Chargement…</div>;
  if (etat === 'echec') return <div style={texte} role="alert">Les suggestions ne se sont pas chargées. Rechargez la page pour réessayer.</div>;
  if (lignes.length === 0) {
    return (
      <div style={texte} data-parrains-vide="">
        Personne n’est en ligne pour le moment, et aucun parrain ni contact à vous suggérer. Revenez bientôt.
      </div>
    );
  }
  return (
    <>
      <div style={{ ...texte, marginTop: '10px', fontSize: '11.5px', color: '#8A958F' }}>Personne en ligne : voici qui vous pourriez contacter.</div>
      {lignes.map((l) => (
        <div key={l.cle} data-parrain-suggestion="" style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: '12px' }}>
          <Link
            href={`/@${l.handle}`}
            aria-label={`Voir le profil de ${l.nom}`}
            style={{ width: '36px', height: '36px', borderRadius: '999px', background: l.fond, color: '#fff', fontSize: '10.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
          >
            {l.i}
          </Link>
          <span style={{ minWidth: 0 }}>
            <Link href={`/@${l.handle}`} style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>
              {l.nom}
            </Link>
            <span style={{ display: 'block', fontSize: '11.5px', color: '#8A958F' }}>{l.sous}</span>
          </span>
        </div>
      ))}
    </>
  );
}
