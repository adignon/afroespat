import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  STAFF_SCOPES,
  citiesAdminQuerySchema,
  createCitySchema,
  createCountrySchema,
  createLanguageSchema,
  createTaggedSchema,
  importCitiesSchema,
  mergeCitySchema,
  refListQuerySchema,
  refReasonSchema,
  updateCitySchema,
  updateCountrySchema,
  updateLanguageSchema,
  updateTaggedSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { RequiresStaffRole } from '../../common/staff-role.decorator';
import { Staff, type StaffUser } from '../../common/staff.guard';
import { zodPipe } from '../../common/zod.pipe';
import { ReferentialsService } from './referentials.service';

/**
 * Administration des référentiels — 02-referentiels.md §4.2, `/v1/admin/ref/*`.
 *
 * `CONTENT_ADMIN` pour tout, comme le §4.2 l'écrit en titre de section. Les listes
 * sont FERMÉES (§2.3) : un membre ne crée jamais une valeur, il la suggère — donc
 * quelqu'un doit les tenir, et c'est ici.
 *
 * `STAFF_SCOPES.content` plutôt que le rôle écrit à la main : c'est la
 * transcription du tableau du §2.2 de la spec 15, et la recopier route par route la
 * ferait diverger.
 */
@ApiTags('admin-ref')
@Controller('admin/ref')
export class ReferentialsController {
  constructor(private readonly ref: ReferentialsService) {}

  // ── Langues ───────────────────────────────────────────────────────────────

  @Get('languages')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les langues. Sans `is_active` : la colonne manque au schéma' })
  async languages(@Query(zodPipe(refListQuerySchema)) query: z.infer<typeof refListQuerySchema>) {
    return this.ref.listSimple('languages', query);
  }

  @Post('languages')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Ajoute une langue' })
  async createLanguage(
    @Staff() staff: StaffUser,
    @Body(zodPipe(createLanguageSchema)) body: z.infer<typeof createLanguageSchema>,
  ) {
    return this.ref.createLanguage(staff, body);
  }

  @Patch('languages/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Renomme une langue' })
  async updateLanguage(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateLanguageSchema)) body: z.infer<typeof updateLanguageSchema>,
  ) {
    return this.ref.updateLanguage(staff, id, body);
  }

  // ── Compétences et métiers ────────────────────────────────────────────────

  @Get('skills')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les compétences, actives ou non' })
  async skills(@Query(zodPipe(refListQuerySchema)) query: z.infer<typeof refListQuerySchema>) {
    return this.ref.listSimple('skills', query);
  }

  @Post('skills')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Ajoute une compétence' })
  async createSkill(
    @Staff() staff: StaffUser,
    @Body(zodPipe(createTaggedSchema)) body: z.infer<typeof createTaggedSchema>,
  ) {
    return this.ref.createTagged(staff, 'skills', body);
  }

  @Patch('skills/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie une compétence, ou la retire des propositions' })
  async updateSkill(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateTaggedSchema)) body: z.infer<typeof updateTaggedSchema>,
  ) {
    return this.ref.updateTagged(staff, 'skills', id, body);
  }

  @Get('professions')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les métiers, actifs ou non' })
  async professions(@Query(zodPipe(refListQuerySchema)) query: z.infer<typeof refListQuerySchema>) {
    return this.ref.listSimple('professions', query);
  }

  @Post('professions')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Ajoute un métier' })
  async createProfession(
    @Staff() staff: StaffUser,
    @Body(zodPipe(createTaggedSchema)) body: z.infer<typeof createTaggedSchema>,
  ) {
    return this.ref.createTagged(staff, 'professions', body);
  }

  @Patch('professions/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie un métier, ou le retire des propositions' })
  async updateProfession(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateTaggedSchema)) body: z.infer<typeof updateTaggedSchema>,
  ) {
    return this.ref.updateTagged(staff, 'professions', id, body);
  }

  // ── Pays ──────────────────────────────────────────────────────────────────

  @Get('countries')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les pays, avec leur nombre de villes' })
  async countries() {
    return this.ref.listCountries();
  }

  @Post('countries')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Ajoute un pays. Inactif : l’activation est une route à part' })
  async createCountry(
    @Staff() staff: StaffUser,
    @Body(zodPipe(createCountrySchema)) body: z.infer<typeof createCountrySchema>,
  ) {
    return this.ref.createCountry(staff, body);
  }

  @Patch('countries/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie un pays. `isActive` n’y est pas : voir /activate' })
  async updateCountry(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateCountrySchema)) body: z.infer<typeof updateCountrySchema>,
  ) {
    return this.ref.updateCountry(staff, id, body);
  }

  @Post('countries/:id/activate')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Active un pays : crée son réseau et y inscrit les membres (§2.2)' })
  async activateCountry(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(refReasonSchema)) body: z.infer<typeof refReasonSchema>,
  ) {
    return this.ref.activateCountry(staff, id, body);
  }

  // ── Villes ────────────────────────────────────────────────────────────────

  @Get('cities')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Les villes, filtrables par pays, état et nom' })
  async cities(@Query(zodPipe(citiesAdminQuerySchema)) query: z.infer<typeof citiesAdminQuerySchema>) {
    return this.ref.listCities(query);
  }

  @Post('cities')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Ajoute une ville. Inactive : l’activation est une route à part' })
  async createCity(
    @Staff() staff: StaffUser,
    @Body(zodPipe(createCitySchema)) body: z.infer<typeof createCitySchema>,
  ) {
    return this.ref.createCity(staff, body);
  }

  @Patch('cities/:id')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Modifie une ville : nom, région, coordonnées, pays' })
  async updateCity(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateCitySchema)) body: z.infer<typeof updateCitySchema>,
  ) {
    return this.ref.updateCity(staff, id, body);
  }

  /**
   * LE GESTE DU JOUR DU LANCEMENT (§2.2).
   *
   * Il n'existait aucune route pour le faire, et c'est ce qui bloquait la mise en
   * service : une ville inactive n'a « ni réseau, ni carte, ni fiche », et rien ne
   * pouvait la rendre active autrement qu'en SQL — ce qui n'aurait créé ni le
   * réseau, ni inscrit les membres.
   */
  @Post('cities/:id/activate')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Active une ville : crée son réseau et y inscrit les membres (§2.2)' })
  async activateCity(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(refReasonSchema)) body: z.infer<typeof refReasonSchema>,
  ) {
    return this.ref.activateCity(staff, id, body);
  }

  @Post('cities/:id/deactivate')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Referme une ville. Son réseau est conservé, pas supprimé' })
  async deactivateCity(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(refReasonSchema)) body: z.infer<typeof refReasonSchema>,
  ) {
    return this.ref.deactivateCity(staff, id, body);
  }

  @Post('cities/:id/merge')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Fusionne deux villes. IRRÉVERSIBLE : exige le slug en confirmation' })
  async mergeCity(
    @Staff() staff: StaffUser,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(mergeCitySchema)) body: z.infer<typeof mergeCitySchema>,
  ) {
    return this.ref.mergeCity(staff, id, body);
  }

  @Post('cities/import')
  @RequiresStaffRole(...STAFF_SCOPES.content)
  @ApiOperation({ summary: 'Importe des villes en CSV. `apply: false` valide sans écrire' })
  async importCities(
    @Staff() staff: StaffUser,
    @Body(zodPipe(importCitiesSchema)) body: z.infer<typeof importCitiesSchema>,
  ) {
    return this.ref.importCities(staff, body);
  }
}
