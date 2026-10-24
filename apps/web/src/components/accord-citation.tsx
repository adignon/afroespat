'use client';

import { useEffect, useState } from 'react';
import { quotableResponseSchema } from '@app/shared';
import { displayMessageFor, memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — « AUTORISER LA CITATION » SUR MON GUIDE (15 §5.3, §6)               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le rapport d'impact peut citer un extrait de guide — mais SEULEMENT si l'auteur l'a permis. La case est
 * ici, sur la vue AUTEUR du guide, jamais cochée par défaut ; la décliner (ou la décocher plus tard) retire
 * la citation du rapport au prochain affichage. Le serveur ne laisse écrire l'accord qu'à l'auteur.
 *
 * Même langage visuel que les cartes voisines (fond `#fff`, trait `#E6EBE9`, rayon 22, coche `#16785E`), aucune
 * couleur nouvelle.
 */
export function AccordCitation({ guideId }: { readonly guideId: string }) {
  const [accord, setAccord] = useState<boolean | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    memberApi.get(`/guides/${guideId}/quotable`, quotableResponseSchema).then(
      (r) => {
        if (!annule) setAccord(r.quotable);
      },
      () => {
        if (!annule) setAccord(null);
      },
    );
    return () => {
      annule = true;
    };
  }, [guideId]);

  if (accord === null) return null;

  const basculer = (valeur: boolean) => {
    setOccupe(true);
    setMessage(null);
    memberApi.put(`/guides/${guideId}/quotable`, quotableResponseSchema, { body: { quotable: valeur } }).then(
      (r) => {
        setAccord(r.quotable);
        setMessage(r.quotable ? 'Merci : un extrait de votre guide pourra être cité, sans votre nom.' : 'C’est noté : votre guide ne sera plus cité.');
        setOccupe(false);
      },
      (erreur: unknown) => {
        setMessage(displayMessageFor(erreur));
        setOccupe(false);
      },
    );
  };

  return (
    <section
      aria-label="Citation dans le rapport d’impact"
      style={{ margin: '16px 24px', background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: occupe ? 'default' : 'pointer' }}>
        <input
          type="checkbox"
          checked={accord}
          disabled={occupe}
          onChange={(e) => basculer(e.target.checked)}
          style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#16785E', flexShrink: 0 }}
        />
        <span>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>Autoriser la citation de ce guide</span>
          <span style={{ display: 'block', fontSize: '13px', color: '#5D6B66' }}>
            Le rapport d’impact pour nos financeurs peut citer un extrait de ce guide, validé par l’équipe, sans votre nom. Vous pouvez retirer cet accord à tout moment.
          </span>
        </span>
      </label>
      {message === null ? null : (
        <div role="status" style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F5C48' }}>
          {message}
        </div>
      )}
    </section>
  );
}
