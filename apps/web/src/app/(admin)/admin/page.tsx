'use client';

import { chargerD02 } from '@/screens/administration/appels';
import { EcranDonneesEquipe } from '@/screens/administration/ecran-donnees';
import { SQUELETTE_D02 } from '@/screens/administration/data';
import { ScreenFrames } from '@/screens/frames';
import { D02Desktop } from '@/screens/d02/desktop.generated';

/**
 * D02 — le tableau de bord d'équipe. `/admin` (15 §5.1, T5 D02).
 *
 * ─── LA RÉSERVE SUR `metric_snapshots` ÉTAIT FAUSSE, POUR LA DEUXIÈME FOIS ────
 *
 * Ce fichier disait « TRANSCODÉ, PAS BRANCHÉ — et c'est une limite du back-end :
 * 15 §6 ajoute la table `metric_snapshots` ; elle manque au schéma ». C'est la
 * MÊME réserve que le lot précédent avait déjà levée sur D16, recopiée ici sans
 * être revérifiée. `GET /v1/admin/dashboard` répond 200 sur l'API qui tourne et
 * rend onze blocs de points de mesure. La table existe.
 *
 * Relevé avec une vraie session d'équipe — mot de passe argon2id puis TOTP, le
 * parcours réel de §2.1 — et non déduit du service : aucun handler des six
 * contrôleurs d'équipe ne déclare de DTO de réponse, donc la forme ne se lit que
 * sur le JSON.
 *
 * ─── CINQ CARTES SUR DOUZE, ET LA RÈGLE EST ÉCRITE ───────────────────────────
 *
 * MEMBRES, PARCOURS, ENTRAIDE, GUIDES et SERVICES sont branchées. Les sept autres
 * restent dessinées, parce qu'il manque au moins un de leurs nombres —
 * `screens/administration/data.ts` dit laquelle à cause de quoi, carte par carte.
 *
 * Le critère est qu'une carte n'est liée que si CHAQUE nombre qu'elle porte est
 * servi. Un nombre figé posé à côté d'un nombre vivant est pire qu'une carte
 * entièrement figée : la carte figée se reconnaît, la carte mixte non.
 *
 * LE BANDEAU D'ALERTES N'EST PAS ENTAMÉ. `GET /admin/dashboard` ne rend aucune
 * alerte ; les trois morceaux (« SLA dépassé », « Justificatifs pro »,
 * « Villes à activer ») vivraient dans trois routes différentes, et les recoller
 * ici fabriquerait un bandeau dont personne ne pourrait dire s'il est complet.
 * Entier ou remonté — c'est remonté.
 *
 * ─── UN SEUL APPEL, ET C'EST UNE DÉCISION DE RÔLE ────────────────────────────
 *
 * `GET /admin/dashboard` est ouvert aux QUATRE rôles (`STAFF_SCOPES.dashboard`).
 * Les nombres qui manquent vivent dans des routes plus restreintes :
 * `GET /admin/moderation/stats`, qui porte `slaComplianceRate`, EXCLUT `SUPPORT`.
 * L'appeler d'ici rendrait le tableau de bord 403 pour un rôle que §2.2 autorise
 * explicitement à le voir — et le défaut serait invisible pour qui développe en
 * SUPER_ADMIN. Un écran ne doit jamais exiger plus de privilège que ce qu'il
 * affiche.
 *
 * ─── CETTE PAGE EST DEVENUE CLIENTE ──────────────────────────────────────────
 *
 * Même raison que D08 : le cookie `dp_staff` est `HttpOnly` et `SameSite=Strict`,
 * et le navigateur ne le joint qu'avec `credentials: 'include'`. Un composant
 * serveur de Next n'a pas la requête du navigateur sous la main pour le relayer
 * vers une autre origine ; il appellerait l'API en anonyme et prendrait un
 * `401 STAFF_SESSION_REQUIRED`.
 *
 * `chargerD02` est une fonction de MODULE, donc stable : `useDonneesEquipe` la
 * garde dans ses dépendances sans boucler.
 *
 * ─── UNE BASE SANS MESURE N'EST PAS UNE ERREUR ───────────────────────────────
 *
 * Sur une base sans instantané de métriques, `GET /admin/dashboard` répond 200 avec onze
 * blocs vides. Le chargeur levait sur la première mesure absente et la page affichait
 * « Une erreur est survenue ». Il rend maintenant des tirets et `aucuneMesure`, et la
 * page le dit (« Pas encore de mesure »). Les sept cartes non liées n'affichent plus les
 * nombres d'exemple de la maquette (adaptation `D02_SANS_INVENTION`).
 *
 * CETTE PAGE N'A PAS DE `<h1>`, et c'est la maquette qui en décide : le seul
 * endroit où « Tableau de bord » est écrit dans ce cadre, c'est l'entrée ACTIVE du
 * menu latéral. Promouvoir un élément de `<nav>` en titre de page dirait que la
 * page parle de son menu. Le manque est signalé à chaque régénération.
 */
export default function Page() {
  return (
    <EcranDonneesEquipe
      charger={chargerD02}
      squelette={SQUELETTE_D02}
      note={(d) =>
        d.aucuneMesure
          ? 'Pas encore de mesure : les indicateurs apparaissent après le premier calcul horaire.'
          : null
      }
    >
      {(donnees) => <ScreenFrames screen="D02" desktop={<D02Desktop {...donnees} />} />}
    </EcranDonneesEquipe>
  );
}
