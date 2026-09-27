import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  calendarQuerySchema,
  cancelEventSchema,
  checkInSchema,
  createEventSchema,
  eventsQuerySchema,
  rsvpSchema,
  updateEventSchema,
  uuidSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext, MaybeAuth } from '../../common/auth.guard';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { EventsService } from './events.service';

/**
 * Agenda — 09-villes-agenda.md §5.
 *
 * Les LECTURES sont `@PublicRead()` : un visiteur non connecté doit pouvoir voir
 * ce qui se passe dans sa ville — c'est ce qui donne envie de s'inscrire. Le
 * service applique la visibilité de toute façon (réseau réservé, membre bloqué,
 * événement annulé depuis plus de 7 jours), avec ou sans jeton.
 *
 * Les ÉCRITURES déclarent leur capacité (00 §7.3) : `event.create` pour créer,
 * modifier et annuler — c'est le même pouvoir sur le même objet — et
 * `event.attend` pour le RSVP et la présence. La séparation compte : `event.create`
 * porte un quota de plan, `event.attend` n'en portera JAMAIS (règle dure 14 §2).
 */
@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  /**
   * Le calendrier vertical (§3.5). Déclaré AVANT `events/:id` : sans cela, Nest
   * fait correspondre « calendar » au paramètre `:id` et la route ne répond
   * jamais — un 400 sur un UUID invalide, pour une route qui existe.
   */
  @Get('events/calendar')
  @PublicRead()
  @ApiOperation({ summary: 'Un objet par jour : total, mes participations, premier titre' })
  async calendar(
    @Query(zodPipe(calendarQuerySchema)) query: z.infer<typeof calendarQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.events.calendar(query, viewer?.userId ?? null);
  }

  @Get('events')
  @PublicRead()
  @ApiOperation({ summary: 'Événements d’un jour ou d’un intervalle, mes participations en tête' })
  async list(
    @Query(zodPipe(eventsQuerySchema)) query: z.infer<typeof eventsQuerySchema>,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.events.list(query, viewer?.userId ?? null);
  }

  @Get('events/:id')
  @PublicRead()
  @ApiOperation({ summary: 'Détail, mon RSVP, avatars des participants' })
  async detail(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.events.detail(id, viewer?.userId ?? null);
  }

  @Get('events/:id/attendees')
  @PublicRead()
  @ApiOperation({ summary: 'Organisateur : liste complète ; autres : avatars des GOING' })
  async attendees(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @MaybeAuth() viewer: AuthContext | null,
  ) {
    return this.events.attendees(id, viewer?.userId ?? null);
  }

  // ── Écriture ──────────────────────────────────────────────────────────────

  @Post('events')
  @RequiresCapability('event.create')
  // Créer un événement est un geste rare et lourd : la limite de débit n'a pas à
  // être large, et le quota mensuel du §3.1 la double de toute façon.
  @RateLimit(10)
  @ApiOperation({ summary: 'Crée un événement (L1, 1 par mois en gratuit)' })
  async create(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createEventSchema)) body: z.infer<typeof createEventSchema>,
  ) {
    return this.events.create(auth.userId, body);
  }

  @Patch('events/:id')
  @RequiresCapability('event.create')
  @RateLimit(20)
  @ApiOperation({ summary: 'Modifie un événement, jusqu’à son début (organisateur)' })
  async update(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(updateEventSchema)) body: z.infer<typeof updateEventSchema>,
  ) {
    return this.events.update(id, auth.userId, body);
  }

  @Post('events/:id/cancel')
  @RequiresCapability('event.create')
  @ApiOperation({ summary: 'Annule un événement, motif facultatif (organisateur)' })
  async cancel(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(cancelEventSchema)) body: z.infer<typeof cancelEventSchema>,
  ) {
    return this.events.cancel(id, auth.userId, body);
  }

  @Put('events/:id/rsvp')
  @RequiresCapability('event.attend')
  @RateLimit(30)
  @ApiOperation({ summary: 'Je viens / Peut-être / Je ne viens pas — liste d’attente si complet' })
  async rsvp(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(rsvpSchema)) body: z.infer<typeof rsvpSchema>,
  ) {
    return this.events.rsvp(id, auth.userId, body);
  }

  @Delete('events/:id/rsvp')
  @RequiresCapability('event.attend')
  @ApiOperation({ summary: 'Retire ma participation (promeut la liste d’attente)' })
  async withdraw(@Param('id', zodPipe(uuidSchema)) id: string, @Auth() auth: AuthContext) {
    return this.events.withdraw(id, auth.userId);
  }

  @Post('events/:id/check-in')
  @RequiresCapability('event.attend')
  @ApiOperation({ summary: '« Je suis là », ou la feuille de présence de l’organisateur' })
  async checkIn(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Auth() auth: AuthContext,
    @Body(zodPipe(checkInSchema)) body: z.infer<typeof checkInSchema>,
  ) {
    return this.events.checkIn(id, auth.userId, body);
  }
}
