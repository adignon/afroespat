/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DISJONCTEUR DE LA SOCKET — UNE CONNEXION QUI TOMBE AUSSITÔT S'ARRÊTE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ en production : sur la page Messages, l'API recevait des RAFALES de deux appels
 * par seconde (la liste des conversations, les notifications, les messages), pendant une
 * vingtaine de secondes, puis reprenait — jusqu'à déclencher des limites de débit (429).
 * Chaque connexion de la socket diffuse « resync » (tout se relit) ; une connexion qui
 * s'établit puis tombe aussitôt, en boucle, relit donc tout à chaque tour.
 *
 * Le polling de repli (15 s) est le filet voulu quand la socket est coupée ; une socket qui
 * SE REBRANCHE chaque seconde en est l'inverse : elle coûte plus que le polling qu'elle
 * remplace. Ce disjoncteur compte les connexions trop brèves : après `seuil` de suite, il
 * suspend la socket pour `suspensionMs`, et seul le polling de repli travaille. Une
 * connexion qui tient (`dureeMinimaleMs`) remet le compte à zéro.
 *
 * Pur et sans horloge propre : l'appelant passe l'heure, ce qui le rend éprouvable.
 */
export class DisjoncteurTempsReel {
  private courtes = 0;
  private etabliA: number | null = null;
  private jusqua = 0;

  constructor(
    private readonly seuil = 3,
    private readonly dureeMinimaleMs = 10_000,
    private readonly suspensionMs = 5 * 60_000,
  ) {}

  /** La socket vient d'être admise (« ready »). */
  etabli(maintenant: number): void {
    this.etabliA = maintenant;
  }

  /** La socket est tombée. Rend `true` si le disjoncteur vient de s'ouvrir. */
  perdu(maintenant: number): boolean {
    const brève = this.etabliA !== null && maintenant - this.etabliA < this.dureeMinimaleMs;
    this.etabliA = null;
    this.courtes = brève ? this.courtes + 1 : 0;
    if (this.courtes < this.seuil) return false;
    this.courtes = 0;
    this.jusqua = maintenant + this.suspensionMs;
    return true;
  }

  suspendu(maintenant: number): boolean {
    return maintenant < this.jusqua;
  }

  /** Les millisecondes qui restent avant de pouvoir réessayer. */
  restant(maintenant: number): number {
    return Math.max(0, this.jusqua - maintenant);
  }
}
