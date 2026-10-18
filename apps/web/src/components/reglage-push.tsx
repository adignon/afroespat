'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';
import { activerPush, desactiverPush, lireEtatPush, type EtatPush } from '@/lib/push';

/**
 * AJOUT HORS MAQUETTE (le dessin existe à 1 440 px, pas à 390) — « Activer les
 * notifications » dans les réglages de notification (K07), 12 §2.4.
 *
 * La planche d'ordinateur dessine la carte verte « PUSH DÉSACTIVÉES — Votre
 * navigateur bloque les notifications. [Activer les notifications] » ; elle est
 * reprise ICI avec ses mesures (fond `#E3F0EB`, rayon 22, bouton plein `#16785E` de
 * 40 px), et elle devient vivante : le texte dit l'état réel de CET appareil, le
 * bouton fait réellement `Notification.requestPermission()` puis
 * `pushManager.subscribe()` puis `POST /me/push-subscriptions`. La planche de
 * téléphone ne la dessine pas : la même carte y est posée, au bas du contenu.
 *
 * « Demande de permission uniquement après une action explicite » : RIEN ne se
 * demande au chargement ; seule la lecture de l'état se fait (sans invite).
 *
 * Quatre états : indisponible (navigateur sans push, ou serveur sans clé — la carte
 * disparaît, pour ne pas proposer un geste impossible), bloqué (le membre doit
 * autoriser dans le navigateur — on ne peut pas le faire à sa place), inactif, actif.
 */
const CARTE: CSSProperties = { background: '#E3F0EB', borderRadius: '22px', padding: '18px', flexShrink: 0 };
const ETIQUETTE: CSSProperties = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#0F5C48' };
const TEXTE: CSSProperties = { fontSize: '13px', marginTop: '8px', lineHeight: 1.5 };
const BOUTON: CSSProperties = {
  padding: '0 18px', borderRadius: '14px', background: '#16785E', color: '#fff', border: 'none', font: 'inherit',
  fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  whiteSpace: 'nowrap', flexShrink: 0, width: '100%', marginTop: '12px', height: '40px', cursor: 'pointer',
};
const BOUTON_DISCRET: CSSProperties = { ...BOUTON, background: '#fff', color: '#16211D' };

export function ReglagePush() {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [enVol, setEnVol] = useState(false);

  const lire = useCallback(() => {
    lireEtatPush()
      .then(setEtat)
      .catch(() => {
        setEtat({ etat: 'indisponible' });
      });
  }, []);

  useEffect(() => {
    lire();
  }, [lire]);

  const agir = (travail: () => Promise<EtatPush>, succes: string, repli: string): void => {
    if (enVol) return;
    setEnVol(true);
    travail()
      .then((r) => {
        setEtat(r);
        if (r.etat === 'actif' || r.etat === 'inactif') notifySuccess(succes);
        if (r.etat === 'bloque') notifyError('Les notifications sont bloquées par votre navigateur.');
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof ApiError ? cause.displayMessage : repli);
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  if (etat === null || etat.etat === 'indisponible') return null;

  return (
    <div data-reglage-push="" data-etat-push={etat.etat} style={CARTE}>
      <div style={ETIQUETTE}>{etat.etat === 'actif' ? 'PUSH ACTIVÉES' : 'PUSH DÉSACTIVÉES'}</div>
      {etat.etat === 'bloque' ? (
        <div style={TEXTE}>
          Votre navigateur bloque les notifications. Autorisez-les dans les réglages du site (le cadenas, à gauche de
          l’adresse), puis revenez ici.
        </div>
      ) : null}
      {etat.etat === 'inactif' ? (
        <>
          <div style={TEXTE}>Recevez vos rappels et vos réponses sur cet appareil, même quand l’application est fermée.</div>
          <button
            type="button" data-push-action="activer" disabled={enVol} style={BOUTON}
            onClick={() => { agir(activerPush, 'Notifications activées sur cet appareil.', 'Les notifications n’ont pas pu être activées.'); }}
          >
            {enVol ? 'Activation…' : 'Activer les notifications'}
          </button>
        </>
      ) : null}
      {etat.etat === 'actif' ? (
        <>
          <div style={TEXTE}>Cet appareil reçoit vos notifications. Les heures calmes s’appliquent.</div>
          <button
            type="button" data-push-action="desactiver" disabled={enVol} style={BOUTON_DISCRET}
            onClick={() => { agir(desactiverPush, 'Notifications désactivées sur cet appareil.', 'Les notifications n’ont pas pu être désactivées.'); }}
          >
            {enVol ? 'Désactivation…' : 'Désactiver sur cet appareil'}
          </button>
        </>
      ) : null}
    </div>
  );
}
