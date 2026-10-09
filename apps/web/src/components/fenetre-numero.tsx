'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { PanneauFenetre } from '@/components/panneau-fenetre';
import { listCountries } from '@/lib/api';
import { z } from 'zod';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUTER UN NUMÉRO — DEUX TEMPS, PARCE QUE LE SERVEUR EN A DEUX            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le bouton pour faire la vérification d'identité est là ? Et
 * l'ajout du numéro marche ? » et « Niveau page sécurité, l'ajout de numéro
 * marche […] ? »
 *
 * MESURÉ : les deux boutons « Ajouter mon numéro » (K03) et « + Ajouter » (K04)
 * étaient des `<button>` SANS geste. Les routes existaient :
 * `POST /me/phones` envoie le code, `POST /me/phones/verify` le confirme.
 *
 * ── UNE SEULE FENÊTRE POUR LES DEUX PAGES ─────────────────────────────────
 *
 * La vérification et la sécurité demandent la même chose, et la maquette ne
 * dessine de fenêtre ni pour l'une ni pour l'autre. En écrire deux donnerait deux
 * formulaires à tenir d'accord, et la première retouche les ferait diverger.
 *
 * ⚠ AUCUNE MAQUETTE NE DESSINE CETTE FENÊTRE. Sa coque est `PanneauFenetre` — le
 * composant que le porteur a demandé, dont le châssis vient de A01P — et ses
 * champs reprennent le dessin de l'onboarding, qui demande déjà un numéro puis un
 * code. DÉDUCTION, remontée au porteur.
 *
 * ── LE PAYS SE CHOISIT, ET C'ÉTAIT UN DÉFAUT MESURÉ ──────────────────────
 *
 * Le porteur : « L'ajout de numéro est validé ? Aussi il faut permettre de
 * changer le pays (les pays hors Afrique). »
 *
 * MESURÉ : `POST /me/phones` répondait **400**. `addPhoneStartSchema` exige
 * `countryIso2` et la première version ne l'envoyait pas — le champ existait, la
 * fenêtre s'ouvrait, et rien ne partait.
 *
 * LE PAYS VIENT DONC DU RÉFÉRENTIEL, pas d'une valeur par défaut : c'est lui qui
 * porte l'indicatif, et le membre doit pouvoir dire où est son numéro.
 * `GET /places/countries` est PUBLIQUE et rend les pays ACTIFS avec leur
 * `dialCode` — la même route que l'inscription.
 *
 * ⚠ LE CATALOGUE NE PORTAIT QUE DES PAYS AFRICAINS plus la France : dix-sept
 * lignes, trois actives. Les destinations hors Afrique ont été ajoutées au semis
 * (Belgique, Suisse, Canada, Allemagne, Royaume-Uni, États-Unis, Espagne, Italie,
 * Portugal) — voir `packages/db/src/seed/referentials.ts` pour le pourquoi du
 * `kind: 'DESTINATION'`.
 *
 * ── `captchaToken: 'dev'` ─────────────────────────────────────────────────
 *
 * `addPhoneStartSchema` l'exige. L'onboarding envoie la même valeur
 * (`use-onboarding-flow.ts`) : le fournisseur de captcha n'est pas branché dans
 * ce dépôt, et inventer un second jeton ici ferait croire qu'il l'est. Le jour où
 * il arrive, les deux appels changent ensemble — et c'est pour ça qu'ils doivent
 * dire la même chose aujourd'hui.
 */
/**
 * `POST /me/phones` rend ce que rend `requestOtp` : `{ challengeId, expiresAt }`.
 * Relevé sur `auth.service.ts`, pas deviné — la route délègue à lui. `.strict()`,
 * comme toute frontière du dépôt : un champ ajouté par le serveur doit se voir.
 */
const debutSchema = z
  .object({ challengeId: z.string(), expiresAt: z.string() })
  .strict();

export function FenetreNumero({
  ouverte,
  onFermer,
  onAjoute,
}: {
  readonly ouverte: boolean;
  readonly onFermer: () => void;
  /** Appelé après une vérification réussie : l'écran se recharge. */
  readonly onAjoute: () => void;
}) {
  const [numero, setNumero] = useState('');
  const [pays, setPays] = useState<readonly { iso2: string; nameFr: string; dialCode: string }[]>(
    [],
  );
  const [iso2, setIso2] = useState('FR');
  const [code, setCode] = useState('');
  const [defi, setDefi] = useState<string | null>(null);
  const [enVol, setEnVol] = useState(false);

  /**
   * LE RÉFÉRENTIEL NE SE CHARGE QU'À L'OUVERTURE. La fenêtre vit sur deux pages
   * du compte et la plupart des visites ne l'ouvriront pas : le charger au
   * montage ferait un aller-retour pour rien.
   */
  useEffect(() => {
    if (!ouverte || pays.length > 0) return;
    void listCountries()
      .then((r) => {
        setPays(r.items);
      })
      .catch(() => {
        notifyError('La liste des pays n’a pas pu être chargée.');
      });
  }, [ouverte, pays.length]);

  const fermer = (): void => {
    setNumero('');
    setCode('');
    setDefi(null);
    onFermer();
  };

  const envoyerCode = (): void => {
    const tel = numero.trim();
    if (tel.length < 4 || enVol) return;
    setEnVol(true);
    memberApi
      .post('/me/phones', debutSchema, {
        /**
         * `countryIso2` EST OBLIGATOIRE, et son absence valait un `400` muet :
         * le code ne partait jamais et rien ne le disait. Relevé sur
         * `addPhoneStartSchema`, pas supposé.
         */
        body: { phone: tel, countryIso2: iso2, captchaToken: 'dev' },
      })
      .then((r) => {
        setDefi(r.challengeId);
        notifySuccess('Code envoyé par SMS.');
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'Le code n’a pas pu être envoyé.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  const confirmer = (): void => {
    if (defi === null || code.trim().length < 4 || enVol) return;
    setEnVol(true);
    memberApi
      .post('/me/phones/verify', z.unknown(), { body: { challengeId: defi, code: code.trim() } })
      .then(() => {
        notifySuccess('Numéro ajouté.');
        fermer();
        onAjoute();
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'Le code n’a pas été accepté.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  /** Le dessin d'un champ, repris de la fenêtre de signalement (X03). */
  const champ = {
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

  const action = {
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
    flex: '1',
  };

  const panneau = (
    <PanneauFenetre
      titreId="numero-titre"
      titre="Ajouter un numéro"
      actions={
        <>
          <button
            type="button"
            onClick={fermer}
            style={{ ...action, background: '#F2F5F4', color: '#16211D', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={defi === null ? envoyerCode : confirmer}
            disabled={enVol || (defi === null ? numero.trim().length < 4 : code.trim().length < 4)}
            data-numero-valider=""
            style={{
              ...action,
              background: enVol ? '#8A958F' : '#16785E',
              color: '#fff',
              cursor: enVol ? 'default' : 'pointer',
            }}
          >
            {defi === null ? 'Envoyer le code' : 'Vérifier'}
          </button>
        </>
      }
    >
      {defi === null ? (
        <>
          <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#5D6B66' }}>
            Un code vous sera envoyé par SMS. Choisissez le pays, puis indiquez le numéro.
          </div>
          <select
            value={iso2}
            onChange={(e) => {
              setIso2(e.target.value);
            }}
            aria-label="Pays du numéro"
            data-numero-pays=""
            style={champ}
          >
            {pays.map((p) => (
              <option key={p.iso2} value={p.iso2}>
                {p.nameFr} ({p.dialCode})
              </option>
            ))}
          </select>
          <input
            value={numero}
            onChange={(e) => {
              setNumero(e.target.value);
            }}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="6 12 34 56 78"
            aria-label="Numéro de téléphone"
            data-numero-champ=""
            style={champ}
          />
        </>
      ) : (
        <>
          <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#5D6B66' }}>
            Entrez le code reçu au {numero.trim()}.
          </div>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            aria-label="Code reçu par SMS"
            data-numero-code=""
            style={{ ...champ, letterSpacing: '4px', fontWeight: 800 }}
          />
        </>
      )}
    </PanneauFenetre>
  );

  return (
    <Modal open={ouverte} onClose={fermer} titleId="numero-titre" name="NUMERO" mobile={panneau} />
  );
}
