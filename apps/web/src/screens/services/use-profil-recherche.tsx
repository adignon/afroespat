'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import {
  JOB_SEEKER_LIMITS,
  jobSeekerProfileSchema,
  myJobSeekerProfileResponseSchema,
} from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { ajouterEntree, brouillon, refusDuBrouillon } from './profil-recherche';
import { ApiFailure, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S04 — « MON PROFIL DE RECHERCHE » : LIRE, ENREGISTRER, RETIRER (10 §3.2)    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * AJOUT HORS MAQUETTE (lot E2). La planche S04 dessine l'onglet « Mon profil de
 * recherche » sans en dessiner le contenu. Trois routes existent :
 *
 *   · `GET /me/job-seeker-profile` — l'objet, ou RIEN. Mesuré : quand le membre n'a pas
 *     de profil, la réponse est un `200` au corps VIDE (Nest n'écrit pas `null`) ; le
 *     socle d'appel le lit comme `undefined`, que le schéma partagé refuserait. On
 *     accepte donc explicitement l'absence de corps, et elle veut dire « pas de
 *     profil » — l'état VIDE de l'écran ;
 *   · `PUT /me/job-seeker-profile` — crée ou remplace (un seul profil par membre) ;
 *   · `DELETE /me/job-seeker-profile` — le retire.
 *
 * §3.2 : « Aucun CV stocké en V1 ». Le formulaire n'a aucun champ de fichier, et le
 * schéma est `.strict()`.
 *
 * LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE : le brouillon est vérifié avec
 * `jobSeekerProfileSchema` (le MÊME schéma que l'API), les bornes viennent de
 * `JOB_SEEKER_LIMITS`, et un refus du serveur s'affiche avec sa phrase. Le niveau
 * n'est jamais lu : `useGeste` ouvre la fenêtre de niveau sur un `403 LEVEL_REQUIRED`.
 */

const REPONSE = myJobSeekerProfileResponseSchema.or(z.undefined());

export type PhaseProfil = 'chargement' | 'erreur' | 'pret';

export interface ProfilRechercheView {
  readonly phase: PhaseProfil;
  /** La phrase affichée quand la lecture échoue. */
  readonly erreur: string;
  readonly onRecharger: () => void;
  /** Le serveur a-t-il déjà un profil pour ce membre ? (faux = état vide) */
  readonly existe: boolean;
  readonly titre: string;
  readonly onTitre: (valeur: string) => void;
  readonly secteurs: readonly string[];
  readonly contrats: readonly string[];
  readonly onAjouter: (liste: 'secteurs' | 'contrats', valeur: string) => boolean;
  readonly onRetirerEntree: (liste: 'secteurs' | 'contrats', valeur: string) => void;
  readonly visible: boolean;
  readonly onVisible: () => void;
  /** La phrase de prévention ou le refus du serveur — vide quand tout va bien. */
  readonly echec: string;
  /** Le message de réussite du dernier enregistrement, ou `''`. */
  readonly succes: string;
  readonly occupe: boolean;
  /** Le bouton « Enregistrer » est éteint tant que le brouillon est invalide ou inchangé. */
  readonly bloque: boolean;
  readonly onEnregistrer: () => void;
  readonly onRetirerProfil: () => void;
}

export function useProfilRecherche(): ProfilRechercheView {
  const { occupe, lancer } = useGeste();
  const [phase, setPhase] = useState<PhaseProfil>('chargement');
  const [erreur, setErreur] = useState('');
  const [existe, setExiste] = useState(false);
  const [titre, setTitre] = useState('');
  const [secteurs, setSecteurs] = useState<readonly string[]>([]);
  const [contrats, setContrats] = useState<readonly string[]>([]);
  const [visible, setVisible] = useState(true);
  const [echec, setEchec] = useState('');
  const [succes, setSucces] = useState('');
  /** L'instantané enregistré, pour éteindre « Enregistrer » tant que rien n'a changé. */
  const [reference, setReference] = useState('');
  const [essai, setEssai] = useState(0);

  const cle = (t: string, s: readonly string[], c: readonly string[], v: boolean): string =>
    JSON.stringify([t.trim(), s, c, v]);

  useEffect(() => {
    const ac = new AbortController();
    setPhase('chargement');
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const profil = await memberApi.get('/me/job-seeker-profile', REPONSE, { signal: ac.signal });
        if (ac.signal.aborted) return;
        if (profil === undefined || profil === null) {
          setExiste(false);
          setReference(cle('', [], [], true));
        } else {
          setExiste(true);
          setTitre(profil.headline);
          setSecteurs(profil.sectors);
          setContrats(profil.contractTypes);
          setVisible(profil.isVisible);
          setReference(cle(profil.headline, profil.sectors, profil.contractTypes, profil.isVisible));
        }
        setPhase('pret');
      } catch (cause: unknown) {
        if (ac.signal.aborted) return;
        setErreur(
          cause instanceof ApiFailure
            ? cause.displayMessage
            : 'Votre profil de recherche n’a pas pu être chargé.',
        );
        setPhase('erreur');
      }
    })();
    return () => {
      ac.abort();
    };
  }, [essai]);

  const changement = useCallback((): void => {
    setEchec('');
    setSucces('');
  }, []);

  const onAjouter = useCallback(
    (liste: 'secteurs' | 'contrats', valeur: string): boolean => {
      const courante = liste === 'secteurs' ? secteurs : contrats;
      const r = ajouterEntree(courante, valeur);
      if (!r.ajoutee) {
        if (valeur.trim() !== '') {
          setEchec(
            courante.length >= JOB_SEEKER_LIMITS.listMax
              ? `Dix entrées au plus dans cette liste.`
              : courante.some((e) => e.toLowerCase() === valeur.trim().toLowerCase())
                ? 'Cette entrée est déjà dans la liste.'
                : `Chaque entrée fait de ${JOB_SEEKER_LIMITS.itemMin} à ${JOB_SEEKER_LIMITS.itemMax} caractères.`,
          );
        }
        return false;
      }
      changement();
      (liste === 'secteurs' ? setSecteurs : setContrats)(r.liste);
      return true;
    },
    [changement, contrats, secteurs],
  );

  const onRetirerEntree = useCallback(
    (liste: 'secteurs' | 'contrats', valeur: string): void => {
      changement();
      (liste === 'secteurs' ? setSecteurs : setContrats)((l) => l.filter((e) => e !== valeur));
    },
    [changement],
  );

  const modifie = cle(titre, secteurs, contrats, visible) !== reference;
  const bloque = occupe || !modifie || titre.trim().length < JOB_SEEKER_LIMITS.headlineMin;

  const onEnregistrer = useCallback((): void => {
    const refus = refusDuBrouillon(titre, secteurs, contrats);
    if (refus !== '') {
      setEchec(refus);
      return;
    }
    const corps = jobSeekerProfileSchema.parse(brouillon(titre, secteurs, contrats, visible));
    setEchec('');
    setSucces('');
    void lancer(
      async () => {
        await memberApi.put('/me/job-seeker-profile', myJobSeekerProfileResponseSchema, { body: corps });
      },
      { recharger: false, echecRepli: 'Votre profil de recherche n’a pas pu être enregistré.' },
    ).then((ok) => {
      if (!ok) {
        setEchec('Votre profil de recherche n’a pas été enregistré.');
        return;
      }
      setExiste(true);
      setReference(cle(titre, secteurs, contrats, visible));
      setSucces(
        visible
          ? 'Profil enregistré. Il apparaît dans « Profils disponibles » : les recruteurs peuvent vous écrire.'
          : 'Profil enregistré, mais masqué : personne ne le voit dans « Profils disponibles ».',
      );
    });
  }, [contrats, lancer, secteurs, titre, visible]);

  const onRetirerProfil = useCallback((): void => {
    setEchec('');
    setSucces('');
    void lancer(
      async () => {
        await memberApi.del('/me/job-seeker-profile', z.object({ deleted: z.boolean() }));
      },
      { recharger: false, succes: 'Votre profil de recherche est retiré.', echecRepli: 'Le profil n’a pas pu être retiré.' },
    ).then((ok) => {
      if (!ok) return;
      setExiste(false);
      setTitre('');
      setSecteurs([]);
      setContrats([]);
      setVisible(true);
      setReference(cle('', [], [], true));
    });
  }, [lancer]);

  return useMemo<ProfilRechercheView>(
    () => ({
      phase,
      erreur,
      onRecharger: () => {
        setEssai((n) => n + 1);
      },
      existe,
      titre,
      onTitre: (v) => {
        changement();
        setTitre(v);
      },
      secteurs,
      contrats,
      onAjouter,
      onRetirerEntree,
      visible,
      onVisible: () => {
        changement();
        setVisible((v) => !v);
      },
      echec,
      succes,
      occupe,
      bloque,
      onEnregistrer,
      onRetirerProfil,
    }),
    [bloque, changement, contrats, echec, erreur, existe, occupe, onAjouter, onEnregistrer, onRetirerEntree, onRetirerProfil, phase, secteurs, succes, titre, visible],
  );
}
