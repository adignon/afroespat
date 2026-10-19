'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FEED_LIMITS, type CommentRow, type CommentThread } from '@app/shared';
import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { MenuPublication } from '@/components/menu-publication';
import { EtatVide } from '@/components/etat-vide';
import { notifyError, notifySuccess } from '@/components/notifications';
import { urlMedia } from '@/lib/api/base';
import { A01GDesktop } from '@/screens/a01g/desktop.generated';
import { A01GMobile } from '@/screens/a01g/mobile.generated';
import { useSondageGuides, type FenetrePiece } from '@/screens/a01/use-sondage-guides';
import {
  bookmarkPost,
  deletePost,
  moveToTopic,
  reactToPost,
  unbookmarkPost,
  unreactToPost,
  updatePost,
} from '@/screens/accueil/api';
import { TYPE_STYLE, avatarDe } from '@/screens/accueil/from-api';
import { useMesReseaux } from '@/screens/accueil/use-mes-reseaux';
import { usePublication } from '@/screens/publication/use-publication';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A02 — LA PUBLICATION ET SES RÉPONSES, VIVANTES (AJOUT, lot G)             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * AJOUT HORS MAQUETTE, autorisé par le porteur : la planche A02 dessine UNE
 * publication d'exemple — « Fatou Ndiaye », « Parcours Santé · Lyon 7e », « 11
 * réponses · 4 soutiens » — écrite en dur, un compositeur qui n'est pas un champ
 * (« Écrire une réponse… » est un `<div>`, « Envoyer » un bouton sans geste), un
 * lien « Répondre » en `href="#"`, « GUIDES LIÉS · 3 » et « Lier un guide » inertes,
 * et un « Choisir un réseau » qui ne choisit rien. `/publications/:id` montrait
 * donc les vrais commentaires SOUS la publication de quelqu'un d'autre.
 *
 * Ce composant redessine ces pièces avec les valeurs EXACTES de la planche (couleurs,
 * rayons, retraits, tailles relevés dans `a02/*.generated.tsx`), nourries par
 * `GET /posts/:id`. Aucune couleur nouvelle, aucun rouge nouveau : le seul rouge
 * est celui de « Supprimer » dans `MenuPublication`, qui existait déjà.
 *
 * ── CE QUE CHAQUE GESTE FAIT, ET QUI DÉCIDE ────────────────────────────────
 *
 *   · répondre / commenter — `POST /comments`, une seule profondeur (§2.5) ;
 *   · modifier, supprimer SON commentaire — `PATCH`/`DELETE /comments/:id`. Le bouton
 *     « Modifier » n'est offert que tant que le SERVEUR dit `canEdit` (15 minutes) ;
 *   · réagir, enregistrer — comme sur le fil, mêmes routes ;
 *   · « Choisir un réseau » — `POST /posts/:id/move-to-topic` (§2.3), jamais
 *     automatique : l'offre vient de `canMoveToTopic`, que le serveur calcule ;
 *   · « Suite dans le réseau X » — le lien que la publication déplacée garde ;
 *   · « Lier un guide » — la fenêtre A01G du composeur (même crochet), puis
 *     `PATCH /posts/:id` avec les `guideIds` ;
 *   · l'état de MODÉRATION (13 §2) : « Contenu en vérification » (masqué par le
 *     pipeline, vu de son seul auteur) et « Contenu retiré » (corps non rendu).
 *
 * Le front PRÉVIENT, le serveur DÉCIDE : aucun `if (niveau)` ici. On tente, et un
 * `403 LEVEL_REQUIRED` ou un `422` remonte en message.
 */

type Etat = ReturnType<typeof usePublication>;

interface Contexte {
  readonly etat: Etat;
  readonly postId: string;
  readonly texte: string;
  readonly setTexte: (t: string) => void;
  readonly envoi: boolean;
  readonly envoyer: () => void;
  readonly reponse: { readonly id: string; readonly nom: string } | null;
  readonly repondreA: (cible: { id: string; nom: string } | null) => void;
  readonly edition: { readonly id: string; readonly texte: string } | null;
  readonly editer: (e: { id: string; texte: string } | null) => void;
  readonly enregistrerEdition: () => void;
  readonly demanderSuppressionCommentaire: (id: string) => void;
  readonly ouvrirModifierPost: () => void;
  readonly demanderSuppressionPost: () => void;
  readonly ouvrirDeplacement: () => void;
  readonly ouvrirLierGuide: () => void;
  readonly ouvrirSignalement: () => void;
  readonly reagir: () => void;
  readonly enregistrer: () => void;
  readonly reagi: boolean;
  readonly signet: boolean;
  readonly occupe: boolean;
}

const Ctx = createContext<Contexte | null>(null);

function utiliser(): Contexte {
  const c = useContext(Ctx);
  if (c === null) throw new Error('PublicationVivante : hors de PublicationProvider.');
  return c;
}

// ─── Le fournisseur : l'état, les gestes et les fenêtres ───────────────────────

export function PublicationProvider({
  postId,
  children,
}: {
  readonly postId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const etat = usePublication(postId, true);
  const { post } = etat;

  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [reponse, setReponse] = useState<{ id: string; nom: string } | null>(null);
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const [suppressionCommentaire, setSuppressionCommentaire] = useState<string | null>(null);
  const [suppressionPost, setSuppressionPost] = useState(false);
  const [modificationPost, setModificationPost] = useState<string | null>(null);
  const [deplacement, setDeplacement] = useState(false);
  const [signalement, setSignalement] = useState(false);
  const [fenetre, setFenetre] = useState<FenetrePiece>(null);
  const [occupe, setOccupe] = useState(false);
  /** Les états locaux du lecteur, posés SUR la réponse du serveur (jamais en optimiste). */
  const [lecteur, setLecteur] = useState<{ reagi?: boolean; signet?: boolean }>({});
  const reseaux = useMesReseaux(deplacement);

  const pieces = useSondageGuides({
    fenetre,
    setFenetre,
    surLierGuides: (ids) => {
      void lier(ids);
      return true;
    },
  });

  const echec = useCallback((message: string): void => {
    notifyError(message);
  }, []);

  async function lier(ids: readonly string[]): Promise<void> {
    if (post === null) return;
    setOccupe(true);
    try {
      const detail = await updatePost(post.id, { body: post.body, guideIds: [...ids] });
      etat.remplacerPost(detail.post);
      notifySuccess(ids.length === 0 ? 'Guides déliés.' : 'Guides liés à la publication.');
    } catch (cause) {
      echec(cause instanceof Error ? cause.message : 'Les guides n’ont pas pu être liés.');
    } finally {
      setOccupe(false);
    }
  }

  const envoyer = useCallback((): void => {
    const corps = texte.trim();
    if (corps === '' || envoi) return;
    setEnvoi(true);
    void etat.commenter(corps, reponse?.id).then((e) => {
      setEnvoi(false);
      if (e !== null) {
        echec(e.message);
        return;
      }
      setTexte('');
      setReponse(null);
    });
  }, [echec, envoi, etat, reponse, texte]);

  const enregistrerEdition = useCallback((): void => {
    if (edition === null) return;
    const corps = edition.texte.trim();
    if (corps === '') return;
    setOccupe(true);
    void etat.modifierCommentaire(edition.id, corps).then((e) => {
      setOccupe(false);
      if (e !== null) {
        echec(e.message);
        return;
      }
      setEdition(null);
      notifySuccess('Commentaire modifié.');
    });
  }, [echec, edition, etat]);

  const confirmerSuppressionCommentaire = (): void => {
    if (suppressionCommentaire === null) return;
    setOccupe(true);
    void etat.supprimerCommentaire(suppressionCommentaire).then((e) => {
      setOccupe(false);
      setSuppressionCommentaire(null);
      if (e !== null) echec(e.message);
      else notifySuccess('Commentaire supprimé.');
    });
  };

  const confirmerSuppressionPost = (): void => {
    if (post === null) return;
    setOccupe(true);
    void deletePost(post.id)
      .then(() => {
        notifySuccess('Publication supprimée.');
        router.push('/accueil');
      })
      .catch((cause: unknown) => {
        setSuppressionPost(false);
        echec(cause instanceof Error ? cause.message : 'La suppression n’a pas abouti.');
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const confirmerModificationPost = (): void => {
    if (post === null || modificationPost === null) return;
    const corps = modificationPost.trim();
    if (corps === '') return;
    setOccupe(true);
    void updatePost(post.id, { body: corps })
      .then((detail) => {
        etat.remplacerPost(detail.post);
        setModificationPost(null);
        notifySuccess('Publication modifiée.');
      })
      .catch((cause: unknown) => {
        echec(cause instanceof Error ? cause.message : 'La modification n’a pas abouti.');
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const choisirReseau = (communityId: string): void => {
    if (post === null) return;
    setOccupe(true);
    void moveToTopic(post.id, communityId)
      .then(async (reponseDeplacement) => {
        setDeplacement(false);
        notifySuccess(reponseDeplacement.post.label);
        // La publication rendue par le serveur porte `movedTo` : on la relit.
        await etat.recharger();
      })
      .catch((cause: unknown) => {
        echec(cause instanceof Error ? cause.message : 'Le déplacement n’a pas abouti.');
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const reagir = useCallback((): void => {
    if (post === null || occupe) return;
    const deja = lecteur.reagi ?? post.reaction.mine !== null;
    setOccupe(true);
    void (deja ? unreactToPost(post.id) : reactToPost(post.id))
      .then((r) => {
        setLecteur((l) => ({ ...l, reagi: r.mine !== null }));
        etat.remplacerPost({
          ...post,
          counter: { ...post.counter, count: r.reactionCount, displayCount: r.displayCount, word: r.word },
          reaction: { ...post.reaction, mine: r.mine },
        });
      })
      .catch((cause: unknown) => {
        echec(cause instanceof Error ? cause.message : 'La réaction n’a pas abouti.');
      })
      .finally(() => {
        setOccupe(false);
      });
  }, [echec, etat, lecteur.reagi, occupe, post]);

  const enregistrer = useCallback((): void => {
    if (post === null || occupe) return;
    const deja = lecteur.signet ?? post.bookmarked;
    setOccupe(true);
    void (deja ? unbookmarkPost(post.id) : bookmarkPost(post.id))
      .then(({ bookmarked }) => {
        setLecteur((l) => ({ ...l, signet: bookmarked }));
      })
      .catch((cause: unknown) => {
        echec(cause instanceof Error ? cause.message : 'L’enregistrement n’a pas abouti.');
      })
      .finally(() => {
        setOccupe(false);
      });
  }, [echec, lecteur.signet, occupe, post]);

  const valeur: Contexte = useMemo(
    () => ({
      etat,
      postId,
      texte,
      setTexte,
      envoi,
      envoyer,
      reponse,
      repondreA: setReponse,
      edition,
      editer: setEdition,
      enregistrerEdition,
      demanderSuppressionCommentaire: setSuppressionCommentaire,
      ouvrirModifierPost: () => {
        setModificationPost(post?.body ?? '');
      },
      demanderSuppressionPost: () => {
        setSuppressionPost(true);
      },
      ouvrirDeplacement: () => {
        setDeplacement(true);
      },
      ouvrirLierGuide: () => {
        pieces.semerGuides((post?.guides ?? []).map((g) => g.id));
        pieces.ouvrirGuides();
      },
      ouvrirSignalement: () => {
        setSignalement(true);
      },
      reagir,
      enregistrer,
      reagi: lecteur.reagi ?? post?.reaction.mine != null,
      signet: lecteur.signet ?? post?.bookmarked ?? false,
      occupe,
    }),
    // `pieces` change à chaque rendu (objet neuf) : seuls ses gestes servent ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [etat, postId, texte, envoi, envoyer, reponse, edition, enregistrerEdition, post, reagir, enregistrer, lecteur, occupe],
  );

  return (
    <Ctx.Provider value={valeur}>
      {children}
      <FenetreSignalement
        sujet={signalement && post !== null ? { type: 'POST', id: post.id } : null}
        onFermer={() => {
          setSignalement(false);
        }}
      />
      <FenetreConfirmation
        ouverte={suppressionPost}
        nom="SUPPRESSION"
        titre="Supprimer cette publication ?"
        question="Elle disparaîtra du fil, avec ses commentaires, ses réactions et ses images."
        precision="Ce geste est définitif : la publication ne pourra pas être restaurée."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onConfirmer={confirmerSuppressionPost}
        onAnnuler={() => {
          setSuppressionPost(false);
        }}
      />
      <FenetreConfirmation
        ouverte={suppressionCommentaire !== null}
        nom="SUPPRESSION-COMMENTAIRE"
        titre="Supprimer ce commentaire ?"
        question="Il disparaîtra de la discussion."
        precision="Ce geste est définitif : le commentaire ne pourra pas être restauré."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onConfirmer={confirmerSuppressionCommentaire}
        onAnnuler={() => {
          setSuppressionCommentaire(null);
        }}
      />
      <FenetreConfirmation
        ouverte={modificationPost !== null}
        nom="MODIFIER-PUBLICATION"
        titre="Modifier la publication"
        question="Le texte est modifiable pendant quinze minutes, puis figé."
        champ={{
          libelle: 'Texte de la publication',
          valeur: modificationPost ?? '',
          onChange: setModificationPost,
          max: FEED_LIMITS.postBodyMax,
          min: FEED_LIMITS.postBodyMin,
        }}
        libelleConfirmer="Enregistrer"
        occupe={occupe}
        onConfirmer={confirmerModificationPost}
        onAnnuler={() => {
          setModificationPost(null);
        }}
      />
      <Modal
        open={deplacement}
        onClose={() => {
          setDeplacement(false);
        }}
        titleId="deplacement-titre"
        name="DEPLACEMENT"
        desktop={
          <FenetreReseaux
            feuille={false}
            reseaux={reseaux.reseaux.map((r) => ({ id: r.id, nom: r.name }))}
            chargement={reseaux.chargement}
            occupe={occupe}
            onChoisir={choisirReseau}
          />
        }
        mobile={
          <FenetreReseaux
            feuille
            reseaux={reseaux.reseaux.map((r) => ({ id: r.id, nom: r.name }))}
            chargement={reseaux.chargement}
            occupe={occupe}
            onChoisir={choisirReseau}
          />
        }
      />
      <Modal
        open={fenetre === 'A01G'}
        onClose={() => {
          setFenetre(null);
        }}
        titleId="a01g-titre"
        name="A01G"
        desktop={<A01GDesktop {...pieces.guidesFenetre} />}
        mobile={<A01GMobile {...pieces.guidesFenetre} />}
      />
    </Ctx.Provider>
  );
}

// ─── « Choisir un réseau » ──────────────────────────────────────────────────

function FenetreReseaux({
  feuille,
  reseaux,
  chargement,
  occupe,
  onChoisir,
}: {
  readonly feuille: boolean;
  readonly reseaux: readonly { readonly id: string; readonly nom: string }[];
  readonly chargement: boolean;
  readonly occupe: boolean;
  readonly onChoisir: (id: string) => void;
}) {
  return (
    <PanneauFenetre titreId="deplacement-titre" titre="Déplacer vers un réseau" feuille={feuille}>
      <div style={{ padding: feuille ? '12px 18px 20px' : '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: '#5D6B66' }}>
          La question, son texte et ses commentaires sont copiés dans un sujet du réseau que vous choisissez. La
          publication reste, avec un lien « Suite dans le réseau ».
        </p>
        {chargement ? <EtatVide texte="Chargement de vos réseaux…" /> : null}
        {!chargement && reseaux.length === 0 ? (
          <EtatVide texte="Vous n’êtes membre d’aucun réseau pour l’instant." />
        ) : null}
        {reseaux.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={occupe}
            onClick={() => {
              onChoisir(r.id);
            }}
            data-choix-reseau=""
            style={{
              height: '48px',
              padding: '0 16px',
              borderRadius: '14px',
              border: '1px solid #E6EBE9',
              background: '#fff',
              font: 'inherit',
              fontSize: '14px',
              fontWeight: 700,
              color: '#16211D',
              textAlign: 'left',
              cursor: occupe ? 'default' : 'pointer',
            }}
          >
            {r.nom}
          </button>
        ))}
      </div>
    </PanneauFenetre>
  );
}

// ─── La publication, ses réponses, le compositeur ──────────────────────────────

const CHECK = (taille: number) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="#16785E" aria-label="Profil vérifié">
    <circle cx="12" cy="12" r="10" />
    <path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" />
  </svg>
);

export function PublicationVivante({ largeur }: { readonly largeur: 'desktop' | 'mobile' }) {
  const c = utiliser();
  const { etat } = c;
  const mobile = largeur === 'mobile';

  if (etat.chargement && etat.post === null) {
    return <EtatVide texte="Chargement de la publication…" />;
  }
  if (etat.echec !== null || etat.post === null) {
    return <EtatVide texte={etat.echec?.message ?? 'Cette publication est introuvable.'} />;
  }
  const post = etat.post;
  const style = TYPE_STYLE[post.type];
  const av = avatarDe(post.author);
  const PROFIL = post.author.handle;
  const retiree = post.moderationState === 'REMOVED';
  const enVerification = post.moderationState === 'IN_REVIEW';
  const mot = post.type === 'QUESTION' ? 'réponse' : 'commentaire';
  const n = post.commentCount;
  const fil = etat.fil?.items ?? [];

  const pastilleType = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: style.tBg,
        color: style.tFg,
        fontSize: '11px',
        fontWeight: 700,
        padding: '4px 11px',
        borderRadius: '999px',
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: style.tDot }} />
      {post.typeLabel}
    </span>
  );

  const rond = (taille: number, police: string) => {
    const corps = (
      <span
        style={{
          width: `${String(taille)}px`,
          height: `${String(taille)}px`,
          borderRadius: '999px',
          background: av.bg,
          color: '#fff',
          fontSize: police,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {av.i}
      </span>
    );
    return (
      <Link
        href={`/@${PROFIL}`}
        data-avatar-profil=""
        aria-label={`Voir le profil de ${post.author.displayName}`}
        style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}
      >
        {corps}
      </Link>
    );
  };

  const nom = (
    <Link
      href={`/@${PROFIL}`}
      data-nom-profil=""
      style={{
        fontWeight: 700,
        fontSize: mobile ? '14.5px' : '15.5px',
        letterSpacing: mobile ? undefined : '-0.3px',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      {post.author.displayName}
    </Link>
  );

  const encart = (texte: string, repere: string): ReactNode => (
    <div
      data-moderation-etat={repere}
      role="status"
      style={{
        marginTop: '14px',
        background: '#F2F5F4',
        borderRadius: '14px',
        padding: '12px 14px',
        fontSize: '13px',
        lineHeight: 1.5,
        color: '#5D6B66',
      }}
    >
      {texte}
    </div>
  );

  const carte = (
    <article
      data-publication=""
      style={{
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: mobile ? '20px' : '22px',
        padding: mobile ? '16px' : '22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? '10px' : '12px' }}>
        {rond(mobile ? 40 : 46, mobile ? '12px' : '13px')}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            {nom}
            {post.author.level === 'L0' ? null : CHECK(mobile ? 14 : 15)}
            {mobile ? null : pastilleType}
          </div>
          <div style={{ fontSize: mobile ? '12px' : '12.5px', color: '#8A958F', marginTop: '3px' }}>
            {post.context.text}
          </div>
        </div>
        {post.isAuthor && !retiree ? (
          <MenuPublication onModifier={c.ouvrirModifierPost} onSupprimer={c.demanderSuppressionPost} />
        ) : null}
      </div>

      {enVerification
        ? encart(
            'Contenu en vérification. Notre équipe relit cette publication : tant qu’elle n’a pas fini, vous seul la voyez.',
            'IN_REVIEW',
          )
        : null}

      {retiree ? (
        encart('Contenu retiré par la modération.', 'REMOVED')
      ) : (
        <>
          <p
            style={{
              margin: '14px 0 0',
              fontSize: mobile ? '14.5px' : '15px',
              lineHeight: mobile ? 1.58 : 1.62,
              whiteSpace: 'pre-wrap',
            }}
          >
            {post.body}
          </p>
          {post.media.length > 0 ? (
            <div
              style={{
                marginTop: '14px',
                display: 'grid',
                gridTemplateColumns: post.media.length === 1 ? '1fr' : '1fr 1fr',
                gap: '6px',
              }}
            >
              {post.media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={urlMedia(m.url)}
                  alt=""
                  style={{ width: '100%', borderRadius: '14px', objectFit: 'cover', maxHeight: '320px' }}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      {post.movedTo !== null ? (
        <Link
          href={`/reseaux/${post.movedTo.community.slug}/sujets/${post.movedTo.topicId}`}
          data-suite-reseau=""
          style={{
            marginTop: '14px',
            background: '#E3F0EB',
            borderRadius: '18px',
            padding: '14px 16px',
            display: 'block',
            fontSize: '13.5px',
            fontWeight: 700,
            color: '#0F5C48',
            lineHeight: 1.5,
            textDecoration: 'none',
          }}
        >
          {post.movedTo.label} →
        </Link>
      ) : null}

      {post.canMoveToTopic && !retiree ? (
        <div
          data-deplacer-reseau=""
          style={{
            marginTop: '14px',
            background: '#E3F0EB',
            borderRadius: '18px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexWrap: mobile ? 'wrap' : 'nowrap',
          }}
        >
          <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: '#0F5C48', lineHeight: 1.5 }}>
            Cette question intéresse du monde. La déplacer vers un réseau ?
          </span>
          <button
            type="button"
            onClick={c.ouvrirDeplacement}
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '999px',
              background: '#16785E',
              color: '#fff',
              border: 'none',
              font: 'inherit',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Choisir un réseau
          </button>
        </div>
      ) : null}

      {retiree ? null : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '14px',
            fontSize: '12.5px',
            color: '#5D6B66',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <strong style={{ color: '#16211D' }}>{n}</strong> {n > 1 ? `${mot}s` : mot}
          </span>
          {post.type === 'QUESTION' ? null : (
            <>
              <span style={{ width: '4px', height: '4px', borderRadius: '999px', background: '#C9D2CE' }} />
          <span>
            {post.counter.displayCount} {post.counter.word}
          </span>
            </>
          )}
          <span style={{ flex: 1 }} />
          {post.isAuthor ? null : (
            <button
              type="button"
              onClick={c.ouvrirSignalement}
              style={{ border: 'none', background: 'none', font: 'inherit', fontSize: '12.5px', fontWeight: 700, color: '#5D6B66', cursor: 'pointer', padding: 0 }}
            >
              Signaler
            </button>
          )}
          <button
            type="button"
            onClick={c.enregistrer}
            disabled={c.occupe}
            aria-pressed={c.signet}
            style={{ border: 'none', background: 'none', font: 'inherit', fontSize: '12.5px', fontWeight: 700, color: c.signet ? '#16785E' : '#5D6B66', cursor: 'pointer', padding: 0 }}
          >
            {c.signet ? 'Enregistrée' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={c.reagir}
            disabled={c.occupe}
            aria-pressed={c.reagi}
            style={{
              height: '34px',
              padding: '0 16px',
              borderRadius: '999px',
              border: 'none',
              font: 'inherit',
              fontSize: '12.5px',
              fontWeight: 700,
              background: c.reagi ? style.reactBg : style.aBg,
              color: c.reagi ? '#fff' : style.aFg,
              cursor: 'pointer',
            }}
          >
            {post.reaction.actionLabel}
          </button>
        </div>
      )}
    </article>
  );

  const guidesMobile = mobile ? <GuidesLiesPublication largeur="mobile" /> : null;

  const reponses = (
    <section
      aria-label="Réponses"
      style={{
        background: mobile ? 'transparent' : '#fff',
        border: mobile ? 'none' : '1px solid #E6EBE9',
        borderRadius: '22px',
        padding: mobile ? '0' : '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: mobile ? '12px' : '18px',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
        {n === 0 ? 'AUCUNE RÉPONSE' : `${String(n)} ${(n > 1 ? `${mot}s` : mot).toLocaleUpperCase('fr-FR')}`}
      </div>
      {fil.length === 0 ? (
        <EtatVide texte="Aucune réponse pour l’instant. Soyez la première personne à répondre." />
      ) : null}
      {fil.map((racine, i) => (
        <LigneCommentaire key={'removed' in racine ? `r${String(i)}` : racine.id} ligne={racine} profond={false} mobile={mobile} />
      ))}
      {etat.fil?.nextCursor != null ? (
        <button
          type="button"
          disabled={etat.suiteEnCours}
          onClick={() => {
            void etat.chargerSuite().then((e) => {
              if (e !== null) notifyError(e.message);
            });
          }}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'none', font: 'inherit', fontSize: '13px', fontWeight: 700, color: '#16785E', cursor: 'pointer', padding: 0 }}
        >
          {etat.suiteEnCours ? 'Chargement…' : 'Voir la suite des réponses'}
        </button>
      ) : null}
    </section>
  );

  const compositeur = (
    <form
      data-compositeur-reponse=""
      onSubmit={(event) => {
        event.preventDefault();
        c.envoyer();
      }}
      style={{
        position: 'sticky',
        bottom: mobile ? 0 : '12px',
        background: '#fff',
        border: mobile ? 'none' : '1px solid #E6EBE9',
        borderTop: mobile ? '1px solid #E6EBE9' : undefined,
        borderRadius: mobile ? 0 : '22px',
        padding: mobile ? '10px 12px 28px' : '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 5,
      }}
    >
      {c.reponse === null ? null : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#5D6B66', padding: '0 6px' }}>
          <span style={{ flex: 1 }}>
            Réponse à <strong style={{ color: '#16211D' }}>{c.reponse.nom}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              c.repondreA(null);
            }}
            style={{ border: 'none', background: 'none', font: 'inherit', fontSize: '12.5px', fontWeight: 700, color: '#5D6B66', cursor: 'pointer' }}
          >
            Annuler
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: mobile ? '8px' : '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={c.texte}
          maxLength={FEED_LIMITS.commentBodyMax}
          onChange={(event) => {
            c.setTexte(event.target.value);
          }}
          placeholder="Écrire une réponse…"
          aria-label="Écrire une réponse"
          style={{
            flex: 1,
            minWidth: 0,
            height: '44px',
            borderRadius: '999px',
            background: '#F2F5F4',
            border: 'none',
            padding: '0 16px',
            font: 'inherit',
            fontSize: '13.5px',
            color: '#16211D',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={c.envoi || c.texte.trim() === ''}
          aria-label="Envoyer"
          style={{
            height: '44px',
            minWidth: mobile ? '44px' : undefined,
            padding: mobile ? '0' : '0 20px',
            borderRadius: '999px',
            background: '#16785E',
            color: '#fff',
            border: 'none',
            font: 'inherit',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            opacity: c.envoi || c.texte.trim() === '' ? 0.55 : 1,
          }}
        >
          {mobile ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          ) : c.envoi ? (
            'Envoi…'
          ) : (
            'Envoyer'
          )}
        </button>
      </div>
    </form>
  );

  if (mobile) {
    // Le téléphone : le corps défile, la barre de saisie reste en bas (comme la planche).
    return (
      <>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {carte}
          {retiree ? null : guidesMobile}
          {retiree ? null : reponses}
        </div>
        {retiree ? null : compositeur}
      </>
    );
  }
  if (retiree) return carte;
  return (
    <>
      {carte}
      {reponses}
      {compositeur}
    </>
  );
}

function LigneCommentaire({
  ligne,
  profond,
  mobile,
}: {
  readonly ligne: CommentRow | CommentThread['replies'][number];
  readonly profond: boolean;
  readonly mobile: boolean;
}) {
  const c = utiliser();
  const retrait = profond ? (mobile ? '34px' : '48px') : '0px';

  if ('removed' in ligne) {
    return (
      <div style={{ display: 'flex', gap: mobile ? '10px' : '12px', paddingLeft: retrait }}>
        <div
          data-commentaire-retire=""
          style={{ flex: 1, background: '#F2F5F4', borderRadius: '14px', padding: '12px 14px', fontSize: '12.5px', color: '#5D6B66' }}
        >
          Ce commentaire a été retiré par la modération.
        </div>
      </div>
    );
  }

  const av = avatarDe(ligne.author);
  const PROFIL = ligne.author.handle;
  const enEdition = c.edition?.id === ligne.id;
  const taille = mobile ? 32 : 36;

  return (
    <>
      <div style={{ display: 'flex', gap: mobile ? '10px' : '12px', paddingLeft: retrait }} data-commentaire={ligne.id}>
        <Link
          href={`/@${PROFIL}`}
          data-avatar-profil=""
          aria-label={`Voir le profil de ${ligne.author.displayName}`}
          style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}
        >
          <span
            style={{
              width: `${String(taille)}px`,
              height: `${String(taille)}px`,
              borderRadius: '999px',
              background: av.bg,
              color: '#fff',
              fontSize: mobile ? '10px' : '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {av.i}
          </span>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              background: mobile ? '#fff' : '#F6F8F7',
              border: mobile ? '1px solid #EAEEEC' : undefined,
              borderRadius: mobile ? '14px' : '16px',
              padding: mobile ? '10px 12px' : '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link
                href={`/@${PROFIL}`}
                data-nom-profil=""
                style={{ fontSize: mobile ? '13px' : '13.5px', fontWeight: 700, color: 'inherit', textDecoration: 'none' }}
              >
                {ligne.author.displayName}
              </Link>
              {ligne.author.level === 'L0' || mobile ? null : CHECK(13)}
            </div>
            {enEdition && c.edition !== null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <textarea
                  value={c.edition.texte}
                  maxLength={FEED_LIMITS.commentBodyMax}
                  aria-label="Modifier le commentaire"
                  onChange={(event) => {
                    c.editer({ id: ligne.id, texte: event.target.value });
                  }}
                  rows={3}
                  style={{ width: '100%', borderRadius: '12px', border: '1px solid #DDE3E0', background: '#fff', padding: '8px 10px', font: 'inherit', fontSize: '13.5px', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={c.occupe || c.edition.texte.trim() === ''}
                    onClick={c.enregistrerEdition}
                    style={{ height: '34px', padding: '0 16px', borderRadius: '999px', background: '#16785E', color: '#fff', border: 'none', font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      c.editer(null);
                    }}
                    style={{ height: '34px', padding: '0 12px', borderRadius: '999px', background: 'none', color: '#5D6B66', border: 'none', font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: mobile ? '13px' : '13.5px', lineHeight: mobile ? 1.5 : 1.55, marginTop: '3px', whiteSpace: 'pre-wrap' }}>
                {ligne.body}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#8A958F', marginTop: '6px', paddingLeft: '4px', flexWrap: 'wrap' }}>
            <span>{ligne.relativeTime}</span>
            {profond ? null : (
              <button
                type="button"
                data-repondre=""
                onClick={() => {
                  c.repondreA({ id: ligne.id, nom: ligne.author.displayName });
                }}
                style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '12px', fontWeight: 700, color: '#5D6B66', cursor: 'pointer' }}
              >
                Répondre
              </button>
            )}
            {ligne.isAuthor && ligne.canEdit && !enEdition ? (
              <button
                type="button"
                data-modifier-commentaire=""
                onClick={() => {
                  c.editer({ id: ligne.id, texte: ligne.body });
                }}
                style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '12px', fontWeight: 700, color: '#5D6B66', cursor: 'pointer' }}
              >
                Modifier
              </button>
            ) : null}
            {ligne.isAuthor ? (
              <button
                type="button"
                data-supprimer-commentaire=""
                onClick={() => {
                  c.demanderSuppressionCommentaire(ligne.id);
                }}
                style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '12px', fontWeight: 700, color: '#5D6B66', cursor: 'pointer' }}
              >
                Supprimer
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {'replies' in ligne
        ? ligne.replies.map((r, i) => (
            <LigneCommentaire key={'removed' in r ? `rr${String(i)}` : r.id} ligne={r} profond mobile={mobile} />
          ))
        : null}
    </>
  );
}

// ─── « GUIDES LIÉS » ────────────────────────────────────────────────────────

const LIVRE =
  'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z';

export function GuidesLiesPublication({ largeur }: { readonly largeur: 'desktop' | 'mobile' }) {
  const c = utiliser();
  const post = c.etat.post;
  if (post === null || post.moderationState === 'REMOVED') return null;
  const guides = post.guides;
  // Un lecteur qui n'est pas l'auteur n'a rien à lier ; et sans guide lié, rien à lire.
  if (!post.isAuthor && guides.length === 0) return null;
  const mobile = largeur === 'mobile';

  return (
    <div
      data-guides-lies=""
      style={{
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: mobile ? '20px' : '22px',
        padding: mobile ? '14px 16px' : '18px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
          GUIDES LIÉS · {guides.length}
        </span>
        {post.isAuthor ? (
          <button
            type="button"
            data-lier-guide=""
            disabled={c.occupe}
            onClick={c.ouvrirLierGuide}
            style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '12px', fontWeight: 700, color: '#16785E', cursor: 'pointer' }}
          >
            {guides.length === 0 ? 'Lier un guide' : 'Modifier les guides'}
          </button>
        ) : null}
      </div>
      {guides.length === 0 ? <EtatVide compact texte="Aucun guide lié à cette publication." /> : null}
      {guides.map((g) => (
        <Link
          key={g.id}
          href={`/guides/${g.slug}`}
          style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '14px', color: 'inherit', textDecoration: 'none' }}
        >
          <span style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#E3F0EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={LIVRE} />
            </svg>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}>{g.title}</span>
            <span style={{ display: 'block', fontSize: '11.5px', color: '#8A958F', marginTop: '2px' }}>Lié par l’auteur</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Le titre de l'en-tête mobile : le TYPE de la publication, « Publication » en attendant. */
export function TitrePublication() {
  const c = utiliser();
  return <>{c.etat.post?.typeLabel ?? 'Publication'}</>;
}
