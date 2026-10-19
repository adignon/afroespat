'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  HOUSING_OFFER_PHOTOS_MIN,
  HOUSING_PHOTOS_MAX,
  createHousingSchema,
  housingDetailResponseSchema,
  housingListResponseSchema,
  isHousingOfferKind,
  mediaAssetSchema,
  placesCitiesResponseSchema,
  type HousingKind,
} from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { fetchMe, hasAccessToken, memberApi, resumeSession, ApiError } from '@/lib/api/index';
import { centimesDe } from '@/lib/centimes';
import { urlMedia } from '@/lib/api/base';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S03 — PUBLIER, MODIFIER UNE ANNONCE DE LOGEMENT (10 §2.1, §2.2)             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Publier l'annonce » était INERTE (`screens/services/data.ts` : « un bouton
 * inerte est moins nuisible qu'un bouton qui ment »). Le raisonnement était juste
 * tant que l'écran ne pouvait pas dire la vérité sur le score de risque ; il le peut :
 * `POST /housing` répond soit l'annonce publiée, soit `LISTING_UNDER_REVIEW` — et
 * dans ce second cas l'annonce EXISTE, retenue, avec son dossier (10 §2.2). L'écran
 * dit alors « Votre annonce est en vérification. Vous serez prévenu·e. » — jamais
 * « publiée ». Aucun chiffre de risque ne traverse l'API.
 *
 * ── CE QUI EST PRÉVENU ICI, CE QUI EST DÉCIDÉ AILLEURS ──────────────────────
 *
 *   · le FORMULAIRE GRISÉ (§2.1 : « Un L1 voit le formulaire grisé avec
 *     l'explication ») se décide sur `meta.canPublish` de `GET /housing`, que le
 *     SERVEUR calcule — le front ne lit jamais le niveau pour autoriser ;
 *   · les bornes (titre 10–120, description 50–3 000, 1 à 8 photos, au moins une
 *     pour une offre) viennent de `createHousingSchema` et de ses constantes ;
 *   · le plafond de trois annonces actives, le score et la modération sont ceux du
 *     serveur, et son refus s'affiche tel quel.
 *
 * `?modifier=<id>` ouvre la même planche sur une annonce existante : le formulaire
 * se remplit depuis `GET /housing/:id` et « Enregistrer » envoie `PATCH` (le score
 * est recalculé, §2.2). Le genre ne se change pas (`updateHousingSchema` ne l'accepte
 * pas) : il est montré, éteint.
 */
export type Sens = 'OFFRE' | 'RECHERCHE';

export const GENRES_OFFRE: readonly { valeur: HousingKind; libelle: string }[] = [
  { valeur: 'FLATSHARE', libelle: 'Colocation' },
  { valeur: 'RENT', libelle: 'Location' },
  { valeur: 'SUBLET', libelle: 'Sous-location' },
  { valeur: 'TEMPORARY', libelle: 'Temporaire' },
];

export const GENRES_RECHERCHE: readonly { valeur: HousingKind; libelle: string }[] = [
  { valeur: 'SEEKING_HOUSING', libelle: 'Un logement' },
  { valeur: 'SEEKING_FLATMATE', libelle: 'Un·e colocataire' },
];

export interface PhotoSaisie {
  readonly id: string;
  readonly url: string;
  readonly nom: string;
}

export interface FormulaireAnnonceView {
  readonly sens: Sens;
  readonly onSens: (s: Sens) => void;
  readonly kind: HousingKind;
  readonly onKind: (k: HousingKind) => void;
  readonly genres: readonly { valeur: HousingKind; libelle: string }[];
  readonly titre: string;
  readonly onTitre: (e: { readonly target: { readonly value: string } }) => void;
  readonly description: string;
  readonly onDescription: (e: { readonly target: { readonly value: string } }) => void;
  readonly villeId: string;
  readonly onVille: (e: { readonly target: { readonly value: string } }) => void;
  readonly villes: readonly { id: string; nom: string }[];
  readonly quartier: string;
  readonly onQuartier: (e: { readonly target: { readonly value: string } }) => void;
  readonly loyer: string;
  readonly onLoyer: (e: { readonly target: { readonly value: string } }) => void;
  readonly disponible: string;
  readonly onDisponible: (e: { readonly target: { readonly value: string } }) => void;
  readonly duree: string;
  readonly onDuree: (e: { readonly target: { readonly value: string } }) => void;
  readonly meuble: boolean;
  readonly onMeuble: () => void;
  readonly photos: readonly PhotoSaisie[];
  readonly photosMax: number;
  readonly onPhotos: (fichiers: FileList | null) => void;
  readonly onRetirerPhoto: (id: string) => void;
  readonly echec: string;
  readonly occupe: boolean;
  readonly bloque: boolean;
  readonly onPublier: () => void;
  /** Le serveur dit que ce membre ne peut pas publier : le formulaire est grisé. */
  readonly grise: boolean;
  readonly phraseGrise: string;
  /** Après un envoi retenu pour décision humaine. */
  readonly enVerification: boolean;
  readonly modification: boolean;
}

const VIDE = (): void => {};

export const formulaireAnnonceVide: FormulaireAnnonceView = {
  sens: 'OFFRE',
  onSens: VIDE,
  kind: 'RENT',
  onKind: VIDE,
  genres: GENRES_OFFRE,
  titre: '',
  onTitre: VIDE,
  description: '',
  onDescription: VIDE,
  villeId: '',
  onVille: VIDE,
  villes: [],
  quartier: '',
  onQuartier: VIDE,
  loyer: '',
  onLoyer: VIDE,
  disponible: '',
  onDisponible: VIDE,
  duree: '',
  onDuree: VIDE,
  meuble: false,
  onMeuble: VIDE,
  photos: [],
  photosMax: HOUSING_PHOTOS_MAX,
  onPhotos: VIDE,
  onRetirerPhoto: VIDE,
  echec: '',
  occupe: false,
  bloque: true,
  onPublier: VIDE,
  grise: false,
  phraseGrise: '',
  enVerification: false,
  modification: false,
};

type Evt = { readonly target: { readonly value: string } };

export function useFormulaireAnnonce(modifierId: string | null): {
  readonly formulaire: FormulaireAnnonceView;
  readonly fenetre: ReactNode;
} {
  const router = useRouter();
  const { occupe, lancer, fenetre } = useGeste();
  const [sens, setSens] = useState<Sens>('OFFRE');
  const [kind, setKind] = useState<HousingKind>('RENT');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [villeId, setVilleId] = useState('');
  const [villes, setVilles] = useState<readonly { id: string; nom: string }[]>([]);
  const [quartier, setQuartier] = useState('');
  const [loyer, setLoyer] = useState('');
  const [disponible, setDisponible] = useState('');
  const [duree, setDuree] = useState('');
  const [meuble, setMeuble] = useState(false);
  const [photos, setPhotos] = useState<readonly PhotoSaisie[]>([]);
  const [echec, setEchec] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [peutPublier, setPeutPublier] = useState(true);
  const [phraseGrise, setPhraseGrise] = useState('');
  const [enVerification, setEnVerification] = useState(false);
  const modification = modifierId !== null;

  // Les villes, ma ville par défaut, et ce que le SERVEUR dit de mon droit de publier.
  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const [moi, liste, meta] = await Promise.allSettled([
          fetchMe(),
          memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema, { signal: ac.signal }),
          memberApi.get('/housing?limit=1', housingListResponseSchema, { signal: ac.signal }),
        ]);
        if (ac.signal.aborted) return;
        if (liste.status === 'fulfilled') setVilles(liste.value.items.map((c) => ({ id: c.id, nom: c.name })));
        if (moi.status === 'fulfilled' && moi.value.user.cityId !== null) {
          const ville = moi.value.user.cityId;
          setVilleId((courant) => (courant === '' ? ville : courant));
        }
        if (meta.status === 'fulfilled') {
          setPeutPublier(meta.value.meta.canPublish);
          setPhraseGrise(meta.value.meta.publishRequirement);
        }
      } catch {
        /* sans ces listes, le formulaire reste saisissable : le serveur tranchera */
      }
    })();
    return () => {
      ac.abort();
    };
  }, []);

  // La modification part de l'annonce telle que le serveur la rend.
  useEffect(() => {
    if (modifierId === null) return;
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const a = await memberApi.get(`/housing/${modifierId}`, housingDetailResponseSchema, {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        setSens(isHousingOfferKind(a.kind) ? 'OFFRE' : 'RECHERCHE');
        setKind(a.kind);
        setTitre(a.title);
        setDescription(a.description);
        setVilleId(a.city.id);
        setQuartier(a.district ?? '');
        setLoyer(a.priceCents === null ? '' : String(a.priceCents / 100).replace('.', ','));
        setDisponible(a.availableFrom === null ? '' : a.availableFrom.slice(0, 10));
        setDuree(a.durationMonths === null ? '' : String(a.durationMonths));
        setMeuble(a.isFurnished === true);
        // Les photos déjà liées ne sont pas rechargeables par identifiant d'asset :
        // `GET /housing/:id` ne rend que leurs URL. Elles sont donc CONSERVÉES telles
        // quelles tant que le membre n'en touche aucune (voir `onPublier`).
      } catch (cause: unknown) {
        if (!ac.signal.aborted) {
          setEchec(cause instanceof ApiError ? cause.displayMessage : 'L’annonce n’a pas pu être chargée.');
        }
      }
    })();
    return () => {
      ac.abort();
    };
  }, [modifierId]);

  const champ = (poser: (v: string) => void) => (e: Evt): void => {
    poser(e.target.value);
    setEchec('');
  };

  const onSens = useCallback((s: Sens): void => {
    setSens(s);
    setKind(s === 'OFFRE' ? 'RENT' : 'SEEKING_HOUSING');
    setEchec('');
  }, []);

  const onPhotos = useCallback(
    (fichiers: FileList | null): void => {
      if (fichiers === null) return;
      const choisis = [...fichiers].slice(0, Math.max(0, HOUSING_PHOTOS_MAX - photos.length));
      for (const f of choisis) {
        const corps = new FormData();
        corps.append('file', f);
        corps.append('kind', 'HOUSING');
        void memberApi
          .post('/media', mediaAssetSchema, { body: corps })
          .then((m) => {
            setPhotos((courant) =>
              courant.length >= HOUSING_PHOTOS_MAX
                ? courant
                : [...courant, { id: m.id, url: urlMedia(m.url), nom: f.name }],
            );
          })
          .catch((cause: unknown) => {
            setEchec(cause instanceof ApiError ? cause.displayMessage : 'La photo n’a pas pu être déposée.');
          });
      }
    },
    [photos.length],
  );

  /** Le corps à envoyer, ou le premier refus des règles PARTAGÉES. */
  const preparer = useCallback((): { corps: Record<string, unknown> } | { refus: string } => {
    const prix = loyer.trim() === '' ? null : centimesDe(loyer);
    if (loyer.trim() !== '' && prix === null) return { refus: 'Le loyer n’est pas un montant en euros.' };
    const dureeNombre = duree.trim() === '' ? undefined : Number(duree);
    if (dureeNombre !== undefined && !Number.isInteger(dureeNombre)) {
      return { refus: 'La durée est un nombre entier de mois.' };
    }
    const corps: Record<string, unknown> = {
      kind,
      title: titre.trim(),
      description: description.trim(),
      cityId: villeId,
      ...(quartier.trim() === '' ? {} : { district: quartier.trim() }),
      ...(prix === null ? (isHousingOfferKind(kind) && kind !== 'TEMPORARY' ? {} : { priceCents: null }) : { priceCents: prix }),
      isFurnished: meuble,
      ...(disponible === '' ? {} : { availableFrom: disponible }),
      ...(dureeNombre === undefined ? {} : { durationMonths: dureeNombre }),
      photoAssetIds: photos.map((p) => p.id),
    };
    // En modification sans nouvelle photo, on ne touche pas aux photos existantes.
    if (modification && photos.length === 0) delete corps['photoAssetIds'];
    if (!modification) {
      const verdict = createHousingSchema.safeParse(corps);
      if (!verdict.success) return { refus: verdict.error.issues[0]?.message ?? 'Annonce invalide.' };
    }
    return { corps };
  }, [description, disponible, duree, kind, loyer, meuble, modification, photos, quartier, titre, villeId]);

  const bloque =
    enVol ||
    occupe ||
    titre.trim() === '' ||
    description.trim() === '' ||
    villeId === '' ||
    (!modification && isHousingOfferKind(kind) && photos.length < HOUSING_OFFER_PHOTOS_MIN);

  // `LISTING_UNDER_REVIEW` n'est pas un échec : l'annonce existe, retenue. `useGeste`
  // l'affiche comme une erreur ; on le dit aussi dans la colonne de droite.
  const onPublier = useCallback((): void => {
    if (bloque) return;
    const prepare = preparer();
    if ('refus' in prepare) {
      setEchec(prepare.refus);
      return;
    }
    setEnVol(true);
    setEchec('');
    const appel = modification
      ? memberApi.patch(`/housing/${modifierId}`, z.unknown(), { body: prepare.corps })
      : memberApi.post('/housing', z.unknown(), { body: prepare.corps });
    void appel
      .then(() => {
        router.push('/services/mes-annonces');
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.code === 'LISTING_UNDER_REVIEW') {
          setEnVerification(true);
          setEchec('');
          return;
        }
        if (cause instanceof ApiError && cause.code === 'LEVEL_REQUIRED') {
          // L'invitation à monter de niveau est celle de `useGeste` : on la déclenche.
          void lancer(() => Promise.reject(cause));
          return;
        }
        setEchec(cause instanceof ApiError ? cause.displayMessage : 'L’annonce n’a pas pu être enregistrée.');
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [bloque, lancer, modification, modifierId, preparer, router]);

  const formulaire = useMemo<FormulaireAnnonceView>(
    () => ({
      sens,
      onSens,
      kind,
      onKind: (k) => {
        setKind(k);
        setEchec('');
      },
      genres: sens === 'OFFRE' ? GENRES_OFFRE : GENRES_RECHERCHE,
      titre,
      onTitre: champ(setTitre),
      description,
      onDescription: champ(setDescription),
      villeId,
      onVille: champ(setVilleId),
      villes,
      quartier,
      onQuartier: champ(setQuartier),
      loyer,
      onLoyer: champ(setLoyer),
      disponible,
      onDisponible: champ(setDisponible),
      duree,
      onDuree: champ(setDuree),
      meuble,
      onMeuble: () => {
        setMeuble((v) => !v);
      },
      photos,
      photosMax: HOUSING_PHOTOS_MAX,
      onPhotos,
      onRetirerPhoto: (id) => {
        setPhotos((courant) => courant.filter((p) => p.id !== id));
      },
      echec,
      occupe: enVol || occupe,
      bloque,
      onPublier,
      grise: !peutPublier && !modification,
      phraseGrise,
      enVerification,
      modification,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `champ` est recréé à chaque rendu
    [bloque, description, disponible, duree, echec, enVerification, enVol, kind, loyer, meuble, modification, occupe, onPhotos, onSens, peutPublier, phraseGrise, photos, onPublier, quartier, sens, titre, villeId, villes],
  );

  return { formulaire, fenetre };
}
