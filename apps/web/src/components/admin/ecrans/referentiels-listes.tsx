'use client';

import { useState } from 'react';
import { z } from 'zod';
import { okResponseSchema } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { Confirmation } from '../confirmation';
import { useDroit } from '../session-equipe';
import {
  Bouton,
  C,
  Carte,
  Champ,
  Fenetre,
  FenetreMotif,
  Lecture,
  Message,
  Pastille,
  Selecteur,
  Vide,
  useCharge,
  useGeste,
} from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ RÉFÉRENTIELS — PAYS, LANGUES, COMPÉTENCES, MÉTIERS (02 §4.2)                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les onglets d'à côté des villes. Les listes sont FERMÉES (02 §2.3) : un membre ne crée jamais une valeur, il la
 * suggère, et c'est ici qu'on les tient. Tout vient de `GET /admin/ref/{countries,languages,skills,professions}` et les
 * gestes appellent les routes qui existent déjà :
 *
 *   · pays : ajouter (inactif), « Ouvrir » (crée le réseau du pays, motif) et « Fermer » (refusé s'il reste une ville
 *     active — le serveur le dit, l'écran le répète) ;
 *   · langues : ajouter, renommer (pas de colonne `is_active` : une langue ne se retire pas des propositions) ;
 *   · compétences et métiers : ajouter, renommer, « Retirer des propositions » / « Remettre » (confirmation : l'entrée
 *     reste sur les profils qui l'ont déjà, elle n'est plus proposée).
 *
 * Écriture réservée au rôle « contenu » (SUPER_ADMIN, CONTENT_ADMIN) ; les autres rôles ne voient pas la page.
 */

export const LISTES = ['pays', 'langues', 'competences', 'metiers'] as const;
export type ListeRef = (typeof LISTES)[number];

const MOTIF_MIN = 10;

const paysSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        iso2: z.string(),
        nameFr: z.string(),
        dialCode: z.string(),
        kind: z.enum(['ORIGIN', 'DESTINATION', 'BOTH']),
        isActive: z.boolean(),
        cityCount: z.number(),
      })
      .passthrough(),
  ),
});
const langueSchema = z.object({
  items: z.array(z.object({ id: z.string(), code: z.string(), nameFr: z.string() }).passthrough()),
});
const etiquetteSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        nameFr: z.string(),
        category: z.string().nullable().optional(),
        isActive: z.boolean(),
      })
      .passthrough(),
  ),
});
const creeSchema = z.object({ id: z.string() }).passthrough();

const NOM_KIND: Record<string, string> = {
  ORIGIN: 'Origine',
  DESTINATION: 'Destination',
  BOTH: 'Origine et destination',
};

/** Filtre « chercher » : sans accent ni casse. */
export function contient(texte: string, recherche: string): boolean {
  const norme = (t: string) =>
    t
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  return norme(texte).includes(norme(recherche.trim()));
}

function Entete({ colonnes }: { readonly colonnes: readonly string[] }) {
  return (
    <thead>
      <tr
        style={{
          textAlign: 'left',
          color: C.grisClair,
          fontSize: '10.5px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        {colonnes.map((h) => (
          <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

const cellule = { padding: '8px 14px' } as const;

// ─── Pays ────────────────────────────────────────────────────────────────────

type GestePays = { kind: 'ouvrir' | 'fermer'; id: string; nom: string } | null;

export function OngletPays() {
  const peut = useDroit('content');
  const liste = useCharge(() => staffApi.get('/ref/countries', paysSchema), 'ref-pays');
  const [recherche, setRecherche] = useState('');
  const [geste, setGeste] = useState<GestePays>(null);
  const [ajout, setAjout] = useState(false);
  const action = useGeste();
  const formulaire = useGeste();
  const [iso2, setIso2] = useState('');
  const [nom, setNom] = useState('');
  const [indicatif, setIndicatif] = useState('+');
  const [kind, setKind] = useState('BOTH');

  const fermerGeste = () => {
    if (!action.occupe) {
      setGeste(null);
      action.effacer();
    }
  };
  const confirmer = async (motif: string) => {
    if (geste === null) return;
    const ok = await action.lancer(
      () =>
        staffApi.post(
          `/ref/countries/${geste.id}/${geste.kind === 'ouvrir' ? 'activate' : 'deactivate'}`,
          okResponseSchema,
          { body: { reason: motif } },
        ),
      geste.kind === 'ouvrir'
        ? `${geste.nom} est ouvert : son réseau est créé.`
        : `${geste.nom} est fermé.`,
    );
    if (ok) {
      setGeste(null);
      liste.recharger();
    }
  };
  const ajouter = async () => {
    const ok = await formulaire.lancer(
      () =>
        staffApi.post('/ref/countries', creeSchema, {
          body: { iso2: iso2.trim(), nameFr: nom.trim(), dialCode: indicatif.trim(), kind },
        }),
      `${nom.trim()} est ajouté (fermé : ouvrez-le quand vous êtes prêt·e).`,
    );
    if (ok) {
      setAjout(false);
      setIso2('');
      setNom('');
      setIndicatif('+');
      liste.recharger();
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Champ libelle="Chercher un pays" valeur={recherche} onChange={setRecherche} />
        </div>
        <Bouton
          ton="principal"
          disabled={!peut}
          titre={peut ? undefined : 'Réservé : contenu'}
          onClick={() => {
            formulaire.effacer();
            setAjout(true);
          }}
        >
          Ajouter un pays
        </Bouton>
      </div>
      {geste === null && !ajout ? <Message message={action.message} /> : null}
      <Lecture etat={liste.etat} recharger={liste.recharger}>
        {(d) => {
          const affiches = d.items.filter(
            (p) => recherche.trim() === '' || contient(`${p.nameFr} ${p.iso2}`, recherche),
          );
          return (
            <Carte style={{ padding: 0, overflow: 'hidden' }}>
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    minWidth: '640px',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}
                >
                  <Entete colonnes={['Pays', 'Indicatif', 'Rôle', 'Villes', 'Statut', 'Action']} />
                  <tbody>
                    {affiches.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <Vide>Aucun pays ne correspond.</Vide>
                        </td>
                      </tr>
                    ) : null}
                    {affiches.map((p) => (
                      <tr key={p.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                        <td style={{ ...cellule, fontWeight: 600 }}>
                          {p.nameFr}{' '}
                          <span style={{ color: C.grisClair, fontWeight: 400 }}>· {p.iso2}</span>
                        </td>
                        <td style={cellule}>{p.dialCode}</td>
                        <td style={cellule}>{NOM_KIND[p.kind] ?? p.kind}</td>
                        <td style={cellule}>{p.cityCount}</td>
                        <td style={cellule}>
                          <Pastille ton={p.isActive ? 'vert' : 'terre'}>
                            {p.isActive ? 'Ouvert' : 'Fermé'}
                          </Pastille>
                        </td>
                        <td style={cellule}>
                          {p.isActive ? (
                            <Bouton
                              petit
                              ton="contour"
                              disabled={!peut}
                              onClick={() => {
                                action.effacer();
                                setGeste({ kind: 'fermer', id: p.id, nom: p.nameFr });
                              }}
                            >
                              Fermer
                            </Bouton>
                          ) : (
                            <Bouton
                              petit
                              ton="principal"
                              disabled={!peut}
                              onClick={() => {
                                action.effacer();
                                setGeste({ kind: 'ouvrir', id: p.id, nom: p.nameFr });
                              }}
                            >
                              Ouvrir
                            </Bouton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
          );
        }}
      </Lecture>
      <FenetreMotif
        ouverte={geste !== null}
        titre={geste?.kind === 'fermer' ? `Fermer ${geste.nom}` : `Ouvrir ${geste?.nom ?? ''}`}
        consigne={
          geste?.kind === 'fermer'
            ? 'Le pays se referme. Refusé s’il reste des villes actives, ou s’il est le dernier de son genre.'
            : 'Le réseau du pays est créé et les membres déjà rattachés y sont inscrits.'
        }
        min={MOTIF_MIN}
        max={500}
        libelleConfirmer={geste?.kind === 'fermer' ? 'Fermer le pays' : 'Ouvrir le pays'}
        onConfirmer={(m) => void confirmer(m)}
        onFermer={fermerGeste}
        occupe={action.occupe}
        message={action.message}
      />
      <Fenetre
        ouverte={ajout}
        titre="Ajouter un pays"
        onFermer={() => setAjout(false)}
        occupe={formulaire.occupe}
      >
        <Champ libelle="Code ISO (2 lettres)" valeur={iso2} onChange={setIso2} maxLength={2} />
        <Champ libelle="Nom en français" valeur={nom} onChange={setNom} maxLength={80} />
        <Champ
          libelle="Indicatif (+229)"
          valeur={indicatif}
          onChange={setIndicatif}
          maxLength={5}
        />
        <Selecteur
          libelle="Rôle"
          valeur={kind}
          onChange={setKind}
          options={Object.entries(NOM_KIND).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
        <Message message={formulaire.message} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Bouton onClick={() => setAjout(false)}>Annuler</Bouton>
          <Bouton
            ton="principal"
            disabled={
              formulaire.occupe ||
              iso2.trim().length !== 2 ||
              nom.trim().length < 2 ||
              !/^\+\d{1,4}$/.test(indicatif.trim())
            }
            onClick={() => void ajouter()}
          >
            Ajouter
          </Bouton>
        </div>
      </Fenetre>
    </>
  );
}

// ─── Langues, compétences, métiers ──────────────────────────────────────────

const CONFIG = {
  langues: {
    chemin: 'languages',
    singulier: 'langue',
    article: 'une',
    retirable: false,
    categorie: false,
  },
  competences: {
    chemin: 'skills',
    singulier: 'compétence',
    article: 'une',
    retirable: true,
    categorie: true,
  },
  metiers: {
    chemin: 'professions',
    singulier: 'métier',
    article: 'un',
    retirable: true,
    categorie: true,
  },
} as const;

interface Ligne {
  readonly id: string;
  readonly nameFr: string;
  readonly code?: string | undefined;
  readonly category?: string | null | undefined;
  readonly isActive?: boolean | undefined;
}

type GesteListe =
  | { kind: 'renommer'; ligne: Ligne }
  | { kind: 'basculer'; ligne: Ligne }
  | { kind: 'ajouter' }
  | null;

export function OngletListe({ liste }: { readonly liste: Exclude<ListeRef, 'pays'> }) {
  const cfg = CONFIG[liste];
  const peut = useDroit('content');
  const charge = useCharge<readonly Ligne[]>(
    async () =>
      liste === 'langues'
        ? (await staffApi.get(`/ref/${cfg.chemin}`, langueSchema)).items
        : (await staffApi.get(`/ref/${cfg.chemin}`, etiquetteSchema)).items,
    `ref-${liste}`,
  );
  const [recherche, setRecherche] = useState('');
  const [geste, setGeste] = useState<GesteListe>(null);
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [categorie, setCategorie] = useState('');
  const action = useGeste();

  const ouvrir = (g: NonNullable<GesteListe>) => {
    action.effacer();
    setNom(g.kind === 'renommer' ? g.ligne.nameFr : '');
    setCode('');
    setCategorie('');
    setGeste(g);
  };
  const fermer = () => {
    if (action.occupe) return;
    setGeste(null);
    action.effacer();
  };
  const valider = async () => {
    if (geste === null) return;
    let ok = false;
    if (geste.kind === 'ajouter') {
      const corps =
        liste === 'langues'
          ? { code: code.trim(), nameFr: nom.trim() }
          : {
              nameFr: nom.trim(),
              ...(categorie.trim() === '' ? {} : { category: categorie.trim() }),
            };
      ok = await action.lancer(
        () => staffApi.post(`/ref/${cfg.chemin}`, creeSchema, { body: corps }),
        `« ${nom.trim()} » est ajouté${cfg.article === 'une' ? 'e' : ''}.`,
      );
    } else if (geste.kind === 'renommer') {
      ok = await action.lancer(
        () =>
          staffApi.patch(`/ref/${cfg.chemin}/${geste.ligne.id}`, z.unknown(), {
            body: { nameFr: nom.trim() },
          }),
        'Nom modifié.',
      );
    } else {
      const retire = geste.ligne.isActive === true;
      ok = await action.lancer(
        () =>
          staffApi.patch(`/ref/${cfg.chemin}/${geste.ligne.id}`, z.unknown(), {
            body: { isActive: !retire },
          }),
        retire
          ? `« ${geste.ligne.nameFr} » n’est plus proposé${cfg.article === 'une' ? 'e' : ''}.`
          : `« ${geste.ligne.nameFr} » est de nouveau proposé${cfg.article === 'une' ? 'e' : ''}.`,
      );
    }
    if (ok) {
      setGeste(null);
      charge.recharger();
    }
  };

  const nomOk = nom.trim().length >= 2;
  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Champ
            libelle={`Chercher ${cfg.article} ${cfg.singulier}`}
            valeur={recherche}
            onChange={setRecherche}
          />
        </div>
        <Bouton
          ton="principal"
          disabled={!peut}
          titre={peut ? undefined : 'Réservé : contenu'}
          onClick={() => ouvrir({ kind: 'ajouter' })}
        >
          Ajouter {cfg.article} {cfg.singulier}
        </Bouton>
      </div>
      {geste === null ? <Message message={action.message} /> : null}
      <Lecture etat={charge.etat} recharger={charge.recharger}>
        {(lignes) => {
          const affichees = lignes.filter(
            (l) =>
              recherche.trim() === '' ||
              contient(`${l.nameFr} ${l.category ?? ''} ${l.code ?? ''}`, recherche),
          );
          return (
            <Carte style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', fontSize: '12.5px', color: C.gris }}>
                {lignes.length} entrée{lignes.length > 1 ? 's' : ''}
                {recherche.trim() === ''
                  ? ''
                  : ` · ${affichees.length} affichée${affichees.length > 1 ? 's' : ''}`}
              </div>
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    minWidth: '560px',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}
                >
                  <Entete
                    colonnes={[
                      'Nom',
                      liste === 'langues' ? 'Code' : 'Catégorie',
                      ...(cfg.retirable ? ['Statut'] : []),
                      'Action',
                    ]}
                  />
                  <tbody>
                    {affichees.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <Vide>Aucune entrée ne correspond.</Vide>
                        </td>
                      </tr>
                    ) : null}
                    {affichees.map((l) => (
                      <tr key={l.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                        <td style={{ ...cellule, fontWeight: 600 }}>{l.nameFr}</td>
                        <td style={cellule}>
                          {liste === 'langues' ? l.code : (l.category ?? '—')}
                        </td>
                        {cfg.retirable ? (
                          <td style={cellule}>
                            <Pastille ton={l.isActive === false ? 'neutre' : 'vert'}>
                              {l.isActive === false ? 'Retiré' : 'Proposé'}
                            </Pastille>
                          </td>
                        ) : null}
                        <td style={cellule}>
                          <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <Bouton
                              petit
                              disabled={!peut}
                              onClick={() => ouvrir({ kind: 'renommer', ligne: l })}
                            >
                              Renommer
                            </Bouton>
                            {cfg.retirable ? (
                              <Bouton
                                petit
                                ton="contour"
                                disabled={!peut}
                                onClick={() => ouvrir({ kind: 'basculer', ligne: l })}
                              >
                                {l.isActive === false ? 'Remettre' : 'Retirer des propositions'}
                              </Bouton>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
          );
        }}
      </Lecture>
      <Fenetre
        ouverte={geste !== null && geste.kind !== 'basculer'}
        titre={
          geste?.kind === 'renommer'
            ? `Renommer « ${geste.ligne.nameFr} »`
            : `Ajouter ${cfg.article} ${cfg.singulier}`
        }
        onFermer={fermer}
        occupe={action.occupe}
      >
        {geste?.kind === 'ajouter' && liste === 'langues' ? (
          <Champ
            libelle="Code (ISO 639, p. ex. wo)"
            valeur={code}
            onChange={setCode}
            maxLength={8}
          />
        ) : null}
        <Champ libelle="Nom en français" valeur={nom} onChange={setNom} maxLength={80} />
        {geste?.kind === 'ajouter' && cfg.categorie ? (
          <Champ
            libelle="Catégorie (facultatif)"
            valeur={categorie}
            onChange={setCategorie}
            maxLength={40}
          />
        ) : null}
        <Message message={action.message} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Bouton onClick={fermer}>Annuler</Bouton>
          <Bouton
            ton="principal"
            disabled={
              action.occupe ||
              !nomOk ||
              (geste?.kind === 'ajouter' && liste === 'langues' && code.trim().length < 2)
            }
            onClick={() => void valider()}
          >
            {geste?.kind === 'renommer' ? 'Enregistrer' : 'Ajouter'}
          </Bouton>
        </div>
      </Fenetre>
      <Confirmation
        ouverte={geste?.kind === 'basculer'}
        titre={
          geste?.kind === 'basculer' && geste.ligne.isActive === false
            ? `Remettre « ${geste.ligne.nameFr} »`
            : `Retirer « ${geste?.kind === 'basculer' ? geste.ligne.nameFr : ''} »`
        }
        consigne={
          geste?.kind === 'basculer' && geste.ligne.isActive === false
            ? 'L’entrée est de nouveau proposée aux membres. L’action est tracée dans le journal d’audit.'
            : 'L’entrée n’est plus proposée aux membres ; elle reste affichée sur les profils qui l’ont déjà. L’action est tracée dans le journal d’audit.'
        }
        libelle={
          geste?.kind === 'basculer' && geste.ligne.isActive === false ? 'Remettre' : 'Retirer'
        }
        onConfirmer={() => void valider()}
        onFermer={fermer}
        occupe={action.occupe}
        message={action.message}
      />
    </>
  );
}
