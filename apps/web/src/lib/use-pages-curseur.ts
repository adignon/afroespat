'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « PAGE SUIVANTE » : SUIVRE `nextCursor` SANS REFAIRE LE FIL                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le serveur plafonne chaque liste à 20 éléments (`DEFAULT_PAGE_LIMIT`) et rend
 * `{ items, nextCursor }`. Presque aucun écran ne suivait `nextCursor` : au-delà
 * de la vingtième ligne, le membre ne voyait RIEN et n'avait aucun moyen de le
 * savoir. Ce module est la brique commune.
 *
 * ── DEUX COUCHES ──────────────────────────────────────────────────────────
 *
 * `SuiteCurseur` est une classe sans React : une requête à la fois, annulable,
 * qui rend la page à un rappel. Elle se teste sans navigateur (fusion des pages,
 * arrêt en fin de liste, annulation quand le filtre change).
 * `useSuiteCurseur` n'est que son habillage.
 *
 * ── CE QUE LE MODULE NE POSSÈDE PAS ───────────────────────────────────────
 *
 * La LISTE reste à l'écran qui l'a chargée : elle porte déjà des mises à jour
 * optimistes (réaction, signet, suppression). Le module ne garde ni éléments ni
 * curseur ; l'écran lui passe le curseur courant et fusionne la page reçue avec
 * `fusionner`, qui dédoublonne — un élément publié entre deux pages décale le
 * curseur du serveur, et sans cela il apparaîtrait deux fois.
 */

export interface PageSuivante<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total?: number | null;
}

/** Ajoute les éléments nouveaux à la suite ; un identifiant déjà présent n'est pas répété. */
export function fusionner<T>(
  actuels: readonly T[],
  nouveaux: readonly T[],
  identifiant: (element: T) => string,
): T[] {
  const vus = new Set(actuels.map(identifiant));
  const suite: T[] = [];
  for (const element of nouveaux) {
    const id = identifiant(element);
    if (vus.has(id)) continue;
    vus.add(id);
    suite.push(element);
  }
  return [...actuels, ...suite];
}

/** « 20 sur 134 » quand le total est connu et plus grand que ce qui est affiché ; sinon rien. */
export function resumeListe(affiches: number, total: number | null | undefined): string | null {
  if (total === null || total === undefined || !Number.isFinite(total)) return null;
  if (total <= affiches) return null;
  return `${String(affiches)} sur ${String(total)}`;
}

export interface EtatSuite {
  readonly chargement: boolean;
  /** L'erreur brute de la dernière tentative ; `null` si elle a réussi ou n'a pas eu lieu. */
  readonly echec: unknown;
  readonly aEchoue: boolean;
}

const ETAT_REPOS: EtatSuite = { chargement: false, echec: null, aEchoue: false };

export class SuiteCurseur<T> {
  private etatCourant: EtatSuite = ETAT_REPOS;
  private controleur: AbortController | null = null;
  private generation = 0;
  private dernierCurseur: string | null = null;
  private readonly abonnes = new Set<() => void>();

  constructor(
    private readonly charger: (curseur: string, signal: AbortSignal) => Promise<PageSuivante<T>>,
    private readonly surPage: (page: PageSuivante<T>) => void,
  ) {}

  get etat(): EtatSuite {
    return this.etatCourant;
  }

  abonner(rappel: () => void): () => void {
    this.abonnes.add(rappel);
    return () => {
      this.abonnes.delete(rappel);
    };
  }

  private poser(etat: EtatSuite): void {
    this.etatCourant = etat;
    this.abonnes.forEach((a) => {
      a();
    });
  }

  /**
   * Charge la page qui suit `curseur`. Sans effet si une requête est déjà en vol
   * (le double clic, la sentinelle qui se redéclenche) ou si `curseur` est nul
   * (fin de liste : on ne boucle pas).
   */
  async lancer(curseur: string | null): Promise<void> {
    if (curseur === null || this.etatCourant.chargement) return;
    this.dernierCurseur = curseur;
    const generation = ++this.generation;
    const controleur = new AbortController();
    this.controleur = controleur;
    this.poser({ chargement: true, echec: null, aEchoue: false });
    try {
      const page = await this.charger(curseur, controleur.signal);
      if (generation !== this.generation || controleur.signal.aborted) return;
      this.surPage(page);
      this.poser(ETAT_REPOS);
    } catch (error) {
      if (generation !== this.generation || controleur.signal.aborted) return;
      this.poser({ chargement: false, echec: error, aEchoue: true });
    }
  }

  /** Rejoue la dernière page demandée, après un échec. */
  async reessayer(): Promise<void> {
    await this.lancer(this.dernierCurseur);
  }

  /** Abandonne la requête en vol : sa réponse, si elle arrive, est ignorée. */
  annuler(): void {
    this.generation += 1;
    this.controleur?.abort();
    this.controleur = null;
    if (this.etatCourant.chargement || this.etatCourant.aEchoue) this.poser(ETAT_REPOS);
  }
}

export interface OptionsSuite<T> {
  /** Le curseur de la dernière page reçue ; `null` quand la liste est finie. */
  readonly curseur: string | null;
  /** Change avec le filtre : la requête en vol est alors abandonnée et l'état remis à zéro. */
  readonly cle: string;
  readonly charger: (curseur: string, signal: AbortSignal) => Promise<PageSuivante<T>>;
  readonly surPage: (page: PageSuivante<T>) => void;
}

export interface SuiteVue {
  readonly chargement: boolean;
  readonly echec: unknown;
  readonly aEchoue: boolean;
  readonly suivante: () => void;
  readonly reessayer: () => void;
}

export function useSuiteCurseur<T>(options: OptionsSuite<T>): SuiteVue {
  const { curseur, cle } = options;
  const dernier = useRef(options);
  dernier.current = options;
  const [, forcer] = useState(0);
  const suite = useRef<{ cle: string; suite: SuiteCurseur<T> } | null>(null);

  if (suite.current === null || suite.current.cle !== cle) {
    suite.current?.suite.annuler();
    suite.current = {
      cle,
      suite: new SuiteCurseur<T>(
        (c, signal) => dernier.current.charger(c, signal),
        (page) => {
          dernier.current.surPage(page);
        },
      ),
    };
  }
  const courante = suite.current.suite;

  useEffect(() => {
    const desabonner = courante.abonner(() => {
      forcer((n) => n + 1);
    });
    return () => {
      desabonner();
      courante.annuler();
    };
  }, [courante]);

  const suivante = useCallback((): void => {
    void courante.lancer(curseur);
  }, [courante, curseur]);
  const reessayer = useCallback((): void => {
    void courante.reessayer();
  }, [courante]);

  return {
    chargement: courante.etat.chargement,
    echec: courante.etat.echec,
    aEchoue: courante.etat.aEchoue,
    suivante,
    reessayer,
  };
}
