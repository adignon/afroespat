'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { emailStateSchema, type EmailState } from '@app/shared';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { voidResponse } from '@/lib/api/void-response';

/**
 * AJOUT HORS MAQUETTE — l'adresse email du membre dans les réglages de notification
 * (K07), 12 §3 et §4.
 *
 * La planche d'ordinateur dessine UNE ligne « Email · … [À vérifier] [Renvoyer le
 * lien] » ; elle ne dessine ni la saisie, ni le code, ni le changement, ni le
 * retrait, et la planche de téléphone ne dessine rien du tout. Ce composant tient
 * tous les états dans le langage visuel de la ligne dessinée (mêmes boutons gris de
 * 36 px, même pastille, mêmes teintes) — voir `tools/adaptations/exploitation-vivante.mjs`
 * pour la manière dont il est posé aux deux largeurs.
 *
 * ── LE PARCOURS ─────────────────────────────────────────────────────────────
 *   aucune adresse → saisie → code reçu par email → vérifiée ; puis « Changer »
 *   (l'ancienne adresse reste active jusqu'à confirmation de la nouvelle) et
 *   « Retirer ». L'adresse n'est JAMAIS relue en clair : le serveur ne rend qu'un
 *   masque (`j•••••••@gmail.com`), y compris pour son propriétaire.
 *
 * Le front PRÉVIENT, le serveur DÉCIDE : la forme de l'adresse et celle du code sont
 * vérifiées ici pour éviter un aller-retour, mais le refus qui compte est celui de
 * l'API, dont le message est affiché tel quel.
 *
 * Aucune couleur nouvelle, aucun rouge : une erreur s'annonce par la bannière
 * commune (`notifyError`), pas par une teinte.
 */

const BOUTON_GRIS: CSSProperties = {
  padding: '0 18px', borderRadius: '14px', background: '#F2F5F4', color: '#16211D', border: 'none',
  font: 'inherit', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap', flexShrink: 0, height: '36px', cursor: 'pointer',
};
const BOUTON_VERT: CSSProperties = { ...BOUTON_GRIS, background: '#16785E', color: '#fff' };
const CHAMP: CSSProperties = {
  height: '44px', borderRadius: '14px', border: '1.5px solid #E6EBE9', background: '#fff', padding: '0 14px',
  fontSize: '14px', fontFamily: 'inherit', color: '#16211D', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const PASTILLE_A_VERIFIER: CSSProperties = {
  background: '#FBE3D4', color: '#B4581F', fontSize: '11px', fontWeight: 700, padding: '4px 10px',
  borderRadius: '999px', whiteSpace: 'nowrap',
};
const PASTILLE_VERIFIEE: CSSProperties = { ...PASTILLE_A_VERIFIER, background: '#E3F0EB', color: '#0F5C48' };

/** Forme minimale d'une adresse — le serveur reste juge. */
export function adresseVraisemblable(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur.trim()) && valeur.trim().length <= 254;
}

function messageDe(cause: unknown, repli: string): string {
  return cause instanceof ApiError ? cause.displayMessage : repli;
}

export function ReglageEmail({ variante }: { readonly variante: 'ligne' | 'carte' }) {
  const [etat, setEtat] = useState<EmailState | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [saisie, setSaisie] = useState<'adresse' | 'code' | null>(null);
  const [adresse, setAdresse] = useState('');
  const [code, setCode] = useState('');
  const [enVol, setEnVol] = useState(false);

  const charger = useCallback(() => {
    setErreurChargement(false);
    memberApi
      .get('/me/email', emailStateSchema)
      .then((r) => {
        setEtat(r);
        // Une vérification déjà en cours (autre onglet, page rechargée) : on reprend au code.
        setSaisie((s) => (r.pending !== null && s === null ? 'code' : s));
      })
      .catch(() => {
        setErreurChargement(true);
      });
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const appeler = (travail: () => Promise<void>, repli: string): void => {
    if (enVol) return;
    setEnVol(true);
    travail()
      .catch((cause: unknown) => {
        notifyError(messageDe(cause, repli));
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  const envoyerCode = (): void => {
    if (!adresseVraisemblable(adresse)) {
      notifyError('Entrez une adresse email valide.');
      return;
    }
    appeler(async () => {
      const r = await memberApi.post('/me/email', emailStateSchema, { body: { email: adresse.trim() } });
      setEtat(r);
      setAdresse('');
      setCode('');
      setSaisie('code');
      notifySuccess('Code envoyé par email.');
    }, 'Le code n’a pas pu être envoyé.');
  };

  const confirmer = (): void => {
    if (!/^\d{6}$/.test(code.trim())) {
      notifyError('Le code compte 6 chiffres.');
      return;
    }
    appeler(async () => {
      const r = await memberApi.post('/me/email/verify', emailStateSchema, { body: { code: code.trim() } });
      setEtat(r);
      setCode('');
      setSaisie(null);
      notifySuccess('Adresse vérifiée.');
    }, 'Le code n’a pas été accepté.');
  };

  const renvoyer = (): void => {
    // L'adresse en attente n'est pas relue en clair : pour renvoyer, on la ressaisit.
    setCode('');
    setSaisie('adresse');
  };

  const retirer = (): void => {
    appeler(async () => {
      await memberApi.del('/me/email', voidResponse);
      setEtat({ email: null, pending: null });
      setSaisie(null);
      notifySuccess('Adresse retirée. Vous ne recevrez plus d’emails.');
    }, 'L’adresse n’a pas pu être retirée.');
  };

  const racine: CSSProperties =
    variante === 'ligne'
      ? { display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid #F0F3F2' }
      : { background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' };
  const rangee: CSSProperties = { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' };
  const texte: CSSProperties = { flex: '1 1 160px', fontSize: '13.5px', minWidth: 0, overflowWrap: 'anywhere' };

  if (etat === null) {
    return (
      <div data-reglage-email="" style={racine}>
        <div style={rangee}>
          <span style={{ ...texte, color: '#5D6B66' }}>
            <strong style={{ color: '#16211D' }}>Email</strong> · {erreurChargement ? 'indisponible' : 'chargement…'}
          </span>
          {erreurChargement ? (
            <button type="button" onClick={charger} style={BOUTON_GRIS}>Réessayer</button>
          ) : null}
        </div>
      </div>
    );
  }

  const enregistree = etat.email;
  return (
    <div data-reglage-email="" style={racine}>
      <div style={rangee}>
        <span style={texte}>
          <strong>Email</strong> · {enregistree === null ? 'aucune adresse' : enregistree.masked}{' '}
          {enregistree !== null ? (
            <span style={enregistree.verified ? PASTILLE_VERIFIEE : PASTILLE_A_VERIFIER}>
              {enregistree.verified ? 'Vérifiée' : 'À vérifier'}
            </span>
          ) : null}
        </span>
        {saisie === null ? (
          <>
            <button type="button" data-email-action="ajouter" onClick={() => { setSaisie('adresse'); }} style={BOUTON_GRIS}>
              {enregistree === null ? 'Ajouter une adresse' : 'Changer'}
            </button>
            {enregistree !== null ? (
              <button type="button" data-email-action="retirer" onClick={retirer} disabled={enVol} style={BOUTON_GRIS}>
                Retirer
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {enregistree === null && saisie === null ? (
        <span style={{ fontSize: '12px', color: '#5D6B66', lineHeight: 1.45 }}>
          Sans adresse, vous ne recevez aucun email. Les notifications restent dans l’application.
        </span>
      ) : null}

      {saisie === 'adresse' ? (
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          onSubmit={(e) => { e.preventDefault(); envoyerCode(); }}
        >
          <input
            type="email" inputMode="email" autoComplete="email" autoFocus maxLength={254}
            aria-label="Votre adresse email" placeholder="prenom@exemple.fr"
            value={adresse} onChange={(e) => { setAdresse(e.target.value); }} style={CHAMP}
          />
          <div style={rangee}>
            <button type="submit" disabled={enVol} data-email-action="envoyer" style={BOUTON_VERT}>
              {enVol ? 'Envoi…' : 'Envoyer le code'}
            </button>
            <button type="button" onClick={() => { setSaisie(etat.pending === null ? null : 'code'); }} style={BOUTON_GRIS}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {saisie === 'code' && etat.pending !== null ? (
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          onSubmit={(e) => { e.preventDefault(); confirmer(); }}
        >
          <span style={{ fontSize: '12.5px', color: '#5D6B66', lineHeight: 1.45 }}>
            Un code à 6 chiffres vient d’être envoyé à {etat.pending.masked}. Il est valable 15 minutes.
          </span>
          <input
            inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6}
            aria-label="Code reçu par email" placeholder="000000"
            value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); }}
            style={{ ...CHAMP, letterSpacing: '4px', textAlign: 'center', fontWeight: 700 }}
          />
          <div style={rangee}>
            <button type="submit" disabled={enVol} data-email-action="confirmer" style={BOUTON_VERT}>
              {enVol ? 'Vérification…' : 'Confirmer'}
            </button>
            <button type="button" onClick={renvoyer} style={BOUTON_GRIS}>Renvoyer le code</button>
            <button type="button" onClick={() => { setSaisie(null); }} style={BOUTON_GRIS}>Plus tard</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
