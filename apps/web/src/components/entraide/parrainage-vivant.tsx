'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  MENTORSHIP_MESSAGE_MAX,
  MENTORSHIP_MESSAGE_MIN,
  createMentorshipSchema,
  journeysListResponseSchema,
  mentorshipCreatedSchema,
} from '@app/shared';
import { memberApi } from '@/lib/api/index';
import { Alerte, BOUTON_DISCRET, BOUTON_PLEIN, CHAMP, Compteur, Feuille, LIBELLE, eteint } from './atomes';
import { useGeste } from './geste';

/**
 * AJOUT HORS MAQUETTE — les gestes du PARRAINAGE (H05 à H08).
 *
 * La maquette dessine la fiche d'un parrain, sa liste, « Mes parrainages » et
 * « Devenir parrain » comme des images : aucun bouton n'écrivait. Les composants de
 * ce fichier en reprennent le dessin (mêmes rayons, mêmes teintes) et branchent les
 * huit routes d'écriture du module (`POST /mentorships`, `/accept`, `/decline`,
 * `/end`, `/extend`, `/review`, `PUT` et `DELETE /me/mentor-profile`).
 *
 * LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE : on grise « Envoyer » tant que le message n'a
 * pas les 50 caractères de §2.2 (`MENTORSHIP_MESSAGE_MIN`, source unique), mais
 * `MENTOR_FULL`, `PENDING_REQUEST_EXISTS` et `BLOCKED_RELATIONSHIP` sont ceux du
 * serveur, avec leur phrase — le front ne devine pas qu'une demande est déjà en
 * attente.
 */

// ── H06 : « Demander comme parrain » et sa feuille ───────────────────────────

export function BoutonDemander({
  handle,
  nom,
  complet,
  libelle,
  style,
}: {
  readonly handle: string;
  readonly nom: string;
  /** « Complet » (§2.1) : on prévient, mais le serveur refuse de toute façon. */
  readonly complet: boolean;
  readonly libelle: string;
  readonly style: CSSProperties;
}) {
  const router = useRouter();
  const { lancer, occupe, fenetre } = useGeste();
  const [ouverte, setOuverte] = useState(false);
  const [message, setMessage] = useState('');
  const [parcours, setParcours] = useState('');
  const [mesParcours, setMesParcours] = useState<readonly { id: string; title: string }[]>([]);
  const [refus, setRefus] = useState<string | null>(null);

  useEffect(() => {
    if (!ouverte) return;
    let vivant = true;
    void memberApi
      .get('/journeys', journeysListResponseSchema)
      .then((r) => {
        if (vivant) setMesParcours(r.items.map((j) => ({ id: j.id, title: j.title })));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [ouverte]);

  const brouillon = {
    mentorHandle: handle,
    message: message.trim(),
    ...(parcours === '' ? {} : { journeyId: parcours }),
  };
  const verdict = createMentorshipSchema.safeParse(brouillon);

  const envoyer = async (): Promise<void> => {
    setRefus(null);
    if (!verdict.success || occupe) return;
    const ok = await lancer(
      () => memberApi.post('/mentorships', mentorshipCreatedSchema, { body: verdict.data }),
      { succes: 'Votre demande est envoyée. Réponse sous 7 jours.', recharger: false },
    );
    if (ok) {
      setOuverte(false);
      router.push('/parrainage/mes-parrainages');
    } else {
      setRefus('La demande n’est pas partie : voir le message affiché.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        data-demander-parrain=""
        style={eteint(style, complet)}
        aria-disabled={complet}
      >
        {complet ? 'Complet pour le moment' : libelle}
      </button>
      <Feuille
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        nom="DEMANDE-PARRAIN"
        titre={`Demander ${nom} comme parrain`}
        actions={
          <>
            <button type="button" data-modal-close="" style={{ ...BOUTON_DISCRET, flex: 1 }}>
              Annuler
            </button>
            <button
              type="button"
              disabled={!verdict.success || occupe}
              onClick={() => void envoyer()}
              style={{ ...eteint(BOUTON_PLEIN, !verdict.success || occupe), flex: 1 }}
            >
              {occupe ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: '13px', color: '#5D6B66', lineHeight: 1.5 }}>
          Présentez-vous et dites ce que vous cherchez : {nom} accepte ou refuse sans avoir à
          se justifier, et la demande expire au bout de 7 jours. Un parrainage est gratuit.
        </div>
        <div>
          <label htmlFor="parrain-message" style={LIBELLE}>
            Votre message
          </label>
          <textarea
            id="parrain-message"
            value={message}
            rows={6}
            maxLength={MENTORSHIP_MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Bonjour, je prépare mon arrivée à Lyon pour mes études et je cherche quelqu’un qui connaît les démarches…"
            style={{ ...CHAMP, resize: 'vertical' }}
          />
          <Compteur n={message.trim().length} min={MENTORSHIP_MESSAGE_MIN} max={MENTORSHIP_MESSAGE_MAX} />
        </div>
        {mesParcours.length === 0 ? null : (
          <div>
            <label htmlFor="parrain-parcours" style={LIBELLE}>
              Un de vos parcours (facultatif)
            </label>
            <select id="parrain-parcours" value={parcours} onChange={(e) => setParcours(e.target.value)} style={CHAMP}>
              <option value="">Aucun</option>
              {mesParcours.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {refus === null ? null : <Alerte>{refus}</Alerte>}
      </Feuille>
      {fenetre}
    </>
  );
}
