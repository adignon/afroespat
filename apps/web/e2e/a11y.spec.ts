import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { connecter } from './session';

/**
 * Accessibilité — §10.6 : « contrôle automatisé (axe-core) sur chaque page
 * principale ». Exigence de la définition de « terminé » (§12.2) : une
 * fonctionnalité n'est pas finie tant qu'une violation subsiste.
 *
 * axe-core ne remplace pas une relecture humaine : il attrape le contraste, les
 * noms accessibles manquants, la structure de titres. Il ne dit rien de la
 * pertinence d'un libellé. C'est un plancher, pas un plafond.
 *
 * ── DIX PAGES EXIGENT MAINTENANT UNE SESSION ────────────────────────────────
 *
 * Les dix écrans du module Compte lisent l'API depuis le lot de branchement. Sans
 * session, ils ne rendent plus que leur état d'attente puis une invitation à se
 * reconnecter — et axe-core auditerait ce bloc de trois lignes en annonçant zéro
 * violation. Ce serait le pire résultat possible : un SUCCÈS QUI NE PROUVE RIEN,
 * sur dix pages, sans que rien ne le signale.
 *
 * Elles portent donc `session: true`, et le test ouvre une vraie session avant de
 * naviguer. Le surcoût est borné à ces dix pages : les autres n'en ont pas besoin,
 * et en ouvrir une pour chacune des soixante allongerait la suite pour rien.
 */

const PAGES = [
  { path: '/accueil', name: 'A01 Fil d’actualité' },

  // Lot 2 — les dix-sept sections restantes de « 03 Accueil v2 ». Une route par
  // écran ; les variantes d'état (`?onglet=`, `?vue=`) sont couvertes par celles qui
  // changent réellement de balisage, pas par les vingt combinaisons possibles.
  { path: '/publications/repas-partage', name: 'A02 Publication' },
  // A01N — « Nouvelle publication », le composeur en plein écran. Écran MOBILE
  // SEUL : la maquette ne lui dessine aucun cadre d'ordinateur, et il est donc
  // rendu aux deux largeurs. Il faut le contrôler comme les autres — c'est un
  // formulaire, donc l'endroit où un nom accessible manquant coûte le plus cher.
  { path: '/publications/nouvelle', name: 'A01N Nouvelle publication' },
  { path: '/guides', name: 'A03 Guides — liste' },
  { path: '/guides/visale-sans-cdi', name: 'A04 Guide — lecture' },
  { path: '/guides/visale-sans-cdi?vue=auteur', name: 'A04 Guide — vue auteur' },
  { path: '/guides/nouveau', name: 'A05 Guide — éditeur' },
  { path: '/guides/visale-sans-cdi/propositions', name: 'A06 Propositions reçues' },
  { path: '/guides/visale-sans-cdi/corriger', name: 'A06 Proposer une correction' },
  { path: '/reseaux', name: 'A07 Réseaux' },
  { path: '/reseaux/beninois-en-france', name: 'A08 Réseau — Sujets' },
  { path: '/reseaux/beninois-en-france?onglet=fil', name: 'A08T Réseau — Fil' },
  { path: '/reseaux/beninois-en-france?onglet=membres', name: 'A08T Réseau — Membres' },
  { path: '/reseaux/beninois-en-france?onglet=gerer&vue=proprietaire', name: 'A08T Gérer le réseau' },
  { path: '/reseaux/beninois-en-france/sujets/passeport', name: 'A09 Sujet' },
  { path: '/reseaux/nouveau', name: 'A10 Créer un réseau' },
  { path: '/villes', name: 'A11 Villes et Membres' },
  { path: '/villes/lyon', name: 'A12 Fiche ville' },
  { path: '/villes/lyon?onglet=produits', name: 'A12T Ville — Produits du pays' },
  // A12C — la fenêtre de contribution, ouverte dès l'arrivée par `?contribution=`.
  // Les trois volets sont trois PLANCHES distinctes, donc trois balisages : les
  // contrôler tous les trois, et pas seulement le premier, est ce qui a manqué au
  // lot précédent — où la fenêtre entière était absente sans que rien ne le dise.
  { path: '/villes/lyon?contribution=type', name: 'A12C Contribuer — étape 1' },
  { path: '/villes/lyon?contribution=produit', name: 'A12C Contribuer — Produit du pays' },
  { path: '/villes/lyon?contribution=budget', name: 'A12C Contribuer — Budget réel' },
  { path: '/stories/visale', name: 'A13 Story — lecture' },
  { path: '/stories/nouvelle', name: 'A14 Story — création' },
  // Entraide (05 Entraide.dc.html) — H01 à H10.
  { path: '/entraide', name: 'H01 Fil d’entraide' },
  { path: '/entraide/abc', name: 'H02 Demande — détail' },
  { path: '/entraide/nouveau', name: 'H03 Publier une demande' },
  { path: '/entraide/aider', name: 'H04 Vous pouvez aider' },
  { path: '/entraide/mes-demandes', name: 'H09 Mes demandes' },
  { path: '/entraide/mes-reponses', name: 'H10 Mes réponses' },
  { path: '/parrainage', name: 'H05 Parrains — liste' },
  { path: '/parrainage/amina', name: 'H06 Parrain — fiche' },
  { path: '/parrainage/mes-parrainages', name: 'H07 Mes parrainages' },
  { path: '/parrainage/devenir', name: 'H08 Devenir parrain' },
  // Agenda (07 Agenda.dc.html) — E01 à E04.
  { path: '/agenda', name: 'E01 Agenda' },
  { path: '/agenda/42', name: 'E02 Événement' },
  { path: '/agenda/nouveau', name: 'E03 Créer un événement' },
  { path: '/agenda/42/presence', name: 'E04 Présence' },
  /**
   * Les douze routes du module Parcours (`docs/specs/T5-pages-et-prompts.md` §5).
   *
   * §10.6 demande le contrôle « sur chaque page principale » : les y ajouter
   * une par une est la seule lecture honnête de cette phrase. Elles passent
   * toutes, et deux adaptations du générateur y sont pour beaucoup — le `<h1>`
   * promu depuis le titre visible (la maquette n'écrit aucun `<h2>` : sans cela
   * les douze pages arrivaient sans aucun titre) et les fermetures de modale
   * promues en vrais `<button>` avec leur nom accessible.
   */
  { path: '/parcours', name: 'J11 Mes parcours' },
  { path: '/parcours/nouveau', name: 'J02 Créer un parcours' },
  { path: '/parcours/1', name: 'J01 Parcours' },
  { path: '/parcours/1/etapes/7', name: 'J01S Étape en cours' },
  { path: '/parcours/1/discussion', name: 'J01D Discussion' },
  { path: '/parcours/1/equipe', name: 'J05 Équipe' },
  { path: '/parcours/1/documents', name: 'J06 Checklist de documents' },
  { path: '/parcours/1/historique', name: 'J07 Historique' },
  { path: '/parcours/1/reglages', name: 'J08 Réglages' },
  { path: '/parcours/1/abouti', name: 'J10 Fin de parcours' },
  { path: '/parcours/publics', name: 'J09 Parcours publics' },
  { path: '/parcours/publics/1', name: 'J09 Vue publique d’un parcours' },

  /**
   * Les seize écrans de l'application d'ÉQUIPE (`10 Administration`, T5 §11).
   *
   * §10.6 demande le contrôle « sur chaque page principale », et l'administration
   * en fait partie : l'équipe y passe ses journées, et c'est l'écran le plus dense
   * du produit. Les trois états de la connexion sont comptés séparément parce
   * qu'ils changent réellement de balisage.
   *
   * DEUX PAGES N'ONT PAS DE `<h1>` — `/admin` et `/admin/membres` — parce que la
   * maquette n'y écrit aucun titre hors du menu latéral. `page-has-heading-one` est
   * une règle « best-practice » d'axe-core, hors des étiquettes WCAG retenues ici :
   * la suite reste donc verte, et le manque est épinglé dans
   * `e2e/administration.spec.ts`, qui exige explicitement zéro `<h1>` sur ces deux
   * routes. Le jour où la maquette leur donne un titre, c'est là que ça tombe.
   */
  { path: '/admin', name: 'D02 Tableau de bord' },
  { path: '/admin/connexion', name: 'D01 Connexion admin' },
  { path: '/admin/connexion?etape=totp', name: 'D01 Connexion — code TOTP' },
  { path: '/admin/connexion?etape=enrolement', name: 'D01 Connexion — enrôlement forcé' },
  { path: '/admin/membres', name: 'D03 Membres' },
  { path: '/admin/moderation', name: 'D04 Modération — file' },
  { path: '/admin/moderation/4812', name: 'D05 Modération — dossier' },
  { path: '/admin/parcours', name: 'D06 Modèles de parcours' },
  { path: '/admin/etapes', name: 'D07 Bibliothèque d’étapes' },
  { path: '/admin/referentiels', name: 'D08 Référentiels' },
  { path: '/admin/guides', name: 'D09 Guides' },
  { path: '/admin/services', name: 'D10 Services' },
  { path: '/admin/alertes', name: 'D11 Alertes arnaques' },
  { path: '/admin/contenu', name: 'D12 Pages et annonces' },
  { path: '/admin/partenaires', name: 'D13 Partenaires' },
  { path: '/admin/revenus', name: 'D14 Abonnements et revenus' },
  { path: '/admin/reglages', name: 'D15 Réglages' },
  { path: '/admin/impact', name: 'D16 Rapport d’impact' },
  /**
   * Messages et transverse (`09 Messages et transverse.dc.html`) — M01, X01 à X04.
   *
   * X04 n'y figure pas : T5 le range en « composants » et ne lui donne aucune route.
   * X03 n'en a pas non plus (T5 écrit « — ») ; sa feuille est servie en état d'URL sur
   * la conversation, et c'est à ce titre qu'elle est contrôlée ici — une boîte de
   * dialogue ouverte est ce qu'axe doit voir.
   */
  { path: '/messages', name: 'M01 Messagerie — liste' },
  { path: '/messages/1', name: 'M01 Messagerie — conversation' },
  { path: '/messages/1?feuille=signaler', name: 'X03 Signaler — feuille' },
  { path: '/messages/1?feuille=merci', name: 'X03 Signaler — confirmation' },
  /**
   * Le MENU DE LA CONVERSATION s'ouvre au « ··· » de l'en-tête ; il est servi ici
   * par l'URL pour la même raison que les deux feuilles X03 — une boîte de dialogue
   * vit dans un portail, donc axe-core ne la voit que si elle est ouverte.
   *
   * Deux points qu'il vaut la peine de savoir contrôlés ici : son nom accessible
   * vient de l'étiquette de la carte (« MENU DE LA CONVERSATION », promue en
   * `<h2 id="m01-titre">`), et le « ··· » qui l'ouvre est un bouton en ICÔNE SEULE
   * — muet sans le `label` déclaré avec son déclencheur, ce qu'axe relève en
   * `critical` (`button-name`).
   */
  { path: '/messages/1?feuille=menu', name: 'M01 Menu de la conversation' },
  /**
   * ⚠ LA CONVERSATION BLOQUÉE N'EST DESSINÉE PAR AUCUNE MAQUETTE : sa forme est
   * empruntée et sa phrase vient du porteur (voir `CONVERSATION_BLOQUEE` dans
   * `tools/screens/09-messages.mjs`). Raison de plus pour qu'axe la voie : c'est le
   * seul écran de ce module dont le contenu n'a pas été transcodé mot pour mot, donc
   * le seul où une faute de balisage ne serait couverte par aucune planche.
   */
  { path: '/messages/1?etat=bloque', name: 'M01 Conversation — membre bloqué' },
  { path: '/recherche', name: 'X01 Recherche' },
  { path: '/notifications', name: 'X02 Notifications — page complète' },
  { path: '/notifications?vue=panneau', name: 'X02 Notifications — panneau déroulant' },
  /**
   * Les dix écrans du module Compte (`docs/specs/T5-pages-et-prompts.md` §9).
   *
   * `/@fatou.n` porte l'arobase DANS le segment : c'est la forme que T5 écrit, et
   * la seule que l'App Router puisse servir — un dossier `@handle` serait un slot
   * de route parallèle, sans segment d'URL.
   *
   * Les trois variantes `?paiement=` ne sont pas listées : elles n'ajoutent aucun
   * balisage à la PAGE — la fenêtre vit dans un portail, hors du document au
   * rendu serveur, et axe-core ne la verrait pas. Ce qu'elle promet
   * (`aria-modal`, `aria-labelledby`, le piège au clavier) est éprouvé par
   * `e2e/compte.spec.ts`, qui l'ouvre vraiment.
   */
  /**
   * `session: true` sur les dix : voir l'en-tête. Sans elle, axe auditerait l'état
   * d'attente et annoncerait zéro violation en ne regardant rien.
   *
   * `path: null` sur K02 : son adresse est celle du membre que la session vient de
   * créer, et elle n'est donc connue qu'à l'exécution. La maquette écrivait
   * `/@fatou.n` ; ce pseudo n'existe dans aucune base, et il n'en existait pas non
   * plus avant — la page se contentait d'afficher le nom dessiné.
   */
  { path: '/compte/profil', name: 'K01 Mon profil', session: true },
  { path: null, name: 'K02 Profil d’un membre', session: true },
  { path: '/compte/verification', name: 'K03 Vérification et niveaux', session: true },
  { path: '/compte/securite', name: 'K04 Téléphones et sessions', session: true },
  { path: '/compte/contacts', name: 'K05 Contacts', session: true },
  { path: '/compte/abonnement', name: 'K06 Abonnement et Premium', session: true },
  { path: '/premium', name: 'K06 Premium', session: true },
  { path: '/compte/notifications', name: 'K07 Réglages des notifications', session: true },
  { path: '/compte/donnees', name: 'K08 Mes données', session: true },
  { path: '/compte/sanctions', name: 'K09 Sanctions', session: true },
  { path: '/compte/enregistres', name: 'K10 Enregistrés', session: true },
  /**
   * Les dix écrans du module Services (`06 Services.dc.html`, 10 §7).
   *
   * `/services/emploi/nouveau` ne figure pas à part : la maquette dessine UNE
   * planche pour `:id` et `/nouveau`, et la route dynamique la sert aux deux. La
   * lister deux fois contrôlerait deux fois le même balisage.
   *
   * `?niveau=l0` non plus, pour la raison déjà écrite plus haut à propos de
   * `?paiement=` : la fenêtre vit dans un portail, hors du document au rendu
   * serveur, et axe-core ne la verrait pas. Ce qu'elle promet (`aria-modal`,
   * `aria-labelledby`, le piège au clavier) est éprouvé par
   * `e2e/services.spec.ts`, qui l'ouvre vraiment.
   */
  { path: '/services/logement', name: 'S01 Logement — liste' },
  { path: '/services/logement/abc', name: 'S02 Annonce — détail' },
  { path: '/services/logement/nouveau', name: 'S03 Publier une annonce' },
  { path: '/services/emploi', name: 'S04 Emploi — liste' },
  { path: '/services/emploi/42', name: 'S05 Offre — détail et publication' },
  { path: '/services/annuaire', name: 'S06 Annuaire — liste' },
  { path: '/services/annuaire/mariam-bah', name: 'S07 Fiche pro' },
  { path: '/services/annuaire/ma-fiche', name: 'S08 Créer ma fiche pro' },
  { path: '/services/mes-annonces', name: 'S09 Mes annonces' },
  { path: '/services/alertes', name: 'S10 Mes alertes' },
] as const;

for (const entree of PAGES) {
  const { path, name } = entree;
  const besoinSession = 'session' in entree && entree.session === true;

  test(`${name} ne présente aucune violation d’accessibilité`, async ({ context, page, request }) => {
    /**
     * LA SESSION D'ABORD, l'adresse ensuite.
     *
     * K02 a `path: null` : son adresse est `/@` suivi du pseudo du membre que la
     * session vient de créer. La calculer avant d'ouvrir la session serait
     * impossible, et la remplacer par un pseudo écrit en dur donnerait une 404 —
     * qu'axe auditerait sans broncher.
     */
    const adresse = besoinSession
      ? await (async () => {
          const membre = await connecter(context, request, { displayName: 'Awa Konaté' });
          return path ?? `/@${membre.handle}`;
        })()
      : (path as string);

    await page.goto(adresse, { waitUntil: 'networkidle' });

    /**
     * Sur une page qui charge ses données, on attend le CADRE avant d'auditer.
     * `networkidle` ne suffit pas : Next précharge les liens visibles, donc il
     * retombe parfois au calme avant que les appels de l'écran n'aient répondu.
     */
    if (besoinSession) {
      await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });
    }

    const results = await new AxeBuilder({ page })
      // AA est la cible (§10.6). AAA n'est pas exigé et produirait du bruit.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // ÉCART ASSUMÉ — le contraste est exclu ICI, et ici seulement.
      //
      // Le porteur a choisi de conserver les couleurs de la maquette telles
      // quelles ; trois jetons n'atteignent pas le seuil AA. La liste exacte, avec
      // les ratios mesurés, vit dans packages/config/guardrails/check-contrast.mjs
      // et s'affiche à CHAQUE build : l'écart reste sous les yeux plutôt que de
      // disparaître. Voir docs/decisions.md.
      //
      // Tout le reste d'axe-core continue de bloquer : noms accessibles, rôles,
      // ordre des titres, libellés de formulaire, attributs ARIA.
      .disableRules(['color-contrast'])
      .analyze();

    // Message lisible : la liste brute d'axe est illisible en sortie de CI.
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact ?? 'n/a'}) — ${v.help}\n    ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n    ')}`,
    );

    expect(summary, `Violations sur ${adresse} :\n${summary.join('\n')}`).toEqual([]);
  });
}
