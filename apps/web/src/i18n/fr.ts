/**
 * Textes d'interface — français, un espace de noms par module (§10.5).
 *
 * RÈGLE DURE (§10.5, T1) : aucune chaîne en dur dans les composants. Tout texte
 * visible passe par ici. La règle est tenue dès le premier écran, parce qu'une
 * dette de traduction commence toujours par « une seule chaîne, juste pour voir ».
 *
 * Ton (T2) : vouvoiement, phrases courtes, écriture inclusive au point médian
 * seulement quand un accord est inévitable.
 *
 * Mots interdits : « certifié » et ses dérivés (règle dure §1.2). Le garde-fou
 * `containsForbiddenWord` de @app/shared le vérifie sur ce catalogue.
 */

export const fr = {
  nav: {
    ariaMain: 'Navigation principale',
    settings: 'Réglages',
    search: 'Rechercher dans la diaspora',
    create: 'Créer',
    messages: 'Messages',
    notifications: 'Notifications',
    myAccount: 'Mon compte',
    sections: {
      home: 'Accueil',
      journey: 'Parcours',
      help: 'Entraide',
      services: 'Services',
      agenda: 'Agenda',
      account: 'Compte',
    },
  },

  /** Panneau Accueil — §10.1. Ses compteurs sont des NOUVEAUTÉS depuis la dernière visite. */
  homePanel: {
    viewPublicProfile: 'Voir mon profil public',
    community: 'Communauté',
    feed: 'Fil d’actualité',
    guides: 'Guides & Démarches',
    help: 'Fil d’entraide',
    networks: 'Réseaux',
    mentorship: 'Parrainage',
    cities: 'Villes & Membres',
    events: 'Événements',
    shortcuts: 'Vos raccourcis',
    edit: 'Modifier',
    membersSuffix: 'membres',
  },

  journeyCard: {
    label: 'Mon parcours',
    continue: 'Continuer',
    create: 'Créer mon parcours',
    // Aucune connotation d'échec : une étape se met en pause (règle dure §1.2).
    pitch: 'Listez vos étapes, suivez vos échéances, trouvez de l’aide au bon moment.',
    stepPrefix: 'Étape',
  },

  feed: {
    title: 'Fil d’actualité',
    subtitle: 'Ce que partage la diaspora autour de vous.',
    composerPlaceholder: 'Que voulez-vous partager avec la diaspora ?',
    publish: 'Publier',
    share: 'Partager',
    bookmark: 'Enregistrer',
    composerActions: {
      poll: 'Créer un sondage',
      guide: 'Lier un guide',
      image: 'Ajouter une image',
    },
    empty: {
      title: 'Le fil est encore calme',
      description:
        'Rejoignez un réseau de votre ville ou posez votre première question : l’entraide démarre là.',
      action: 'Découvrir les réseaux',
    },
  },

  /** Bandeau des stories du jour (§10.1). */
  stories: {
    title: 'Stories du jour',
    create: 'Créer une story',
    filters: {
      all: 'Tout',
      information: 'Informations',
      conseil: 'Conseils',
      decouverte: 'Découvertes',
    },
  },

  /**
   * Colonne de contexte. Les quatre blocs poussent tous vers le RÉEL : un
   * événement physique, un membre à saluer, un parrain joignable.
   */
  contextColumn: {
    eventsTitle: 'Événements à {ville}',
    seeAll: 'Voir tout',
    arrivalsTitle: 'Nouveaux arrivants',
    greet: 'Saluer',
    alertTitle: 'Alerte vigilance',
    alertBody:
      'Attention aux fausses offres de logement exigeant un virement avant toute visite.',
    contactsTitle: 'Parrains et contacts',
    online: 'En ligne',
  },

  states: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    loadError: 'Impossible de charger.',
    offline: 'Vous êtes hors ligne. Les contenus déjà chargés restent consultables.',
  },
} as const;

export type Messages = typeof fr;
