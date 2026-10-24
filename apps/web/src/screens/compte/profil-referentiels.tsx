'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FenetreChoix } from '@/components/fenetre-choix';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { creerCompetence, listLanguages, listSkills, messageCreationCompetence } from '@/lib/api';
import { z } from 'zod';
import type { K01Lecture } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ COMPÉTENCES ET LANGUES DEVIENNENT MODIFIABLES                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Au niveau du profil, Compétences et langues ne sont pas
 * modifiables ? »
 *
 * MESURÉ : non. Deux boîtes de TEXTE. Une adaptation existait pour les rendre
 * sélectionnables et le générateur disait à chaque exécution qu'elle était
 * « attendue mais introuvable » — elle visait un dessin que la maquette n'a plus.
 *
 * ── LES RÉFÉRENTIELS NE SE CHARGENT QU'À L'OUVERTURE ──────────────────────
 *
 * Soixante compétences et vingt-quatre langues, pour une fenêtre que la plupart
 * des visites n'ouvriront pas. Les charger à l'arrivée sur le profil ferait deux
 * allers-retours pour rien — c'est le même arbitrage que l'inscription, qui ne
 * les demande qu'à son cinquième écran.
 *
 * ── LES LANGUES SE RECONNAISSENT À LEUR CODE, PAS À LEUR IDENTIFIANT ──────
 *
 * ⚠ ÉCART D'API, remonté : `publicProfileResponseSchema` rend `{ id, nameFr }`
 * pour les compétences et `{ code, nameFr }` pour les langues. `PATCH
 * /me/profile` attend pourtant `languageIds` — des UUID. Le référentiel porte
 * les deux, et c'est lui qui fait la conversion ici. Un `id` sur les langues du
 * profil public fermerait l'écart.
 */
type Item = { readonly id: string; readonly code?: string; readonly nameFr: string };

export function ProfilReferentiels({
  donnees,
  onRecharger,
  children,
}: {
  readonly donnees: K01Lecture;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K01Lecture) => ReactNode;
}) {
  const [ouverte, setOuverte] = useState<'competences' | 'langues' | null>(null);
  const [competences, setCompetences] = useState<readonly Item[]>([]);
  const [langues, setLangues] = useState<readonly Item[]>([]);
  const [enVol, setEnVol] = useState(false);

  useEffect(() => {
    if (ouverte === null) return;
    if (ouverte === 'competences' && competences.length > 0) return;
    if (ouverte === 'langues' && langues.length > 0) return;
    void (async () => {
      try {
        if (ouverte === 'competences') setCompetences((await listSkills()).items);
        else setLangues((await listLanguages()).items);
      } catch {
        notifyError('La liste n’a pas pu être chargée.');
      }
    })();
  }, [ouverte, competences.length, langues.length]);

  const enregistrer = useCallback(
    (champ: 'skillIds' | 'languageIds', ids: readonly string[]) => {
      setEnVol(true);
      memberApi
        .patch('/me/profile', z.unknown(), { body: { [champ]: ids } })
        .then(() => {
          setOuverte(null);
          notifySuccess('Profil mis à jour.');
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le profil n’a pas pu être mis à jour.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [onRecharger],
  );

  /**
   * « Autre… » — `POST /places/skills`. Le serveur crée la compétence À SOI (ou rend la ligne
   * qui portait déjà ce nom, sans casse ni accent) ; on l'ajoute au catalogue de la fenêtre
   * pour qu'elle s'affiche, et `FenetreChoix` la coche. Un refus (plafond, nom pris, forme)
   * s'écrit par son message, jamais en silence.
   */
  const creer = useCallback(async (nom: string) => {
    try {
      const creee = await creerCompetence(nom);
      setCompetences((avant) =>
        avant.some((c) => c.id === creee.id) ? avant : [...avant, { id: creee.id, nameFr: creee.nameFr }],
      );
      return { id: creee.id, nameFr: creee.nameFr };
    } catch (cause: unknown) {
      notifyError(messageCreationCompetence(cause));
      return null;
    }
  }, []);

  /** Les langues cochées : on part des CODES du profil et on les convertit. */
  const languesChoisies = langues
    .filter((l) => (donnees.languesIds ?? []).includes(l.code ?? ''))
    .map((l) => l.id);

  const enrichies: K01Lecture = {
    ...donnees,
    profilOccupe: enVol,
    onCompetences: () => {
      setOuverte('competences');
    },
    onLangues: () => {
      setOuverte('langues');
    },
  };

  return (
    <>
      <FenetreChoix
        ouverte={ouverte === 'competences'}
        titre="Mes compétences"
        items={competences}
        choisis={donnees.competencesIds ?? []}
        occupe={enVol}
        onCreer={creer}
        onValider={(ids) => {
          enregistrer('skillIds', ids);
        }}
        onFermer={() => {
          setOuverte(null);
        }}
      />
      <FenetreChoix
        ouverte={ouverte === 'langues'}
        titre="Mes langues"
        items={langues}
        choisis={languesChoisies}
        occupe={enVol}
        onValider={(ids) => {
          enregistrer('languageIds', ids);
        }}
        onFermer={() => {
          setOuverte(null);
        }}
      />
      {children(enrichies)}
    </>
  );
}
