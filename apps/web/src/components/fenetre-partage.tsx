'use client';

import { useState } from 'react';
import { myConnectionsResponseSchema } from '@app/shared';
import { ApiError, memberApi } from '@/lib/api/index';
import { notifyError, notifySuccess } from '@/components/notifications';
import { Modal } from '@/components/modal';
import { A01PDesktop } from '@/screens/a01p/desktop.generated';
import { A01PMobile } from '@/screens/a01p/mobile.generated';
import { useMesReseaux } from '@/screens/accueil/use-mes-reseaux';
import { ecrireAAuteur, publierDansReseau } from '@/screens/accueil/api';
import { avatarColor, contactsFiltres, initialesDeReseau, initials } from '@/screens/accueil/from-api';
import { shareButtonFor, shareOut as SORTIES } from '@/screens/a01/data';
import { shareContactsDe } from '@/screens/a01p/data';
import type { A01PData } from '@/screens/a01p/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA FEUILLE « PARTAGER » — DÉSORMAIS GÉNÉRALE À SON SUJET                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le bouton back sur mobile et les icon du header ne marchent
 * pas. » L'un des quatre est le PARTAGE, et la page du guide n'avait aucune
 * feuille à monter.
 *
 * ── CE QU'ELLE ÉTAIT, ET POURQUOI ELLE DÉMÉNAGE ─────────────────────────────
 *
 * Elle vivait dans `screens/accueil/cartes-fil-vivantes.tsx`, en fonction LOCALE
 * et non exportée, et elle prenait un `postId` : elle composait son lien
 * (`/publications/:id`), sa phrase (« Je partage cette publication avec vous »)
 * et son objet de courriel (« Une publication de la diaspora ») autour de ce seul
 * identifiant. Rien d'autre ne la liait à une publication.
 *
 * C'est exactement le marché que `FenetreCommentaires` a passé au lot précédent
 * — « emprunter A01C au guide » — et il se tient ici dans les mêmes termes : UNE
 * SOURCE, DEUX EMPLOIS. La recopier pour le guide aurait fait deux feuilles qui
 * auraient divergé au premier changement de maquette ; et le dessin, lui, est
 * strictement le même (les cadres `a01p` sont transcodés, fenêtre centrée sur
 * ordinateur, feuille du bas sur mobile).
 *
 * ── LES TROIS SEULES CHOSES QUI DÉPENDENT DU SUJET ──────────────────────────
 *
 * Relevé, pas supposé : le lien, la phrase du message privé, et l'objet du
 * courriel. Tout le reste de la feuille est déjà générique —
 * « Partagé à 3 contacts. », « Lien copié. », « Le partage dans X n'a pas
 * abouti. » — et les DEUX ROUTES employées ne savent rien du sujet : un message
 * privé transporte un texte, une publication de réseau transporte un texte.
 *
 * ⚠ IL N'EXISTE TOUJOURS AUCUNE ROUTE DE PARTAGE — ni `POST /posts/:id/share`,
 * ni compteur, ni l'équivalent pour un guide. La page du fil le disait déjà, et
 * la solution reste la même : « ENVOYER À UN CONTACT » est un message privé
 * (`ecrireAAuteur`), et « DANS UN RÉSEAU » est une publication de réseau
 * (`publierDansReseau`, `createPostSchema.communityId`). Les deux routes portent
 * toutes les règles qu'un partage doit tenir ; une route de partage les aurait
 * redites.
 *
 * ⚠ CE QUI RESTE EN DEÇÀ POUR LE GUIDE, et qui est REMONTÉ plutôt que bricolé :
 * la CARTE DU SUJET en tête de la feuille (`partageSujet`) reste nulle, comme
 * elle l'était sur le fil, et pour la même raison — « la feuille s'ouvre depuis
 * un écran qui l'affiche déjà, et aller rechercher ce qu'on vient de lire serait
 * un appel pour rien ». Le cadre rend alors la feuille sans son encart, ce que le
 * ternaire du gabarit prévoit. La remplir demanderait une prise de plus, et une
 * décision de produit sur ce qu'une carte de guide y montre (voir l'arbitrage
 * déjà écrit pour A01C dans `guide-screen.tsx`).
 */
export function FenetrePartage({
  lien,
  message,
  objetCourriel,
  onFermer,
}: {
  /**
   * LE LIEN PARTAGÉ — et `null` quand la feuille est FERMÉE.
   *
   * Une seule prise porte les deux, exactement comme `postId` le faisait : un
   * `ouverte` séparé aurait permis l'état « ouverte sans lien », où les trois
   * sorties de « AILLEURS » (copier, WhatsApp, courriel) n'auraient rien eu à
   * donner. Le lien EST la condition d'existence de cette feuille.
   *
   * ⚠ IL EST COMPOSÉ PAR L'APPELANT, et il le doit : lui seul connaît l'adresse
   * de son sujet — `/publications/:id` pour une publication, `/guides/:slug`
   * pour un guide, dont §2.1 fige le slug « jamais modifié » précisément pour
   * qu'un lien partagé continue de fonctionner.
   */
  readonly lien: string | null;
  /**
   * LE TEXTE ENVOYÉ, lien compris.
   *
   * C'est l'appelant qui l'écrit en entier plutôt que de nous laisser coller une
   * phrase et une adresse : « Je partage cette publication avec vous : … » et
   * « Je partage ce guide avec vous : … » ne diffèrent pas que par un mot, et une
   * composition faite ici aurait figé la ponctuation pour tous les sujets à
   * venir.
   */
  readonly message: string;
  /** L'objet du `mailto:` — « Une publication de la diaspora », « Un guide… ». */
  readonly objetCourriel: string;
  readonly onFermer: () => void;
}) {
  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState<readonly number[]>([]);
  const [enVol, setEnVol] = useState(false);
  const [contacts, setContacts] = useState<
    readonly {
      readonly i: string;
      readonly bg: string;
      readonly name: string;
      readonly handle: string;
    }[]
  >([]);
  const [reseauEnCours, setReseauEnCours] = useState<string | null>(null);
  const [reseauxPartages, setReseauxPartages] = useState<readonly string[]>([]);
  const mesReseaux = useMesReseaux(lien !== null);
  const [demandes, setDemandes] = useState(false);

  /** Les contacts ne sont demandés qu'à l'ouverture, et une seule fois. */
  if (lien !== null && !demandes) {
    setDemandes(true);
    void memberApi
      .get('/me/connections', myConnectionsResponseSchema)
      .then((page) => {
        setContacts(
          /**
           * `GET /me/connections` REND LE MEMBRE À PLAT — `handle`,
           * `displayName`, `avatarUrl` — et non sous une clé `member`. Vérifié au
           * schéma, pas supposé : la première version lisait `c.member` et le
           * compilateur l'a dit.
           *
           * `avatarDe` ATTEND UN `MemberSummary` ENTIER — niveau, phase, ville —
           * que cette route ne rend pas. On compose donc le rond avec les deux
           * seules fabriques dont il a besoin, celles-là mêmes que `avatarDe`
           * emploie : les initiales du nom et la teinte du pseudo.
           */
          page.items.map((c) => ({
            i: initials(c.displayName),
            bg: avatarColor(c.handle),
            name: c.displayName,
            handle: c.handle,
          })),
        );
      })
      .catch(() => undefined);
  }

  const visibles = contactsFiltres(contacts, recherche);

  const donnees: A01PData = {
    /**
     * LA CARTE DU SUJET reste nulle : ce composant ne charge PAS ce qui est
     * partagé — la feuille s'ouvre depuis un écran qui l'affiche déjà, et aller
     * rechercher ce qu'on vient de lire serait un appel pour rien. Le cadre rend
     * alors la feuille sans son encart, ce que le ternaire du gabarit prévoit.
     */
    partageSujet: null,
    partageRecherche: recherche,
    onPartageRecherche: (e) => {
      setRecherche(e.target.value);
    },
    partageAucun: recherche.trim() !== '' && visibles.length === 0,
    shareContacts: visibles.map(({ contact, rang }) => ({
      ...shareContactsDe([contact], choisis.includes(rang) ? [0] : [], () => {
        setChoisis((c) => (c.includes(rang) ? c.filter((x) => x !== rang) : [...c, rang]));
      })[0]!,
    })),
    shareNets: mesReseaux.reseaux.map((reseau) => ({
      ...initialesDeReseau(reseau.name, reseau.id),
      name: reseau.name,
      sub: `${String(reseau.memberCount)} membre${reseau.memberCount > 1 ? 's' : ''}`,
      action: reseauxPartages.includes(reseau.id)
        ? 'Partagé'
        : reseauEnCours === reseau.id
          ? 'Envoi…'
          : 'Partager',
      bloque: reseauxPartages.includes(reseau.id) || reseauEnCours !== null,
      onPartager: (): void => {
        if (lien === null || reseauEnCours !== null) return;
        setReseauEnCours(reseau.id);
        void publierDansReseau(reseau.id, lien)
          .then(() => {
            setReseauxPartages((c) => [...c, reseau.id]);
            notifySuccess(`Partagé dans ${reseau.name}.`);
          })
          .catch((cause: unknown) => {
            notifyError(
              cause instanceof ApiError
                ? cause.displayMessage
                : `Le partage dans ${reseau.name} n’a pas abouti.`,
            );
          })
          .finally(() => {
            setReseauEnCours(null);
          });
      },
    })),
    shareOut: SORTIES.map((sortie) => ({
      label: sortie.label,
      icon: sortie.icon,
      onChoisir: (): void => {
        if (lien === null) return;
        if (sortie.label === 'Copier le lien') {
          void navigator.clipboard
            .writeText(lien)
            .then(() => {
              notifySuccess('Lien copié.');
            })
            .catch(() => {
              notifyError('Le lien n’a pas pu être copié.');
            });
          return;
        }
        const vers =
          sortie.label === 'WhatsApp'
            ? `https://wa.me/?text=${encodeURIComponent(message)}`
            : `mailto:?subject=${encodeURIComponent(objetCourriel)}&body=${encodeURIComponent(message)}`;
        window.open(vers, '_blank', 'noopener,noreferrer');
      },
    })),
    ...shareButtonFor(choisis.length),
    partageBloque: choisis.length === 0 || enVol,
    onPartager: (): void => {
      if (choisis.length === 0 || enVol || lien === null) return;
      setEnVol(true);
      const handles = choisis
        .map((rang) => contacts[rang]?.handle)
        .filter((h): h is string => h !== undefined);
      void Promise.allSettled(handles.map((handle) => ecrireAAuteur(handle, message)))
        .then((issues) => {
          const partis = issues.filter((i) => i.status === 'fulfilled').length;
          if (partis === 0) {
            notifyError('Le partage n’a pu être envoyé à personne.');
            return;
          }
          notifySuccess(`Partagé à ${String(partis)} contact${partis > 1 ? 's' : ''}.`);
          setChoisis([]);
          onFermer();
        })
        .finally(() => {
          setEnVol(false);
        });
    },
  };

  return (
    <Modal
      open={lien !== null}
      onClose={onFermer}
      titleId="a01p-titre"
      name="A01P"
      desktop={<A01PDesktop {...donnees} />}
      mobile={<A01PMobile {...donnees} />}
    />
  );
}
