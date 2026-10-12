'use client';

import { useCallback, useState } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH01, SQUELETTE_H01, type PorteeChoisie } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H01Desktop } from '@/screens/h01/desktop.generated';
import { H01Mobile } from '@/screens/h01/mobile.generated';

/**
 * H01 — Fil d'entraide (`/entraide`, 06 §5).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/05 Entraide.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — les
 * littéraux devenus des données l'ont été par DÉCLARATION dans
 * `tools/screens/05-entraide.mjs`, sous la clé `donnees`.
 *
 * COMPOSANT CLIENT, et c'est le jeton qui le décide : il vit en mémoire, dans la
 * clôture de `lib/api/session.ts`, et n'existe que dans le navigateur. Un composant
 * serveur n'a aucun moyen d'appeler `/help` au nom du membre.
 *
 * `chargerH01` est une fonction DE MODULE, donc STABLE : `EcranDonnees` la met dans
 * les dépendances de son effet, et une fonction anonyme rechargerait en boucle.
 *
 * RÈGLE DURE (14 §2) : l'entraide n'est JAMAIS payante. Cet écran ne porte aucun
 * encart d'abonnement, aucun verrou, aucune mention de plan — la maquette n'en
 * dessine pas non plus, ce qui a été vérifié plutôt que supposé.
 */
export default function HelpListPage() {
  /**
   * ── LE FILTRE DE TYPE EST UN ÉTAT DE PAGE, ET IL RECHARGE ────────────────
   *
   * Le porteur : « rends aussi la page, les filtres etc. dynamique ».
   *
   * `useDonnees` relance son effet quand `charger` CHANGE D'IDENTITÉ — c'est le
   * seul mécanisme qu'il offre, et six autres écrans s'en servent déjà. Le
   * filtre part donc dans la requête (`?type=`), ce qui est la seule façon juste
   * sur une liste paginée : trier la page déjà reçue donnerait un filtre vide
   * alors que la demande existe, simplement parce qu'elle est page deux.
   *
   * ⚠ LE COMMENTAIRE CI-DESSUS DISAIT « `chargerH01` est une fonction DE MODULE,
   * donc STABLE ». Ce n'est plus vrai, et c'est voulu : `useCallback` lui rend
   * une identité stable TANT QUE le filtre ne bouge pas, ce qui conserve la
   * propriété qui comptait — pas de rechargement en boucle.
   */
  const [type, setType] = useState('*');
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PORTÉE EST LE SECOND ÉTAT DE CETTE PAGE, ET ELLE CHANGE D'APPEL       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, devant les deux pastilles mobiles « Toutes · N » et « Vous pouvez
   * aider · N » : « Intègre donc. »
   *
   * Elles ne trient pas le même tableau : elles lisent DEUX ROUTES —
   * `GET /help` et `GET /help/can-help` — et la seconde est une liste calculée
   * depuis les types d'aide déclarés au profil et les étapes franchies (§2.6). La
   * portée entre donc dans les dépendances de `charger`, exactement comme le
   * filtre de type, et `useDonnees` relance son effet quand l'identité change.
   *
   * ── CHANGER DE PORTÉE REMET LE TYPE À « TOUT », ET C'EST DÉLIBÉRÉ ─────────
   *
   * `helpCanHelpQuerySchema` n'accepte ni `type` ni rien d'autre que `limit` et
   * `radiusKm` : sous « Vous pouvez aider », la rangée de types s'éteint (voir
   * `filtresType`). Garder « Trajet » en mémoire pendant qu'il est éteint, puis le
   * RÉAPPLIQUER au retour sur « Toutes », afficherait un fil filtré sous une
   * rangée que le membre n'a pas touchée depuis deux gestes. On repart donc de
   * « Tout », qui est l'état que la rangée montre.
   */
  const [portee, setPortee] = useState<PorteeChoisie>('toutes');
  const choisirPortee = useCallback((cle: PorteeChoisie) => {
    setPortee(cle);
    setType('*');
  }, []);
  const charger = useCallback(
    () => chargerH01({ portee, type, onPortee: choisirPortee, onType: setType }),
    [portee, type, choisirPortee],
  );

  return (
    <EcranDonnees
      charger={charger}
      attente="Chargement du fil d’entraide…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est mesuré : sans cela,
       * `/entraide` répondait 200 avec une coquille — ni rail, ni panneau de
       * section, ni barre basse dans le HTML servi. Voir `SQUELETTE_H01`.
       */
      squelette={SQUELETTE_H01}
    >
      {(donnees) => (
        <ScreenFrames
          screen="H01"
          desktop={<H01Desktop {...donnees} />}
          mobile={<H01Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
