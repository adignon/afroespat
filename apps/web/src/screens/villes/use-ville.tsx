'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { CITY_TIP_MAX_BODY, createCityTipSchema } from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { conversationAvec, ouvrirConversation, prenomDe } from '@/components/ecrire';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { notifyError } from '@/components/notifications';
import { centimesDe } from '@/lib/centimes';
import { ApiError, memberApi } from '@/lib/api/index';
import type {
  ContributionView,
  GestesContributions,
  LigneBudgetSaisie,
  TypeContribution,
} from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES GESTES DE LA FICHE VILLE : VOTER, SIGNALER, SUPPRIMER, SALUER, CONTRIBUER ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Chaque geste est UN appel et le serveur décide :
 *
 *   · `PUT/DELETE /tips/:id/vote` — « Utile ». Le compteur revient du serveur ;
 *   · le signalement passe par la feuille commune (`CITY_TIP`) ;
 *   · `DELETE /tips/:id` — l'auteur retire sa contribution, après confirmation ;
 *   · « Saluer » ouvre la conversation directe pré-adressée (08 : `POST
 *     /conversations/direct`), ou rouvre celle qui existe — la route est unique par
 *     paire ;
 *   · `POST /cities/:slug/tips` — contribuer (capacité `post.create`, L1). Les
 *     bornes viennent de `createCityTipSchema` et de `CITY_TIP_MAX_BODY`, JAMAIS
 *     recopiées ; le refus du serveur s'affiche tel quel.
 *
 * Les fenêtres (confirmation, signalement, écrire, niveau) sont rendues UNE fois
 * par l'écran : `ScreenFrames` monte les deux cadres, et une fenêtre posée dans le
 * cadre s'ouvrirait en double (leçon payée, voir `use-ecrire-membre.ts`).
 */
export function useGestesVille(recharger: () => void): {
  readonly gestes: GestesContributions;
  readonly fenetres: ReactNode;
} {
  const router = useRouter();
  const { occupe, lancer, fenetre } = useGeste();
  const [signalement, setSignalement] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [salut, setSalut] = useState<{ readonly handle: string } | null>(null);
  const [enVol, setEnVol] = useState(false);

  const onVoter = useCallback(
    (id: string, aVote: boolean): void => {
      void lancer(
        () =>
          aVote
            ? memberApi.del(`/tips/${id}/vote`, z.unknown())
            : memberApi.put(`/tips/${id}/vote`, z.unknown()),
        { recharger: false, echecRepli: 'Votre vote n’a pas pu être enregistré.' },
      ).then((ok) => {
        if (ok) recharger();
      });
    },
    [lancer, recharger],
  );

  const onSupprimer = useCallback((id: string): void => {
    setSuppression(id);
  }, []);

  const confirmerSuppression = useCallback((): void => {
    const id = suppression;
    if (id === null) return;
    void lancer(() => memberApi.del(`/tips/${id}`, z.unknown()), {
      recharger: false,
      succes: 'Votre contribution est retirée.',
      echecRepli: 'La contribution n’a pas pu être retirée.',
    }).then((ok) => {
      if (ok) {
        setSuppression(null);
        recharger();
      }
    });
  }, [lancer, recharger, suppression]);

  /**
   * ON CHERCHE AVANT D'OUVRIR : la route de conversation directe est unique par
   * paire, et lui demander un premier message sur un fil existant en enverrait un
   * de plus pour rien. Même arbitrage que `use-ecrire-membre.ts`.
   */
  const onSaluer = useCallback(
    (handle: string): void => {
      if (enVol) return;
      setEnVol(true);
      conversationAvec(handle)
        .then((existante) => {
          if (existante === null) setSalut({ handle });
          else router.push(`/messages/${existante}`);
        })
        .catch(() => {
          setSalut({ handle });
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [enVol, router],
  );

  const envoyerSalut = useCallback(
    (message: string): void => {
      if (salut === null) return;
      setEnVol(true);
      ouvrirConversation(salut.handle, message)
        .then((conversationId) => {
          setSalut(null);
          router.push(`/messages/${conversationId}`);
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [router, salut],
  );

  const gestes = useMemo<GestesContributions>(
    () => ({
      occupe: occupe || enVol,
      onVoter,
      onSignaler: setSignalement,
      onSupprimer,
      onSaluer,
    }),
    [enVol, occupe, onSaluer, onSupprimer, onVoter],
  );

  const fenetres = (
    <>
      {fenetre}
      <FenetreSignalement
        sujet={signalement === null ? null : { type: 'CITY_TIP', id: signalement }}
        onFermer={() => {
          setSignalement(null);
        }}
      />
      <FenetreConfirmation
        ouverte={suppression !== null}
        nom="SUPPRESSION-CONTRIBUTION"
        titre="Retirer ma contribution"
        question="Elle disparaîtra de la fiche, ainsi que les votes « utile » qu’elle a reçus."
        libelleConfirmer="Retirer"
        occupe={occupe}
        onConfirmer={confirmerSuppression}
        onAnnuler={() => {
          setSuppression(null);
        }}
      />
      <FenetreEcrire
        ouverte={salut !== null}
        prenom={salut === null ? '' : prenomDe('', salut.handle)}
        occupe={enVol}
        onEnvoyer={envoyerSalut}
        onFermer={() => {
          setSalut(null);
        }}
      />
    </>
  );

  return { gestes, fenetres };
}

// ─── Contribuer ──────────────────────────────────────────────────────────────

const TITRES_ETAPE: Record<TypeContribution, string> = {
  TIP: 'Bon plan',
  SHOP: 'Produit du pays',
  BUDGET: 'Budget réel',
  TESTIMONY: 'Témoignage',
};

const LIGNES_DEPART: readonly LigneBudgetSaisie[] = [
  { libelle: '', montant: '' },
  { libelle: '', montant: '' },
  { libelle: '', montant: '' },
  { libelle: '', montant: '' },
];

export function useContribution(
  slug: string,
  surPublie: () => void,
  initial: { readonly type: TypeContribution; readonly etape: 'type' | 'detail' } | null = null,
): ContributionView {
  const [type, setType] = useState<TypeContribution>(initial?.type ?? 'TIP');
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [lieu, setLieu] = useState('');
  const [adresse, setAdresse] = useState('');
  const [lignes, setLignes] = useState<readonly LigneBudgetSaisie[]>(LIGNES_DEPART);
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState('');
  const [etape, setEtape] = useState<'type' | 'detail'>(initial?.etape ?? 'type');

  const vider = useCallback((): void => {
    setTitre('');
    setTexte('');
    setLieu('');
    setAdresse('');
    setLignes(LIGNES_DEPART);
    setEtape('type');
  }, []);

  const champ =
    (poser: (v: string) => void) =>
    (e: { readonly target: { readonly value: string } }): void => {
      poser(e.target.value);
      setEchec('');
    };

  /**
   * Ce qu'on enverra, genre par genre. Un bon plan est `titre + saut de ligne +
   * détail` (09 §2.3 : un TEXTE ≤ 500, sans titre dans le modèle) ; un budget est UNE
   * contribution par ligne remplie (libellé + montant).
   */
  const corps = useMemo(() => {
    if (type === 'BUDGET') {
      return lignes
        .filter((l) => l.libelle.trim() !== '' || l.montant.trim() !== '')
        .map((l) => ({
          kind: 'BUDGET' as const,
          body: l.libelle.trim(),
          amountCents: centimesDe(l.montant) ?? Number.NaN,
        }));
    }
    if (type === 'TIP') {
      const t = titre.trim();
      const d = texte.trim();
      return [{ kind: 'TIP' as const, body: t === '' ? d : d === '' ? t : `${t}\n${d}` }];
    }
    if (type === 'SHOP') {
      return [
        {
          kind: 'SHOP' as const,
          body: texte.trim(),
          venueName: lieu.trim(),
          ...(adresse.trim() === '' ? {} : { addressText: adresse.trim() }),
        },
      ];
    }
    return [{ kind: 'TESTIMONY' as const, body: texte.trim() }];
  }, [adresse, lieu, lignes, texte, titre, type]);

  /** Premier refus des règles PARTAGÉES — le front prévient, le serveur décide. */
  const refusLocal = useMemo((): string => {
    if (corps.length === 0) return 'Remplissez au moins une ligne.';
    for (const c of corps) {
      if (c.kind === 'BUDGET' && Number.isNaN(c.amountCents)) {
        return 'Le montant d’une ligne n’est pas un nombre.';
      }
      const verdict = createCityTipSchema.safeParse(c);
      if (!verdict.success) return verdict.error.issues[0]?.message ?? 'Contribution invalide.';
    }
    return '';
  }, [corps]);

  const bloque = occupe || corps.length === 0 || corps.some((c) => c.body === '');

  const onPublier = useCallback((): void => {
    if (bloque) return;
    if (refusLocal !== '') {
      setEchec(refusLocal);
      return;
    }
    setOccupe(true);
    setEchec('');
    void (async () => {
      try {
        for (const c of corps) {
          await memberApi.post(`/cities/${encodeURIComponent(slug)}/tips`, z.unknown(), { body: c });
        }
        vider();
        surPublie();
      } catch (cause: unknown) {
        setEchec(
          cause instanceof ApiError ? cause.displayMessage : 'La contribution n’a pas pu être publiée.',
        );
      } finally {
        setOccupe(false);
      }
    })();
  }, [bloque, corps, refusLocal, slug, surPublie, vider]);

  return {
    ouverte: true,
    type,
    onType: (t) => {
      setType(t);
      setEchec('');
    },
    titre,
    onTitre: champ(setTitre),
    texte,
    onTexte: champ(setTexte),
    lieu,
    onLieu: champ(setLieu),
    adresse,
    onAdresse: champ(setAdresse),
    lignes,
    onLigne: (rang, nom, valeur) => {
      setEchec('');
      setLignes((courant) => courant.map((l, i) => (i === rang ? { ...l, [nom]: valeur } : l)));
    },
    onAjouterLigne: () => {
      setLignes((courant) => [...courant, { libelle: '', montant: '' }]);
    },
    onPublier,
    bloque,
    occupe,
    echec,
    max: CITY_TIP_MAX_BODY,
    etape,
    onContinuer: () => {
      setEchec('');
      setEtape('detail');
    },
    onRetour: () => {
      setEchec('');
      setEtape('type');
    },
    titreEtape: TITRES_ETAPE[type],
    reinitialiser: vider,
  };
}
