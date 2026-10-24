'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { staffEnrollResponseSchema, staffLoginResponseSchema, staffOpenedSchema } from '@app/shared';
import { ApiError, staffApi } from '@/lib/api/index';
import { QrCode } from './qr-code';
import { Bandeau, Bouton, C, Champ, useGeste } from './ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LA CONNEXION D'ÉQUIPE, D01 (15 §2.1)                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine trois cartes de saisie INERTES (« 1 · IDENTIFIANTS »,
 * « 2 · CODE TOTP », « ENRÔLEMENT FORCÉ ») : `Continuer` ne faisait rien, donc on ne
 * pouvait pas se connecter. C'est UNE carte à trois états, qui suit le parcours que
 * le serveur impose :
 *
 *   1. `POST /admin/auth/login` — e-mail + mot de passe → un défi signé ;
 *   2a. compte enrôlé : `POST /admin/auth/totp` — le code à six chiffres ;
 *   2b. compte NON enrôlé : `POST /admin/auth/totp/enroll` rend le secret, on le saisit
 *       dans l'application d'authentification, puis `POST /admin/auth/totp/confirm`
 *       ouvre la session avec un premier code (« enrôlement forcé », §2.1).
 *
 * Le cookie de session est posé par le serveur (`HttpOnly`, `Strict`) : cette carte ne
 * stocke RIEN — ni jeton, ni mot de passe, ni défi dans un stockage du navigateur. Le
 * défi ne vit que dans l'état du composant, et un rechargement recommence à l'étape 1.
 *
 * Le secret d'enrôlement est montré en CODE QR (rendu localement, `qr-code.tsx` : aucun
 * service tiers ne voit le secret), puis en TEXTE (groupes de quatre) et en lien
 * `otpauth://` pour la saisie manuelle ou l'ouverture directe sur mobile.
 *
 * Le verrouillage (« Compte verrouillé après 5 échecs ») est dit par le SERVEUR
 * (`STAFF_LOCKED`) : le compteur est compté côté serveur, jamais côté écran.
 */

type Etape =
  | { readonly nom: 'identifiants' }
  | { readonly nom: 'totp'; readonly challenge: string }
  | { readonly nom: 'enrolement'; readonly challenge: string; readonly secret: string; readonly uri: string };

const groupes = (secret: string): string => (secret.match(/.{1,4}/g) ?? [secret]).join(' ');

export function ConnexionEquipe() {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>({ nom: 'identifiants' });
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const geste = useGeste();

  const recommencer = () => {
    setEtape({ nom: 'identifiants' });
    setCode('');
    setMotDePasse('');
    geste.effacer();
  };

  const premierFacteur = async () => {
    await geste.lancer(async () => {
      const r = await staffApi.post('/auth/login', staffLoginResponseSchema, {
        body: { email: email.trim(), password: motDePasse },
      });
      if (r.enrollmentRequired) {
        const e = await staffApi.post('/auth/totp/enroll', staffEnrollResponseSchema, {
          body: { challenge: r.challenge },
        });
        setEtape({ nom: 'enrolement', challenge: e.challenge, secret: e.secret, uri: e.otpauthUri });
      } else {
        setEtape({ nom: 'totp', challenge: r.challenge });
      }
      setCode('');
    });
  };

  const secondFacteur = async () => {
    if (etape.nom === 'identifiants') return;
    const chemin = etape.nom === 'totp' ? '/auth/totp' : '/auth/totp/confirm';
    const ok = await geste.lancer(async () => {
      try {
        await staffApi.post(chemin, staffOpenedSchema, { body: { challenge: etape.challenge, code } });
      } catch (erreur) {
        // Le défi expire vite : on ne laisse pas saisir un code contre un défi mort.
        if (erreur instanceof ApiError && erreur.code === 'STAFF_CHALLENGE_INVALID') setEtape({ nom: 'identifiants' });
        throw erreur;
      }
    });
    if (ok) router.replace('/admin');
  };

  const soumettre = () => (etape.nom === 'identifiants' ? premierFacteur() : secondFacteur());
  const pret =
    etape.nom === 'identifiants' ? email.trim().length > 3 && motDePasse.length > 0 : /^\d{6}$/.test(code);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pret && !geste.occupe) void soumettre();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: C.vertFonce, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" />
          </svg>
        </div>
        <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
          {etape.nom === 'enrolement' ? 'Activer la double authentification' : 'Administration'}
        </h1>
      </div>

      {etape.nom === 'identifiants' ? (
        <>
          <Champ libelle="Email professionnel" valeur={email} onChange={setEmail} type="email" autoComplete="username" nom="email" />
          <Champ libelle="Mot de passe" valeur={motDePasse} onChange={setMotDePasse} type="password" autoComplete="current-password" nom="password" />
        </>
      ) : null}

      {etape.nom === 'totp' ? (
        <>
          <div style={{ fontSize: '13.5px', color: C.gris }}>Saisissez le code à six chiffres de votre application d’authentification.</div>
          <Champ libelle="Code" valeur={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} nom="code" />
          <div style={{ fontSize: '12.5px', color: C.grisClair }}>Compte verrouillé après 5 échecs.</div>
        </>
      ) : null}

      {etape.nom === 'enrolement' ? (
        <>
          <div style={{ fontSize: '13.5px', color: C.gris }}>
            La double authentification est obligatoire. Scannez le code ci-dessous avec votre application d’authentification (ou saisissez la clé), puis saisissez le premier code.
          </div>
          <QrCode valeur={etape.uri} libelle="Code QR à scanner avec l’application d’authentification" />
          <div style={{ fontSize: '12.5px', color: C.grisClair }}>Impossible de scanner ? Saisissez la clé :</div>
          <div data-admin-secret="" style={{ background: C.fond, borderRadius: '14px', padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontSize: '15px', fontWeight: 700, letterSpacing: '1px', wordBreak: 'break-all' }}>
            {groupes(etape.secret)}
          </div>
          <a href={etape.uri} style={{ fontSize: '12.5px', fontWeight: 700, color: C.vertFonce, textDecoration: 'underline' }}>
            Ouvrir dans l’application d’authentification
          </a>
          <Champ libelle="Premier code" valeur={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} nom="code" />
        </>
      ) : null}

      {geste.message === null ? null : <Bandeau ton="attention" role="alert">{geste.message.texte}</Bandeau>}

      <Bouton type="submit" ton="sombre" plein disabled={!pret || geste.occupe}>
        {geste.occupe ? 'Un instant…' : etape.nom === 'enrolement' ? 'Activer et me connecter' : 'Continuer'}
      </Bouton>
      {etape.nom === 'identifiants' ? null : (
        <button type="button" onClick={() => recommencer()} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: '13px', fontWeight: 700, color: C.gris, cursor: 'pointer' }}>
          Recommencer
        </button>
      )}
    </form>
  );
}
