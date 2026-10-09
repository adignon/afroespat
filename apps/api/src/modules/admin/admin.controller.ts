import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  STAFF_SCOPES,
  auditQuerySchema,
  kycDowngradeSchema,
  memberCitySchema,
  memberPhaseSchema,
  memberReasonSchema,
  memberSearchQuerySchema,
  proApproveSchema,
  proRejectSchema,
  proReviewQuerySchema,
  settingWriteSchema,
  staffCreateSchema,
  staffListQuerySchema,
  staffUpdateSchema,
  uuidSchema,
  adminReindexSchema,
} from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { KycService } from '../kyc/kyc.service';
import { SearchService } from '../search/search.service';
import { AdminService } from './admin.service';

/**
 * Administration — 15-administration.md §7, préfixe `/v1/admin`.
 *
 * Chaque route déclare son rôle avec `@RequiresStaffRole`, à partir des listes
 * nommées de `STAFF_SCOPES` — qui sont la transcription du tableau du §2.2. Écrire
 * les rôles à la main route par route ferait recopier cette matrice trente fois,
 * et une recopie qui diverge d'une ligne est une route ouverte au mauvais rôle.
 *
 * « Toutes les routes exigent une session équipe valide et vérifient le rôle »
 * (§7) : c'est `StaffGuard` qui le fait, globalement, et `AuthGuard` qui garantit
 * qu'aucune de ces routes ne peut être atteinte par un jeton de membre.
 */
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly kyc: KycService,
    private readonly search: SearchService,
  ) {}

  // ── §2.2 — Comptes équipe ─────────────────────────────────────────────────

  @Get('staff')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Les comptes équipe et leur rôle' })
  async listStaff(@Query(zodPipe(staffListQuerySchema)) query: z.infer<typeof staffListQuerySchema>) {
    return this.admin.listStaff(query);
  }

  @Post('staff')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Crée un compte équipe (enrôlement TOTP forcé à sa première connexion)' })
  async createStaff(
    @Staff() staff: StaffUser,
    @Body(zodPipe(staffCreateSchema)) body: z.infer<typeof staffCreateSchema>,
  ) {
    return this.admin.createStaff(staff, body);
  }

  @Patch('staff/:id')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Modifie un compte équipe : nom, rôle, activation' })
  async updateStaff(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(staffUpdateSchema)) body: z.infer<typeof staffUpdateSchema>,
  ) {
    return this.admin.updateStaff(staff, id, body);
  }

  /**
   * Le `D` du CRUD annoncé par §7 — qui répond toujours 409, à dessein.
   *
   * La route existe plutôt que d'être absente parce que §7 la promet : un 404 de
   * routeur laisserait croire à un oubli, là où un 409 explicite dit qu'un compte
   * équipe qui a agi ne peut pas disparaître (voir `AdminService.deleteStaff`).
   * Désactiver est le geste à faire, et le message le dit.
   */
  @Delete('staff/:id')
  @RequiresStaffRole(...STAFF_SCOPES.staffAdmin)
  @ApiOperation({ summary: 'Refusé : un compte équipe se désactive, il ne se supprime pas' })
  deleteStaff(@Param('id', zodPipe(uuidSchema)) _id: string) {
    return this.admin.deleteStaff();
  }

  // ── §2.3 — Journal d'audit ────────────────────────────────────────────────

  @Get('audit')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Journal d’audit, filtrable par acteur, action, cible, période' })
  async audit(@Query(zodPipe(auditQuerySchema)) query: z.infer<typeof auditQuerySchema>) {
    return this.admin.listAudit(query);
  }

  /**
   * L'export CSV du §2.3.
   *
   * `text/csv` posé à la main : sans lui la réponse part en `application/json`,
   * le navigateur l'affiche au lieu de la télécharger, et l'équipe croit l'export
   * cassé. Nest ne le devine pas d'une chaîne rendue.
   */
  @Get('audit/export')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="audit.csv"')
  @ApiOperation({ summary: 'Export CSV du journal d’audit, mêmes filtres' })
  async auditExport(@Query(zodPipe(auditQuerySchema)) query: z.infer<typeof auditQuerySchema>) {
    return (await this.admin.exportAudit(query)).csv;
  }

  // ── §4.4 — Paramètres système ─────────────────────────────────────────────

  /**
   * En LECTURE, les quatre rôles : une page de réglages en lecture seule aide à
   * comprendre le comportement de la plateforme, et n'accorde rien. L'ÉCRITURE,
   * elle, est resserrée par clé dans le registre — voir `AdminService.putSetting`.
   */
  @Get('settings')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Tous les paramètres système, valeur effective et défaut du code' })
  async settings() {
    return this.admin.listSettings();
  }

  @Get('settings/:key')
  @RequiresStaffRole(...STAFF_SCOPES.dashboard)
  @ApiOperation({ summary: 'Un paramètre système' })
  async setting(@Param('key') key: string) {
    return this.admin.getSetting(key);
  }

  @Put('settings/:key')
  @RequiresStaffRole(...STAFF_SCOPES.settings)
  @ApiOperation({ summary: 'Modifie un paramètre système (le rôle exigé dépend de la clé)' })
  async putSetting(
    @Staff() staff: StaffUser,
    @Param('key') key: string,
    @Body(zodPipe(settingWriteSchema)) body: z.infer<typeof settingWriteSchema>,
  ) {
    return this.admin.putSetting(staff, key, body.value, body.reason);
  }

  // ── §2.2 — Fiches professionnelles (module 10 §4.1) ───────────────────────

  @Get('pro-profiles')
  @RequiresStaffRole(...STAFF_SCOPES.proReview)
  @ApiOperation({ summary: 'File des fiches professionnelles, en attente par défaut' })
  async proProfiles(
    @Query(zodPipe(proReviewQuerySchema)) query: z.infer<typeof proReviewQuerySchema>,
  ) {
    return this.admin.listProProfiles(query);
  }

  @Get('pro-profiles/:id')
  @RequiresStaffRole(...STAFF_SCOPES.proReview)
  @ApiOperation({ summary: 'Une fiche pro, son justificatif et l’historique de ses décisions' })
  async proProfile(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.admin.proProfileDetail(id);
  }

  @Post('pro-profiles/:id/approve')
  @RequiresStaffRole(...STAFF_SCOPES.proReview)
  @ApiOperation({ summary: 'Valide une fiche professionnelle : elle devient visible' })
  async approvePro(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(proApproveSchema)) body: z.infer<typeof proApproveSchema>,
  ) {
    return this.admin.approveProProfile(staff, id, body);
  }

  @Post('pro-profiles/:id/reject')
  @RequiresStaffRole(...STAFF_SCOPES.proReview)
  @ApiOperation({ summary: 'Refuse une fiche professionnelle, motif obligatoire' })
  async rejectPro(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(proRejectSchema)) body: z.infer<typeof proRejectSchema>,
  ) {
    return this.admin.rejectProProfile(staff, id, body);
  }

  // ── §3 — Fiche membre ─────────────────────────────────────────────────────

  @Get('users')
  @RequiresStaffRole(...STAFF_SCOPES.memberRead)
  @ApiOperation({ summary: 'Recherche par handle, nom, ou numéro (empreinte HMAC)' })
  async searchUsers(
    @Query(zodPipe(memberSearchQuerySchema)) query: z.infer<typeof memberSearchQuerySchema>,
  ) {
    return this.admin.searchMembers(query);
  }

  @Get('users/:id')
  @RequiresStaffRole(...STAFF_SCOPES.memberRead)
  @ApiOperation({ summary: 'Fiche membre complète — numéros MASQUÉS, jamais en clair' })
  async user(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.admin.memberDetail(id);
  }

  @Post('users/:id/revoke-sessions')
  @RequiresStaffRole(...STAFF_SCOPES.rgpd)
  @ApiOperation({ summary: 'Révoque toutes les sessions d’un membre' })
  async revokeSessions(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberReasonSchema)) body: z.infer<typeof memberReasonSchema>,
  ) {
    return this.admin.revokeMemberSessions(staff, id, body);
  }

  @Post('users/:id/deactivate')
  @RequiresStaffRole(...STAFF_SCOPES.moderation)
  @ApiOperation({ summary: 'Désactive un compte membre et coupe ses sessions' })
  async deactivate(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberReasonSchema)) body: z.infer<typeof memberReasonSchema>,
  ) {
    return this.admin.setMemberActive(staff, id, false, body);
  }

  @Post('users/:id/reactivate')
  @RequiresStaffRole(...STAFF_SCOPES.moderation)
  @ApiOperation({ summary: 'Réactive un compte membre désactivé' })
  async reactivate(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberReasonSchema)) body: z.infer<typeof memberReasonSchema>,
  ) {
    return this.admin.setMemberActive(staff, id, true, body);
  }

  /**
   * `SUPER_ADMIN` SEUL, et pas `STAFF_SCOPES.moderation` comme la réactivation
   * voisine : 15 §2.2 réserve « Bannir définitivement » au SUPER_ADMIN, et lever la
   * sanction est la même décision prise à l'envers. Un modérateur qui pourrait
   * débannir pourrait contourner le bannissement qu'il n'a pas le droit de poser.
   */
  @Post('users/:id/unban')
  @RequiresStaffRole('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Lève un bannissement et retire le numéro de la liste noire (13 §4.2)',
  })
  async unban(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberReasonSchema)) body: z.infer<typeof memberReasonSchema>,
  ) {
    return this.admin.unbanMember(staff, id, body);
  }

  @Post('users/:id/phase')
  @RequiresStaffRole(...STAFF_SCOPES.rgpd)
  @ApiOperation({ summary: 'Force la phase d’un membre, à sa demande. Tracé.' })
  async phase(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberPhaseSchema)) body: z.infer<typeof memberPhaseSchema>,
  ) {
    return this.admin.forceMemberPhase(staff, id, body);
  }

  @Post('users/:id/city')
  @RequiresStaffRole(...STAFF_SCOPES.rgpd)
  @ApiOperation({ summary: 'Force la ville d’un membre, à sa demande. Tracé.' })
  async city(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(memberCitySchema)) body: z.infer<typeof memberCitySchema>,
  ) {
    return this.admin.forceMemberCity(staff, id, body);
  }

  /**
   * §3.2 : « Rétrograder le niveau — MODERATOR — marque le KYC `DECLINED` avec
   * motif ; recalcul. »
   *
   * `STAFF_SCOPES.moderation` et non `memberRead` : c'est une décision qui retire
   * des droits à un membre, au même titre qu'une suspension.
   *
   * Elle ne porte QUE `@RequiresStaffRole`, jamais aussi `@RequiresCapability` :
   * `AuthGuard` refuse à chaque appel une route qui déclarerait les deux (règle dure
   * 15 §2.1, les deux domaines sont hermétiques).
   *
   * Le service appelé est celui du module 01 — la vérification d'identité lui
   * appartient, et §2.4 veut qu'un seul code calcule le niveau. L'application
   * d'équipe décide, le module concerné exécute.
   */
  @Post('users/:id/kyc/downgrade')
  @RequiresStaffRole(...STAFF_SCOPES.moderation)
  @ApiOperation({ summary: 'Rétrograde le niveau : marque le KYC DECLINED avec motif' })
  async downgradeKyc(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(kycDowngradeSchema)) body: z.infer<typeof kycDowngradeSchema>,
  ) {
    return this.kyc.downgrade({ staffId: staff.staffId, ip: staff.ip }, id, body.reason);
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ RECONSTRUIRE L'INDEX DE RECHERCHE — 11 §4, ET ELLE MANQUAIT             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La spec la nomme : « Admin : `/v1/admin/search/reindex` (type) ». Le service
   * porte `reindexType` depuis le début et personne ne l'appelait — le contrôleur
   * de recherche l'écrit noir sur blanc : « attendent le module 15 ». Le module 15
   * existe ; la route, non.
   *
   * ── POURQUOI ELLE A MANQUÉ, ET QUAND ──────────────────────────────────────
   *
   * Le porteur : « il faut que la recherche touche à tous les types de contenus ».
   * MESURÉ : `search_documents` était VIDE, et 7 711 événements attendaient dans
   * la boîte d'envoi — le relais ne tourne que si `APP_ROLE=worker`, et ce
   * processus-là ne tournait pas. Une fois démarré, les contenus NOUVEAUX
   * s'indexent ; les anciens, dont les événements sont passés, restent dehors.
   *
   * Rejouer de vieux événements serait faux — ils décrivent un état révolu. Relire
   * la SOURCE est la seule façon juste de rattraper, et c'est ce que `reindexType`
   * fait : il réécrit ce qui est éligible et retire ce qui ne l'est plus.
   *
   * `STAFF_SCOPES.content` : c'est une opération sur le contenu, pas sur des
   * comptes ni sur des sanctions. Elle ne touche à aucune donnée de membre — elle
   * recopie dans l'index ce que les tables disent déjà.
   *
   * ── ELLE EST TRACÉE, ET LE DÉPÔT ME L'A FAIT REMARQUER ────────────────────
   *
   * `admin.int.test.ts` porte un cas qui lit le document OpenAPI et exige que
   * TOUTE route d'écriture de l'administration ait un test d'audit. Il a rougi dès
   * que cette route a existé, et il avait raison : une reconstruction réécrit
   * `search_documents` et en RETIRE les lignes dont la source n'est plus éligible
   * — elle peut faire disparaître du contenu de la recherche du produit entier.
   *
   * La boucle est donc passée au service, qui écrit la trace. Le contrôleur lui
   * passe la fonction de réindexation plutôt que le service de recherche : c'est le
   * module 11 qui sait réindexer, et `AdminService` n'a pas à en dépendre pour
   * poser une ligne de journal.
   */
  @Post('search/reindex')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Reconstruit l’index de recherche, type par type (11 §2.5)' })
  async reindexSearch(
    @Staff() staff: StaffUser,
    @Body(zodPipe(adminReindexSchema)) body: z.infer<typeof adminReindexSchema>,
  ) {
    return this.admin.reindexSearch(staff, body.types, (type) => this.search.reindexType(type));
  }
}
