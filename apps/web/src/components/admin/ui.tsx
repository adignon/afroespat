'use client';

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { displayMessageFor } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LES PIÈCES COMMUNES DES ÉCRANS D'ÉQUIPE (D03 À D16)                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette `10 Administration` ne dessine que les écrans, pas leurs états ni leurs
 * éditeurs. Ces pièces en reprennent le langage — chaque valeur est RELEVÉE dans les
 * `.generated.tsx` voisins (`screens/d0x`), aucune n'est inventée :
 *
 *   · carte : fond `#fff`, trait `1px solid #E6EBE9`, rayon 22 ;
 *   · étiquette de section : 11 px / 700 / interlettrage 1 px, `#8A958F` ;
 *   · champ : `minHeight: 48`, rayon 14, trait `1px solid #E6EBE9` (`1.5px #16785E` au
 *     focus, comme la maquette peint son champ actif), retrait `13px 14px`, 14 px ;
 *   · bouton principal : `#16785E` / blanc ; secondaire : `#EEF2F0` / `#16211D` ;
 *     sombre : `#16211D` / blanc — 44 px, rayon 14, 13,5 px / 700 ;
 *   · onglets : bande `#EEF2F0`, rayon 14, retrait 4, onglet actif blanc ;
 *   · pastilles : 11 px / 700, rayon 999, retrait `4px 10px` ;
 *   · avertissement : `#FBE3D4` / `#B4581F` ; confirmation : `#E3F0EB` / `#0F5C48`.
 *
 * AUCUNE COULEUR NOUVELLE, AUCUN ROUGE, AUCUNE OMBRE (T1 §2.3).
 */

export const C = {
  encre: '#16211D',
  gris: '#5D6B66',
  grisClair: '#8A958F',
  trait: '#E6EBE9',
  traitLeger: '#F0F3F2',
  fond: '#F6F8F7',
  aplat: '#EEF2F0',
  vert: '#16785E',
  vertFonce: '#0F5C48',
  vertPale: '#E3F0EB',
  terre: '#B4581F',
  terrePale: '#FBE3D4',
} as const;

export const carteStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${C.trait}`,
  borderRadius: '22px',
  padding: '18px',
  minWidth: 0,
};

export function Carte({ children, style, className }: { readonly children: ReactNode; readonly style?: CSSProperties; readonly className?: string }) {
  return (
    <div className={className} style={{ ...carteStyle, ...style }}>
      {children}
    </div>
  );
}

export function Etiquette({ children }: { readonly children: ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: C.grisClair, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

/** L'en-tête de page : le titre à 28 px (celui que la maquette écrit) et son sous-titre. */
export function Titre({
  titre,
  sous,
  action,
}: {
  readonly titre: string;
  readonly sous?: string | undefined;
  readonly action?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.9px' }}>{titre}</h1>
        {sous === undefined ? null : <div style={{ fontSize: '14px', color: C.gris, marginTop: '4px' }}>{sous}</div>}
      </div>
      {action}
    </div>
  );
}

const champBase: CSSProperties = {
  font: 'inherit',
  minHeight: '48px',
  borderRadius: '14px',
  border: `1px solid ${C.trait}`,
  background: '#fff',
  padding: '13px 14px',
  fontSize: '14px',
  lineHeight: 1.5,
  color: C.encre,
  width: '100%',
  boxSizing: 'border-box',
};

export function Champ({
  libelle,
  valeur,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  autoComplete,
  inputMode,
  maxLength,
  nom,
  erreur,
  aide,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (v: string) => void;
  /** Message d'erreur du champ : pose aria-invalid et le relie au champ. */
  readonly erreur?: string | undefined;
  /** Texte d'aide, relié au champ (aria-describedby). */
  readonly aide?: string | undefined;
  readonly type?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly autoComplete?: string;
  readonly inputMode?: 'numeric' | 'text';
  readonly maxLength?: number;
  readonly nom?: string;
}) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur === undefined ? '' : idErreur, aide === undefined ? '' : idAide].filter(Boolean).join(' ');
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>{libelle}</div>
      <input
        aria-invalid={erreur === undefined ? undefined : true}
        aria-describedby={decrit === '' ? undefined : decrit}
        name={nom}
        type={type}
        value={valeur}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={champBase}
      />
      {aide === undefined ? null : (
        <div id={idAide} style={{ fontSize: '12px', color: C.gris, marginTop: '4px' }}>
          {aide}
        </div>
      )}
      {erreur === undefined ? null : (
        <div id={idErreur} role="alert" style={{ fontSize: '12px', fontWeight: 700, color: C.terre, marginTop: '4px' }}>
          {erreur}
        </div>
      )}
    </label>
  );
}

export function ZoneTexte({
  libelle,
  valeur,
  onChange,
  lignes = 4,
  mono = false,
  maxLength,
  disabled,
  placeholder,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (v: string) => void;
  readonly lignes?: number;
  readonly mono?: boolean;
  readonly maxLength?: number;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>{libelle}</div>
      <textarea
        value={valeur}
        rows={lignes}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...champBase, resize: 'vertical', ...(mono ? { fontFamily: 'ui-monospace, monospace', fontSize: '13px' } : {}) }}
      />
    </label>
  );
}

export function Selecteur({
  libelle,
  valeur,
  onChange,
  options,
  disabled,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (v: string) => void;
  readonly options: readonly { readonly valeur: string; readonly libelle: string }[];
  readonly disabled?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>{libelle}</div>
      <select value={valeur} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={champBase}>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

type Ton = 'principal' | 'secondaire' | 'sombre' | 'contour';

export function Bouton({
  children,
  onClick,
  ton = 'secondaire',
  disabled,
  type = 'button',
  plein,
  petit,
  titre,
  etiquette,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly ton?: Ton;
  readonly disabled?: boolean | undefined;
  readonly type?: 'button' | 'submit';
  readonly plein?: boolean;
  readonly petit?: boolean;
  readonly titre?: string | undefined;
  /** Nom accessible d'un bouton qui ne porte qu'un symbole (▲ ▼ ✕) : il ne se lisait que « ▼ ». */
  readonly etiquette?: string;
}) {
  const palette: Record<Ton, CSSProperties> = {
    principal: { background: C.vert, color: '#fff', border: 'none' },
    secondaire: { background: C.aplat, color: C.encre, border: 'none' },
    sombre: { background: C.encre, color: '#fff', border: 'none' },
    contour: { background: '#fff', color: C.encre, border: `1px solid ${C.trait}` },
  };
  return (
    <button
      type={type}
      className="admin-bouton"
      onClick={onClick}
      disabled={disabled}
      title={titre}
      {...(etiquette === undefined ? {} : { 'aria-label': etiquette })}
      style={{
        height: petit === true ? '34px' : '44px',
        padding: petit === true ? '0 14px' : '0 18px',
        borderRadius: petit === true ? '12px' : '14px',
        font: 'inherit',
        fontSize: petit === true ? '12.5px' : '13.5px',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: disabled === true ? 'default' : 'pointer',
        opacity: disabled === true ? 0.5 : 1,
        ...(plein === true ? { width: '100%' } : {}),
        ...palette[ton],
      }}
    >
      {children}
    </button>
  );
}

export function Pastille({
  children,
  ton = 'neutre',
}: {
  readonly children: ReactNode;
  readonly ton?: 'neutre' | 'vert' | 'terre' | 'sombre';
}) {
  const t = {
    neutre: { background: '#F2F5F4', color: C.gris },
    vert: { background: C.vertPale, color: C.vertFonce },
    terre: { background: C.terrePale, color: C.terre },
    sombre: { background: C.encre, color: '#fff' },
  }[ton];
  return (
    <span style={{ ...t, fontSize: '11px', fontWeight: 700, padding: '4px 9px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

/** Les identifiants reliant un onglet à son panneau (`aria-controls` / `aria-labelledby`). */
export const idOnglet = (base: string, id: string): string => `onglet-${base}-${id}`;
export const idPanneau = (base: string, id: string): string => `panneau-${base}-${id}`;

/**
 * Onglets accessibles : `tablist`, un seul onglet dans l'ordre de tabulation (celui qui est actif), flèches gauche/droite
 * et Début/Fin pour passer de l'un à l'autre. Avec `base`, chaque onglet pointe son panneau (`aria-controls`) ; le
 * panneau s'écrit avec `PanneauOnglet`.
 */
export function Onglets<T extends string>({
  onglets,
  actif,
  onChange,
  base,
  libelle,
}: {
  readonly onglets: readonly { readonly id: T; readonly libelle: string }[];
  readonly actif: T;
  readonly onChange: (id: T) => void;
  readonly base?: string;
  readonly libelle?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const clavier = (e: React.KeyboardEvent, index: number) => {
    const n = onglets.length;
    let cible = -1;
    if (e.key === 'ArrowRight') cible = (index + 1) % n;
    else if (e.key === 'ArrowLeft') cible = (index - 1 + n) % n;
    else if (e.key === 'Home') cible = 0;
    else if (e.key === 'End') cible = n - 1;
    if (cible < 0) return;
    e.preventDefault();
    const o = onglets[cible];
    if (o === undefined) return;
    onChange(o.id);
    refs.current[o.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={libelle} style={{ display: 'flex', gap: '4px', background: C.aplat, borderRadius: '14px', padding: '4px', width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      {onglets.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[o.id] = el;
          }}
          id={base === undefined ? undefined : idOnglet(base, o.id)}
          type="button"
          role="tab"
          aria-selected={o.id === actif}
          aria-controls={base === undefined ? undefined : idPanneau(base, o.id)}
          tabIndex={o.id === actif ? 0 : -1}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => clavier(e, i)}
          style={{
            padding: '0 16px',
            height: '36px',
            borderRadius: '10px',
            border: 'none',
            font: 'inherit',
            fontSize: '13.5px',
            fontWeight: o.id === actif ? 700 : 500,
            background: o.id === actif ? '#fff' : 'transparent',
            color: o.id === actif ? C.encre : C.gris,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/** Le panneau d'un onglet : à poser autour du contenu de l'onglet actif, avec le même `base` que `Onglets`. */
export function PanneauOnglet({ base, id, children }: { readonly base: string; readonly id: string; readonly children: ReactNode }) {
  return (
    <div role="tabpanel" id={idPanneau(base, id)} aria-labelledby={idOnglet(base, id)} tabIndex={0} style={{ outline: 'none' }}>
      {children}
    </div>
  );
}

export function Interrupteur({
  actif,
  onChange,
  libelle,
  disabled,
}: {
  readonly actif: boolean;
  readonly onChange: (v: boolean) => void;
  readonly libelle: string;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={disabled}
      onClick={() => onChange(!actif)}
      style={{
        width: '40px',
        height: '24px',
        borderRadius: '999px',
        border: 'none',
        padding: 0,
        background: actif ? C.vertFonce : '#D3DBD8',
        position: 'relative',
        cursor: disabled === true ? 'default' : 'pointer',
        opacity: disabled === true ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span style={{ position: 'absolute', top: '3px', left: actif ? '19px' : '3px', width: '18px', height: '18px', borderRadius: '999px', background: '#fff' }} />
    </button>
  );
}

/** Un message : `info` (vert pâle), `attention` (terre cuite pâle). Jamais de rouge. */
export function Bandeau({
  ton = 'info',
  children,
  role,
}: {
  readonly ton?: 'info' | 'attention';
  readonly children: ReactNode;
  readonly role?: 'status' | 'alert';
}) {
  const t = ton === 'info' ? { background: C.vertPale, color: C.vertFonce } : { background: C.terrePale, color: C.terre };
  return (
    <div role={role} style={{ ...t, borderRadius: '14px', padding: '10px 14px', fontSize: '13px', fontWeight: 600 }}>
      {children}
    </div>
  );
}

/**
 * Un état vide COMPOSÉ : le message, et — quand il existe un geste qui change la situation — l'action à côté
 * (« Réinitialiser les filtres », « Créer… »). Un vide sans issue est une impasse ; `titre` pose le constat, les
 * enfants l'explication.
 */
export function Vide({ children, titre, action }: { readonly children: ReactNode; readonly titre?: string; readonly action?: ReactNode }) {
  return (
    <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '14px', color: C.gris, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {titre === undefined ? null : <div style={{ fontSize: '15px', fontWeight: 700, color: C.encre }}>{titre}</div>}
      <div style={{ maxWidth: '52ch', textWrap: 'pretty' }}>{children}</div>
      {action === undefined ? null : <div style={{ marginTop: '2px' }}>{action}</div>}
    </div>
  );
}

/**
 * Un SQUELETTE de chargement : des blocs gris à la forme de ce qui va arriver (cartes, lignes d'un tableau), pas un
 * rond seul. Il tient la place : quand les données arrivent, la page ne saute pas. L'animation ne touche que
 * l'opacité (`admin-squelette`, dans admin.css) et s'arrête si le système demande moins de mouvement.
 */
export function Squelette({ forme = 'lignes' }: { readonly forme?: 'lignes' | 'tableau-de-bord' }) {
  const bloc = (largeur: string, hauteur: number, rayon = 8): CSSProperties => ({ width: largeur, height: `${hauteur}px`, borderRadius: `${rayon}px` });
  if (forme === 'tableau-de-bord') {
    return (
      <div role="status" aria-live="polite" aria-label="Chargement du tableau de bord" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          <div className="admin-squelette" style={{ ...bloc('100%', 232, 16), background: C.aplat }} />
          <div className="admin-squelette" style={{ ...bloc('100%', 232, 16), background: C.aplat }} />
        </div>
        <div className="admin-squelette" style={{ ...bloc('100%', 168, 16), background: C.aplat }} />
        <span className="admin-sr-seul">Chargement…</span>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" aria-label="Chargement" style={{ background: '#fff', border: `1px solid ${C.trait}`, borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[78, 92, 64, 85, 70].map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="admin-squelette" style={{ ...bloc('34px', 34, 10), background: C.aplat, flexShrink: 0 }} />
          <div className="admin-squelette" style={{ ...bloc(`${l}%`, 12), background: C.aplat }} />
        </div>
      ))}
      <span className="admin-sr-seul">Chargement…</span>
    </div>
  );
}

// ─── Chargement ──────────────────────────────────────────────────────────────

export type Charge<T> =
  | { readonly phase: 'attente' }
  | { readonly phase: 'pret'; readonly donnees: T }
  | { readonly phase: 'echec'; readonly erreur: unknown };

/**
 * Charge au montage et à chaque changement de `cle`, et rend `recharger`.
 *
 * `charger` N'EST PAS dans les dépendances : l'appelant la passe en lambda, et la
 * relancer à chaque rendu bouclerait. `cle` dit QUAND recharger (un filtre, un
 * identifiant) ; `recharger()` relit sur demande, après une écriture.
 */
export function useCharge<T>(charger: () => Promise<T>, cle: string): { etat: Charge<T>; recharger: () => void } {
  const [etat, setEtat] = useState<Charge<T>>({ phase: 'attente' });
  const [tour, setTour] = useState(0);
  const chargerRef = useRef(charger);
  chargerRef.current = charger;

  useEffect(() => {
    let annule = false;
    chargerRef.current().then(
      (donnees) => {
        if (!annule) setEtat({ phase: 'pret', donnees });
      },
      (erreur: unknown) => {
        if (!annule) setEtat({ phase: 'echec', erreur });
      },
    );
    return () => {
      annule = true;
    };
  }, [cle, tour]);

  const recharger = useCallback(() => setTour((t) => t + 1), []);
  return { etat, recharger };
}

/** Le rendu commun des trois états d'une lecture : attente, échec (avec « Réessayer »), prêt. */
export function Lecture<T>({
  etat,
  recharger,
  children,
  forme,
}: {
  readonly etat: Charge<T>;
  readonly recharger: () => void;
  readonly children: (donnees: T) => ReactNode;
  /** La forme du squelette d'attente : celle de ce qui va s'afficher (voir `Squelette`). */
  readonly forme?: 'lignes' | 'tableau-de-bord';
}) {
  if (etat.phase === 'attente') return <Squelette forme={forme ?? 'lignes'} />;
  if (etat.phase === 'echec') {
    return (
      <div role="alert" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Bandeau ton="attention">{displayMessageFor(etat.erreur)}</Bandeau>
        <Bouton onClick={recharger} petit ton="contour">
          Réessayer
        </Bouton>
      </div>
    );
  }
  return <>{children(etat.donnees)}</>;
}

/**
 * Un geste d'écriture : `lancer(fn)` bloque pendant l'appel, garde le message de
 * succès ou d'échec, et rend `ok` pour que l'appelant enchaîne (recharger, fermer).
 */
export function useGeste() {
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ ton: 'info' | 'attention'; texte: string } | null>(null);

  const lancer = useCallback(async (fn: () => Promise<unknown>, succes?: string): Promise<boolean> => {
    setOccupe(true);
    setMessage(null);
    try {
      await fn();
      if (succes !== undefined) setMessage({ ton: 'info', texte: succes });
      return true;
    } catch (erreur) {
      setMessage({ ton: 'attention', texte: displayMessageFor(erreur) });
      return false;
    } finally {
      setOccupe(false);
    }
  }, []);

  /**
   * Une validation faite CÔTÉ ÉCRAN, avant tout appel : le message est dit tel quel.
   * (Avant, on faisait `lancer(() => Promise.reject(new Error(…)))`, et `displayMessageFor`
   * remplaçait le texte par « Une erreur est survenue » — l'équipe ne savait pas quel champ
   * corriger. Relevé au navigateur sur D13.)
   */
  const prevenir = useCallback((texte: string) => setMessage({ ton: 'attention', texte }), []);

  const annoncer = useCallback((texte: string) => setMessage({ ton: 'info', texte }), []);

  return { occupe, message, lancer, prevenir, annoncer, effacer: () => setMessage(null) };
}

export function Message({ message }: { readonly message: { ton: 'info' | 'attention'; texte: string } | null }) {
  if (message === null) return null;
  return (
    <Bandeau ton={message.ton} role={message.ton === 'info' ? 'status' : 'alert'}>
      {message.texte}
    </Bandeau>
  );
}

/** La date, dans les mots du produit : « 26/09 10:42 ». */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function dateLongue(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export const nombreFr = (n: number): string => new Intl.NumberFormat('fr-FR').format(n);

// ─── Fenêtre ─────────────────────────────────────────────────────────────────

/** La pile des fenêtres ouvertes : Échap ne ferme que celle du dessus. */
const pileFenetres: symbol[] = [];

const FOCALISABLES =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Une fenêtre d'édition ou de confirmation d'équipe — le châssis de
 * `FenetreConfirmation` (voile `rgba(22,33,29,.55)`, panneau blanc à rayon 28, retrait
 * 24, trait `#DDE3E0`), mais avec un CONTENU libre : les écrans d'équipe ont des
 * formulaires, que la confirmation du dépôt (un champ de motif) ne porte pas.
 *
 * Accessibilité : le focus entre dans la fenêtre (premier champ, sinon le panneau), Tab et Maj+Tab y restent
 * (piège), il revient à l'élément qui l'avait avant l'ouverture ; le défilement de la page est verrouillé et le
 * reste de l'application est inerte (`inert`) tant qu'elle est ouverte. Échap ne ferme que la fenêtre du dessus, et
 * ni Échap ni le voile ne ferment pendant un envoi (`occupe`).
 */
export function Fenetre({
  ouverte,
  titre,
  onFermer,
  children,
  large,
  occupe = false,
}: {
  readonly ouverte: boolean;
  readonly titre: string;
  readonly onFermer: () => void;
  readonly children: ReactNode;
  readonly large?: boolean;
  /** Un envoi est en cours : la fenêtre ne se ferme pas (Échap, voile, croix). */
  readonly occupe?: boolean;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const racine = useRef<HTMLDivElement>(null);
  const occupeRef = useRef(occupe);
  occupeRef.current = occupe;
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;

  useEffect(() => {
    if (!ouverte) return undefined;
    const marque = Symbol('fenetre');
    pileFenetres.push(marque);
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Le reste de l'application devient inerte (hors fenêtres, rendues en frère du contenu).
    const inertes: HTMLElement[] = [];
    // On remonte de la fenêtre à la racine de l'administration et on rend inertes les FRÈRES de chaque ancêtre.
    let noeud: HTMLElement | null = racine.current;
    while (noeud !== null && noeud.parentElement !== null && !noeud.hasAttribute('data-admin')) {
      const parent: HTMLElement = noeud.parentElement;
      for (const frere of Array.from(parent.children)) {
        if (frere !== noeud && frere instanceof HTMLElement && !frere.hasAttribute('data-fenetre') && !frere.hasAttribute('inert') && frere.tagName !== 'SCRIPT') {
          frere.setAttribute('inert', '');
          inertes.push(frere);
        }
      }
      if (parent.hasAttribute('data-admin')) break;
      noeud = parent;
    }
    const dedans = () => Array.from(panneau.current?.querySelectorAll<HTMLElement>(FOCALISABLES) ?? []);
    // Focus initial : le premier champ de saisie, sinon le premier focalisable, sinon le panneau.
    const champs = dedans().filter((e) => e.matches('input,textarea,select'));
    (champs[0] ?? dedans().find((e) => e.getAttribute('aria-label') !== 'Fermer') ?? panneau.current)?.focus();

    const touche = (e: KeyboardEvent) => {
      if (pileFenetres[pileFenetres.length - 1] !== marque) return;
      if (e.key === 'Escape') {
        if (!occupeRef.current) {
          e.stopPropagation();
          fermerRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const liste = dedans();
      if (liste.length === 0) {
        e.preventDefault();
        panneau.current?.focus();
        return;
      }
      const premier = liste[0] as HTMLElement;
      const dernier = liste[liste.length - 1] as HTMLElement;
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || actif === panneau.current)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      } else if (!panneau.current?.contains(actif)) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('keydown', touche);
      const i = pileFenetres.indexOf(marque);
      if (i >= 0) pileFenetres.splice(i, 1);
      inertes.forEach((el) => el.removeAttribute('inert'));
      if (pileFenetres.length === 0) document.body.style.overflow = defilement;
      if (avant?.isConnected === true) avant.focus();
    };
  }, [ouverte]);

  if (!ouverte) return null;
  const fermer = () => {
    if (!occupe) onFermer();
  };
  return (
    <div data-fenetre="" ref={racine}>
      <div onClick={fermer} style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)', zIndex: 'var(--z-fenetre, 80)' }} />
      <div
        ref={panneau}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        aria-busy={occupe}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: large === true ? '640px' : '440px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid #DDE3E0',
          borderRadius: '28px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          outline: 'none',
          zIndex: 'calc(var(--z-fenetre, 80) + 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>{titre}</h2>
          <button
            type="button"
            aria-label="Fermer"
            disabled={occupe}
            onClick={fermer}
            style={{ width: '40px', height: '40px', borderRadius: '999px', border: 'none', background: '#F2F5F4', cursor: occupe ? 'default' : 'pointer', fontSize: '18px', color: C.encre }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Une grille qui s'empile sous 1 024 px — l'équivalent mobile des colonnes de la maquette. */
export function Colonnes({
  children,
  gabarit,
}: {
  readonly children: ReactNode;
  /** Le gabarit des colonnes à partir de 1 024 px, p. ex. `minmax(0,1fr) minmax(0,1.4fr)`. */
  readonly gabarit: string;
}) {
  return (
    <div className="admin-colonnes" style={{ ['--cols' as string]: gabarit, display: 'grid', gap: '14px', alignItems: 'start' }}>
      {children}
    </div>
  );
}

/**
 * Une action d'équipe qui exige un MOTIF — 15 §3.2 (« chaque action demande un
 * motif ») et 13 §4.2. Le plancher vient du schéma de la route, jamais d'un nombre écrit
 * ici : l'appelant passe `min`. Le bouton s'éteint tant que le motif TRIMÉ n'y arrive
 * pas, comme le fait le serveur (`.trim().min(…)`).
 */
export function FenetreMotif({
  ouverte,
  titre,
  consigne,
  min,
  max = 1000,
  libelleConfirmer,
  onConfirmer,
  onFermer,
  occupe,
  message,
  enfants,
  motifRequis = true,
}: {
  readonly ouverte: boolean;
  readonly titre: string;
  readonly consigne?: string | undefined;
  readonly min: number;
  readonly max?: number;
  readonly libelleConfirmer: string;
  readonly onConfirmer: (motif: string) => void;
  readonly onFermer: () => void;
  readonly occupe: boolean;
  readonly message: { ton: 'info' | 'attention'; texte: string } | null;
  readonly enfants?: ReactNode;
  readonly motifRequis?: boolean;
}) {
  const [motif, setMotif] = useState('');
  useEffect(() => {
    if (!ouverte) setMotif('');
  }, [ouverte]);
  const suffisant = !motifRequis || motif.trim().length >= min;
  return (
    <Fenetre ouverte={ouverte} titre={titre} onFermer={onFermer} occupe={occupe}>
      {consigne === undefined ? null : <div style={{ fontSize: '14px', color: C.gris }}>{consigne}</div>}
      {enfants}
      {motifRequis ? (
        <>
          <ZoneTexte libelle={min > 0 ? `Motif · ${min} caractères minimum` : 'Motif (facultatif, tracé dans le journal)'} valeur={motif} onChange={setMotif} lignes={3} maxLength={max} />
          {min > 0 ? (
            <div style={{ fontSize: '12px', fontWeight: 700, color: suffisant ? C.vertFonce : C.gris }}>
              {motif.trim().length} / {min}
            </div>
          ) : null}
        </>
      ) : null}
      <Message message={message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Bouton onClick={onFermer} ton="secondaire">
          Annuler
        </Bouton>
        <Bouton onClick={() => onConfirmer(motif.trim())} ton="sombre" disabled={occupe || !suffisant}>
          {occupe ? 'Un instant…' : libelleConfirmer}
        </Bouton>
      </div>
    </Fenetre>
  );
}

/**
 * Le premier défaut d'un `safeParse` Zod, dit en français : le message du schéma s'il en a
 * écrit un (`custom`), sinon « libellé du champ : valeur non valide ».
 */
export function premierDefaut(
  issues: readonly { readonly code: string; readonly message: string; readonly path: readonly (string | number)[] }[],
  libelles: Readonly<Record<string, string>>,
): string {
  const i = issues[0];
  if (i === undefined) return 'Formulaire incomplet.';
  if (i.code === 'custom') return i.message;
  const champ = libelles[String(i.path[0] ?? '')] ?? 'Un champ';
  const raison = i.code === 'too_small' || i.code === 'too_big' ? 'valeur hors des bornes autorisées' : 'valeur non valide (trop courte, trop longue ou mal formée)';
  return `${champ} : ${raison}.`;
}
