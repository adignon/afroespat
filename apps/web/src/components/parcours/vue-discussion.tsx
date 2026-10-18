'use client';

/**
 * AJOUT HORS MAQUETTE — J01D « DISCUSSION » BRANCHÉE SUR LA MESSAGERIE DU PARCOURS.
 *
 * La maquette dessine des bulles inventées (« Tu veux que je relise ton dossier ? »).
 * La discussion d'un parcours EST une conversation de la messagerie
 * (`journey.groupConversationId`, 08 §5.1) : on lit `GET /conversations/:id/messages`
 * et on écrit par `POST /conversations/:id/messages` — mêmes règles, mêmes bornes que
 * M01. Un OBSERVATEUR n'a pas de discussion (`groupConversationId` nul, §3.4) : on le
 * lui dit au lieu d'afficher un fil vide. Les messages arrivent du plus récent au plus
 * ancien ; on les retourne ici. Pas de temps réel dans cette vue : un bouton
 * « Actualiser » et un rechargement après chaque envoi.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MESSAGE_BODY_MAX, messagesResponseSchema, type Message } from '@app/shared';
import { z } from 'zod';
import { memberApi, displayMessageFor } from '@/lib/api/index';
import { Avis, Attente, Bouton, C, Etiquette, carte } from './ui';
import { Chargeur, EnteteParcours, OngletsMobile } from './commun';
import { ouvrirFeuille } from './feuilles-store';
import { useGeste } from './donnees';

function Fil({ conversationId, compact }: { readonly conversationId: string; readonly compact: boolean }) {
  const [messages, setMessages] = useState<readonly Message[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const geste = useGeste();
  const bas = useRef<HTMLDivElement | null>(null);

  const charger = useCallback(() => {
    memberApi.get(`/conversations/${conversationId}/messages?limit=50`, messagesResponseSchema).then(
      (page) => {
        setMessages([...page.items].reverse());
        setEchec(null);
      },
      (cause: unknown) => setEchec(displayMessageFor(cause)),
    );
  }, [conversationId]);

  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    bas.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const envoyer = () => {
    const corps = texte.trim();
    if (corps === '') return;
    void geste.executer(async () => {
      await memberApi.post(`/conversations/${conversationId}/messages`, z.unknown(), { body: { body: corps } });
      setTexte('');
      charger();
    });
  };

  return (
    <div style={{ ...carte(compact ? 14 : 18), display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}><Etiquette>DISCUSSION DU PARCOURS</Etiquette></div>
        <button type="button" onClick={charger} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: '12.5px', fontWeight: 700, color: C.vertFonce, cursor: 'pointer' }}>
          Actualiser
        </button>
      </div>
      {messages === null && echec === null ? <Attente texte="Chargement des messages…" /> : null}
      <Avis texte={echec} ton="erreur" />
      {messages !== null && messages.length === 0 ? (
        <div style={{ fontSize: '13.5px', color: C.gris, lineHeight: 1.5 }}>
          Aucun message. Invitez un proche ou votre parrain pour échanger sur votre parcours.
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: compact ? '50vh' : '460px', overflowY: 'auto' }}>
        {(messages ?? []).map((m) => (
          <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            {m.mine ? null : <div style={{ fontSize: '11.5px', fontWeight: 700, color: C.gris, marginBottom: '2px' }}>@{m.senderHandle}</div>}
            <div style={{ background: m.mine ? C.vert : C.fond, color: m.mine ? '#fff' : C.texte, borderRadius: '16px', padding: '9px 13px', fontSize: '13.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.deletedAt === null ? (m.body ?? '') : 'Message supprimé'}
            </div>
          </div>
        ))}
        <div ref={bas} />
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          aria-label="Votre message"
          value={texte}
          maxLength={MESSAGE_BODY_MAX}
          rows={2}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              envoyer();
            }
          }}
          placeholder="Écrire à l’équipe…"
          style={{ flex: 1, borderRadius: '14px', border: `1px solid ${C.bord}`, padding: '10px 12px', font: 'inherit', fontSize: '14px', resize: 'none', outline: 'none' }}
        />
        <Bouton compact disabled={geste.occupe || texte.trim() === ''} onClick={envoyer}>
          Envoyer
        </Bouton>
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
    </div>
  );
}

export function VueDiscussion({ compact }: { readonly compact: boolean }) {
  return (
    <Chargeur
      enfants={(parcours, vue) => {
        const corps = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EnteteParcours parcours={parcours} compact={compact} />
            {parcours.journey.groupConversationId === null ? (
              <div style={{ ...carte(20), color: C.gris, fontSize: '14px', lineHeight: 1.5 }}>
                {parcours.viewerRole === 'OBSERVER'
                  ? 'En tant qu’observateur·rice, vous suivez la progression mais ne participez pas à la discussion.'
                  : 'La discussion de ce parcours est en cours de création. Revenez dans un instant.'}
              </div>
            ) : (
              <Fil conversationId={parcours.journey.groupConversationId} compact={compact} />
            )}
            {parcours.viewerRole === 'OWNER' && parcours.members.length === 0 ? (
              <div style={{ ...carte(18), display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '14px', color: C.gris }}>
                  Invitez un proche ou votre parrain pour échanger sur votre parcours.
                </div>
                <div><Bouton compact onClick={() => ouvrirFeuille('inviter')}>Inviter</Bouton></div>
              </div>
            ) : null}
          </div>
        );
        return compact ? (
          <>
            <OngletsMobile id={vue.id} actif="/discussion" />
            <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div>
          </>
        ) : (
          corps
        );
      }}
    />
  );
}
