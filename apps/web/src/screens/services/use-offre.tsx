'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  createJobSchema,
  createMemberRecommendationSchema,
  placesCitiesResponseSchema,
  publicProfileResponseSchema,
  type JobKind,
} from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { notifyError } from '@/components/notifications';
import { ApiError, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S05 — UNE OFFRE : POSTULER, RECOMMANDER, SIGNALER, PUBLIER (10 §3.1, §3.3)  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les quatre boutons de la planche (« Postuler sur le site », « Recommander un
 * membre », le drapeau, « Publier l'offre ») n'avaient aucun gestionnaire, et les
 * champs de « PUBLIER UNE OFFRE » étaient des `<div>` d'exemple.
 *
 *   · « Postuler » ouvre l'interstitiel S05L (« Vous quittez la plateforme »), dont
 *     « Continuer » ouvre `externalUrl` dans un nouvel onglet SANS référent : la
 *     plateforme ne transmet rien du membre à un site tiers (§3.1) ;
 *   · « Recommander » (S05R) cherche le membre par son pseudo
 *     (`GET /users/:handle`), puis `POST /recommendations/members` {toHandle,
 *     jobId, comment}. Le serveur refuse l'auto-recommandation et les doublons : sa
 *     phrase s'affiche telle quelle ;
 *   · « Signaler » ouvre la fenêtre commune (`{ type: 'JOB' }`) ;
 *   · « Publier l'offre » envoie `POST /jobs` (L1, gratuit). La mise en avant est
 *     demandée APRÈS la création (`POST /jobs/:id/sponsor`) : si elle échoue (cinq
 *     par mois), l'offre est tout de même publiée et la phrase du serveur le dit.
 *
 * Le niveau n'est jamais lu pour décider : `useGeste` ouvre la fenêtre de niveau sur
 * un `403 LEVEL_REQUIRED`.
 */
type Evt = { readonly target: { readonly value: string } };

export interface RecommanderView {
  readonly pseudo: string;
  readonly onPseudo: (e: Evt) => void;
  readonly onChercher: () => void;
  readonly trouve: { readonly handle: string; readonly nom: string; readonly sous: string } | null;
  readonly commentaire: string;
  readonly onCommentaire: (e: Evt) => void;
  readonly onEnvoyer: () => void;
  readonly echec: string;
  readonly occupe: boolean;
}

export interface VivantOffre {
  readonly onPostuler: () => void;
  readonly onContinuer: () => void;
  readonly onSignaler: () => void;
  readonly aLien: boolean;
  readonly recommander: RecommanderView;
}

const RIEN = (): void => {};

export const vivantOffreVide: VivantOffre = {
  onPostuler: RIEN,
  onContinuer: RIEN,
  onSignaler: RIEN,
  aLien: false,
  recommander: {
    pseudo: '',
    onPseudo: RIEN,
    onChercher: RIEN,
    trouve: null,
    commentaire: '',
    onCommentaire: RIEN,
    onEnvoyer: RIEN,
    echec: '',
    occupe: false,
  },
};

export function useOffre(
  offre: { readonly id: string; readonly externalUrl: string },
  options: { readonly ouvrir: (nom: 'S05L' | 'S05R') => void; readonly fermer: () => void },
): { readonly vivant: VivantOffre; readonly fenetres: ReactNode } {
  const { ouvrir, fermer } = options;
  const { occupe, lancer, fenetre } = useGeste();
  const [signalement, setSignalement] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [trouve, setTrouve] = useState<RecommanderView['trouve']>(null);
  const [commentaire, setCommentaire] = useState('');
  const [echec, setEchec] = useState('');
  const [enVol, setEnVol] = useState(false);

  const onChercher = useCallback((): void => {
    const handle = pseudo.trim().replace(/^@/, '');
    if (handle === '' || enVol) return;
    setEnVol(true);
    setEchec('');
    setTrouve(null);
    void memberApi
      .get(`/users/${encodeURIComponent(handle)}`, publicProfileResponseSchema)
      .then((p) => {
        setTrouve({
          handle: p.handle,
          nom: p.displayName,
          sous: [p.city?.name, `@${p.handle}`].filter(Boolean).join(' · '),
        });
      })
      .catch((cause: unknown) => {
        setEchec(cause instanceof ApiError ? cause.displayMessage : 'Ce membre est introuvable.');
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [enVol, pseudo]);

  const onEnvoyer = useCallback((): void => {
    if (trouve === null || enVol) return;
    const corps = {
      toHandle: trouve.handle,
      jobId: offre.id,
      ...(commentaire.trim() === '' ? {} : { comment: commentaire.trim() }),
    };
    const verdict = createMemberRecommendationSchema.safeParse(corps);
    if (!verdict.success) {
      setEchec(verdict.error.issues[0]?.message ?? 'Recommandation invalide.');
      return;
    }
    setEnVol(true);
    setEchec('');
    void lancer(() => memberApi.post('/recommendations/members', z.unknown(), { body: corps }), {
      recharger: false,
      succes: `Vous avez recommandé ${trouve.nom}.`,
    })
      .then((ok) => {
        if (ok) {
          setPseudo('');
          setTrouve(null);
          setCommentaire('');
          fermer();
        }
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [commentaire, enVol, fermer, lancer, offre.id, trouve]);

  const vivant = useMemo<VivantOffre>(
    () => ({
      onPostuler: () => {
        ouvrir('S05L');
      },
      onContinuer: () => {
        if (offre.externalUrl !== '') window.open(offre.externalUrl, '_blank', 'noopener,noreferrer');
        fermer();
      },
      onSignaler: () => {
        setSignalement(true);
      },
      aLien: offre.externalUrl !== '',
      recommander: {
        pseudo,
        onPseudo: (e) => {
          setPseudo(e.target.value);
          setTrouve(null);
          setEchec('');
        },
        onChercher,
        trouve,
        commentaire,
        onCommentaire: (e) => {
          setCommentaire(e.target.value);
          setEchec('');
        },
        onEnvoyer,
        echec,
        occupe: enVol || occupe,
      },
    }),
    [commentaire, echec, enVol, fermer, occupe, offre.externalUrl, onChercher, onEnvoyer, ouvrir, pseudo, trouve],
  );

  const fenetres = (
    <>
      {fenetre}
      <FenetreSignalement
        sujet={signalement ? { type: 'JOB', id: offre.id } : null}
        onFermer={() => {
          setSignalement(false);
        }}
      />
    </>
  );

  return { vivant, fenetres };
}

// ─── Publier une offre ───────────────────────────────────────────────────────

export const GENRES_EMPLOI: readonly { valeur: JobKind; libelle: string }[] = [
  { valeur: 'JOB', libelle: 'Emploi' },
  { valeur: 'INTERNSHIP', libelle: 'Stage' },
  { valeur: 'APPRENTICESHIP', libelle: 'Alternance' },
  { valeur: 'GIG', libelle: 'Mission' },
];

export interface FormulaireOffreView {
  readonly kind: JobKind;
  readonly onKind: (k: JobKind) => void;
  readonly titre: string;
  readonly onTitre: (e: Evt) => void;
  readonly entreprise: string;
  readonly onEntreprise: (e: Evt) => void;
  readonly villeId: string;
  readonly onVille: (e: Evt) => void;
  readonly villes: readonly { id: string; nom: string }[];
  readonly contrat: string;
  readonly onContrat: (e: Evt) => void;
  readonly secteur: string;
  readonly onSecteur: (e: Evt) => void;
  readonly lien: string;
  readonly onLien: (e: Evt) => void;
  readonly description: string;
  readonly onDescription: (e: Evt) => void;
  readonly sponsoriser: boolean;
  readonly onSponsoriser: () => void;
  readonly echec: string;
  readonly occupe: boolean;
  readonly bloque: boolean;
  readonly onPublier: () => void;
}

export const formulaireOffreVide: FormulaireOffreView = {
  kind: 'JOB',
  onKind: RIEN,
  titre: '',
  onTitre: RIEN,
  entreprise: '',
  onEntreprise: RIEN,
  villeId: '',
  onVille: RIEN,
  villes: [],
  contrat: '',
  onContrat: RIEN,
  secteur: '',
  onSecteur: RIEN,
  lien: '',
  onLien: RIEN,
  description: '',
  onDescription: RIEN,
  sponsoriser: false,
  onSponsoriser: RIEN,
  echec: '',
  occupe: false,
  bloque: true,
  onPublier: RIEN,
};

export function useFormulaireOffre(actif: boolean): {
  readonly formulaire: FormulaireOffreView;
  readonly fenetre: ReactNode;
} {
  const router = useRouter();
  const { occupe, lancer, fenetre } = useGeste();
  const [kind, setKind] = useState<JobKind>('JOB');
  const [titre, setTitre] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [villeId, setVilleId] = useState('');
  const [villes, setVilles] = useState<readonly { id: string; nom: string }[]>([]);
  const [contrat, setContrat] = useState('');
  const [secteur, setSecteur] = useState('');
  const [lien, setLien] = useState('');
  const [description, setDescription] = useState('');
  const [sponsoriser, setSponsoriser] = useState(false);
  const [echec, setEchec] = useState('');
  const [enVol, setEnVol] = useState(false);

  useEffect(() => {
    if (!actif) return;
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const liste = await memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema, { signal: ac.signal });
        if (!ac.signal.aborted) setVilles(liste.items.map((c) => ({ id: c.id, nom: c.name })));
      } catch {
        /* la ville est facultative (§3.1 : national / télétravail) */
      }
    })();
    return () => {
      ac.abort();
    };
  }, [actif]);

  const champ = (poser: (v: string) => void) => (e: Evt): void => {
    poser(e.target.value);
    setEchec('');
  };

  const bloque = enVol || occupe || titre.trim().length < 5 || description.trim().length < 30;

  const onPublier = useCallback((): void => {
    if (bloque) return;
    const corps: Record<string, unknown> = {
      kind,
      title: titre.trim(),
      description: description.trim(),
      ...(entreprise.trim() === '' ? {} : { companyName: entreprise.trim() }),
      ...(villeId === '' ? {} : { cityId: villeId }),
      ...(contrat.trim() === '' ? {} : { contractType: contrat.trim() }),
      ...(secteur.trim() === '' ? {} : { sector: secteur.trim() }),
      ...(lien.trim() === '' ? {} : { externalUrl: lien.trim() }),
    };
    // Le front prévient avec la règle PARTAGÉE ; le serveur décide.
    const verdict = createJobSchema.safeParse(corps);
    if (!verdict.success) {
      setEchec(verdict.error.issues[0]?.message ?? 'Offre invalide.');
      return;
    }
    setEnVol(true);
    setEchec('');
    void (async () => {
      let identifiant = '';
      const cree = await lancer(
        async () => {
          const offre = await memberApi.post('/jobs', z.object({ id: z.string().uuid() }).passthrough(), { body: corps });
          identifiant = offre.id;
        },
        { recharger: false, succes: 'Votre offre est publiée.', echecRepli: 'L’offre n’a pas pu être publiée.' },
      );
      if (cree && sponsoriser) {
        // L'offre existe : si la mise en avant est refusée (cinq par mois), on le dit
        // sans rejouer la publication.
        try {
          await memberApi.post(`/jobs/${identifiant}/sponsor`, z.unknown());
        } catch (cause: unknown) {
          notifyError(
            cause instanceof ApiError
              ? `L’offre est publiée, mais pas mise en avant : ${cause.displayMessage}`
              : 'L’offre est publiée, mais pas mise en avant.',
          );
        }
      }
      setEnVol(false);
      if (cree) router.push('/services/mes-annonces');
    })();
  }, [bloque, contrat, description, entreprise, kind, lancer, lien, router, secteur, sponsoriser, titre, villeId]);

  const formulaire = useMemo<FormulaireOffreView>(
    () => ({
      kind,
      onKind: (k) => {
        setKind(k);
        setEchec('');
      },
      titre,
      onTitre: champ(setTitre),
      entreprise,
      onEntreprise: champ(setEntreprise),
      villeId,
      onVille: champ(setVilleId),
      villes,
      contrat,
      onContrat: champ(setContrat),
      secteur,
      onSecteur: champ(setSecteur),
      lien,
      onLien: champ(setLien),
      description,
      onDescription: champ(setDescription),
      sponsoriser,
      onSponsoriser: () => {
        setSponsoriser((v) => !v);
      },
      echec,
      occupe: enVol || occupe,
      bloque,
      onPublier,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `champ` est recréé à chaque rendu
    [bloque, contrat, description, echec, enVol, entreprise, kind, lien, occupe, onPublier, secteur, sponsoriser, titre, villeId, villes],
  );

  return { formulaire, fenetre };
}
