'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { chargerD05 } from '@/screens/administration/appels';
import { EcranDonneesEquipe } from '@/screens/administration/ecran-donnees';
import { SQUELETTE_D05 } from '@/screens/administration/data';
import { ScreenFrames } from '@/screens/frames';
import { D05Desktop } from '@/screens/d05/desktop.generated';

/**
 * D05 — le dossier de modération. `/admin/moderation/:id` (13 §4.2, T5 D05).
 *
 * TROIS COLONNES, comme T5 les décrit : contenu (intégral, conversation jointe) ·
 * contexte (sanctions, dossiers, signalements avec motifs, verdict IA et
 * étiquettes) · actions.
 *
 * LE MOTIF DE 20 CARACTÈRES EST DESSINÉ, et c'est ce qui rend la règle de §4.2
 * visible : « une suspension ou un bannissement exige un motif d'au moins 20
 * caractères ». La maquette écrit le libellé « Motif · 20 caractères minimum » et
 * un compteur « 48 / 20 » à côté d'« Appliquer ». `e2e/administration.spec.ts`
 * mesure les deux.
 *
 * « Bannir · super-admin » porte son rôle dans son libellé — §4.2 : « `BAN_USER` —
 * `SUPER_ADMIN` seulement ». L'écran ne décide rien : c'est le garde de rôle côté
 * API qui tranche, et il existe déjà.
 *
 * LA CONVERSATION JOINTE est l'unique exception à la règle dure de 15 §3.1 (« ni
 * ne permet de lire une conversation privée hors d'un dossier de modération qui la
 * joint »). La maquette la dessine ici, et nulle part ailleurs — « Conversation
 * jointe (4 messages) ». C'est cohérent avec 13 §3.
 *
 * ─── L'`id` DE L'URL EST DÉSORMAIS LU ────────────────────────────────────────
 *
 * Ce fichier disait « Le paramètre d'URL n'est pas lu : la maquette dessine UN
 * dossier, "#4812" ». Il l'est maintenant, pour le SOUS-TITRE, qui est la seule
 * ligne de cette planche dont `GET /admin/moderation/cases/:id` serve les trois
 * valeurs — `subjectType`, `priority`, `sla`.
 *
 * `useCallback` n'est pas du confort : `useDonneesEquipe` garde `charger` dans ses
 * dépendances, et une fonction anonyme écrite ici rechargerait sans fin. Mémoïsée
 * sur `id`, elle est stable tant que l'URL ne change pas — et elle change bien
 * quand on passe d'un dossier à l'autre, ce qui est précisément le comportement
 * voulu.
 *
 * ─── CE QUI RESTE DESSINÉ, ET LE MANQUE QUI COMPTE ───────────────────────────
 *
 * Le titre « Dossier #4812 » n'est pas lié : la route ne rend qu'un `id` UUID, et
 * il manque une référence courte de dossier au back.
 *
 * Surtout : AUCUNE ROUTE D'ÉQUIPE NE JOINT LE CONTENU VISÉ. La route rend
 * `subjectId` et `subjectType`, jamais le texte. L'écran qui sert à décider d'une
 * sanction ne peut donc pas montrer ce qu'il sanctionne — le modérateur lit
 * « Publication · priorité 1 · SLA dépassé » et devrait trancher à l'aveugle. Le
 * contenu, l'auteur, les signalements et le verdict IA restent ceux de la maquette,
 * et le détail est dans `screens/administration/data.ts`.
 *
 * Aucun bouton n'écrit : 15 §2.3 veut que toute écriture passe par
 * `AuditService.record()`, et une sanction appliquée sans trace serait exactement
 * ce que cette règle interdit.
 */
export default function Page() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const charger = useCallback(() => chargerD05(id), [id]);

  return (
    <EcranDonneesEquipe charger={charger} squelette={SQUELETTE_D05}>
      {(donnees) => <ScreenFrames screen="D05" desktop={<D05Desktop {...donnees} />} />}
    </EcranDonneesEquipe>
  );
}
