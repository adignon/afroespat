import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Fusionne les classes Tailwind : la dernière gagne sur un même axe. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
