import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile(resolve(__dirname, '..', '..', '.env'));
} catch {
  /* en CI les variables sont déjà là */
}

export default defineConfig({
  // SWC, et non esbuild : NestJS résout l'injection de dépendances via les
  // métadonnées de décorateur (`design:paramtypes`), qu'esbuild n'émet pas.
  // Sans cela, les services arrivent `undefined` dans les contrôleurs — sans
  // erreur au démarrage, ce qui rend le symptôme difficile à relier à sa cause.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.int.test.ts'],
    environment: 'node',
    pool: 'forks',

    /**
     * UN SEUL fichier à la fois. Ces tests partagent une base de données.
     *
     * Deux défauts distincts l'imposent, et tous deux se présentent comme des
     * échecs de tests innocents :
     *
     *   · **saturation des connexions.** Chaque fichier tourne dans son propre
     *     processus et y construit son `PrismaService`, donc son bassin — une
     *     vingtaine de connexions. PostgreSQL en accepte cent. Au-delà de quatre
     *     ou cinq fichiers simultanés, les suivants attendent une connexion qui
     *     ne vient pas, et des tests sans rapport expirent à soixante secondes,
     *     chacun dans un fichier différent, comme s'ils étaient lents.
     *
     *   · **interférence de données.** Plusieurs requêtes sont GLOBALES par
     *     nature : la liste des « nouveaux arrivants » d'une ville, la boîte
     *     d'envoi, la découverte des réseaux. Les membres qu'un fichier crée
     *     apparaissent dans les résultats d'un autre. Un test qui compte ce qu'il
     *     voit échoue alors sans que rien ne soit cassé.
     *
     * Le coût est du temps de mur, et il est assumé : un échec que l'on doit
     * rejouer pour savoir s'il est réel coûte bien plus cher.
     *
     * Pour paralléliser un jour, la voie est UNE BASE PAR FICHIER — pas des
     * assertions plus lâches, qui reviendraient à tester moins.
     */
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    /**
     * Soixante secondes par test.
     *
     * La transcompilation de vitest est comptée dans la durée du test qui
     * déclenche l'import, et elle varie de moins d'une seconde à plus d'une
     * minute selon la charge. Un délai serré fait alors échouer un test qui n'a
     * rien fait de mal — et le symptôme trompe, puisqu'un test DIFFÉRENT échoue à
     * chaque exécution.
     *
     * Corollaire pour qui écrit un test : **pas d'`await import()` DANS un test.**
     * Trois fichiers en portaient, et la transcompilation de `@app/shared` leur
     * était imputée. Remontés en import statique, le coût retombe dans la phase
     * de collecte, où il est commun à tout le fichier.
     */
    testTimeout: 150_000,
    hookTimeout: 150_000,

    /**
     * ISOLATION par fichier, explicitement.
     *
     * Les fichiers réutilisaient le même processus — `prepare` tombait de 62 s à
     * 2,6 s d'une exécution à l'autre, ce qui le trahissait. Un processus réutilisé
     * garde le tas et les modules chargés du fichier précédent, et la
     * transcompilation d'un nouveau module s'y ajoute en pleine exécution d'un
     * test.
     *
     * Le symptôme était déroutant : un test DIFFÉRENT bloquait à chaque
     * exécution, sans aucune activité en base et sans verrou — j'ai vérifié
     * `pg_stat_activity` pendant les blocages. Aucun défaut du produit ; tout
     * passe quand on lance les fichiers un par un.
     */
    isolate: true,
  },
});
