'use client';

import { chargerD16 } from '@/screens/administration/appels';
import { EcranDonneesEquipe } from '@/screens/administration/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { D16Desktop } from '@/screens/d16/desktop.generated';

/**
 * D16 — le rapport d'impact. `/admin/impact` (15 §5.3, T5 D16).
 *
 * Quatre planches de rapport exportable en PDF : les chiffres clés, la
 * répartition par pays, les témoignages citables, et la page de garde.
 *
 * ─── BRANCHÉ SUR `GET /admin/impact` ───────────────────────────────────────────
 *
 * Une seule route sert les cinq nombres de la première planche, plus le trimestre.
 * La réserve que portait ce module — « les chiffres viennent de `metric_snapshots`,
 * table que §6 ajoute et qui manque au schéma » — était FAUSSE : la route répond
 * 200 sur l'API qui tourne, et ses `items` portent nommément
 * `impact.members_accompanied`, `impact.journeys_completed`,
 * `impact.event_attendances`, `impact.help_resolved` et
 * `impact.mentorships_completed`. Vérifié avec une vraie session d'équipe.
 *
 * LE TRIMESTRE VIENT DU SERVEUR, jamais de l'horloge du navigateur. C'est un
 * document qui sort de l'entreprise : deux lecteurs doivent voir le même titre, et
 * deux exports du même rapport doivent porter le même nom.
 *
 * ─── LE MUR DES TÉMOIGNAGES EST LAISSÉ INTACT, ET C'EST LE POINT ───────────────
 *
 * La troisième planche dessine « Témoignages citables », signés d'un prénom et
 * d'une ville. §5.3 l'autorise — « extraits … avec accord de l'auteur » — et
 * l'accord se lit dans `guides.quotable` et `city_tips.quotable`, DEUX COLONNES
 * ABSENTES du schéma.
 *
 * Elles ne sont pas contournées. Citer un membre sans son accord est exactement ce
 * que ces colonnes existent pour empêcher, et tout critère de remplacement — un
 * avis bien noté, un texte « assez générique » — revient à décider à sa place. Les
 * deux citations restent donc celles de la maquette : visiblement fausses, ce qui
 * est préférable à deux vraies citations publiées sans accord.
 *
 * C'est la troisième fois que cet écart est remonté sans être contourné. Il
 * appartient au porteur : il faut une migration, et une façon pour le membre de
 * donner cet accord.
 *
 * ─── CE QUI RESTE DESSINÉ, ET POURQUOI ────────────────────────────────────────
 *
 * La « Répartition par pays » est un GRAPHIQUE. `GET /admin/impact` rend bien
 * `impact.members_by_origin_country`, mais sa `dimension` est un UUID de pays et la
 * hauteur des barres est dessinée en dur. Lier les quatre noms sans les hauteurs
 * donnerait des libellés justes sur des barres fausses — pire que le graphique
 * figé, parce que ça aurait l'air juste. Signalé.
 *
 * « Exporter en PDF » n'est pas branché : aucune route ne produit ce PDF.
 */
export default function Page() {
  return (
    <EcranDonneesEquipe charger={chargerD16}>
      {(donnees) => <ScreenFrames screen="D16" desktop={<D16Desktop {...donnees} />} />}
    </EcranDonneesEquipe>
  );
}
