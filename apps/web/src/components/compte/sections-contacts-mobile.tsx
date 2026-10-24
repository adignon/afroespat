import Link from 'next/link';
import type { LigneContact } from '@/screens/compte/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LES TROIS AUTRES LISTES DE K05, AU FORMAT DU TÉLÉPHONE            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche mobile de « Contacts » dessine trois onglets (Contacts, Demandes,
 * Suggestions) et UNE liste : celle des contacts. Les demandes reçues, les
 * suggestions et les membres bloqués n'y avaient aucun écran — le membre qui
 * ouvrait l'application sur son téléphone ne pouvait ni accepter une demande ni
 * débloquer quelqu'un, alors que l'ordinateur le permet. (Lot W2A, phase 2.8 : les
 * deux « suggestions » dessinées, Sandra M. et Aïcha Diop, étaient en plus des
 * lignes de la maquette montrées à tout le monde.)
 *
 * Elles s'empilent sous la liste des contacts, une carte chacune, avec le dessin de
 * la ligne de l'ordinateur — rond de 40 px, nom, pastille de vérification, seconde
 * ligne grise, boutons de 36 px — et un état vide HONNÊTE quand il n'y a rien. Les
 * onglets de la planche deviennent des ancres vers ces cartes. Aucune couleur
 * nouvelle : celles des boutons de K05 (`#16785E` plein, `#F2F5F4` en sourdine).
 */

const BOUTON = (fond: string, encre: string, occupe: boolean) =>
  ({
    padding: '0 14px',
    borderRadius: '14px',
    background: fond,
    color: encre,
    border: 'none',
    font: 'inherit',
    fontSize: '13px',
    fontWeight: 700,
    height: '36px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: occupe ? 'default' : 'pointer',
  }) as const;

function Ligne({
  ligne,
  sous,
  boutons,
}: {
  readonly ligne: LigneContact;
  readonly sous: string;
  readonly boutons: React.ReactNode;
}) {
  const rond = (
    <span
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '999px',
        background: ligne.fond,
        color: '#fff',
        fontSize: '13px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {ligne.initiales}
    </span>
  );
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #F0F3F2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {ligne.profil === undefined ? (
          rond
        ) : (
          <Link
            href={ligne.profil}
            aria-label={`Voir le profil de ${ligne.nom}`}
            style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}
          >
            {rond}
          </Link>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>
            {ligne.profil === undefined ? (
              ligne.nom
            ) : (
              <Link href={ligne.profil} style={{ color: 'inherit', textDecoration: 'none' }}>
                {ligne.nom}
              </Link>
            )}
          </span>
          <span style={{ display: 'block', fontSize: '12px', color: '#8A958F' }}>{sous}</span>
        </span>
        <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>{boutons}</span>
      </div>
    </div>
  );
}

function Carte({
  id,
  titre,
  vide,
  lignes,
  rendre,
}: {
  readonly id: string;
  readonly titre: string;
  readonly vide: string;
  readonly lignes: readonly LigneContact[];
  readonly rendre: (l: LigneContact) => React.ReactNode;
}) {
  return (
    <div
      id={id}
      data-contacts-section={id}
      style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '14px 14px 4px', flexShrink: 0, scrollMarginTop: '12px' }}
    >
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
        {titre}
      </div>
      {lignes.length === 0 ? (
        <div style={{ padding: '14px 0 12px', fontSize: '13px', color: '#8A958F' }}>{vide}</div>
      ) : (
        lignes.map((l) => <div key={l.cle}>{rendre(l)}</div>)
      )}
    </div>
  );
}

export function SectionsContactsMobile({
  demandes,
  suggestions,
  bloques,
  occupe,
}: {
  readonly demandes: readonly LigneContact[];
  readonly suggestions: readonly LigneContact[];
  readonly bloques: readonly LigneContact[];
  readonly occupe: boolean;
}) {
  return (
    <>
      <Carte
        id="k05-demandes"
        titre="DEMANDES REÇUES"
        vide="Aucune demande reçue."
        lignes={demandes}
        rendre={(d) => (
          <Ligne
            ligne={d}
            sous={d.message}
            boutons={
              <>
                <button type="button" onClick={d.onPrincipal} disabled={occupe} data-contacts-accepter="" style={BOUTON('#16785E', '#fff', occupe)}>
                  Accepter
                </button>
                <button type="button" onClick={d.onSecondaire} disabled={occupe} data-contacts-refuser="" style={BOUTON('#F2F5F4', '#5D6B66', occupe)}>
                  Refuser
                </button>
              </>
            }
          />
        )}
      />
      <Carte
        id="k05-suggestions"
        titre="SUGGESTIONS"
        vide="Aucune suggestion pour le moment."
        lignes={suggestions}
        rendre={(g) => (
          <Ligne
            ligne={g}
            sous={g.raison}
            boutons={
              <button type="button" onClick={g.onPrincipal} disabled={occupe} data-contacts-ajouter="" style={BOUTON('#F2F5F4', '#16211D', occupe)}>
                Ajouter
              </button>
            }
          />
        )}
      />
      <Carte
        id="k05-bloques"
        titre="BLOQUÉS"
        vide="Aucun membre bloqué."
        lignes={bloques}
        rendre={(b) => (
          <Ligne
            ligne={b}
            sous={b.date}
            boutons={
              <button type="button" onClick={b.onPrincipal} disabled={occupe} data-contacts-debloquer="" style={BOUTON('#F2F5F4', '#16211D', occupe)}>
                Débloquer
              </button>
            }
          />
        )}
      />
    </>
  );
}
