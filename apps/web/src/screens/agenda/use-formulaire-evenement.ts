'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import {
  EventType,
  createEventSchema,
  mediaAssetSchema,
  placesCitiesResponseSchema,
} from '@app/shared';
import { ApiError, fetchMe, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import { fetchCommunities } from '../reseaux/api';
import { TYPES_FR, type FormulaireEvenementView } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « CRÉER UN ÉVÉNEMENT » — L'ÉTAT DU FORMULAIRE, POUR SES DEUX PORTES         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Voir `FormulaireEvenementView` pour le contrat. Ce crochet est monté par la
 * page `/agenda/nouveau` ET par la fenêtre « Créer un événement du réseau » de
 * l'onglet « Événements » ; seule la seconde passe `reseauId`, qui fige la ligne
 * « Réservé à un réseau » sur le réseau ouvert.
 *
 * ── CE QUE LE FRONT VÉRIFIE, ET CE QU'IL LAISSE AU SERVEUR ───────────────
 *
 * `bloque` n'éteint « Publier » que sur les champs OBLIGATOIRES vides, en lisant
 * les bornes de `createEventSchema` (titre 5–120, adresse 4–400) — un aller-
 * retour dont la seule issue serait un 400 n'apprend rien au membre. Le reste —
 * deux heures d'avance minimum, six mois au plus, le quota du mois, l'adhésion
 * au réseau — est la règle du SERVEUR, et son refus s'affiche tel quel dans
 * `echec`. Le front prévient, il n'autorise pas (mémo §5).
 */
export function useFormulaireEvenement(options: {
  readonly reseauId?: string;
  readonly actif: boolean;
  readonly onCree: (eventId: string) => void;
}): FormulaireEvenementView {
  const { reseauId, actif, onCree } = options;
  const [type, setType] = useState<(typeof EventType)[number]>('NETWORKING');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [villeId, setVilleId] = useState('');
  const [villes, setVilles] = useState<readonly { id: string; nom: string }[]>([]);
  const [lieu, setLieu] = useState('');
  const [adresse, setAdresse] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [capacite, setCapacite] = useState('');
  const [reseaux, setReseaux] = useState<readonly { id: string; nom: string }[]>([]);
  const [reseauChoisi, setReseauChoisi] = useState(reseauId ?? '');
  const [couverture, setCouverture] = useState<{ id: string; nom: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState('');

  /**
   * LES VILLES OUVERTES ET MES RÉSEAUX, une fois, et seulement quand le
   * formulaire est visible : la fenêtre du réseau est montée fermée sur chaque
   * onglet, et charger deux listes pour un formulaire jamais ouvert serait du
   * gaspillage pur. Un échec est avalé : la ville reste ma ville, et la ligne
   * « Réservé à un réseau » ne propose que « Ouvert à tous ».
   */
  useEffect(() => {
    if (!actif) return;
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const [moi, liste, mes] = await Promise.allSettled([
          fetchMe(),
          memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema, {
            signal: ac.signal,
          }),
          fetchCommunities({}, ac.signal),
        ]);
        if (ac.signal.aborted) return;
        if (liste.status === 'fulfilled') {
          setVilles(liste.value.items.map((c) => ({ id: c.id, nom: c.name })));
        }
        if (moi.status === 'fulfilled' && moi.value.user.cityId !== null) {
          const maVille = moi.value.user.cityId;
          setVilleId((courant) => (courant === '' ? maVille : courant));
        }
        if (mes.status === 'fulfilled') {
          setReseaux(mes.value.mine.map((r) => ({ id: r.id, nom: r.name })));
        }
      } catch {
        /* voir l'en-tête de l'effet */
      }
    })();
    return () => {
      ac.abort();
    };
  }, [actif]);

  useEffect(() => {
    if (reseauId !== undefined) setReseauChoisi(reseauId);
  }, [reseauId]);

  const champ =
    (poser: (v: string) => void) =>
    (event: { readonly target: { readonly value: string } }): void => {
      poser(event.target.value);
      setEchec('');
    };

  const onCouverture = useCallback(
    (e: { target: { files: FileList | null; value: string } }): void => {
      const fichier = e.target.files?.[0];
      e.target.value = '';
      if (fichier === undefined) return;
      const corps = new FormData();
      corps.append('file', fichier);
      corps.append('kind', 'EVENT_COVER');
      void memberApi
        .post('/media', mediaAssetSchema, { body: corps })
        .then((media) => {
          setCouverture({ id: media.id, nom: fichier.name });
        })
        .catch((cause: unknown) => {
          setEchec(
            cause instanceof ApiError ? cause.displayMessage : 'La couverture n’a pas pu être déposée.',
          );
        });
    },
    [],
  );

  const titreMin = createEventSchema.innerType().shape.title.minLength ?? 0;
  const adresseMin = createEventSchema.innerType().shape.addressText.minLength ?? 0;
  const bloque =
    envoi ||
    titre.trim().length < titreMin ||
    adresse.trim().length < adresseMin ||
    villeId === '' ||
    debut === '';

  const onPublier = useCallback((): void => {
    if (bloque) return;
    setEnvoi(true);
    setEchec('');
    const capaciteNombre = Number.parseInt(capacite, 10);
    const corps = {
      type,
      title: titre.trim(),
      ...(description.trim() === '' ? {} : { description: description.trim() }),
      cityId: villeId,
      ...(lieu.trim() === '' ? {} : { venueName: lieu.trim() }),
      addressText: adresse.trim(),
      startsAt: new Date(debut).toISOString(),
      ...(fin === '' ? {} : { endsAt: new Date(fin).toISOString() }),
      ...(Number.isFinite(capaciteNombre) && capaciteNombre > 0 ? { capacity: capaciteNombre } : {}),
      ...(couverture === null ? {} : { coverAssetId: couverture.id }),
      ...(reseauChoisi === '' ? {} : { communityId: reseauChoisi }),
    };
    void memberApi
      .post('/events', z.object({ id: z.string() }).passthrough(), { body: corps })
      .then((cree) => {
        setTitre('');
        setDescription('');
        setLieu('');
        setAdresse('');
        setDebut('');
        setFin('');
        setCapacite('');
        setCouverture(null);
        onCree(cree.id);
      })
      .catch((cause: unknown) => {
        setEchec(
          cause instanceof ApiError ? cause.displayMessage : 'L’événement n’a pas pu être publié.',
        );
      })
      .finally(() => {
        setEnvoi(false);
      });
  }, [
    adresse,
    bloque,
    capacite,
    couverture,
    debut,
    description,
    fin,
    lieu,
    onCree,
    reseauChoisi,
    titre,
    type,
    villeId,
  ]);

  const types = useMemo(
    () =>
      EventType.map((valeur) => {
        const on = valeur === type;
        return {
          label: TYPES_FR[valeur] ?? valeur,
          // Les couleurs des pastilles DESSINÉES : la première active, les autres
          // blanches au liseré gris — relevées sur E03, jamais choisies ici.
          bg: on ? '#16785E' : '#fff',
          fg: on ? '#fff' : '#16211D',
          bd: on ? '#16785E' : '#E6EBE9',
          onPick: () => {
            setType(valeur);
          },
        };
      }),
    [type],
  );

  return {
    types,
    titre,
    onTitre: champ(setTitre),
    description,
    onDescription: champ(setDescription),
    villes,
    villeId,
    onVille: champ(setVilleId),
    lieu,
    onLieu: champ(setLieu),
    adresse,
    onAdresse: champ(setAdresse),
    debut,
    onDebut: champ(setDebut),
    fin,
    onFin: champ(setFin),
    capacite,
    onCapacite: champ(setCapacite),
    reseaux,
    reseauId: reseauChoisi,
    onReseau: champ(setReseauChoisi),
    reseauFige: reseauId !== undefined,
    couverture: couverture?.nom ?? '',
    onCouverture,
    bloque,
    onPublier,
    echec,
  };
}
