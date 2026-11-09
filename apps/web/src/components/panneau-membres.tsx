'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HELP_TYPE_LABELS, type PublicProfileResponse } from '@app/shared';
import { displayMessageFor } from '@/lib/api/index';
import { fondAvatar } from '@/lib/avatar';
import { fetchProfilMembre } from '@/screens/reseaux/api';
import type { MembreAdminRowView } from '@/screens/a08t/data';
import type { MembreChoisiView } from '@/screens/a08t/vivant';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ONGLET « MEMBRES » : LA LISTE, OU L'APERÇU DU MEMBRE CHOISI              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « les membres s'affichent sur le côté droit sur PC et le clic
 * affiche leur profil avec l'option back. On peut ajouter une animation au
 * changement. »
 *
 * Ce composant est POSÉ PAR L'ADAPTATION `RV_MEMBRES_PANNEAU`
 * (`tools/adaptations/reseau-vivant.mjs`) autour de la liste dessinée : il reçoit
 * le dessin tel quel dans `liste`, et le remplace par l'aperçu quand `choix.handle`
 * est posé. Le cadre généré n'est jamais édité à la main.
 *
 * ── UN PANNEAU, DEUX CADRES ───────────────────────────────────────────────────
 *
 * `ScreenFrames` rend le cadre d'ordinateur ET celui de téléphone, et n'en masque
 * qu'un par CSS : deux panneaux existent. Seul le VISIBLE (`variante` contre le
 * seuil de 1024 px) charge le profil, prend le focus et écoute Échap — sinon le
 * profil serait demandé deux fois et le focus irait dans un cadre caché.
 *
 * ── LE FOCUS ──────────────────────────────────────────────────────────────────
 *
 * À l'ouverture il va sur « Retour » ; au retour il revient sur la ligne cliquée
 * (`data-membre-ligne`), ou, si elle n'est pas chargée, sur le panneau. Au
 * chargement d'une adresse `?membre=…` le focus n'est PAS volé : seul un changement
 * d'état fait suite à un geste.
 *
 * ── LE MOUVEMENT ──────────────────────────────────────────────────────────────
 *
 * Glissement de 16 px et fondu, 240 ms : c'est `moments.panelAdvance` de
 * `packages/config/motion.js`, rien de plus. Il vit en CSS (`globals.css`,
 * `[data-membres-vue]`) et `prefers-reduced-motion` le coupe comme tout le reste.
 */

const SEUIL_ORDINATEUR = '(min-width: 1024px)';

/** Le cadre qui porte ce panneau est-il celui qu'on voit ? */
function useCadreVisible(variante: 'ordinateur' | 'mobile'): boolean {
  const [ordinateur, setOrdinateur] = useState(true);
  useEffect(() => {
    const requete = window.matchMedia(SEUIL_ORDINATEUR);
    const lire = (): void => {
      setOrdinateur(requete.matches);
    };
    lire();
    requete.addEventListener('change', lire);
    return () => {
      requete.removeEventListener('change', lire);
    };
  }, []);
  return variante === 'ordinateur' ? ordinateur : !ordinateur;
}

export function PanneauMembres({
  variante,
  choix,
  membres,
  occupe,
  onEcrire,
  liste,
}: {
  readonly variante: 'ordinateur' | 'mobile';
  readonly choix: MembreChoisiView;
  readonly membres: readonly MembreAdminRowView[];
  readonly occupe: boolean;
  readonly onEcrire: (userId: string) => void;
  readonly liste: ReactNode;
}) {
  const visible = useCadreVisible(variante);
  const racine = useRef<HTMLDivElement | null>(null);
  const precedent = useRef<string | null>(choix.handle);
  /** Vrai dès qu'un aperçu a été ouvert : la liste ne glisse qu'au RETOUR. */
  const [aVuApercu, setAVuApercu] = useState(false);

  useEffect(() => {
    const avant = precedent.current;
    precedent.current = choix.handle;
    if (avant === choix.handle) return;
    if (choix.handle !== null) setAVuApercu(true);
    if (!visible) return;
    const noeud = racine.current;
    if (noeud === null) return;
    if (choix.handle !== null) {
      noeud.querySelector<HTMLElement>('[data-membres-retour]')?.focus();
      return;
    }
    if (avant !== null) {
      const lignes = Array.from(noeud.querySelectorAll<HTMLElement>('[data-membre-ligne]'));
      (lignes.find((l) => l.getAttribute('data-membre-ligne') === avant) ?? noeud).focus();
    }
  }, [choix.handle, visible]);

  // Échap = retour, sauf si une fenêtre (« Écrire », confirmation) est ouverte par-dessus.
  const retour = choix.onRetour;
  useEffect(() => {
    if (!visible || choix.handle === null) return undefined;
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]') !== null) return;
      retour();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
    };
  }, [visible, choix.handle, retour]);

  const ligne = choix.handle === null ? undefined : membres.find((m) => m.handle === choix.handle);

  return (
    <div
      ref={racine}
      tabIndex={-1}
      data-membres-panneau=""
      data-variante={variante}
      data-vue={choix.handle === null ? 'liste' : 'profil'}
      style={{ outline: 'none', minWidth: 0 }}
    >
      {choix.handle === null ? (
        <div
          key="liste"
          data-membres-vue="liste"
          {...(aVuApercu ? { 'data-membres-retour-anime': '' } : {})}
        >
          {liste}
        </div>
      ) : (
        <div key={choix.handle} data-membres-vue="profil">
          <ApercuMembre
            handle={choix.handle}
            ligne={ligne}
            actif={visible}
            occupe={occupe}
            onEcrire={onEcrire}
            onRetour={choix.onRetour}
          />
        </div>
      )}
    </div>
  );
}

// ─── L'aperçu ───────────────────────────────────────────────────────────────

const PHASES_FR: Readonly<Record<string, string>> = {
  PRE_DEPARTURE: 'Avant le départ',
  RECENT_ARRIVAL: 'Vient d’arriver',
  SETTLING: 'En installation',
  SETTLED: 'Installé·e',
  RETURNED: 'Reparti·e',
};

const ACTIVITES_FR: Readonly<Record<string, string>> = {
  STUDENT: 'Étudiant·e',
  EMPLOYEE: 'Salarié·e',
  JOB_SEEKER: 'En recherche',
  ENTREPRENEUR: 'Indépendant·e',
  OTHER: 'Famille',
};

type Etat =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'echec'; readonly message: string }
  | { readonly statut: 'pret'; readonly profil: PublicProfileResponse };

const CARTE = {
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '22px',
  padding: '16px',
} as const;

const PASTILLE = {
  background: '#F2F5F4',
  color: '#5D6B66',
  fontSize: '11.5px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '999px',
  whiteSpace: 'nowrap',
} as const;

function Rubrique({ titre, children }: { readonly titre: string; readonly children: ReactNode }) {
  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#5D6B66' }}>
        {titre}
      </div>
      <div style={{ marginTop: '6px', fontSize: '13.5px', lineHeight: 1.55, color: '#16211D' }}>
        {children}
      </div>
    </div>
  );
}

function ApercuMembre({
  handle,
  ligne,
  actif,
  occupe,
  onEcrire,
  onRetour,
}: {
  readonly handle: string;
  readonly ligne: MembreAdminRowView | undefined;
  readonly actif: boolean;
  readonly occupe: boolean;
  readonly onEcrire: (userId: string) => void;
  readonly onRetour: () => void;
}) {
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

  useEffect(() => {
    if (!actif) return undefined;
    const ac = new AbortController();
    setEtat({ statut: 'chargement' });
    fetchProfilMembre(handle, ac.signal)
      .then((profil) => {
        if (!ac.signal.aborted) setEtat({ statut: 'pret', profil });
      })
      .catch((cause: unknown) => {
        if (ac.signal.aborted) return;
        setEtat({ statut: 'echec', message: displayMessageFor(cause) });
      });
    return () => {
      ac.abort();
    };
  }, [handle, actif]);

  const profil = etat.statut === 'pret' ? etat.profil : null;
  const nom = profil?.displayName ?? ligne?.name ?? `@${handle}`;
  const photo = profil === null ? null : fondAvatar(profil.avatarUrl);
  const userId = ligne?.userId ?? profil?.userId ?? null;
  const verifie = profil !== null && profil.verificationLevel !== 'L0';
  const moi = profil?.relation?.status === 'SELF';

  return (
    <div data-membre-apercu="" style={CARTE}>
      <button
        type="button"
        onClick={onRetour}
        data-membres-retour=""
        aria-label="Retour à la liste des membres"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          height: '44px',
          padding: '0 14px 0 10px',
          borderRadius: '999px',
          background: '#F2F5F4',
          color: '#16211D',
          border: 'none',
          font: 'inherit',
          fontSize: '13.5px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Retour
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '16px' }}>
        <span
          aria-hidden="true"
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '999px',
            flexShrink: 0,
            background: photo ?? ligne?.bg ?? '#16785E',
            color: '#fff',
            fontSize: '22px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {photo === null ? (ligne?.i ?? nom.slice(0, 1).toUpperCase()) : null}
        </span>
        <div style={{ minWidth: 0 }}>
          <h2
            data-membre-apercu-nom=""
            style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.4px', overflowWrap: 'anywhere' }}
          >
            {nom}
          </h2>
          <div style={{ fontSize: '13px', color: '#5D6B66', marginTop: '2px' }}>@{handle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
        {ligne !== undefined && ligne.roleNom !== '' ? (
          <span
            style={{
              ...PASTILLE,
              background: ligne.roleBg,
              color: ligne.roleFg,
            }}
          >
            {ligne.roleNom}
          </span>
        ) : null}
        {verifie ? <span style={{ ...PASTILLE, background: '#E3F0EB', color: '#0F5C48' }}>Identité vérifiée</span> : null}
        {profil !== null ? <span style={PASTILLE}>{PHASES_FR[profil.phase] ?? profil.phase}</span> : null}
        {profil?.availableToHelp === true ? (
          <span style={{ ...PASTILLE, background: '#E3F0EB', color: '#0F5C48' }}>Disponible pour aider</span>
        ) : null}
      </div>

      {etat.statut === 'chargement' ? (
        <p role="status" style={{ margin: '16px 0 0', fontSize: '13px', color: '#5D6B66' }}>
          Chargement du profil…
        </p>
      ) : null}
      {etat.statut === 'echec' ? (
        <p role="status" data-membre-apercu-echec="" style={{ margin: '16px 0 0', fontSize: '13px', color: '#B4581F' }}>
          {etat.message} Le profil complet s’ouvre depuis le lien ci-dessous.
        </p>
      ) : null}

      {profil === null ? (
        ligne === undefined ? null : (
          <Rubrique titre="EN BREF">{ligne.sub}</Rubrique>
        )
      ) : (
        <>
          {profil.bio === null || profil.bio === '' ? null : <Rubrique titre="À PROPOS">{profil.bio}</Rubrique>}
          <Rubrique titre="VILLE">
            {profil.city === null ? profil.country.nameFr : `${profil.city.name} · ${profil.country.nameFr}`}
          </Rubrique>
          {profil.occupationStatus === null && profil.skills.length === 0 ? null : (
            <Rubrique titre="MÉTIERS ET ACTIVITÉ">
              {profil.occupationStatus === null ? null : <div>{ACTIVITES_FR[profil.occupationStatus]}</div>}
              {profil.skills.length === 0 ? null : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {profil.skills.map((c) => (
                    <span key={c.id} style={PASTILLE}>
                      {c.nameFr}
                    </span>
                  ))}
                </div>
              )}
            </Rubrique>
          )}
          {profil.languages.length === 0 ? null : (
            <Rubrique titre="LANGUES">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {profil.languages.map((l) => (
                  <span key={l.code} style={PASTILLE}>
                    {l.nameFr}
                  </span>
                ))}
              </div>
            </Rubrique>
          )}
          <Rubrique titre="DISPONIBILITÉ">
            {profil.availableToHelp
              ? profil.helpTypes.length === 0
                ? 'Disponible pour aider.'
                : `Disponible pour aider : ${profil.helpTypes.map((h) => HELP_TYPE_LABELS[h]).join(', ')}.`
              : 'Pas disponible pour aider pour le moment.'}
          </Rubrique>
        </>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
        {userId === null || moi ? null : (
          <button
            type="button"
            onClick={() => {
              onEcrire(userId);
            }}
            disabled={occupe}
            data-membre-apercu-ecrire=""
            style={{
              height: '44px',
              padding: '0 20px',
              borderRadius: '14px',
              background: '#16785E',
              color: '#fff',
              border: 'none',
              font: 'inherit',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: occupe ? 'default' : 'pointer',
              opacity: occupe ? 0.6 : 1,
            }}
          >
            Écrire
          </button>
        )}
        <Link
          href={`/@${handle}`}
          data-membre-apercu-profil=""
          style={{
            height: '44px',
            padding: '0 18px',
            borderRadius: '14px',
            background: '#F2F5F4',
            color: '#16211D',
            fontSize: '13.5px',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Voir le profil complet
        </Link>
      </div>
    </div>
  );
}
