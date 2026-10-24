'use client';

import { useEffect, useState } from 'react';
import { CONSENT_DOCUMENT_SLUGS, myConsentsSchema, okResponseSchema, staticPagePublicSchema } from '@app/shared';
import { displayMessageFor, memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LE CONSENTEMENT REDEMANDÉ QUAND UN DOCUMENT CHANGE (01 §2.10)       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Une nouvelle version des CGU redemande le consentement à la prochaine connexion. »
 * L'API calculait déjà `outdated` (`ConsentsService.current`) et la liste `outstanding` de
 * `GET /me/consents` — aucun écran ne l'appelait. Cette fenêtre le fait, une fois par
 * chargement de l'application connectée :
 *
 *   · rien à redemander → rien n'est dessiné ;
 *   · sinon une fenêtre BLOQUANTE mais polie : elle dit CE QUI a changé (les conditions,
 *     la politique de confidentialité), donne un lien pour LIRE chaque document (nouvel
 *     onglet : on ne perd pas sa place), et n'offre que deux sorties — « J'accepte » ou
 *     « Me déconnecter ». Pas de croix, pas d'Échap, pas de clic sur le voile : on ne
 *     continue pas à publier sous des conditions qu'on n'a pas acceptées.
 *
 * La VERSION acceptée est celle que le serveur publie MAINTENANT (`GET /pages/:slug`, pas
 * de valeur écrite ici) ; si elle a encore changé entre-temps, le serveur répond
 * `DOCUMENT_VERSION_STALE` et on la relit. L'IP, preuve du consentement, est celle de la
 * requête, jamais du corps (`POST /me/consents`).
 *
 * La fenêtre reprend le châssis de `FenetreConfirmation` (voile `rgba(22,33,29,.55)`,
 * panneau blanc de 440 px, rayon 28, retrait 24, bouton sombre de 44 px).
 */

const TITRES: Record<string, string> = { TERMS: 'les conditions d’utilisation', PRIVACY: 'la politique de confidentialité' };

export function FenetreConsentement() {
  const [restants, setRestants] = useState<readonly string[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    memberApi.get('/me/consents', myConsentsSchema).then(
      (c) => {
        if (!annule) setRestants(c.outstanding.filter((t) => t in CONSENT_DOCUMENT_SLUGS));
      },
      () => {
        /* Une lecture qui échoue ne ferme pas l'application : la fenêtre ne s'ouvre pas. */
      },
    );
    return () => {
      annule = true;
    };
  }, []);

  if (restants.length === 0) return null;

  const accepter = async () => {
    setOccupe(true);
    setErreur(null);
    try {
      for (const type of restants) {
        const slug = CONSENT_DOCUMENT_SLUGS[type as keyof typeof CONSENT_DOCUMENT_SLUGS];
        const page = await memberApi.get(`/pages/${slug}`, staticPagePublicSchema);
        await memberApi.post('/me/consents', okResponseSchema, { body: { type, granted: true, version: page.version } });
      }
      setRestants([]);
    } catch (e) {
      setErreur(displayMessageFor(e));
    } finally {
      setOccupe(false);
    }
  };

  const sortir = async () => {
    const { logout } = await import('@/lib/api/index');
    await logout();
    window.location.assign('/connexion');
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)', zIndex: 200 }} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="consentement-titre"
        aria-describedby="consentement-texte"
        data-fenetre-consentement=""
        style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '440px', maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#fff', border: '1px solid #DDE3E0', borderRadius: '28px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 201 }}
      >
        <h2 id="consentement-titre" style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Nos conditions ont changé
        </h2>
        <p id="consentement-texte" style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6 }}>
          Nous avons mis à jour {restants.map((t) => TITRES[t] ?? t).join(' et ')}. Merci de les relire avant de continuer : nous vous demandons de les accepter à nouveau.
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {restants.map((t) => (
            <li key={t}>
              <a href={`/p/${CONSENT_DOCUMENT_SLUGS[t as keyof typeof CONSENT_DOCUMENT_SLUGS]}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', fontWeight: 700, color: '#0F5C48', textDecoration: 'underline' }}>
                Lire {TITRES[t] ?? t}
              </a>
            </li>
          ))}
        </ul>
        <div style={{ background: '#F6F8F7', borderRadius: '14px', padding: '12px', fontSize: '12.5px', color: '#5D6B66' }}>
          Votre acceptation est enregistrée avec la date et la version du document.
        </div>
        {erreur === null ? null : (
          <div role="alert" style={{ background: '#FBE3D4', color: '#B4581F', borderRadius: '14px', padding: '10px 14px', fontSize: '13px', fontWeight: 600 }}>
            {erreur}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => void sortir()} style={{ height: '44px', padding: '0 18px', borderRadius: '14px', border: 'none', background: '#F2F5F4', color: '#16211D', font: 'inherit', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
            Me déconnecter
          </button>
          <button type="button" onClick={() => void accepter()} disabled={occupe} style={{ height: '44px', padding: '0 18px', borderRadius: '14px', border: 'none', background: '#16211D', color: '#fff', font: 'inherit', fontSize: '13.5px', fontWeight: 700, cursor: occupe ? 'default' : 'pointer', opacity: occupe ? 0.6 : 1 }}>
            {occupe ? 'Un instant…' : 'J’accepte'}
          </button>
        </div>
      </div>
    </>
  );
}
