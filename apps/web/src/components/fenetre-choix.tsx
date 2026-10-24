'use client';

import { useMemo, useState } from 'react';
import { SKILL_NAME_MAX, createPlacesSkillSchema } from '@app/shared';
import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CHOISIR DANS UN RÉFÉRENTIEL — COMPÉTENCES, LANGUES                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Au niveau du profil, Compétences et langues ne sont pas
 * modifiables ? »
 *
 * MESURÉ : non. Les deux boîtes de K01 étaient du TEXTE — `{profil.competences}`
 * dans une boîte blanche — et une adaptation déclarée pour les rendre
 * sélectionnables ne s'appliquait plus (le générateur le disait à chaque
 * exécution : « adaptation attendue introuvable »). Elle visait un dessin que la
 * maquette n'a plus.
 *
 * `PATCH /me/profile` accepte pourtant `skillIds` et `languageIds` depuis le
 * début, et `GET /places/skills` / `GET /places/languages` servent les
 * référentiels aux MEMBRES — l'inscription s'en sert déjà.
 *
 * ── DIX AU PLUS, ET C'EST LE SERVEUR QUI LE DIT ───────────────────────────
 *
 * `updateProfileSchema` : `.max(10)` sur les deux. On éteint donc les cases non
 * cochées à la borne plutôt que de prendre un refus — et on le DIT, sans quoi le
 * membre croirait l'écran cassé.
 *
 * ── « AUTRE… » : ÉCRIRE SA PROPRE COMPÉTENCE ──────────────────────────────
 *
 * Quand l'appelant passe `onCreer`, une dernière ligne en pointillés, « Autre… », ouvre un
 * champ pour écrire une compétence absente de la liste — c'est `POST /places/skills`, qui
 * la crée À SOI (elle n'est proposée aux autres que si l'équipe la globalise) ou rend la ligne
 * qui existait déjà sous ce nom. La bordure en pointillés, le vert et la hauteur de 44 px sont
 * ceux de « Nouveau parcours » dans J01M. La forme du nom est celle du serveur
 * (`createPlacesSkillSchema`, importé de `@app/shared`) : le front PRÉVIENT, le serveur DÉCIDE.
 *
 * ── LE FILTRE EST À L'ÉCRAN, PAS AU SERVEUR ───────────────────────────────
 *
 * Soixante compétences et vingt-quatre langues arrivent en une réponse, triées
 * par le serveur : c'est écrit dans `lib/api.ts`. Interroger à chaque frappe
 * ferait soixante allers-retours pour filtrer ce qu'on a déjà.
 */
export function FenetreChoix({
  ouverte,
  titre,
  items,
  choisis,
  max = 10,
  occupe = false,
  onCreer,
  onValider,
  onFermer,
}: {
  readonly ouverte: boolean;
  readonly titre: string;
  readonly items: readonly { readonly id: string; readonly nameFr: string }[];
  readonly choisis: readonly string[];
  readonly max?: number;
  readonly occupe?: boolean;
  /** Présent = la ligne « Autre… » est offerte. Rend la ligne créée, ou `null` si le serveur refuse. */
  readonly onCreer?: (nom: string) => Promise<{ readonly id: string; readonly nameFr: string } | null>;
  readonly onValider: (ids: readonly string[]) => void;
  readonly onFermer: () => void;
}) {
  const [selection, setSelection] = useState<readonly string[]>(choisis);
  const [autreOuvert, setAutreOuvert] = useState(false);
  const [autre, setAutre] = useState('');
  const [autreOccupe, setAutreOccupe] = useState(false);
  const [filtre, setFiltre] = useState('');
  const [cle, setCle] = useState(0);

  /**
   * LA SÉLECTION SE RECALE SUR LA PRISE À CHAQUE OUVERTURE. Sans cela, rouvrir
   * la fenêtre après un enregistrement montrerait l'ancien choix : `useState` ne
   * relit sa valeur initiale qu'au montage, et `Modal` ne démonte pas son
   * contenu. On compare donc une clé, à la façon d'un `key` — c'est le motif que
   * React recommande pour « un état dérivé d'une prise ».
   */
  const signature = `${ouverte ? '1' : '0'}:${choisis.join(',')}`;
  const [vue, setVue] = useState(signature);
  if (vue !== signature) {
    setVue(signature);
    setSelection(choisis);
    setFiltre('');
    setCle((n) => n + 1);
  }

  const visibles = useMemo(() => {
    const q = filtre.trim().toLocaleLowerCase('fr-FR');
    return q === '' ? items : items.filter((i) => i.nameFr.toLocaleLowerCase('fr-FR').includes(q));
  }, [items, filtre]);

  const panneau = (
    <PanneauFenetre
      titreId="choix-titre"
      titre={titre}
      enTete={
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#8A958F' }}>
          {selection.length} / {max}
        </span>
      }
      actions={
        <>
          <button
            type="button"
            onClick={onFermer}
            style={{ ...ACTION, background: '#F2F5F4', color: '#16211D', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              onValider(selection);
            }}
            disabled={occupe}
            data-choix-valider=""
            style={{
              ...ACTION,
              background: occupe ? '#8A958F' : '#16785E',
              color: '#fff',
              cursor: occupe ? 'default' : 'pointer',
            }}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <input
        key={cle}
        value={filtre}
        onChange={(e) => {
          setFiltre(e.target.value);
        }}
        placeholder="Rechercher"
        aria-label="Rechercher"
        data-choix-recherche=""
        style={{
          height: '46px',
          borderRadius: '999px',
          border: 'none',
          background: '#F2F5F4',
          padding: '0 18px',
          fontSize: '13.5px',
          fontFamily: 'inherit',
          color: '#16211D',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      />
      {visibles.map((i) => {
        const pris = selection.includes(i.id);
        const plein = !pris && selection.length >= max;
        return (
          <button
            key={i.id}
            type="button"
            role="checkbox"
            aria-checked={pris}
            disabled={plein}
            data-choix-item={i.id}
            onClick={() => {
              setSelection((liste) =>
                pris ? liste.filter((x) => x !== i.id) : [...liste, i.id],
              );
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              /** 44 px : la cible tactile minimale de T1 §2.3. */
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '14px',
              background: pris ? '#EFF7F3' : '#fff',
              border: pris ? '1.5px solid #16785E' : '1px solid #E6EBE9',
              font: 'inherit',
              fontSize: '14px',
              fontWeight: 600,
              textAlign: 'left',
              color: '#16211D',
              opacity: plein ? 0.45 : 1,
              cursor: plein ? 'default' : 'pointer',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '6px',
                boxSizing: 'border-box',
                flexShrink: 0,
                border: pris ? '6px solid #16785E' : '1.5px solid #CBD5D1',
              }}
            />
            {i.nameFr}
          </button>
        );
      })}
      {visibles.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#8A958F' }}>
          Aucun résultat{onCreer === undefined ? '.' : ' : ajoutez-la avec « Autre… ».'}
        </div>
      ) : null}
      {onCreer === undefined ? null : autreOuvert ? (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input
            value={autre}
            onChange={(e) => {
              setAutre(e.target.value);
            }}
            maxLength={SKILL_NAME_MAX}
            placeholder="Nom de la compétence"
            aria-label="Nom de la compétence"
            data-choix-autre=""
            autoFocus
            style={{
              flex: 1,
              minWidth: 0,
              height: '44px',
              borderRadius: '14px',
              border: '1.5px solid #16785E',
              background: '#fff',
              padding: '0 14px',
              fontSize: '13.5px',
              fontFamily: 'inherit',
              color: '#16211D',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            data-choix-autre-ajouter=""
            disabled={autreOccupe || !createPlacesSkillSchema.safeParse({ nameFr: autre }).success}
            onClick={() => {
              setAutreOccupe(true);
              void onCreer(autre).then((creee) => {
                setAutreOccupe(false);
                if (creee === null) return;
                setAutre('');
                setAutreOuvert(false);
                setSelection((liste) =>
                  liste.includes(creee.id) || liste.length >= max ? liste : [...liste, creee.id],
                );
              });
            }}
            style={{
              ...ACTION,
              flex: 'none',
              background: '#16785E',
              color: '#fff',
              cursor: 'pointer',
              opacity: autreOccupe || !createPlacesSkillSchema.safeParse({ nameFr: autre }).success ? 0.5 : 1,
            }}
          >
            Ajouter
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-choix-autre-ouvrir=""
          onClick={() => {
            setAutre(filtre.trim());
            setAutreOuvert(true);
          }}
          style={{
            height: '44px',
            borderRadius: '16px',
            border: '1.5px dashed #9FB3AB',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13.5px',
            fontWeight: 700,
            fontFamily: 'inherit',
            color: '#0F5C48',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Autre…
        </button>
      )}
    </PanneauFenetre>
  );

  return (
    <Modal open={ouverte} onClose={onFermer} titleId="choix-titre" name="CHOIX" mobile={panneau} />
  );
}

/** La géométrie que K08 et D08 dessinent tous deux pour un bouton d'action. */
const ACTION = {
  height: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '1',
};
