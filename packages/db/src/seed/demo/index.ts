import type { PrismaClient } from '../../../generated/client/index.js';
import { genererActivite } from './activite.js';
import { genererEntraide } from './entraide.js';
import { genererEvenements } from './evenements.js';
import { genererFil } from './fil.js';
import { genererGuides } from './guides.js';
import { genererMembres } from './membres.js';
import { genererParcours } from './parcours.js';
import { creerRng } from './prng.js';
import { purgerDemo, type RapportPurge } from './purge.js';
import { indexerRecherche } from './recherche.js';
import { genererReseaux } from './reseaux.js';
import { genererRelations } from './messagerie.js';
import { cleDepuisEnv } from './scellement.js';
import { genererServices } from './services.js';
import type { Contexte } from './types.js';

/**
 * LE GÉNÉRATEUR DE DONNÉES DE DÉPART (« démo ») — ~120 membres répartis dans huit villes ouvertes, et un contenu pour
 * CHAQUE fonctionnalité du produit : guides, entraide, événements, fil et stories, réseaux, parcours, logements,
 * emplois, professionnels, relations, parrainages, messagerie, modération, notifications.
 *
 * ── CE QUI LE RAND SÛR ─────────────────────────────────────────────────────
 *
 *   · UNE SEULE TRANSACTION : tout est écrit, ou rien. Un échec au milieu ne laisse pas une base à moitié peuplée ;
 *   · DÉTERMINISTE : le même `graine` donne les mêmes textes, les mêmes répartitions (les dates suivent l'instant du
 *     lancement) ;
 *   · MARQUÉ : chaque compte porte `origin = SEED`, et tout contenu est écrit par un de ces comptes. L'administration
 *     les filtre (« Auteur de départ ») et les supprime en lot avec leurs contenus ; `purgerDemo` fait la même chose
 *     d'un coup ;
 *   · INCONNECTABLE : aucun compte n'a de numéro de téléphone, donc personne ne peut ouvrir une session dessus ;
 *   · NON ÉTIQUETÉ : aucun libellé « exemple » ni « démo » dans les contenus — ils se lisent comme de vrais contenus.
 */

export interface OptionsGeneration {
  readonly graine?: number;
  /** Écrit tout, affiche le rapport, puis ANNULE la transaction. */
  readonly simulation?: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly log: (ligne: string) => void;
}

export interface RapportGeneration {
  readonly apercu: boolean;
  readonly compte: Readonly<Record<string, number>>;
}

class AnnulationApercu extends Error {
  constructor(readonly compte: Record<string, number>) {
    super('aperçu : transaction annulée');
  }
}

export const GRAINE_PAR_DEFAUT = 20_261_106;

export async function genererDemo(prisma: PrismaClient, options: OptionsGeneration): Promise<RapportGeneration> {
  const { log } = options;
  const deja = await prisma.user.count({ where: { origin: 'SEED' } });
  if (deja > 0) {
    throw new Error(
      `${deja} compte(s) de départ existent déjà : une seconde génération doublerait les contenus. ` +
        'Purgez d’abord (« pnpm --filter @app/db seed:demo --purge ») ou supprimez-les depuis l’administration.',
    );
  }
  const cleContenu = cleDepuisEnv(options.env);
  const now = new Date();
  const apercu = options.simulation === true;

  try {
    const compte = await prisma.$transaction(
      async (tx) => {
        const c: Contexte = {
          tx,
          rng: creerRng(options.graine ?? GRAINE_PAR_DEFAUT),
          now,
          log,
          cleContenu,
          membres: [],
          villes: [],
          compte: {},
          aIndexer: [],
        };
        log('Génération des données de départ :');
        await genererMembres(c);
        await genererReseaux(c);
        await genererGuides(c);
        await genererEntraide(c);
        await genererEvenements(c);
        await genererFil(c);
        await genererParcours(c);
        await genererServices(c);
        await genererRelations(c);
        await genererActivite(c);
        await indexerRecherche(c);
        if (apercu) throw new AnnulationApercu(c.compte);
        return c.compte;
      },
      { timeout: 15 * 60_000, maxWait: 30_000 },
    );
    return { apercu: false, compte };
  } catch (erreur) {
    if (erreur instanceof AnnulationApercu) return { apercu: true, compte: erreur.compte };
    throw erreur;
  }
}

export async function purgerDonneesDeDepart(prisma: PrismaClient, options: { readonly fermerVilles?: boolean; readonly simulation?: boolean }): Promise<RapportPurge & { readonly apercu: boolean }> {
  class Apercu extends Error {
    constructor(readonly rapport: RapportPurge) {
      super('aperçu');
    }
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const rapport = await purgerDemo(tx, options.fermerVilles === undefined ? {} : { fermerVilles: options.fermerVilles });
        if (options.simulation === true) throw new Apercu(rapport);
        return { ...rapport, apercu: false };
      },
      { timeout: 15 * 60_000, maxWait: 30_000 },
    );
  } catch (erreur) {
    if (erreur instanceof Apercu) return { ...erreur.rapport, apercu: true };
    throw erreur;
  }
}

export { purgerDemo } from './purge.js';
