import type { ReactNode } from 'react';
import { cn } from '../cn.js';
import { Button } from '../primitives/primitives.js';

/**
 * États obligatoires — T1 §5.
 *
 * TOUT écran de liste ou de détail implémente : chargement, vide, erreur, succès,
 * permission insuffisante, hors ligne. Ce sont des composants, définis une fois :
 * les réinventer par écran est la première source de dérive sur douze lots.
 *
 * Portés depuis les helpers `skel`, `emptyS`, `errS`, `permS` du design.
 */

/** Chargement : squelettes, JAMAIS de roue qui tourne au centre (T1 §5). */
export function Skeleton({ lines = 3, className }: { readonly lines?: number; readonly className?: string }) {
  const widths = ['70%', '45%', '60%', '52%', '38%'];
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-busy aria-live="polite">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="rounded-full bg-control"
          style={{ height: i === 0 ? 12 : 10, width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

/**
 * Vide : un message et une action. Illustration typographique, jamais une image
 * générique — et surtout pas d'illustration générique de « diversité » (T1 §6).
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  return (
    <div className="py-6 text-center">
      <p className="text-body font-bold">{title}</p>
      {description !== undefined ? (
        <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] leading-normal text-text-muted">
          {description}
        </p>
      ) : null}
      {actionLabel !== undefined ? (
        <div className="mt-3 inline-flex">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}

/** Erreur : un message et un vrai bouton de reprise. Neutre, sans rouge. */
export function ErrorState({
  message = 'Impossible de charger.',
  onRetry,
}: {
  readonly message?: string;
  readonly onRetry?: () => void;
}) {
  return (
    <div className="rounded-md bg-control-alt p-3 text-[12.5px]" role="alert">
      {message}{' '}
      <button type="button" onClick={onRetry} className="font-bold text-primary underline">
        Réessayer
      </button>
    </div>
  );
}

/**
 * Permission insuffisante — JAMAIS une simple erreur (§7.3).
 *
 * Quand une capacité manque, l'API renvoie 403 LEVEL_REQUIRED avec le niveau requis :
 * le front affiche alors une invitation à monter de niveau. C'est un moment de
 * conversion, pas un mur.
 */
export function LevelUpPrompt({
  capabilityLabel,
  requiredLevel,
  onAction,
}: {
  /** Le libellé français de la capacité, tel que le renvoie l'API. */
  readonly capabilityLabel: string;
  readonly requiredLevel: 'L1' | 'L2';
  readonly onAction?: () => void;
}) {
  const explanation =
    requiredLevel === 'L1'
      ? 'Vérifiez votre identité pour ' + capabilityLabel + '.'
      : 'Ajoutez un numéro de votre pays d’installation pour ' + capabilityLabel + '.';
  const action = requiredLevel === 'L1' ? 'Vérifier mon identité' : 'Ajouter mon numéro';

  return (
    <div className="rounded-lg bg-primary-soft p-3">
      <p className="text-[13px] font-bold text-primary-strong">{explanation}</p>
      <div className="mt-2 inline-flex">
        <Button onClick={onAction}>{action}</Button>
      </div>
    </div>
  );
}

/**
 * Limite de plan atteinte. Distincte du niveau : ici le membre a le droit, mais a
 * épuisé son quota gratuit. Jamais employé sur l'entraide, les guides, le
 * parrainage ni les réseaux — ils ne sont jamais payants (règle dure 14 §2).
 */
export function PlanLimitPrompt({
  message,
  onAction,
}: {
  readonly message: string;
  readonly onAction?: () => void;
}) {
  return (
    <div className="rounded-lg bg-journey-soft p-3">
      <p className="text-[13px] font-bold text-journey-strong">{message}</p>
      <div className="mt-2 inline-flex">
        <Button variant="journey" onClick={onAction}>
          Découvrir Premium
        </Button>
      </div>
    </div>
  );
}

/** Hors ligne : bandeau, et contenu en cache si disponible (T1 §5). */
export function OfflineBanner() {
  return (
    <div className="rounded-lg bg-control-alt px-3 py-2 text-[12.5px] text-text-muted" role="status">
      Vous êtes hors ligne. Les contenus déjà chargés restent consultables.
    </div>
  );
}

/**
 * Bandeau de sécurité permanent. Terre cuite doux — usage autorisé (T1 §2.1).
 *
 * RÈGLE DURE (06 §2, 10 §2) : présent en permanence sur chaque page d'entraide et
 * chaque liste ou annonce de logement. Le texte vient de l'API, pas du front :
 * l'équipe doit pouvoir le changer sans déploiement.
 */
export function SafetyBanner({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-journey-soft px-[14px] py-3" role="note">
      <p className="text-[12.5px] font-semibold leading-normal text-journey-strong">{children}</p>
    </div>
  );
}
