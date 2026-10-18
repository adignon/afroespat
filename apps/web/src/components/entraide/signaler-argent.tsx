'use client';

import { useState, type CSSProperties } from 'react';
import { publicProfileResponseSchema } from '@app/shared';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';
import { ApiError, ApiFailure, memberApi } from '@/lib/api/index';
import { Alerte, BOUTON_DISCRET, BOUTON_PLEIN, CHAMP, LIBELLE, eteint } from './atomes';

/**
 * AJOUT — le « Signaler » du bandeau anti-paiement (06 §2.7, 08 §2.4).
 *
 * Sur les dix écrans H01 à H10, la règle « Si on vous demande de l'argent,
 * signalez. » était suivie d'un `<a href="#">Signaler</a>` : un lien mort, sur la
 * phrase même qui dit quoi faire. Il devient un vrai signalement (`POST
 * /reports`), par la MÊME fenêtre que partout ailleurs (`FenetreSignalement`, la
 * planche X03) — on n'en dessine pas une seconde.
 *
 * ── QUI SIGNALE-T-ON ? ───────────────────────────────────────────────────
 *
 * Un signalement vise un sujet précis. Là où l'écran en a un — la demande ouverte
 * (H02), le parrain dont on lit la fiche (H06) — il est passé en `sujet` et la
 * fenêtre s'ouvre directement. Ailleurs (le fil, les listes) la règle est générale :
 * la bascule demande d'abord QUI a demandé de l'argent, par son pseudo, le résout
 * avec `GET /users/:handle` (qui rend l'identifiant du membre, jamais un
 * téléphone) et signale ce MEMBRE. Un pseudo inconnu, ou celui d'un membre qui
 * vous est séparé par un blocage, répond 404 : « Aucun membre ne porte ce pseudo. »
 */
export function SignalerArgent({
  style,
  sujet,
}: {
  readonly style?: CSSProperties;
  readonly sujet?: { readonly type: string; readonly id: string } | null;
}) {
  const [etape, setEtape] = useState<'ferme' | 'qui' | 'fenetre'>('ferme');
  const [pseudo, setPseudo] = useState('');
  const [cible, setCible] = useState<{ readonly type: string; readonly id: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const ouvrir = (): void => {
    setErreur(null);
    if (sujet !== undefined && sujet !== null) {
      setCible(sujet);
      setEtape('fenetre');
    } else {
      setEtape('qui');
    }
  };

  const resoudre = async (): Promise<void> => {
    const brut = pseudo.trim().replace(/^@/, '');
    if (brut === '' || occupe) return;
    setOccupe(true);
    setErreur(null);
    try {
      const profil = await memberApi.get(
        `/users/${encodeURIComponent(brut)}`,
        publicProfileResponseSchema,
      );
      if (profil.userId === null) {
        setErreur('Ce membre ne peut pas être signalé depuis ici.');
        return;
      }
      setCible({ type: 'USER', id: profil.userId });
      setEtape('fenetre');
    } catch (cause: unknown) {
      setErreur(
        cause instanceof ApiError && cause.status === 404
          ? 'Aucun membre ne porte ce pseudo.'
          : cause instanceof ApiFailure
            ? cause.displayMessage
            : 'La recherche a échoué. Réessayez dans un instant.',
      );
    } finally {
      setOccupe(false);
    }
  };

  const fermer = (): void => {
    setEtape('ferme');
    setCible(null);
  };

  const feuille = (mobile: boolean) => (
    <PanneauFenetre
      titreId="signaler-argent-titre"
      titre="Signaler une demande d’argent"
      feuille={mobile}
      largeur="440px"
      actions={
        <>
          <button type="button" data-modal-close="" style={{ ...BOUTON_DISCRET, flex: 1 }}>
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              void resoudre();
            }}
            disabled={pseudo.trim() === '' || occupe}
            style={{ ...eteint(BOUTON_PLEIN, pseudo.trim() === '' || occupe), flex: 1 }}
          >
            Continuer
          </button>
        </>
      }
    >
      <div style={{ fontSize: '13px', color: '#5D6B66', lineHeight: 1.5 }}>
        Aucun versement entre membres. Dites-nous qui vous a demandé de l’argent : vous
        choisirez ensuite le motif, et l’équipe de modération regardera en priorité.
      </div>
      <div>
        <label htmlFor="signaler-pseudo" style={LIBELLE}>
          Pseudo du membre
        </label>
        <input
          id="signaler-pseudo"
          value={pseudo}
          onChange={(e) => {
            setPseudo(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void resoudre();
          }}
          placeholder="@pseudo"
          autoCapitalize="none"
          autoCorrect="off"
          style={CHAMP}
        />
      </div>
      {erreur === null ? null : <Alerte>{erreur}</Alerte>}
    </PanneauFenetre>
  );

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        data-signaler-argent=""
        style={{
          font: 'inherit',
          ...style,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        Signaler
      </button>
      <Modal
        open={etape === 'qui'}
        onClose={fermer}
        titleId="signaler-argent-titre"
        name="SIGNALER-ARGENT"
        desktop={feuille(false)}
        mobile={feuille(true)}
      />
      <FenetreSignalement
        sujet={etape === 'fenetre' ? cible : null}
        onFermer={fermer}
      />
    </>
  );
}
