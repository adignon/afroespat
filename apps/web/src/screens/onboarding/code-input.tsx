'use client';

import { useEffect, useRef } from 'react';

/**
 * Le champ qui reçoit le code à six chiffres — écran P02.
 *
 * UN SEUL champ, visuellement masqué, derrière les six cases que la maquette
 * dessine. Six champs séparés paraissent plus fidèles à l'image, mais ils
 * cassent les deux choses dont un membre a réellement besoin ici : coller le
 * code, et le laisser remplir automatiquement depuis le SMS reçu.
 *
 * `autoComplete="one-time-code"` est ce qui déclenche cette proposition sur iOS
 * et Android. Sans lui, le membre doit basculer vers ses messages, retenir six
 * chiffres, revenir — et c'est le moment où l'on perd des inscriptions.
 *
 * Masqué, pas absent : le champ garde une taille et reste focalisable. Un
 * `display: none` le retirerait du parcours de tabulation et de la mémoire du
 * navigateur, donc de l'autoremplissage.
 */
export function CodeInput({
  value,
  onChange,
  disabled,
}: {
  readonly value: string;
  readonly onChange: (event: { target: { value: string } }) => void;
  readonly disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // Le curseur est déjà dans le champ à l'arrivée : c'est le seul geste attendu
  // sur cet écran, et le demander serait une étape de plus.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      disabled={disabled}
      onChange={onChange}
      aria-label="Code à six chiffres reçu par SMS"
      style={{
        position: 'absolute',
        // Une seule ligne de pixel, opaque à zéro : assez pour rester un champ
        // aux yeux du navigateur, invisible aux yeux du membre.
        width: '1px',
        height: '1px',
        opacity: 0,
        border: 'none',
        padding: 0,
        margin: 0,
      }}
    />
  );
}
