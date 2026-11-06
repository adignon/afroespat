import { describe, expect, it } from 'vitest';
import { NAVIGATION_ADMIN, entreeDuChemin, navigationPour, peutOuvrir, quiPeut, reservePour } from './navigation-admin';

describe('la navigation de l’administration', () => {
  const toutes = NAVIGATION_ADMIN.flatMap((g) => g.entrees);

  it('range les quinze écrans par métier, sans doublon', () => {
    expect(NAVIGATION_ADMIN.map((g) => g.titre)).toEqual(['Pilotage', 'Communauté', 'Contenu', 'Offre', 'Configuration']);
    expect(toutes).toHaveLength(15);
    expect(new Set(toutes.map((e) => e.href)).size).toBe(15);
    for (const e of toutes) expect(e.href.startsWith('/admin')).toBe(true);
  });

  it('un rôle ne voit que les écrans qu’il peut traiter', () => {
    const libelles = (r: Parameters<typeof navigationPour>[0]) => navigationPour(r).flatMap((g) => g.entrees.map((e) => e.libelle));
    expect(libelles('SUPER_ADMIN')).toHaveLength(15);
    // Un modérateur ouvre la modération et le journal d'audit (Réglages), mais pas les référentiels.
    expect(libelles('MODERATOR')).toContain('Modération');
    expect(libelles('MODERATOR')).toContain('Réglages');
    expect(libelles('MODERATOR')).not.toContain('Référentiels');
    // Le support ne modère pas, mais traite les justificatifs pro et les membres.
    expect(libelles('SUPPORT')).not.toContain('Modération');
    expect(libelles('SUPPORT')).toContain('Services');
    expect(libelles('SUPPORT')).toContain('Membres');
    // Sans session, rien.
    expect(navigationPour(null)).toEqual([]);
  });

  it('un groupe sans entrée visible disparaît', () => {
    const titres = navigationPour('MODERATOR').map((g) => g.titre);
    expect(titres).toContain('Configuration'); // Réglages (journal) est ouvert aux quatre rôles
    expect(navigationPour('SUPPORT').flatMap((g) => g.entrees.map((e) => e.href))).not.toContain('/admin/referentiels');
  });

  it('la garde de route : peutOuvrir refuse ce que le rail cache', () => {
    const ref = toutes.find((e) => e.href === '/admin/referentiels');
    if (ref === undefined) throw new Error('référentiels absents');
    expect(peutOuvrir('MODERATOR', ref)).toBe(false);
    expect(peutOuvrir('CONTENT_ADMIN', ref)).toBe(true);
    expect(peutOuvrir(null, ref)).toBe(false);
  });

  it('dit en français qui peut employer un périmètre', () => {
    expect(quiPeut('rgpd')).toBe('support et administrateurs');
    expect(reservePour('rgpd')).toBe('Réservé : support et administrateurs');
    expect(quiPeut('staffAdmin')).toBe('administrateurs');
    expect(quiPeut('moderation')).toBe('modération et administrateurs');
  });

  it('la page courante est la plus spécifique', () => {
    expect(entreeDuChemin('/admin')?.entree.libelle).toBe('Tableau de bord');
    expect(entreeDuChemin('/admin/alertes-equipe')?.entree.libelle).toBe('Alertes d’équipe');
    expect(entreeDuChemin('/admin/alertes')?.entree.libelle).toBe('Alertes arnaques');
    expect(entreeDuChemin('/admin/moderation/0b3e1c3a')?.entree.libelle).toBe('Modération');
    expect(entreeDuChemin('/admin/inconnu')).toBeNull();
    expect(entreeDuChemin('/admin/membres')?.groupe.titre).toBe('Communauté');
  });

  it('les pastilles ne viennent que de compteurs que l’API de pilotage fournit', () => {
    const avec = toutes.filter((e) => e.compteur !== undefined).map((e) => [e.libelle, e.compteur]);
    expect(avec).toEqual([
      ['Modération', 'moderation'],
      ['Alertes d’équipe', 'alertesEquipe'],
      ['Services', 'justificatifsPro'],
      ['Référentiels', 'villesAActiver'],
    ]);
  });
});
