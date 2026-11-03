'use client';

import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  PUBLIC_SEARCH_MIN_CHARS,
  guideDetailResponseSchema,
  publicCommunityAboutSchema,
  publicSearchResponseSchema,
  shortName,
  type GuideDetailResponse,
  type PublicCommunityAbout,
  type PublicLanding,
  type PublicSearchResponse,
} from '@app/shared';
import { lirePublic } from '@/lib/api/public';
import {
  CATEGORIES,
  ETAPES,
  POINTS_PARCOURS,
  QUESTIONS,
  avatarInitiales,
  couverture,
  dateEvenement,
  dateLongue,
  libelleCategorieGuide,
  libelleTypeEvenement,
  minutesDeLecture,
  sectionsDeMarkdown,
  type Categorie,
} from './contenu';

/**
 * LA DONNÉE ET LE COMPORTEMENT DE LA PAGE D'ACCUEIL — ce que `landing.generated.tsx` (le dessin, transcodé de la
 * maquette) reçoit. Les noms sont ceux de la maquette (`renderVals` / `overlayVals`) ; les valeurs, elles, viennent de
 * `GET /public/landing`, `/public/search`, `/public/communities/:id` et `GET /guides/:slug`.
 *
 * Tout chiffre absent de la réponse (sous le seuil de membres) fait DISPARAÎTRE sa ligne ou sa section : la page
 * n'affiche jamais un nombre inventé.
 */

type Evenement = (e?: { preventDefault?: () => void }) => void;
type Saisie = (e: { target: { value: string } }) => void;
type Couche = null | 'search' | 'city' | 'guide' | 'group';
type Onglet = 'all' | 'guides' | 'groups' | 'cities';

export interface ResultatVue {
  readonly title: string;
  readonly sub: string;
  readonly img: string;
  readonly radius: string;
  readonly tag: string;
  readonly tagBg: string;
  readonly tagFg: string;
  readonly open: () => void;
}

export interface LandingVals {
  readonly aboutSpan: number;
  readonly backFromCity: () => void;
  readonly backToSearch: () => void;
  readonly cats: readonly Categorie[];
  readonly cities: readonly { slot: string; src: string; n: string; s: string; credit: string; href: string }[];
  readonly cityLabel: string;
  readonly cityList: readonly { n: string; s: string; on: boolean; bg: string; pick: () => void }[];
  readonly close: () => void;
  readonly countriesLabel: string;
  readonly cq: string;
  readonly cqRef: RefObject<HTMLInputElement | null>;
  readonly entraideStats: readonly { v: string; l: string }[];
  readonly events: readonly { slot: string; src: string; tag: string; title: string; when: string; by: string; n: number; credit: string; href: string }[];
  readonly faces: readonly string[];
  readonly faq: readonly { q: string; a: string; open: boolean; bg: string; rot: string; toggle: () => void }[];
  readonly group: {
    readonly cover: string;
    readonly vis: string;
    readonly kind: string;
    readonly name: string;
    readonly sub: string;
    readonly desc: string;
    readonly isPublic: boolean;
    readonly isPrivate: boolean;
    readonly hasRules: boolean;
    readonly rules: readonly { n: number; t: string }[];
    readonly stats: readonly { v: string; l: string }[];
    readonly admins: readonly { img: string; n: string; r: string }[];
  };
  readonly groups: readonly { title: string; items: readonly ResultatVue[] }[];
  readonly guide: {
    readonly tags: readonly string[];
    readonly title: string;
    readonly authorImg: string;
    readonly author: string;
    readonly meta: string;
    readonly updated: string;
    readonly cover: string;
    readonly sections: readonly { h: string; p: string }[];
    readonly useful: number;
    readonly comments: number;
  };
  readonly hasCities: boolean;
  readonly hasEntraide: boolean;
  readonly hasEvents: boolean;
  readonly hasQuotes: boolean;
  readonly hero3: boolean;
  readonly heroCols: string;
  readonly heroStat: string;
  readonly how: readonly { t: string; p: string; cta: string; d: string; bg: string; fg: string; col: string; mw: string }[];
  readonly howCols: string;
  readonly isCity: boolean;
  readonly isGroup: boolean;
  readonly isGuide: boolean;
  readonly isSearch: boolean;
  readonly lockedTabs: readonly string[];
  readonly marquee: ReactNode;
  readonly narrow: boolean;
  readonly narrowNav: boolean;
  readonly noResults: boolean;
  readonly onCq: Saisie;
  readonly onQ: Saisie;
  readonly openCity: () => void;
  readonly openLogin: Evenement;
  readonly openSearch: () => void;
  readonly openSignup: Evenement;
  readonly otherCities: readonly { n: string; m: string }[];
  readonly parcoursPts: typeof POINTS_PARCOURS;
  readonly q: string;
  readonly qRef: RefObject<HTMLInputElement | null>;
  readonly quotes: readonly { t: string; n: string; r: string; img: string; bg: string; accent: string }[];
  readonly sheetRadius: string;
  readonly showCountries: boolean;
  readonly showHeroStat: boolean;
  readonly showLogin: boolean;
  readonly tabs: readonly { label: string; on: () => void; bg: string; fg: string; bd: string }[];
  readonly textOrder: number;
  readonly wide: boolean;
}

/** Les photos des villes que la page sait illustrer (hébergées avec le site) ; les autres villes n'ont pas de photo. */
const PHOTOS_VILLES: Readonly<Record<string, { src: string; credit: string; href: string }>> = {
  lyon: { src: '/landing/1602087594298-706ccc894bfd-1000.jpg', credit: 'Photo by Nguyen Dang Hoang Nhu on Unsplash', href: 'https://unsplash.com/@nguyendhn' },
  paris: { src: '/landing/1503917988258-f87a78e3c995-1000.jpg', credit: 'Photo by Ilnur Kalimullin on Unsplash', href: 'https://unsplash.com/@kalimullin' },
};

const CITATIONS = [
  { bg: '#EFF7F3', accent: '#16785E' },
  { bg: '#FFF6EF', accent: '#E0733A' },
  { bg: '#F2F5F4', accent: '#0F5C48' },
] as const;

export function useLandingVals(landing: PublicLanding): LandingVals {
  const router = useRouter();
  const qRef = useRef<HTMLInputElement | null>(null);
  const cqRef = useRef<HTMLInputElement | null>(null);

  const [w, setW] = useState(1280);
  const [faq, setFaq] = useState(0);
  const [couche, setCouche] = useState<Couche>(null);
  const [villeDepuis, setVilleDepuis] = useState<Couche>(null);
  const [q, setQ] = useState('');
  const [cq, setCq] = useState('');
  const [ville, setVille] = useState('*');
  /** Le pays choisi (code ISO) — « tout le pays » quand aucune ville n'est retenue ; `null` : tous les pays. */
  const [pays, setPays] = useState<string | null>(null);
  /** L'étape du sélecteur de lieu : la liste des pays, puis les villes du pays choisi. */
  const [etapeLieu, setEtapeLieu] = useState<'pays' | 'villes'>('pays');
  const [onglet, setOnglet] = useState<Onglet>('all');
  const [resultats, setResultats] = useState<PublicSearchResponse | null>(null);
  const [guideSel, setGuideSel] = useState<{ slug: string; titre: string } | null>(null);
  const [guideDetail, setGuideDetail] = useState<GuideDetailResponse | null>(null);
  const [groupeSel, setGroupeSel] = useState<{ id: string; nom: string } | null>(null);
  const [groupeDetail, setGroupeDetail] = useState<PublicCommunityAbout | null>(null);

  // La largeur de la fenêtre : la mise en page de la maquette en dépend (rendu serveur à 1 280 px, corrigé au montage).
  useEffect(() => {
    const maj = () => setW(window.innerWidth);
    maj();
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);

  // Une fenêtre ouverte fige le défilement de la page et donne le focus à son champ.
  useEffect(() => {
    document.body.style.overflow = couche === null ? '' : 'hidden';
    const cible = couche === 'search' ? qRef : couche === 'city' ? cqRef : null;
    if (cible === null) return;
    const t = setTimeout(() => cible.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [couche]);
  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  // La recherche : sans compte, deux caractères au moins, un peu d'attente entre deux frappes.
  useEffect(() => {
    const terme = q.trim();
    if (couche !== 'search' || terme.length < PUBLIC_SEARCH_MIN_CHARS) {
      setResultats(null);
      return;
    }
    const controle = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q: terme });
      if (ville !== '*') params.set('city', ville);
      else if (pays !== null) params.set('country', pays);
      lirePublic(`/public/search?${params.toString()}`, publicSearchResponseSchema, { signal: controle.signal }).then(
        setResultats,
        () => {
          if (!controle.signal.aborted) setResultats({ guides: [], communities: [], cities: [] });
        },
      );
    }, 250);
    return () => {
      clearTimeout(t);
      controle.abort();
    };
  }, [q, ville, pays, couche]);

  useEffect(() => {
    if (guideSel === null) return;
    setGuideDetail(null);
    lirePublic(`/guides/${encodeURIComponent(guideSel.slug)}`, guideDetailResponseSchema).then(setGuideDetail, () => undefined);
  }, [guideSel]);

  useEffect(() => {
    if (groupeSel === null) return;
    setGroupeDetail(null);
    lirePublic(`/public/communities/${groupeSel.id}`, publicCommunityAboutSchema).then(setGroupeDetail, () => undefined);
  }, [groupeSel]);

  const allerConnexion: Evenement = useCallback(
    (e) => {
      e?.preventDefault?.();
      router.push('/connexion');
    },
    [router],
  );

  const wide = w >= 900;
  const hero3 = w >= 1080;
  const { stats, entraide } = landing;
  const lieuDuPays = landing.places.find((p) => p.code === pays);
  const nomVille = landing.places.flatMap((p) => p.cities).find((c) => c.slug === ville)?.name ?? ville;

  // ── Les résultats de la recherche.
  const groups = useMemo(() => {
    const sortie: { title: string; items: ResultatVue[] }[] = [];
    const villesProposees =
      resultats !== null
        ? resultats.cities
        : landing.cities.slice(0, 3).map((c) => ({ slug: c.slug, name: c.name }));
    if (resultats !== null && (onglet === 'all' || onglet === 'guides') && resultats.guides.length > 0) {
      sortie.push({
        title: 'GUIDES',
        items: resultats.guides.map((g, i) => ({
          title: g.title,
          sub: `${libelleCategorieGuide(g.category)} · ${String(g.helpfulCount)} ont trouvé utile`,
          img: avatarInitiales(g.title, i),
          radius: '14px',
          tag: 'Lecture libre',
          tagBg: '#E3F0EB',
          tagFg: '#0F5C48',
          open: () => {
            setGuideSel({ slug: g.slug, titre: g.title });
            setCouche('guide');
          },
        })),
      });
    }
    if (resultats !== null && (onglet === 'all' || onglet === 'groups') && resultats.communities.length > 0) {
      sortie.push({
        title: 'COMMUNAUTÉS',
        items: resultats.communities.map((c, i) => ({
          title: c.name,
          sub: [c.cityName, c.memberCount === null ? null : `${String(c.memberCount)} membres`].filter(Boolean).join(' · '),
          img: avatarInitiales(c.name, i + 2),
          radius: '999px',
          tag: 'Public',
          tagBg: '#E3F0EB',
          tagFg: '#0F5C48',
          open: () => {
            setGroupeSel({ id: c.id, nom: c.name });
            setCouche('group');
          },
        })),
      });
    }
    if ((onglet === 'all' || onglet === 'cities') && villesProposees.length > 0) {
      sortie.push({
        title: 'VILLES',
        items: villesProposees.map((v, i) => ({
          title: v.name,
          sub: 'Voir ses guides et son réseau',
          img: avatarInitiales(v.name, i + 4),
          radius: '14px',
          tag: 'Filtrer',
          tagBg: '#FBE3D4',
          tagFg: '#B4581F',
          open: () => {
            setVille(v.slug);
            setQ('');
          },
        })),
      });
    }
    return sortie;
  }, [resultats, onglet, landing.cities]);

  const aRecherche = q.trim().length >= PUBLIC_SEARCH_MIN_CHARS;
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cqNorm = norm(cq).trim();
  const membresDe = (n: number | null): string => (n === null ? '' : `${String(n)} membres`);
  const lieux: { n: string; s: string; on: boolean; pick: () => void }[] =
    etapeLieu === 'pays' || lieuDuPays === undefined
      ? [
          {
            n: 'Tous les pays',
            s: membresDe(stats.members),
            on: pays === null && ville === '*',
            pick: () => {
              setPays(null);
              setVille('*');
              setCq('');
              setCouche('search');
            },
          },
          ...landing.places.map((p) => ({
            n: p.name,
            s: [`${String(p.cities.length)} ${p.cities.length > 1 ? 'villes' : 'ville'}`, membresDe(p.memberCount)].filter(Boolean).join(' · '),
            on: pays === p.code,
            pick: () => {
              setPays(p.code);
              setEtapeLieu('villes');
              setCq('');
            },
          })),
        ]
      : [
          {
            n: '← Tous les pays',
            s: '',
            on: false,
            pick: () => {
              setEtapeLieu('pays');
              setCq('');
            },
          },
          {
            n: `Tout : ${lieuDuPays.name}`,
            s: membresDe(lieuDuPays.memberCount),
            on: ville === '*' && pays === lieuDuPays.code,
            pick: () => {
              setVille('*');
              setCq('');
              setCouche('search');
            },
          },
          ...lieuDuPays.cities.map((c) => ({
            n: c.name,
            s: membresDe(c.memberCount),
            on: ville === c.slug,
            pick: () => {
              setVille(c.slug);
              setCq('');
              setCouche('search');
            },
          })),
        ];
  const cityList = lieux
    .filter((c) => cqNorm === '' || norm(c.n).includes(cqNorm))
    .map((c) => ({ ...c, bg: c.on ? '#EFF7F3' : 'transparent' }));

  // ── La lecture libre d'un guide.
  const guide: LandingVals['guide'] = (() => {
    const g = guideDetail?.guide;
    const corps = guideDetail?.currentVersion?.body ?? '';
    const sections = sectionsDeMarkdown(corps);
    return {
      tags: g === undefined ? [] : [libelleCategorieGuide(g.category), g.city?.name ?? 'Toutes villes'],
      title: g?.title ?? guideSel?.titre ?? '',
      authorImg: avatarInitiales(g?.author?.displayName ?? '?', 1),
      author: g?.author === undefined || g.author === null ? 'Un membre' : shortName(g.author.displayName),
      meta: corps === '' ? '' : `${String(minutesDeLecture(corps))} min de lecture`,
      updated: g === undefined ? '' : `Mis à jour le ${dateLongue(g.lastContentUpdateAt)}`,
      cover: couverture(2),
      sections: sections.length > 0 ? sections : guideDetail === null ? [{ h: '', p: 'Chargement du guide…' }] : [{ h: '', p: 'Ce guide n’a pas encore de contenu.' }],
      useful: g?.helpfulCount ?? 0,
      comments: g?.commentCount ?? 0,
    };
  })();

  // ── La fiche « À propos » d'un réseau de ville public.
  const group: LandingVals['group'] = (() => {
    const g = groupeDetail;
    return {
      cover: couverture(0),
      vis: 'Publique',
      kind: 'Ville',
      name: g?.name ?? groupeSel?.nom ?? '',
      sub: g === null ? '' : [g.cityName, g.memberCount === null ? null : `${String(g.memberCount)} membres`].filter(Boolean).join(' · '),
      desc: g === null ? 'Chargement…' : (g.description ?? 'Le réseau des membres de cette ville : entraide, démarches, rencontres.'),
      isPublic: true,
      isPrivate: false,
      hasRules: false,
      rules: [],
      stats:
        g === null
          ? []
          : [
              ...(g.memberCount === null ? [] : [{ v: String(g.memberCount), l: 'membres' }]),
              { v: String(g.foundedYear), l: 'création' },
            ],
      admins: (g?.moderators ?? []).map((m, i) => ({ img: avatarInitiales(m.name, i), n: m.name, r: m.role === 'OWNER' ? 'Admin' : 'Modérateur' })),
    };
  })();

  // ── Les chiffres : jamais sous le seuil.
  const faces = ['A', 'K', 'F'].map((t, i) => `url("${avatarInitiales(t, i)}")`);
  const chip = (t: string, i: number) =>
    createElement(
      'span',
      {
        key: i,
        style: { flexShrink: 0, height: 36, padding: '0 16px', borderRadius: 999, background: '#F2F5F4', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' },
      },
      createElement('span', { style: { width: 8, height: 8, borderRadius: 999, background: i % 2 ? '#E0733A' : '#16785E' } }),
      t,
    );
  const marquee = createElement(
    'div',
    { style: { display: 'flex', gap: 10, width: 'max-content', animation: 'lpmarq 40s linear infinite' } },
    [...stats.countryNames, ...stats.countryNames].map(chip),
  );

  const entraideStats = [
    ...(entraide.medianFirstReplyMinutes === null ? [] : [{ v: `${String(entraide.medianFirstReplyMinutes)} min`, l: 'délai médian de première réponse' }]),
    ...(entraide.resolvedPercent === null ? [] : [{ v: `${String(entraide.resolvedPercent)} %`, l: 'questions résolues' }]),
    ...(entraide.publishedGuides === null ? [] : [{ v: String(entraide.publishedGuides), l: 'guides publiés' }]),
  ];

  const [villesCartes, autresVilles] = [landing.cities.slice(0, 2), landing.cities.slice(2)];

  return {
    aboutSpan: 1,
    backFromCity: () => setCouche(villeDepuis === 'search' ? 'search' : null),
    backToSearch: () => setCouche('search'),
    cats: CATEGORIES,
    cities: villesCartes.map((c) => ({
      slot: `ville-${c.slug}`,
      src: PHOTOS_VILLES[c.slug]?.src ?? '',
      n: c.name,
      s: c.memberCount === null ? 'La communauté de la ville' : `${String(c.memberCount)} membres`,
      credit: PHOTOS_VILLES[c.slug]?.credit ?? '',
      href: PHOTOS_VILLES[c.slug]?.href ?? '',
    })),
    cityLabel: ville !== '*' ? nomVille : lieuDuPays !== undefined ? `Tout : ${lieuDuPays.name}` : 'Tous les pays',
    cityList,
    close: () => setCouche(null),
    countriesLabel: stats.countries === null ? '' : `Des membres venus de ${String(stats.countries)} pays`,
    cq,
    cqRef,
    entraideStats,
    events: landing.events.map((e) => ({
      slot: `evenement-${e.id}`,
      src: '',
      tag: libelleTypeEvenement(e.type),
      title: e.title,
      when: dateEvenement(e.startsAt),
      by: e.by,
      n: e.attendeeCount,
      credit: '',
      href: '',
    })),
    faces,
    faq: QUESTIONS.map(([question, reponse], i) => {
      const open = faq === i;
      return { q: question, a: reponse, open, bg: open ? '#F6F8F7' : '#fff', rot: open ? '45deg' : '0deg', toggle: () => setFaq((f) => (f === i ? -1 : i)) };
    }),
    group,
    groups,
    guide,
    hasCities: landing.cities.length > 0,
    hasEntraide: entraideStats.length > 0,
    hasEvents: landing.events.length > 0,
    hasQuotes: landing.quotes.length > 0,
    hero3,
    heroCols: hero3 ? '1fr minmax(0,1.5fr) 1fr' : '1fr',
    heroStat:
      stats.members === null
        ? ''
        : stats.cities === null
          ? `${String(stats.members)} membres`
          : `${String(stats.members)} membres dans ${String(stats.cities)} villes`,
    how: ETAPES.map((e, i) => ({
      ...e,
      col: wide ? (i === 0 ? '1' : i === 1 ? '2' : '1 / span 2') : 'auto',
      mw: wide && i === 2 ? '460px' : '100%',
    })),
    howCols: wide ? '1fr 1fr' : '1fr',
    isCity: couche === 'city',
    isGroup: couche === 'group',
    isGuide: couche === 'guide',
    isSearch: couche === 'search',
    lockedTabs: ['Fil', 'Événements', 'Membres', 'Album'],
    marquee,
    narrow: !hero3,
    narrowNav: !wide,
    // « Aucun résultat » : une recherche lancée qui ne rend rien (pas pendant la frappe d'un seul caractère).
    noResults: aRecherche && resultats !== null && groups.length === 0,
    onCq: (e) => setCq(e.target.value),
    onQ: (e) => setQ(e.target.value),
    openCity: () => {
      setEtapeLieu(pays === null ? 'pays' : 'villes');
      setVilleDepuis(couche);
      setCouche('city');
    },
    openLogin: allerConnexion,
    openSearch: () => setCouche('search'),
    openSignup: allerConnexion,
    otherCities: autresVilles.map((c) => ({ n: c.name, m: c.memberCount === null ? '' : String(c.memberCount) })),
    parcoursPts: POINTS_PARCOURS,
    q,
    qRef,
    quotes: landing.quotes.map((c, i) => ({
      t: `« ${c.text} »`,
      n: c.authorName ?? 'Un membre',
      r: c.context ?? '',
      img: 'none',
      bg: CITATIONS[i % CITATIONS.length]?.bg ?? '#F2F5F4',
      accent: CITATIONS[i % CITATIONS.length]?.accent ?? '#16785E',
    })),
    sheetRadius: w < 640 ? '0px' : '28px',
    showCountries: stats.countries !== null && stats.countryNames.length > 0,
    showHeroStat: stats.members !== null,
    showLogin: w >= 560,
    tabs: (
      [
        ['all', 'Tout'],
        ['guides', 'Guides'],
        ['groups', 'Communautés'],
        ['cities', 'Villes'],
      ] as const
    ).map(([k, label]) => ({
      label,
      on: () => setOnglet(k),
      bg: onglet === k ? '#16785E' : '#fff',
      fg: onglet === k ? '#fff' : '#16211D',
      bd: onglet === k ? '#16785E' : '#E6EBE9',
    })),
    textOrder: wide ? 0 : 1,
    wide,
  };
}
