'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { myConnectionsResponseSchema, requiredLevel, type Capability } from '@app/shared';
import { memberApi } from '@/lib/api/member';
import { Modal } from '@/components/modal';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { niveauEcrit, useCapacites } from '@/lib/capacites';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE « + » DE LA BARRE HAUTE — UN RACCOURCI, PAS UNE PAGE                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le bouton + doit afficher un modal permettant d'envoyer vers la
 * page pour créer une story, une actualité, un guide, une demande d'aide, un
 * service, un événement, envoyer un message (liste les utilisateurs avec lesquels
 * il est lié toujours dans le modal avec le bouton discuter) : c'est donc un
 * raccourci. »
 *
 * MESURÉ avant : le `+` était un `<span>` portant un `<svg>`. Aucun rôle, aucun
 * nom accessible, aucun geste — ni cliquable ni atteignable au clavier.
 *
 * ── CE QUE LA FENÊTRE NE FAIT PAS ──────────────────────────────────────────
 *
 * Elle ne CRÉE rien. Chaque entrée est un lien vers l'écran qui sait créer la
 * chose, et chaque contact est un lien vers sa conversation. Une fenêtre qui
 * publierait depuis la barre haute dupliquerait sept écrans de composition, et
 * c'est précisément ce que « c'est donc un raccourci » exclut.
 *
 * ── LES SEPT DESTINATIONS, ET D'OÙ ELLES VIENNENT ─────────────────────────
 *
 * Les routes sont celles du produit, recopiées de `app/(app)` — pas inventées :
 * `/stories/nouvelle`, `/publications/nouvelle`, `/guides/nouveau`,
 * `/entraide/nouvelle`, `/services/nouveau`, `/agenda/nouveau`. La messagerie
 * n'a pas d'écran « nouvelle conversation » : on écrit à QUELQU'UN, d'où la
 * liste des contacts plutôt qu'une huitième entrée.
 *
 * ⚠ AUCUNE PLANCHE NE DESSINE CETTE FENÊTRE. Les libellés et la forme sont donc
 * écrits ici, en reprenant la grammaire des autres fenêtres de la maquette — même
 * coque, mêmes rayons, mêmes couleurs. REMONTÉ au porteur.
 */

/** Une destination de création. L'icône est le tracé que la maquette emploie ailleurs. */
interface Raccourci {
  readonly libelle: string;
  readonly detail: string;
  readonly vers: string;
  readonly trace: string;
  /**
   * LA CAPACITÉ QUE CETTE CRÉATION EXIGE.
   *
   * Le porteur : « les boutons de publications […] non inclus dans ses
   * autorisations doivent être désactivés […] quand il clique un pop-up doit
   * apparaître ». Cette feuille est l'ENTRÉE UNIQUE des six créations : la
   * garder ici les garde toutes, et au même endroit.
   *
   * Le niveau n'est PAS écrit ici — il vient de `CAPABILITIES`, la table que le
   * serveur applique. Le recopier voudrait dire le maintenir en deux endroits,
   * et l'un des deux finirait par mentir.
   */
  readonly capacite: Capability;
}

const RACCOURCIS: readonly Raccourci[] = [
  {
    libelle: 'Une story',
    detail: 'Un conseil, une découverte ou une information — visible 24 h.',
    vers: '/stories/nouvelle',
    capacite: 'post.create',
    trace: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  },
  {
    libelle: 'Une actualité',
    detail: 'Une victoire, une question, une info pour le fil.',
    vers: '/publications/nouvelle',
    capacite: 'post.create',
    trace: 'M4 5h16v14H4zM8 9h8M8 13h5',
  },
  {
    libelle: 'Un guide',
    detail: 'Une procédure que la communauté corrige et tient à jour.',
    vers: '/guides/nouveau',
    capacite: 'guide.write',
    trace: 'M5 4h9l5 5v11H5zM14 4v5h5',
  },
  {
    libelle: 'Une demande d’aide',
    detail: 'Un coup de main ponctuel, près de chez vous.',
    /**
     * `/entraide/nouveau`, AU MASCULIN — et c'était un 404 mesuré.
     *
     * Le porteur, capture à l'appui : la feuille « Créer » ouvrait une page
     * vide sur « Une demande d'aide ». La route existe pourtant depuis le
     * premier jour ; seule l'adresse écrite ici était fausse. Les sept
     * destinations de cette feuille sont désormais vérifiées au curl, une par
     * une : /stories/nouvelle 200, /publications/nouvelle 200, /guides/nouveau
     * 200, /entraide/nouveau 200, /services/mes-annonces 200, /agenda/nouveau
     * 200.
     */
    vers: '/entraide/nouveau',
    capacite: 'help.ask',
    trace: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5',
  },
  {
    libelle: 'Une annonce de service',
    detail: 'Un logement, une offre d’emploi, une fiche professionnelle.',
    /**
     * `/services/nouveau` N'EXISTE PAS — 404, mesuré — et il ne peut pas
     * exister tel quel : cette entrée couvre TROIS créations que le produit
     * sépare (`/services/logement/nouveau`, `/services/emploi/nouveau`, et la
     * fiche pro). En choisir une ferait entrer dans « logement » qui voulait
     * déposer une offre d'emploi.
     *
     * `/services/mes-annonces` est la page qui les offre toutes les trois —
     * « Mes annonces · Logement · Emploi » et « Créer ma fiche pro ». C'est la
     * destination juste pour un libellé qui dit « Un logement, une offre
     * d'emploi, une fiche professionnelle ».
     */
    vers: '/services/mes-annonces',
    capacite: 'housing.publish',
    trace: 'M4 20V8l8-4 8 4v12',
  },
  {
    libelle: 'Un événement',
    detail: 'Une rencontre, un pique-nique, un atelier.',
    vers: '/agenda/nouveau',
    capacite: 'event.create',
    trace: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  },
];

/** Un contact, tel que `GET /me/connections` le rend. */
interface Contact {
  readonly id: string;
  readonly handle: string;
  readonly nom: string;
  readonly initiales: string;
}

const TITRE_ID = 'dp-raccourcis-titre';

export function FenetreRaccourcis({ ouvert, onFermer }: {
  readonly ouvert: boolean;
  readonly onFermer: () => void;
}) {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [chargement, setChargement] = useState(false);
  const { peut } = useCapacites();
  /** La capacité refusée au dernier clic — elle ouvre l'invitation à monter. */
  const [refusee, setRefusee] = useState<Capability | null>(null);
  /**
   * DEMANDÉ UNE FOIS, ET C'EST UN `useRef` POUR UNE RAISON MESURÉE.
   *
   * La première version décidait « faut-il demander ? » sur la LONGUEUR de la
   * liste : `contacts.length === 0 && !chargement`. Pour un membre SANS contact,
   * la réponse laisse la liste vide — la condition redevient donc vraie dès que
   * `chargement` retombe, et l'effet repart. MESURÉ au navigateur : la fenêtre
   * restait sur « Chargement de vos contacts… » indéfiniment, en redemandant la
   * route en boucle.
   *
   * Une liste vide est une RÉPONSE, pas une absence de réponse. Ce qu'il faut
   * retenir, c'est qu'on a demandé — et un `useRef` ne relance pas l'effet.
   */
  const demande = useRef(false);

  /**
   * LES CONTACTS SONT DEMANDÉS À L'OUVERTURE, PAS AU MONTAGE.
   *
   * Cette fenêtre est montée sur les soixante-cinq écrans qui portent la barre.
   * Charger ses contacts à chaque page ferait un aller-retour par page pour une
   * liste que personne n'a demandée. On la demande la première fois qu'on ouvre,
   * et on la garde.
   */
  useEffect(() => {
    if (!ouvert || demande.current) return;
    demande.current = true;
    setChargement(true);
    void memberApi
      .get('/me/connections', myConnectionsResponseSchema)
      .then((page) => {
        setContacts(
          page.items.map((c) => ({
            id: c.userId,
            handle: c.handle,
            nom: c.displayName,
            initiales: initiales(c.displayName),
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, [ouvert]);

  const corps = (
    <>
      <h2 id={TITRE_ID} style={{ margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '-0.4px' }}>
        Créer
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px' }}>
        {RACCOURCIS.map((r) => {
          const ouvert = peut(r.capacite);

          /**
           * LE DESSIN EST ÉCRIT UNE FOIS, et c'est le CONTENANT qui change —
           * même raison que `CadreCliquable` : recopier le rond d'icône, le
           * libellé et le détail dans deux branches garantirait qu'un jour les
           * deux copies divergent.
           */
          const dedans = (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: '#E3F0EB',
                  color: '#0F5C48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={r.trace} />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>
                  {r.libelle}
                </span>
                <span style={{ display: 'block', fontSize: '12.5px', color: '#5D6B66' }}>
                  {ouvert ? r.detail : `Niveau ${niveauEcrit(requiredLevel(r.capacite))} requis`}
                </span>
              </span>
            </>
          );

          const dessin = {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '14px',
            textDecoration: 'none',
            color: '#16211D',
            minHeight: '44px',
            cursor: 'pointer',
          } as const;

          /**
           * ÉTEINT, CE N'EST PLUS UN LIEN — et ce n'est pas du zèle. Un `<a>`
           * neutralisé par `pointer-events: none` reste atteignable au clavier,
           * s'ouvre encore au clic long et en nouvel onglet : il emmènerait sur
           * la page que le niveau interdit, où le serveur refuserait sans que
           * rien n'ait expliqué pourquoi. Le `<button>`, lui, ne mène nulle part
           * et OUVRE l'invitation — ce que le porteur demande.
           */
          if (!ouvert) {
            return (
              <button
                key={r.vers}
                type="button"
                onClick={() => {
                  setRefusee(r.capacite);
                }}
                data-raccourci={r.vers}
                data-raccourci-eteint={r.capacite}
                style={{ ...dessin, opacity: 0.55, border: 'none', background: 'none', font: 'inherit', textAlign: 'left', width: '100%' }}
              >
                {dedans}
              </button>
            );
          }

          return (
            <Link
              key={r.vers}
              href={r.vers}
              onClick={onFermer}
              data-raccourci={r.vers}
              style={dessin}
            >
              {dedans}
            </Link>
          );
        })}
      </div>

      {/**
       * ── ÉCRIRE À QUELQU'UN ────────────────────────────────────────────────
       *
       * « Envoyer un message : liste les utilisateurs avec lesquels il est lié,
       * toujours dans le modal, avec le bouton discuter. » On n'ouvre donc pas un
       * écran de composition : on va DIRECTEMENT à la conversation avec la
       * personne, ce que `/messages?avec=` fait déjà.
       */}
      <div style={{ marginTop: '18px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#8A958F',
            padding: '0 12px 8px',
          }}
        >
          ÉCRIRE À
        </div>

        {contacts.length === 0 ? (
          <p
            role="status"
            style={{ margin: 0, padding: '0 12px', fontSize: '13px', color: '#5D6B66' }}
          >
            {chargement
              ? 'Chargement de vos contacts…'
              : 'Vous n’avez pas encore de contact. Les demandes se font depuis un profil.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {contacts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '6px 12px',
                  borderRadius: '14px',
                  minHeight: '44px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '999px',
                    background: '#B4581F',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {c.initiales}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: 600 }}>
                  {c.nom}
                </span>
                <Link
                  href={`/messages?avec=${encodeURIComponent(c.handle)}`}
                  onClick={onFermer}
                  data-discuter={c.handle}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '999px',
                    background: '#16785E',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    flexShrink: 0,
                  }}
                >
                  Discuter
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  /**
   * LA COQUE EST CELLE DES AUTRES FENÊTRES de ce dépôt — voile, panneau blanc,
   * rayon de 28 px, bouton de fermeture. `Modal` pose `role="dialog"`,
   * `aria-modal`, le piège de tabulation et la fermeture par Échap ; on ne
   * réécrit rien de tout cela.
   */
  const coque = (mobile: boolean) => (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        style={
          mobile
            ? {
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: '88vh',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: '28px 28px 0 0',
                padding: '20px 16px 28px',
              }
            : {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(560px, calc(100vw - 48px))',
                maxHeight: '82vh',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: '28px',
                padding: '22px 20px 24px',
              }
        }
      >
        <button
          type="button"
          data-modal-close=""
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            background: '#EEF2F0',
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#16211D',
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {corps}
      </div>
    </>
  );

  return (
    <>
      <Modal
        open={ouvert}
        onClose={onFermer}
        titleId={TITRE_ID}
        name="RACCOURCIS"
        desktop={coque(false)}
        mobile={coque(true)}
      />
      {/**
       * L'INVITATION EST MONTÉE À CÔTÉ DE LA FEUILLE, pas dedans : les deux sont
       * des fenêtres, et l'une s'ouvre par-dessus l'autre. L'imbriquer aurait
       * voulu dire fermer « Créer » pour expliquer, donc perdre le contexte du
       * geste.
       */}
      <FenetreNiveau
        capacite={refusee}
        onFermer={() => {
          setRefusee(null);
        }}
      />
    </>
  );
}

/** Les initiales, comme le reste du produit les compose. */
function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  const premieres = mots.slice(0, 2).map((m) => m[0] ?? '');
  return premieres.join('').toUpperCase();
}
