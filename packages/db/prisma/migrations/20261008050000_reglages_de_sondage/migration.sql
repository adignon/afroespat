-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ LES DEUX INTERRUPTEURS DU SONDAGE DEVIENNENT DE VRAIS RÉGLAGES          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- La maquette dessine trois interrupteurs sous un sondage. Un seul était porté
-- par la base (`is_multiple`) ; les deux autres décrivaient des règles que le
-- produit imposait à tout le monde, et je les avais rendus inertes en le disant.
-- Le porteur a tranché : « non, fais de ça un réglage. »
--
-- ── LES DÉFAUTS NE CHANGENT RIEN À CE QUI EXISTE ──────────────────────────
--
-- `true` des deux côtés, c'est-à-dire EXACTEMENT le comportement d'avant :
-- résultats masqués avant le vote, et aucun nom de votant rendu. Les sondages
-- déjà créés — et le code qui ne passe pas ces champs — gardent donc leur
-- comportement au bit près. Une migration qui changerait le sens d'une donnée
-- existante serait une migration destructrice sous un autre nom.
--
-- Aucun `DROP`, aucune colonne retirée, aucune ligne touchée.

-- Vrai = les comptes restent masqués tant qu'on n'a pas voté et que le sondage
-- n'est pas clos (§2.3, l'ancienne règle). Faux = visibles tout de suite.
ALTER TABLE "polls"
  ADD COLUMN "results_after_vote" BOOLEAN NOT NULL DEFAULT true;

-- Vrai = seuls les totaux sortent de l'API. Faux = la réponse nomme les votants.
--
-- LE DÉFAUT EST LE SILENCE, et c'est le seul défaut acceptable pour une colonne
-- de confidentialité : un sondage créé sans rien dire ne nomme personne.
ALTER TABLE "polls"
  ADD COLUMN "is_anonymous" BOOLEAN NOT NULL DEFAULT true;
