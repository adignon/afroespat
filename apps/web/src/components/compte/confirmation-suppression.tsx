'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { fetchMe, memberApi, clearSession } from '@/lib/api/member';
import { ApiError } from '@/lib/api/errors';
import { obtenirJetonCaptcha } from '@/lib/captcha';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — « CONFIRMER LA SUPPRESSION » EST BRANCHÉ             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Marqué AJOUT comme `parametres-reseau.tsx` et `carte-mon-parcours.tsx` : la maquette K08
 * dessine la confirmation (« Supprimé », « Conservé sans votre nom », le délai de sept jours,
 * six cases de code SMS, un bouton « Confirmer la suppression ») mais NE DESSINE NI le champ du
 * pseudo, NI l'envoi du code, NI ce qui suit la demande. Le bouton était volontairement inerte
 * depuis plusieurs lots — la suppression est irréversible après sept jours. Décision du porteur :
 * on le branche.
 *
 * Posé par l'adaptation `K08_CONFIRMATION_VIVANTE` (`tools/adaptations/compte-suppression-vivante.mjs`),
 * à la place des six cases et du bouton dessinés, DANS le même langage visuel : les cases sont
 * celles de la maquette (48 px, rayon 12, bordure 1,5 px, la case courante en vert #16785E), le
 * champ du pseudo est celui des fenêtres voisines (48 px, rayon 14), le bouton est le noir #16211D
 * de la planche. Aucune couleur nouvelle, aucun rouge.
 *
 * ── LE PARCOURS, DEUX GESTES ET UN CODE ────────────────────────────────────
 *
 *   1. LE PSEUDO. « Tapez votre pseudo pour confirmer » — comme la suppression immédiate de
 *      l'équipe (`admin/ecrans/membres.tsx`) : un clic distrait ne suffit pas à lancer un envoi
 *      de SMS suivi d'une suppression. « Recevoir le code » reste grisé tant que le pseudo n'est
 *      pas exact (casse et « @ » ignorés).
 *   2. LE CODE. `POST /me/deletion/code` l'envoie au numéro PRINCIPAL du membre (le client ne
 *      connaît que des masques, 01 §2.1) ; l'écran dit « envoyé au +229 •• •• •• 28 ». Six
 *      chiffres, puis « Confirmer la suppression » : `POST /me/deletion`.
 *   3. APRÈS. Le serveur révoque TOUTES les sessions à la demande (§2.8) : l'écran oublie la
 *      session locale et recharge `/connexion?suppression=<échéance>`, où la suppression
 *      programmée est annoncée avec « Annuler la suppression » — c'est-à-dire la reconnexion,
 *      que le serveur traite comme l'annulation (§2.8 ; `deletionCancelled`).
 *
 * ── LES REFUS S'AFFICHENT, ILS NE S'AVALENT PAS ────────────────────────────
 *
 * Le serveur décide ; l'écran dit ce qu'il a dit : code faux (avec les essais restants), code
 * expiré, trop de demandes (avec le délai réel), demande déjà en attente, numéro introuvable.
 * Un `role="alert"` porte le message, en #B4581F (la couleur d'alerte des fenêtres voisines).
 */

const defiSchema = z.object({
  challengeId: z.string(),
  expiresAt: z.string(),
  masked: z.string(),
});

const demandeSchema = z.object({ requestedAt: z.string(), executeAfter: z.string() });

/** Le pseudo tapé vaut le pseudo du membre : sans « @ », sans casse, sans espaces autour. */
export function pseudoConfirme(saisie: string, pseudo: string): boolean {
  const net = (v: string): string => v.trim().replace(/^@/, '').toLowerCase();
  return net(pseudo) !== '' && net(saisie) === net(pseudo);
}

/** La phrase d'un refus du serveur, avec ce qu'il sait et que l'écran ignore. */
export function phraseDeRefus(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return cause instanceof Error && cause.message !== ''
      ? cause.message
      : 'La demande n’a pas pu aboutir. Réessayez dans un instant.';
  }
  if (cause.code === 'OTP_INVALID') {
    const restants = cause.details['attemptsLeft'];
    return typeof restants === 'number'
      ? `Code incorrect. Il vous reste ${String(restants)} ${restants > 1 ? 'essais' : 'essai'}.`
      : 'Code incorrect.';
  }
  if (cause.code === 'DELETION_ALREADY_PENDING') {
    return 'Une suppression est déjà programmée pour ce compte. Reconnectez-vous pour l’annuler.';
  }
  return cause.displayMessage;
}

const CHAMP = {
  height: '48px',
  borderRadius: '14px',
  border: '1.5px solid #E6EBE9',
  background: '#fff',
  padding: '0 14px',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: '#16211D',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
};

/** Le bouton noir de la planche K08 (« Confirmer la suppression »). */
const BOUTON = {
  height: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
  width: '100%',
  color: '#fff',
};

const ETIQUETTE = { fontSize: '12.5px', fontWeight: 700 } as const;

export function ConfirmationSuppression() {
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [defi, setDefi] = useState<z.infer<typeof defiSchema> | null>(null);
  const [code, setCode] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const champCode = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let annule = false;
    void fetchMe()
      .then((me) => {
        if (!annule) setPseudo(me.user.handle);
      })
      .catch(() => {
        // Sans pseudo, le bouton reste grisé : on ne devine pas ce qu'il faudrait taper.
      });
    return () => {
      annule = true;
    };
  }, []);

  const envoyerLeCode = (): void => {
    if (enVol) return;
    setEnVol(true);
    setRefus(null);
    // Le jeton est tiré AU MOMENT de l'envoi (usage unique), comme pour tout envoi d'OTP.
    obtenirJetonCaptcha()
      .then((captchaToken) =>
        memberApi.post('/me/deletion/code', defiSchema, { body: { captchaToken } }),
      )
      .then((reponse) => {
        setDefi(reponse);
        setCode('');
        setTimeout(() => champCode.current?.focus(), 0);
      })
      .catch((cause: unknown) => {
        setRefus(phraseDeRefus(cause));
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  const confirmer = (): void => {
    if (defi === null || enVol || code.length !== 6) return;
    setEnVol(true);
    setRefus(null);
    memberApi
      .post('/me/deletion', demandeSchema, { body: { challengeId: defi.challengeId, code } })
      .then((reponse) => {
        // Le serveur a révoqué TOUTES les sessions : on oublie la nôtre, et on recharge la page de
        // connexion, qui annonce la suppression programmée. Un rechargement complet — et non un
        // changement de route — pour que rien de ce membre ne survive en mémoire.
        clearSession();
        window.location.assign(`/connexion?suppression=${encodeURIComponent(reponse.executeAfter)}`);
      })
      .catch((cause: unknown) => {
        setRefus(phraseDeRefus(cause));
        setEnVol(false);
      });
  };

  const pseudoJuste = pseudo !== null && pseudoConfirme(saisie, pseudo);
  const chiffres = code.padEnd(6, ' ').split('');
  const courante = Math.min(code.length, 5);

  return (
    <div data-suppression="" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label htmlFor="suppression-pseudo" style={ETIQUETTE}>
          Pour confirmer, tapez votre pseudo{pseudo === null ? '' : ` (@${pseudo})`}
        </label>
        <input
          id="suppression-pseudo"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
          }}
          disabled={defi !== null || enVol}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-suppression-pseudo=""
          style={{
            ...CHAMP,
            border: `1.5px solid ${pseudoJuste ? '#16785E' : '#E6EBE9'}`,
            opacity: defi === null ? 1 : 0.6,
          }}
        />
      </div>

      {defi === null ? (
        <button
          type="button"
          onClick={envoyerLeCode}
          disabled={!pseudoJuste || enVol}
          data-suppression-envoyer=""
          style={{
            ...BOUTON,
            background: '#16211D',
            opacity: !pseudoJuste || enVol ? 0.45 : 1,
            cursor: !pseudoJuste || enVol ? 'default' : 'pointer',
          }}
        >
          Recevoir le code par SMS
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="suppression-code" style={ETIQUETTE}>
              Code reçu par SMS au {defi.masked}
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '6px' }} aria-hidden="true">
                {chiffres.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      height: '48px',
                      borderRadius: '12px',
                      border: `1.5px solid ${i === courante ? '#16785E' : '#E6EBE9'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 800,
                    }}
                  >
                    {c.trim()}
                  </div>
                ))}
              </div>
              <input
                id="suppression-code"
                ref={champCode}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={enVol}
                data-suppression-code=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  cursor: 'text',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDefi(null);
                setCode('');
                setRefus(null);
              }}
              disabled={enVol}
              data-suppression-renvoyer=""
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#16785E',
                cursor: 'pointer',
              }}
            >
              Renvoyer un code
            </button>
          </div>

          <button
            type="button"
            onClick={confirmer}
            disabled={code.length !== 6 || enVol}
            data-suppression-confirmer=""
            style={{
              ...BOUTON,
              background: '#16211D',
              opacity: code.length !== 6 || enVol ? 0.45 : 1,
              cursor: code.length !== 6 || enVol ? 'default' : 'pointer',
            }}
          >
            {enVol ? 'Suppression en cours…' : 'Confirmer la suppression'}
          </button>
        </>
      )}

      {refus === null ? null : (
        <p
          role="alert"
          data-suppression-refus=""
          style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, lineHeight: 1.5, color: '#B4581F' }}
        >
          {refus}
        </p>
      )}
    </div>
  );
}
