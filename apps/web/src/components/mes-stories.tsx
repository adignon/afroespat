'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import type { MyStoriesResponse } from '@app/shared';
import { EtatVide } from '@/components/etat-vide';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { notifyError, notifySuccess } from '@/components/notifications';
import { convertStory, deleteStory, fetchMyStories } from '@/screens/accueil/api';
import { echecDe } from '@/screens/publication/echec';
import { cibleDeConversion } from '@/components/actions-story-auteur';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ MES STORIES — L'HISTORIQUE DE 30 JOURS (AJOUT, lot G)                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 04 §2.6 : « Une story expirée reste lisible pour son auteur (historique 30
 * jours) ». `GET /me/stories` rend ces stories avec les votes reçus ; aucun écran
 * ne l'appelait. Cette page les liste, dans le dessin des cartes voisines (blanc,
 * `#E6EBE9`, rayon 22), avec ce que le serveur dit de chacune :
 *
 *   · son état — en ligne, expirée, retirée — et, si elle a été gardée, où ;
 *   · les votes reçus, avec les mots du TYPE (« Utile » / « Pas utile »…) ;
 *   · deux gestes : « Garder » (conversion en demande d'entraide ou en astuce de
 *     ville, avant l'expiration, jamais automatique) et « Supprimer ».
 *
 * AUCUN COMPTEUR DE VUES : §2.6 et 00 §49 l'interdisent, et le schéma est `.strict()`.
 * Le serveur décide de ce qui est convertible ; le bouton n'est offert que si le
 * serveur n'a pas déjà converti la story et qu'elle n'a pas expiré.
 */
type Ligne = MyStoriesResponse['items'][number];

export function MesStories() {
  const [lignes, setLignes] = useState<readonly Ligne[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<Ligne | null>(null);
  const [conversion, setConversion] = useState<Ligne | null>(null);
  const [occupe, setOccupe] = useState(false);
  const reprise = useRef<Promise<boolean> | null>(null);

  const charger = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      if (!hasAccessToken()) {
        reprise.current ??= resumeSession();
        await reprise.current;
      }
      const reponse = await fetchMyStories(signal);
      setLignes(reponse.items);
      setEchec(null);
    } catch (cause) {
      if (signal?.aborted === true) return;
      setEchec(echecDe(cause).message);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => {
      ac.abort();
    };
  }, [charger]);

  const confirmerSuppression = (): void => {
    if (suppression === null) return;
    setOccupe(true);
    void deleteStory(suppression.id)
      .then(() => {
        notifySuccess('Story supprimée.');
        setSuppression(null);
        return charger();
      })
      .catch((cause: unknown) => {
        notifyError(echecDe(cause).message);
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const confirmerConversion = (): void => {
    if (conversion === null) return;
    const cible = cibleDeConversion(conversion.type);
    if (cible === null) return;
    setOccupe(true);
    void convertStory(conversion.id, cible.cible)
      .then(() => {
        notifySuccess(cible.succes);
        setConversion(null);
        return charger();
      })
      .catch((cause: unknown) => {
        notifyError(echecDe(cause).message);
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const etat = (l: Ligne): string => {
    if (l.status === 'REMOVED') return 'Retirée';
    if (l.status === 'HIDDEN') return 'En vérification';
    if (l.expired || l.status === 'EXPIRED') return 'Expirée';
    return 'En ligne';
  };

  return (
    <div data-screen="MES-STORIES" style={{ background: '#F6F8F7', minHeight: '100vh' }}>
      <main style={{ maxWidth: '660px', margin: '0 auto', padding: '24px 16px 48px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Link href="/accueil" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#16785E', textDecoration: 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Fil d’actualité
        </Link>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px' }}>Mes stories</h1>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#5D6B66', lineHeight: 1.5 }}>
          Vos stories des 30 derniers jours, avec les votes reçus. Une story encore en ligne peut être gardée avant
          d’expirer.
        </p>

        {echec !== null ? <EtatVide texte={echec} /> : null}
        {echec === null && lignes === null ? <EtatVide texte="Chargement de vos stories…" /> : null}
        {lignes !== null && lignes.length === 0 ? (
          <EtatVide texte="Vous n’avez publié aucune story ces 30 derniers jours." />
        ) : null}

        {(lignes ?? []).map((l) => {
          const cible = cibleDeConversion(l.type);
          const gardable = cible !== null && l.convertedTo === null && !l.expired && l.status === 'ACTIVE';
          return (
            <article
              key={l.id}
              data-mes-story={l.id}
              style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: '#E3F0EB', color: '#0F5C48', fontSize: '11px', fontWeight: 700, padding: '4px 11px', borderRadius: '999px' }}>
                  {l.typeLabel}
                </span>
                <span style={{ background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '4px 11px', borderRadius: '999px' }}>
                  {etat(l)}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '12px', color: '#8A958F' }}>
                  {new Date(l.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · {l.city.name}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{l.body}</p>
              <div style={{ display: 'flex', gap: '14px', fontSize: '12.5px', color: '#5D6B66', flexWrap: 'wrap' }}>
                <span>
                  <strong style={{ color: '#16211D' }}>{l.votes.positive}</strong> {l.votes.positiveLabel}
                </span>
                <span>
                  <strong style={{ color: '#16211D' }}>{l.votes.negative}</strong> {l.votes.negativeLabel}
                </span>
              </div>
              {l.convertedTo !== null ? (
                <div style={{ background: '#E3F0EB', color: '#0F5C48', borderRadius: '14px', padding: '10px 14px', fontSize: '13px', fontWeight: 600 }}>
                  Gardée
                  {l.convertedTo.type === 'HELP_REQUEST' ? (
                    <>
                      {' '}
                      comme demande d’entraide —{' '}
                      <Link href={`/entraide/${l.convertedTo.id}`} style={{ color: '#0F5C48', fontWeight: 700 }}>
                        ouvrir
                      </Link>
                    </>
                  ) : (
                    ' comme astuce de ville.'
                  )}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {l.status === 'ACTIVE' && !l.expired ? (
                  <Link href={`/stories/${l.id}`} style={{ height: '36px', padding: '0 16px', borderRadius: '999px', border: '1px solid #E6EBE9', background: '#fff', color: '#16211D', fontSize: '12.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                    Voir
                  </Link>
                ) : null}
                {gardable ? (
                  <button
                    type="button"
                    data-garder-story=""
                    onClick={() => {
                      setConversion(l);
                    }}
                    style={{ height: '36px', padding: '0 16px', borderRadius: '999px', border: 'none', background: '#16785E', color: '#fff', font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Garder
                  </button>
                ) : null}
                {l.status !== 'REMOVED' ? (
                  <button
                    type="button"
                    data-supprimer-story=""
                    onClick={() => {
                      setSuppression(l);
                    }}
                    style={{ height: '36px', padding: '0 16px', borderRadius: '999px', border: '1px solid #E6EBE9', background: '#fff', color: '#5D6B66', font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </main>
      <FenetreConfirmation
        ouverte={suppression !== null}
        nom="SUPPRESSION-STORY"
        titre="Supprimer cette story ?"
        question="Elle disparaîtra de votre historique et du ruban."
        precision="Ce geste est définitif : les membres qui l’avaient enregistrée verront « Contenu retiré »."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onConfirmer={confirmerSuppression}
        onAnnuler={() => {
          setSuppression(null);
        }}
      />
      <FenetreConfirmation
        ouverte={conversion !== null}
        nom="GARDER-STORY"
        titre="Garder cette story ?"
        question={cibleDeConversion(conversion?.type ?? 'CONSEIL')?.question ?? ''}
        precision="Ce n’est jamais automatique : la story reste en ligne jusqu’à son expiration."
        libelleConfirmer="Garder"
        occupe={occupe}
        onConfirmer={confirmerConversion}
        onAnnuler={() => {
          setConversion(null);
        }}
      />
    </div>
  );
}
