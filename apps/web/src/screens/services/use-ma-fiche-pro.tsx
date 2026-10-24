'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  PRO_CITIES_MAX,
  PRO_DESCRIPTION_MAX,
  PRO_PHONE_ON_REQUEST_HINT,
  ProContactMethod,
  mediaAssetSchema,
  myProProfileResponseSchema,
  placesCitiesResponseSchema,
  proProfileSchema,
} from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { ApiError, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S08 — CRÉER MA FICHE PRO ET L'ENVOYER POUR VALIDATION (10 §4.1)             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Envoyer pour validation » ne partait nulle part, et le justificatif « ne part
 * nulle part dans ce lot » (ancien commentaire de `screens/services/data.ts`). Il
 * part : le justificatif (une image ou un PDF) passe par `POST /media` (genre
 * `PROOF`, accès équipe uniquement, jamais affiché), puis `PUT /me/pro-profile` crée
 * ou met à jour la fiche. Elle reste INVISIBLE (`PENDING`) jusqu'à la validation
 * humaine du module 15 — l'écran le dit, il ne dit jamais « publiée ».
 *
 * DEUX ÉTATS que la maquette ne dessine pas, remontés :
 *   · « AUCUNE FICHE » — le membre n'en a pas encore : le formulaire est vide, le
 *     justificatif obligatoire (`PROOF_REQUIRED` sinon) ;
 *   · « EN ATTENTE / REFUSÉE » — la fiche existe : le formulaire est rempli et la
 *     carte d'état dit où elle en est.
 *
 * Le téléphone n'est JAMAIS demandé ni stocké ici (10 §4.1) : « sur demande »
 * signifie que le pro le communique lui-même en message.
 */
export interface FormulaireFicheProView {
  readonly chargement: boolean;
  readonly existe: boolean;
  /** « Aucune fiche », « En attente de validation », « Validée », « Refusée ». */
  readonly etat: string;
  readonly metiers: readonly { id: string; nom: string }[];
  readonly metierId: string;
  readonly onMetier: (e: { readonly target: { readonly value: string } }) => void;
  readonly nomCommercial: string;
  readonly onNomCommercial: (e: { readonly target: { readonly value: string } }) => void;
  readonly description: string;
  readonly onDescription: (e: { readonly target: { readonly value: string } }) => void;
  readonly descriptionMax: number;
  readonly tarifs: string;
  readonly onTarifs: (e: { readonly target: { readonly value: string } }) => void;
  readonly methode: (typeof ProContactMethod)[number];
  readonly onMethode: (e: { readonly target: { readonly value: string } }) => void;
  readonly methodes: readonly { valeur: (typeof ProContactMethod)[number]; libelle: string }[];
  readonly aideMethode: string;
  readonly siret: string;
  readonly onSiret: (e: { readonly target: { readonly value: string } }) => void;
  readonly villes: readonly { id: string; nom: string }[];
  readonly villesChoisies: readonly { id: string; nom: string }[];
  readonly onAjouterVille: (e: { readonly target: { readonly value: string } }) => void;
  readonly onRetirerVille: (id: string) => void;
  readonly villesMax: number;
  readonly justificatif: string;
  readonly justificatifDepose: boolean;
  readonly onJustificatif: (fichier: File | null) => void;
  readonly echec: string;
  readonly succes: string;
  readonly occupe: boolean;
  readonly onEnvoyer: () => void;
}

const RIEN = (): void => {};

export const ficheProVide: FormulaireFicheProView = {
  chargement: true,
  existe: false,
  etat: '',
  metiers: [],
  metierId: '',
  onMetier: RIEN,
  nomCommercial: '',
  onNomCommercial: RIEN,
  description: '',
  onDescription: RIEN,
  descriptionMax: PRO_DESCRIPTION_MAX,
  tarifs: '',
  onTarifs: RIEN,
  methode: 'PLATFORM_MESSAGE',
  onMethode: RIEN,
  methodes: [],
  aideMethode: '',
  siret: '',
  onSiret: RIEN,
  villes: [],
  villesChoisies: [],
  onAjouterVille: RIEN,
  onRetirerVille: RIEN,
  villesMax: PRO_CITIES_MAX,
  justificatif: '',
  justificatifDepose: false,
  onJustificatif: RIEN,
  echec: '',
  succes: '',
  occupe: false,
  onEnvoyer: RIEN,
};

const METHODES = [
  { valeur: 'PLATFORM_MESSAGE', libelle: 'Messagerie de la plateforme' },
  { valeur: 'EMAIL', libelle: 'E-mail' },
  { valeur: 'PHONE_ON_REQUEST', libelle: 'Téléphone sur demande' },
] as const;

const ETATS: Record<string, string> = {
  PENDING: 'En attente de validation',
  APPROVED: 'Validée',
  REJECTED: 'Refusée',
};

const metiersSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), nameFr: z.string() })),
});

type Evt = { readonly target: { readonly value: string } };

export function useMaFichePro(): { readonly formulaire: FormulaireFicheProView; readonly fenetre: ReactNode } {
  const { occupe, lancer, fenetre } = useGeste();
  const [chargement, setChargement] = useState(true);
  const [existe, setExiste] = useState(false);
  const [etat, setEtat] = useState('Aucune fiche');
  const [metiers, setMetiers] = useState<readonly { id: string; nom: string }[]>([]);
  const [villes, setVilles] = useState<readonly { id: string; nom: string }[]>([]);
  const [metierId, setMetierId] = useState('');
  const [nomCommercial, setNomCommercial] = useState('');
  const [description, setDescription] = useState('');
  const [tarifs, setTarifs] = useState('');
  const [methode, setMethode] = useState<(typeof ProContactMethod)[number]>('PLATFORM_MESSAGE');
  const [siret, setSiret] = useState('');
  const [choisies, setChoisies] = useState<readonly { id: string; nom: string }[]>([]);
  const [justificatif, setJustificatif] = useState<{ id: string; nom: string } | null>(null);
  const [aDejaUnJustificatif, setADejaUnJustificatif] = useState(false);
  const [echec, setEchec] = useState('');
  const [succes, setSucces] = useState('');
  const [enVol, setEnVol] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const [ma, liste, villesListe] = await Promise.all([
          memberApi.get('/me/pro-profile', myProProfileResponseSchema, { signal: ac.signal }),
          memberApi.get('/places/professions', metiersSchema, { signal: ac.signal }),
          memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema, { signal: ac.signal }),
        ]);
        if (ac.signal.aborted) return;
        setMetiers(liste.items.map((m) => ({ id: m.id, nom: m.nameFr })));
        setVilles(villesListe.items.map((c) => ({ id: c.id, nom: c.name })));
        if (ma !== null) {
          setExiste(true);
          setEtat(ETATS[ma.verificationStatus] ?? ma.verificationStatus);
          setMetierId(ma.profession.id);
          setNomCommercial(ma.businessName ?? '');
          setDescription(ma.description ?? '');
          setTarifs(ma.priceHint ?? '');
          setMethode(ma.contactMethod);
          setSiret(ma.siret ?? '');
          setChoisies(ma.cities.map((c) => ({ id: c.id, nom: c.name })));
          setADejaUnJustificatif(ma.hasProof);
        }
      } catch (cause: unknown) {
        if (!ac.signal.aborted) {
          setEchec(cause instanceof ApiError ? cause.displayMessage : 'Votre fiche n’a pas pu être chargée.');
        }
      } finally {
        if (!ac.signal.aborted) setChargement(false);
      }
    })();
    return () => {
      ac.abort();
    };
  }, []);

  const champ = (poser: (v: string) => void) => (e: Evt): void => {
    poser(e.target.value);
    setEchec('');
    setSucces('');
  };

  const onJustificatif = useCallback((fichier: File | null): void => {
    if (fichier === null) return;
    const corps = new FormData();
    corps.append('file', fichier);
    corps.append('kind', 'PROOF');
    void memberApi
      .post('/media', mediaAssetSchema, { body: corps })
      .then((m) => {
        setJustificatif({ id: m.id, nom: fichier.name });
        setEchec('');
      })
      .catch((cause: unknown) => {
        setEchec(cause instanceof ApiError ? cause.displayMessage : 'Le justificatif n’a pas pu être déposé.');
      });
  }, []);

  const onEnvoyer = useCallback((): void => {
    if (enVol || occupe) return;
    const corps = {
      professionId: metierId,
      ...(nomCommercial.trim() === '' ? {} : { businessName: nomCommercial.trim() }),
      ...(description.trim() === '' ? {} : { description: description.trim() }),
      ...(tarifs.trim() === '' ? {} : { priceHint: tarifs.trim() }),
      contactMethod: methode,
      ...(siret.trim() === '' ? {} : { siret: siret.trim() }),
      cityIds: choisies.map((c) => c.id),
      ...(justificatif === null ? {} : { proofAssetId: justificatif.id }),
    };
    // Le front prévient avec les règles PARTAGÉES ; le serveur décide ensuite.
    const verdict = proProfileSchema.safeParse(corps);
    if (!verdict.success) {
      const premier = verdict.error.issues[0];
      setEchec(
        premier?.path[0] === 'professionId'
          ? 'Choisissez votre métier.'
          : premier?.path[0] === 'cityIds'
            ? 'Indiquez au moins une ville couverte.'
            : (premier?.message ?? 'Fiche invalide.'),
      );
      return;
    }
    if (!existe && justificatif === null && !aDejaUnJustificatif) {
      setEchec('Déposez un justificatif d’activité (extrait SIRENE, attestation, carte professionnelle).');
      return;
    }
    setEnVol(true);
    setEchec('');
    void lancer(() => memberApi.put('/me/pro-profile', z.unknown(), { body: corps }), {
      recharger: false,
      echecRepli: 'Votre fiche n’a pas pu être envoyée.',
    })
      .then((ok) => {
        if (!ok) return;
        setExiste(true);
        setEtat(ETATS['PENDING'] ?? 'En attente de validation');
        setADejaUnJustificatif(true);
        setSucces('Votre fiche est envoyée : elle sera visible après validation par l’équipe.');
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [aDejaUnJustificatif, choisies, description, enVol, existe, justificatif, lancer, methode, metierId, nomCommercial, occupe, siret, tarifs]);

  const formulaire = useMemo<FormulaireFicheProView>(
    () => ({
      chargement,
      existe,
      etat,
      metiers,
      metierId,
      onMetier: champ(setMetierId),
      nomCommercial,
      onNomCommercial: champ(setNomCommercial),
      description,
      onDescription: champ(setDescription),
      descriptionMax: PRO_DESCRIPTION_MAX,
      tarifs,
      onTarifs: champ(setTarifs),
      methode,
      onMethode: champ((v) => {
        setMethode(v as (typeof ProContactMethod)[number]);
      }),
      methodes: METHODES,
      aideMethode: methode === 'PHONE_ON_REQUEST' ? PRO_PHONE_ON_REQUEST_HINT : '',
      siret,
      onSiret: champ(setSiret),
      villes,
      villesChoisies: choisies,
      onAjouterVille: (e) => {
        const ville = villes.find((v) => v.id === e.target.value);
        if (ville === undefined || choisies.some((c) => c.id === ville.id) || choisies.length >= PRO_CITIES_MAX) return;
        setChoisies((courant) => [...courant, ville]);
        setEchec('');
        setSucces('');
      },
      onRetirerVille: (id) => {
        setChoisies((courant) => courant.filter((c) => c.id !== id));
      },
      villesMax: PRO_CITIES_MAX,
      justificatif: justificatif?.nom ?? '',
      justificatifDepose: justificatif !== null || aDejaUnJustificatif,
      onJustificatif,
      echec,
      succes,
      occupe: enVol || occupe,
      onEnvoyer,
    }),
    [aDejaUnJustificatif, chargement, choisies, description, echec, enVol, etat, existe, justificatif, methode, metierId, metiers, nomCommercial, occupe, onEnvoyer, onJustificatif, siret, succes, tarifs, villes],
  );

  return { formulaire, fenetre };
}
