import type { SVGProps } from 'react';
import { ICON_PATHS, type IconName } from './paths.js';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> {
  readonly name: IconName;
  /** Taille en pixels. Les maquettes emploient 17 à 22 px (T1 §2.4). */
  readonly size?: number;
  /** Épaisseur du tracé. 1,7 px par défaut, 2 px pour les chevrons et les croix. */
  readonly strokeWidth?: number;
  /**
   * Nom accessible. Une icône purement décorative le laisse vide : elle est alors
   * masquée aux lecteurs d'écran, et c'est le texte voisin qui porte le sens (§10.6).
   */
  readonly label?: string;
}

/**
 * Icône du jeu porté depuis le design (`ICON_PATHS`).
 *
 * §10.6 : tout élément interactif porte un nom accessible. Une icône seule dans un
 * bouton doit donc recevoir `label`, sinon le bouton est muet au lecteur d'écran.
 */
export function Icon({ name, size = 17, strokeWidth = 1.7, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : 'img'}
      {...rest}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/**
 * Coche de vérification. Pleine, jamais en tracé — c'est le seul signe de confiance
 * de la plateforme, et il doit se lire à 13 px.
 *
 * RÈGLE DURE (§1.2) : le mot « certifié » n'apparaît nulle part. Cette coche dit
 * « identité vérifiée », pas « dossier vérifié » : la plateforme ne vérifie aucun
 * dossier administratif.
 */
export function VerifiedBadge({ size = 13, level }: { size?: number; level?: 'L1' | 'L2' }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[2px]"
      role="img"
      aria-label={level === 'L2' ? 'Identité vérifiée et présence confirmée' : 'Identité vérifiée'}
      title={level === 'L2' ? 'Identité vérifiée et présence confirmée' : 'Identité vérifiée'}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-primary">
        <circle cx="12" cy="12" r="10" />
        <path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" />
      </svg>
      {/* L2 ajoute un point : présence sur le territoire, pas un niveau de confiance supérieur. */}
      {level === 'L2' ? (
        <span className="h-[4px] w-[4px] rounded-full bg-primary-alt" aria-hidden />
      ) : null}
    </span>
  );
}
