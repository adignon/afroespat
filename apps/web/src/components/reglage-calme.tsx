'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  DEFAULT_QUIET_HOURS,
  notificationPreferencesResponseSchema,
  type NotificationPreferencesResponse,
} from '@app/shared';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { lireReglagesNotification, oublierReglagesNotification } from '@/lib/preferences-notification';

/**
 * AJOUTS HORS MAQUETTE — les heures calmes et le résumé hebdomadaire de K07
 * (12 §2.2, `PUT /me/notification-preferences`).
 *
 * La planche dessine deux lignes à interrupteur — « Heures calmes · 22 h – 8 h » et
 * « Résumé hebdomadaire · chaque lundi par email » — dont les interrupteurs sont des
 * `<span>` : la plage et l'état étaient affichés, jamais modifiables. Ces deux
 * composants reprennent la ligne telle qu'elle est dessinée (titre 13.5/700, phrase
 * 12/#5D6B66, interrupteur 46×26 `#16785E`, repos `#CBD5D1`) et y ajoutent les deux
 * champs d'heure de la plage quand elle est active.
 *
 * Ils lisent et écrivent LEUR PROPRE part des préférences, sans passer par la grille
 * par catégorie ni par l'email et le push (lot B : `reglage-email`, `reglage-push`) :
 * `PUT` est partiel — une clé absente ne change rien côté serveur — donc écrire
 * `quietHours` seul ne touche pas aux canaux.
 *
 * Le fuseau est celui du membre (`users.timezone`), appliqué par le serveur : l'écran
 * dit « heure locale » et ne fait aucune conversion.
 */
const LIGNE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 0',
  flexWrap: 'wrap',
};
const TITRE: CSSProperties = { fontSize: '13.5px', fontWeight: 700 };
const PHRASE: CSSProperties = { fontSize: '12px', color: '#5D6B66', marginTop: '2px', lineHeight: 1.45 };
const CHAMP_HEURE: CSSProperties = {
  height: '44px',
  borderRadius: '12px',
  border: '1.5px solid #E6EBE9',
  background: '#fff',
  padding: '0 10px',
  fontSize: '13.5px',
  fontFamily: 'inherit',
  color: '#16211D',
};

function useReglages() {
  const [prefs, setPrefs] = useState<NotificationPreferencesResponse | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true;
    void lireReglagesNotification()
      .then((p) => {
        if (vivant) setPrefs(p);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const ecrire = useCallback((corps: Record<string, unknown>, succes: string): void => {
    setOccupe(true);
    oublierReglagesNotification();
    memberApi
      .put('/me/notification-preferences', notificationPreferencesResponseSchema, { body: corps })
      .then((p) => {
        setPrefs(p);
        notifySuccess(succes);
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'Le réglage n’a pas pu être enregistré.',
        );
      })
      .finally(() => {
        setOccupe(false);
      });
  }, []);

  return { prefs, occupe, ecrire };
}

function Interrupteur({
  actif,
  occupe,
  nom,
  onBasculer,
}: {
  readonly actif: boolean;
  readonly occupe: boolean;
  readonly nom: string;
  readonly onBasculer: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={nom}
      disabled={occupe}
      onClick={onBasculer}
      style={{
        width: '46px',
        height: '26px',
        borderRadius: '999px',
        background: actif ? '#16785E' : '#CBD5D1',
        position: 'relative',
        flexShrink: 0,
        border: 'none',
        padding: 0,
        cursor: occupe ? 'default' : 'pointer',
        boxSizing: 'content-box',
        minWidth: '46px',
        // Zone de clic de 44 px sans grossir la ligne.
        outlineOffset: '2px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: actif ? '23px' : '3px',
          width: '20px',
          height: '20px',
          borderRadius: '999px',
          background: '#fff',
        }}
      />
    </button>
  );
}

function heureFr(valeur: string): string {
  const [h = '', m = ''] = valeur.split(':');
  return m === '00' ? `${String(Number(h))} h` : `${String(Number(h))} h ${m}`;
}

export function ReglageHeuresCalmes({
  debut: debutConnu,
  fin: finConnue,
}: {
  /** Les bornes déjà chargées par la page (« 22 h »), montrées le temps que le réglage se charge. */
  readonly debut?: string;
  readonly fin?: string;
}) {
  const { prefs, occupe, ecrire } = useReglages();
  const plage = prefs?.quietHours ?? null;
  const [debut, setDebut] = useState<string>(DEFAULT_QUIET_HOURS.start);
  const [fin, setFin] = useState<string>(DEFAULT_QUIET_HOURS.end);

  useEffect(() => {
    if (plage !== null) {
      setDebut(plage.start);
      setFin(plage.end);
    }
  }, [plage]);

  return (
    <div style={LIGNE} data-reglage-calme="">
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={TITRE}>Heures calmes</div>
        <div style={PHRASE}>
          {prefs === null
            ? debutConnu !== undefined && finConnue !== undefined
              ? `${debutConnu} – ${finConnue}`
              : 'Chargement…'
            : plage === null
              ? 'Désactivées : les notifications push partent à toute heure.'
              : `Aucune notification push de ${heureFr(plage.start)} à ${heureFr(plage.end)} (heure locale). La sécurité du compte passe toujours.`}
        </div>
      </div>
      <Interrupteur
        actif={plage !== null}
        occupe={occupe || prefs === null}
        nom="Heures calmes"
        onBasculer={() => {
          ecrire(
            { quietHours: plage === null ? { ...DEFAULT_QUIET_HOURS } : null },
            plage === null ? 'Heures calmes activées.' : 'Heures calmes désactivées.',
          );
        }}
      />
      {plage === null ? null : (
        <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12.5px', color: '#5D6B66', display: 'flex', alignItems: 'center', gap: '8px' }}>
            De
            <input
              type="time"
              value={debut}
              disabled={occupe}
              onChange={(e) => {
                setDebut(e.target.value);
              }}
              style={CHAMP_HEURE}
            />
          </label>
          <label style={{ fontSize: '12.5px', color: '#5D6B66', display: 'flex', alignItems: 'center', gap: '8px' }}>
            à
            <input
              type="time"
              value={fin}
              disabled={occupe}
              onChange={(e) => {
                setFin(e.target.value);
              }}
              style={CHAMP_HEURE}
            />
          </label>
          <button
            type="button"
            disabled={occupe || debut === '' || fin === '' || (debut === plage.start && fin === plage.end)}
            onClick={() => {
              ecrire({ quietHours: { start: debut, end: fin } }, 'Heures calmes enregistrées.');
            }}
            style={{
              padding: '0 18px',
              borderRadius: '14px',
              background: '#16785E',
              color: '#fff',
              border: 'none',
              font: 'inherit',
              fontSize: '13.5px',
              fontWeight: 700,
              height: '44px',
              cursor: 'pointer',
              opacity: occupe || (debut === plage.start && fin === plage.end) ? 0.5 : 1,
            }}
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

export function ReglageResume() {
  const { prefs, occupe, ecrire } = useReglages();
  const actif = prefs?.weeklyDigest ?? false;
  return (
    <div style={LIGNE} data-reglage-resume="">
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={TITRE}>Résumé hebdomadaire</div>
        <div style={PHRASE}>
          {prefs === null
            ? 'Chargement…'
            : !prefs.emailAvailable
              ? 'Chaque lundi par email — ajoutez une adresse vérifiée pour le recevoir.'
              : actif
                ? 'Chaque lundi par email'
                : 'Désactivé'}
        </div>
      </div>
      <Interrupteur
        actif={actif}
        occupe={occupe || prefs === null}
        nom="Résumé hebdomadaire"
        onBasculer={() => {
          ecrire(
            { weeklyDigest: !actif },
            actif ? 'Résumé hebdomadaire désactivé.' : 'Résumé hebdomadaire activé.',
          );
        }}
      />
    </div>
  );
}
