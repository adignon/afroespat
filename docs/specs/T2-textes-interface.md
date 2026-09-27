# Textes d'interface

> Ton, règles et libellés de référence. Les fichiers de traduction (`messages/fr/<module>.json`) reprennent ces textes clé par clé. Ce document fixe le ton une fois ; les modules ne le rediscutent pas.

---

## 1. Ton

- **Vouvoiement**, toujours.
- Phrases courtes. Un message = une idée.
- On dit ce qui se passe et ce qu'on peut faire, pas pourquoi le système a raison.
- Pas de superlatifs, pas d'exclamation dans les messages système. Les points d'exclamation sont réservés aux félicitations (jalon, fin de parcours).
- Écriture inclusive au point médian **uniquement** quand un accord est inévitable : « marqué·e », « inscrit·e ». Sinon, formulation épicène : « les membres », « la personne ».
- **Mots interdits** dans l'interface : certifié, échec / échoué, garanti, officiel (sauf pour désigner un document administratif réel), gratuit (pour parler d'un contenu qui l'est déjà par principe), révolutionnaire, communauté de frères.
- **Mots à préférer** : membre (pas utilisateur), parcours (pas projet, dans l'interface), étape franchie (pas complétée), contact (pas ami, pas connexion), réseau (pas groupe, pas forum), parrain / marraine et « Parrainage » seul (pas « Parrainage d'accueil » : il commence avant le départ), entraide (pas support), signaler (pas dénoncer).

---

## 2. Navigation

| Clé | Texte |
|---|---|
| nav.home | Accueil |
| nav.journey | Parcours |
| nav.help | Entraide |
| nav.services | Services |
| nav.agenda | Agenda |
| nav.account | Compte |
| panel.home.feed | Fil d'actualité |
| panel.home.guides | Guides et Démarches |
| panel.home.communities | Réseaux |
| panel.home.cities | Villes et Membres |
| panel.home.journey.create | Créer mon parcours |
| panel.home.journey.continue | Continuer |
| panel.journey.discussion | Discussion |
| panel.journey.team | Équipe |
| panel.journey.checklist | Checklist de documents |
| panel.journey.history | Historique |
| panel.journey.settings | Réglages |
| panel.journey.overview | Vue d'ensemble |
| panel.journey.current | Étape en cours |
| panel.journey.public | Parcours publics |
| panel.journey.reminders | Rappels |
| panel.help.reputation | Ma réputation |
| panel.services.quotas | Mes quotas du mois |
| panel.services.myspace | Mon espace |
| panel.services.propro | Ma fiche pro |
| panel.agenda.calendar | Calendrier |
| panel.agenda.all | Tous |
| panel.agenda.attending | Mes participations |
| panel.agenda.organized | Mes organisations |
| panel.help.all | Toutes les demandes |
| panel.help.mine | Mes demandes |
| panel.help.responses | Mes réponses |
| panel.help.canhelp | Vous pouvez aider |
| panel.help.mentoring | Parrainage |
| panel.home.mentoring | Parrainage |
| panel.services.housing | Annonces logement |
| panel.services.jobs | Bourses et emploi |
| panel.services.pros | Annuaire professionnel |
| panel.services.mylistings | Mes annonces |
| panel.services.alerts | Mes alertes |
| panel.agenda.near | Près de chez moi |
| panel.agenda.mine | Mes participations |
| panel.agenda.organized | Mes organisations |
| panel.agenda.create | Créer un événement |

---

## 3. Onboarding

| Clé | Texte |
|---|---|
| ob.phone.title | Votre numéro de téléphone |
| ob.phone.help | Nous vous envoyons un code par SMS. Votre numéro n'est jamais affiché aux autres membres. |
| ob.phone.country_unsupported | Nous n'ouvrons pas encore dans ce pays. |
| ob.otp.title | Entrez le code reçu |
| ob.otp.invalid | Ce code n'est pas valide. |
| ob.otp.expired | Ce code a expiré. Demandez-en un nouveau. |
| ob.phase.title | Où en êtes-vous ? |
| ob.phase.pre | Je prépare mon départ |
| ob.phase.recent | Je viens d'arriver (moins de 6 mois) |
| ob.phase.settled | Je suis installé·e |
| ob.location.title | D'où venez-vous, et où allez-vous ? |
| ob.location.city_target | Ville où vous comptez vous installer |
| ob.location.city_current | Ville où vous vivez |
| ob.goal.title | Quel est votre objectif ? |
| ob.goal.help | Nous construisons votre parcours à partir de cette réponse. Vous pourrez le modifier à tout moment. |
| ob.goal.studies | Étudier en France |
| ob.goal.work | Travailler en France |
| ob.goal.family | Rejoindre ma famille |
| ob.goal.settle | Régulariser ma situation |
| ob.goal.no_journey | sans créer de parcours |
| ob.goal.integrate | M'intégrer, rencontrer du monde |
| ob.goal.help_others | Aider les autres |
| ob.profile.title | Présentez-vous |
| ob.profile.available | Je suis disponible pour aider |
| ob.skip | Passer cette étape |
| ob.done.journey | Votre parcours est prêt. Première étape : {step}. |
| ob.done.no_journey | Bienvenue à {city}. Voici ce qui se passe près de chez vous. |

---

## 4. Niveaux et permissions

| Clé | Texte |
|---|---|
| level.L0.name | Compte créé |
| level.L1.name | Identité vérifiée |
| level.L2.name | Présence en France vérifiée |
| level.required.L1.title | Cette action demande une identité vérifiée |
| level.required.L1.body | La vérification prend deux minutes et protège tous les membres. Vous aurez besoin d'une pièce d'identité. |
| level.required.L1.cta | Vérifier mon identité |
| level.required.L2.title | Cette action demande un numéro français vérifié |
| level.required.L2.body | Publier un logement ou devenir parrain demande d'être présent en France. Ajoutez votre numéro français. |
| level.required.L2.cta | Ajouter mon numéro français |
| level.L0.compose_hint | Vérifiez votre identité pour publier. Vous pouvez déjà lire, commenter et demander de l'aide. |
| kyc.pending | Vérification en cours |
| kyc.declined | La vérification n'a pas abouti. Vous pourrez réessayer dans 24 heures. |
| kyc.minor | La plateforme est réservée aux personnes majeures. |
| plan.limit.journeys | Vous avez déjà un parcours actif. Le Premium permet d'en suivre plusieurs. |
| plan.limit.events | {used} événement sur {limit} ce mois-ci. Réinitialisé le {date}. |
| plan.limit.pro_contacts | {used} contacts sur {limit} ce mois-ci. |
| plan.limit.cta | Découvrir Premium |

---

## 5. Parcours

| Clé | Texte |
|---|---|
| journey.create.title | Créer un parcours |
| journey.title.placeholder | Donnez un nom à votre parcours |
| journey.status.active | En cours |
| journey.status.paused | En pause |
| journey.status.completed | Abouti |
| journey.status.abandoned | Arrêté |
| journey.progress | {done} / {total} étapes |
| step.status.todo | À faire |
| step.status.in_progress | En cours |
| step.status.done | Franchie |
| step.status.paused | En pause |
| step.done_collapsed | {n} étapes franchies |
| step.due_in | Échéance dans {days} jours |
| step.due_today | Échéance aujourd'hui |
| step.due_passed | Échéance dépassée depuis {days} jours |
| step.deadline_conflict | Cette échéance est trop proche : {prev} prend en général {days} jours. |
| step.members_done | {n} membres de {city} ont franchi cette étape |
| step.risky | Beaucoup de membres ont eu besoin d'aide ici. Voici les guides les plus utiles. |
| step.blocked.button | Je suis bloqué·e |
| blocker.title | Demander de l'aide |
| blocker.help | Relisez et complétez ce texte. Rien n'est publié sans votre accord. |
| blocker.scope.public | Publier dans {section} |
| blocker.scope.private | Envoyer seulement à mon équipe et mon parrain |
| blocker.publish | Publier |
| blocker.cancel | Annuler |
| milestone.share.title | Partager cette victoire ? |
| milestone.share.help | Racontez-la avec vos mots. Cela encourage ceux qui préparent leur départ. |
| milestone.share.inset | Étape franchie · {n} sur {total} |
| milestone.share.later | Plus tard |
| journey.completed.title | Vous y êtes arrivé·e ! |
| journey.completed.body | Aidez le suivant. |
| journey.completed.mentor | Devenir parrain |
| journey.completed.guide | Écrire un guide à partir de mon parcours |
| journey.completed.event | Organiser une rencontre |
| journey.inactive.title | Où en êtes-vous ? |
| journey.inactive.continue | Je continue |
| journey.inactive.paused | J'ai mis en pause |
| journey.inactive.done | J'ai fini |
| journey.inactive.stopped | J'ai arrêté |
| journey.public.title | Parcours publics |
| journey.visibility.private | Privé — vous seul·e |
| journey.visibility.shared | Partagé — vous et vos invités |
| journey.visibility.public | Public — les membres connectés voient votre progression |
| journey.public.explain | Ils verront vos étapes franchies et leur durée. Jamais vos notes, vos documents, votre équipe ni votre discussion. Un parcours en pause n'est jamais affiché. |
| journey.public.propose | Rendre mon parcours public ? Cela encourage ceux qui suivent le même chemin. |
| journey.team.observer | Observateur — voit la progression |
| journey.team.supporter | Accompagnant — peut échanger et recevoir vos demandes privées |
| checklist.help | Cochez ce que vous avez réuni. Les documents restent chez vous. |

---

## 6. Fil, entraide, réactions

| Clé | Texte |
|---|---|
| post.type.victory | Victoire |
| post.type.question | Question |
| post.type.info | Info |
| post.type.discussion | Discussion |
| post.composer.placeholder | Un conseil, une question, une bonne nouvelle ? |
| post.reaction.victory | Bravo |
| post.reaction.question | Soutenir |
| post.reaction.other | J'aime |
| post.count.victory | {n} félicitations |
| post.count.question | {n} réponses |
| post.count.other | {n} réactions |
| post.context | {journeyType} · {city} · {ago} |
| post.move_to_topic | Cette question intéresse du monde. La déplacer vers un réseau pour qu'elle reste trouvable ? |
| story.strip.title | Stories du jour |
| story.strip.create | Créer une story |
| story.type.conseil | Conseil |
| story.type.decouverte | Découverte |
| story.type.information | Information |
| story.react.useful | Utile |
| story.react.not_useful | Pas utile |
| story.react.want_to_go | À voir |
| story.react.been_there | J'y suis allé·e |
| story.react.confirm | Je confirme |
| story.react.changed | Ça a changé |
| story.state.conseil | {rank} des conseils {topic} aujourd'hui · {n} trouvent utile |
| story.state.decouverte | Ajoutée aux {section} de la fiche {city} · {n} veulent y aller |
| story.state.information | {n} membres confirment · dans Guichets du jour |
| story.expires | expire dans {hours} h |
| story.valid_until | valable jusqu'à {date} |
| story.write_to | Écrire à {name}… |
| story.create.step1 | Écrire |
| story.create.step2 | Ce {type} concerne… |
| story.create.step3 | Prêt à publier |
| story.create.attach_help | Il sera montré d'abord aux membres sur cette étape. |
| story.create.audience_all | Tous les membres |
| story.create.audience_city | {city} seulement |
| story.create.allow_messages | Autoriser les messages |
| story.create.no_links | Pas de lien, de numéro ni de montant précis : ce genre d'information périme trop vite. Les guides sont là pour ça. |
| story.create.publish | Publier — visible 24 h |
| story.keep | Garder en demande d'entraide |
| story.keep_tip | Garder dans la fiche ville |
| bookmark.save | Enregistrer |
| bookmark.saved | Enregistré |
| bookmark.prompt | Enregistrer pour plus tard ? |
| bookmark.page | Enregistrés |
| bookmark.state.expired | Expiré, gardé pour vous |
| bookmark.state.resolved | Résolue |
| bookmark.state.past | Passé |
| bookmark.state.unavailable | Plus disponible |
| bookmark.state.updated | Mis à jour le {date} |
| bookmark.state.removed | Contenu retiré |
| feed.share_milestone | Partager un jalon |
| feed.empty | Rien encore à {city}. Soyez la première personne à publier. |
| help.kind.request | Demande |
| help.kind.offer | Offre |
| help.type.paperwork | Démarches |
| help.type.service | Service |
| help.type.ride | Trajet |
| help.type.material | Matériel |
| help.type.other | Autre |
| help.status.open | Ouverte |
| help.status.resolved | Résolue |
| help.from_journey | Depuis un parcours |
| help.rule | Aucun versement entre membres pour une démarche administrative. Si on vous demande de l'argent, signalez. |
| help.use_services | Pour un logement ou un emploi, utilisez Services. |
| help.helpful | Ça m'a aidé |
| help.resolved_inset | {name} a été marqué·e « ça m'a aidé » — contact créé |
| help.counts | {open} ouvertes à {city} · {resolved} résolues ce mois-ci |
| help.canhelp.title | Vous pouvez aider |
| help.canhelp.reason | Vous avez franchi l'étape « {step} ». {n} demandes ouvertes portent dessus. |

---

## 7. Guides

| Clé | Texte |
|---|---|
| guide.updated | Mis à jour le {date} |
| guide.vote.question | Ce guide vous a-t-il aidé ? |
| guide.vote.yes | Oui |
| guide.vote.no | Non |
| guide.propose | Proposer une correction |
| guide.outdated | L'information a changé |
| guide.banner.review | À vérifier — dernière mise à jour il y a {months} mois |
| guide.banner.flagged | Des membres signalent que cette information a changé. |
| guide.banner.community | Maintenu par la communauté |
| guide.proposal.reason | Pourquoi cette correction ? |
| guide.proposal.sent | Merci. L'auteur a 14 jours pour répondre. |
| guide.proposal.accept | Accepter |
| guide.proposal.amend | Accepter en modifiant |
| guide.proposal.reject | Refuser |
| guide.tabs.helpful | Les plus utiles |
| guide.tabs.recent | Récents |
| guide.tabs.review | À vérifier |

---

## 8. Parrainage, contacts, messages

| Clé | Texte |
|---|---|
| mentor.available | Disponible |
| mentor.full | Complet |
| mentor.request.message | Présentez-vous et dites ce que vous attendez |
| mentor.request.sent | Demande envoyée. {name} a 7 jours pour répondre. |
| mentor.rule | Un parrainage n'implique jamais d'argent ni de garantie. |
| mentor.ended | Ce parrainage est terminé. Merci à vous deux. |
| mentor.review.title | Comment s'est passé ce parrainage ? |
| contact.request.message | Pourquoi souhaitez-vous ce contact ? |
| contact.mutual | Connecté·e à {n} de vos contacts |
| contact.suggest.event | Vous étiez à la même rencontre. Ajouter {name} à vos contacts ? |
| block.confirm | Vous ne verrez plus cette personne, et elle ne vous verra plus. Elle n'en sera pas informée. |
| message.pending | Premier message envoyé. Vous pourrez continuer quand {name} aura répondu. |
| message.deleted | Message supprimé |
| message.new_push | Nouveau message de {name} |

---

## 9. Services

| Clé | Texte |
|---|---|
| housing.banner | Aucun versement avant visite ou vérification. Si une annonce demande un acompte à distance, signalez-la. |
| housing.publish.locked | Publier un logement demande un numéro français vérifié — c'est ce qui protège tout le monde des fausses annonces. |
| housing.under_review | Votre annonce est en vérification. Vous serez prévenu·e. |
| housing.contact.L0 | Pour contacter cette personne, demandez d'abord un parrain : il vous accompagnera. |
| housing.caution_strong | Soyez particulièrement prudent·e avec cette annonce. |
| job.shared_by | Partagée par {name} |
| job.sponsored | Sponsorisée |
| pro.featured | Fiche mise en avant |
| pro.recommend.requires_contact | Vous pouvez recommander un professionnel avec qui vous avez déjà interagi sur la plateforme. |
| pro.register.title | Vous exercez un métier ? |
| pro.register.proof | Un justificatif d'activité est demandé. Il n'est jamais affiché. |
| pro.pending | Fiche en attente de validation |
| alert.premium | Les alertes sont réservées aux membres Premium. |

---

## 10. Sécurité, modération, compte

| Clé | Texte |
|---|---|
| report.title | Signaler |
| report.reason.scam | Arnaque |
| report.reason.money | Demande d'argent |
| report.reason.harassment | Harcèlement |
| report.reason.spam | Indésirable |
| report.reason.inappropriate | Inapproprié |
| report.reason.other | Autre |
| report.message_notice | La conversation sera visible des modérateurs. |
| report.sent | Merci. Nous regardons sous 24 heures. |
| report.closed | Merci, nous avons traité votre signalement. |
| content.hidden.author | Ce contenu est en vérification. |
| content.removed | Ce contenu a été retiré. Raison : {reason}. |
| sanction.warning | Avertissement : {rule}. |
| sanction.suspended | Votre compte est suspendu jusqu'au {date}. Raison : {reason}. |
| sanction.appeal | Contester |
| scam.title | Alerte vigilance |
| resources.selfharm | Si vous traversez un moment difficile, des personnes peuvent vous écouter. |
| account.deactivate.confirm | Votre profil sera masqué. Vous pourrez revenir pendant 6 mois en vous connectant. |
| account.delete.title | Supprimer mon compte |
| account.delete.lose | Seront supprimés : votre profil, vos parcours, vos annonces, vos messages. |
| account.delete.keep | Seront conservés, sans votre nom : vos guides et vos réponses qui ont aidé d'autres membres. |
| account.delete.delay | Vous avez 7 jours pour changer d'avis en vous reconnectant. |
| account.export | Télécharger mes données |
| session.new_device | Nouvelle connexion depuis {device}. Ce n'était pas vous ? Révoquez cette session. |

---

## 11. Emails et SMS

| Clé | Objet / texte |
|---|---|
| sms.otp | {code} est votre code afroexpates. Il expire dans 10 minutes. |
| email.welcome.subject | Bienvenue sur afroexpates |
| email.deadline.subject | Demain : {step} |
| email.mentor_request.subject | {name} vous demande comme parrain |
| email.proposal.subject | Une correction proposée sur votre guide « {title} » |
| email.digest.subject | Votre semaine à {city} |
| email.security.subject | Nouvelle connexion à votre compte |
| email.deletion.subject | Votre demande de suppression |
| email.invoice.subject | Votre facture afroexpates {number} |
| email.footer.unsubscribe | Se désabonner de ces emails |

Aucun email pour les réactions, commentaires ou suggestions de contact.

---

## 12. États vides et erreurs génériques

| Clé | Texte |
|---|---|
| empty.generic | Rien ici pour le moment. |
| empty.search | Aucun résultat. Posez la question à la communauté ? |
| empty.search.cta | Poser la question |
| error.generic | Quelque chose n'a pas fonctionné. Réessayez. |
| error.offline | Vous êtes hors ligne. |
| error.rate | Trop de demandes. Patientez un instant. |
| action.retry | Réessayer |
| action.loadmore | Charger plus |
| action.cancel | Annuler |
| action.save | Enregistrer |
| action.publish | Publier |
| action.delete | Supprimer |
