import { EcranNotifications } from '@/screens/messages/ecran-donnees';

/**
 * X02 — Notifications (`/notifications`, 12 §2.7 et §5, T5 §10).
 *
 * Transcodé de `docs/template/09 Messages et transverse.dc.html`.
 *
 * Composant SERVEUR : il reçoit `searchParams` en propriété et n'emploie donc pas
 * `useSearchParams()`, qui forcerait un rendu client et servirait un HTML vide. Il
 * REND la coquille cliente sans appeler aucune de ses fonctions, pour la raison
 * écrite dans `screens/messages/feuilles.ts`.
 *
 * BRANCHÉ SUR `GET /notifications` (12 §4), ses cinq lignes liées sur les TROIS
 * planches.
 *
 * DEUX PLANCHES D'ORDINATEUR, parce que 12 §2.7 décrit deux formes — « panneau
 * déroulant » et « page complète » — et que la maquette les dessine toutes les deux :
 *
 *   · la PAGE COMPLÈTE, par défaut : titre, filtres par catégorie, lignes ;
 *   · le PANNEAU DÉROULANT, sur `?vue=panneau` : la même liste dans une carte
 *     posée sous la cloche, avec « Tout marquer lu » et « Voir tout ».
 *
 * POURQUOI UN PARAMÈTRE D'URL plutôt qu'un clic sur la cloche : aucun cadre de ce lot
 * ne dessine de cloche cliquable — c'est un `<span>` d'icône dans la barre haute, et
 * la planche du panneau représente son état OUVERT sur un contenu principal VIDE.
 * Inventer le contrôle serait réécrire la maquette ; laisser la planche inatteignable
 * serait la livrer morte. Même choix que pour le sélecteur de parcours de J01M.
 *
 * Le panneau n'a pas de forme mobile dessinée : sur téléphone, la maquette ne montre
 * que la page complète. Le cadre mobile ne change donc pas.
 *
 * ── 12 §2.1 ET 12 §2.4 — LA RÈGLE DU CORPS DE MESSAGE, MAINTENANT EXÉCUTABLE ──
 *
 * « Un push MESSAGE ne contient jamais le corps du message. »
 *
 * Le constat de départ n'a pas changé, et il était bon : AUCUNE NOTIFICATION DE
 * MESSAGE N'EST DESSINÉE ICI. Les cinq lignes de la maquette portent une réaction
 * groupée, des réponses d'entraide, une échéance de parcours, un événement et une
 * acceptation de parrainage — pas un corps de message, pas même un « Nouveau message
 * de X ». Vérifié ligne à ligne. La pastille de filtre « Messages » existe, mais elle
 * ne filtre aucune ligne dessinée.
 *
 * CE QUI A CHANGÉ : ces lignes ne sont plus dessinées, elles sont LUES. Une
 * notification de catégorie `MESSAGE` peut donc arriver ici — le back en produit,
 * avec `body: null` et le titre « Nouveau message de X » — et c'est désormais la
 * garde de la FRONTIÈRE qui tient la règle, non plus l'absence de pixel :
 * `notificationSchema` (dans `packages/shared`) REFUSE une réponse où une
 * notification `MESSAGE` porte un corps, et il est `.strict()` pour qu'un `preview`
 * ou un `excerpt` greffé soit rejeté au lieu d'être dépouillé en silence.
 *
 * La passerelle temps réel fait déjà bien sa part — `message.new` ne transporte que
 * `conversationId` et `messageId` — et rien ici ne l'ajoute.
 *
 * LES DEUX ÉCARTS QUE CE COMMENTAIRE CONSIGNAIT SONT FERMÉS. `meta.unread` est
 * affiché (« N non lues ») ; les lignes sont cliquables : la table `notifications`
 * a maintenant une colonne `url` (migration `notifications_cible`), posée par les
 * gestionnaires d'événements en chemins du front. Une notification de message mène
 * à `/messages/<conversation>` — le `refId` (le MESSAGE) n'est plus employé à cet
 * usage. Les lignes sans page (« Bienvenue ») ne promettent pas de lien. « Tout
 * marquer lu » écrit `POST /notifications/read`, et la page se relit à
 * `notification.new`. */
const VUES = { panneau: 'panneau' } as const;

/**
 * LES SEPT FILTRES QUE LA MAQUETTE DESSINE, et aucun autre.
 *
 * Le porteur : « Les filtres sur la page notification marchent ? » Ils ne
 * marchaient pas — sept `<span>`, zéro geste. Ils sont maintenant des liens vers
 * `?type=…`, et cette liste est le garde-fou : l'URL est publique, un `type`
 * inconnu est IGNORÉ plutôt qu'envoyé au serveur. C'est la même règle que `vue`
 * juste au-dessus.
 */
const FILTRES = ['Parcours', 'Entraide', 'Réseaux', 'Événements', 'Messages', 'Compte'];

export default async function NotificationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demande = params['vue'];
  // Une vue inconnue est IGNORÉE plutôt qu'affichée : l'URL est publique.
  const panneau =
    typeof demande === 'string' && VUES[demande as keyof typeof VUES] === 'panneau';

  const type = params['type'];
  const filtre = typeof type === 'string' && FILTRES.includes(type) ? type : '*';

  return <EcranNotifications panneau={panneau} filtre={filtre} />;
}
