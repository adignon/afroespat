import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  changePeriodSchema,
  checkoutSchema,
  paymentsQuerySchema,
  subscriptionTargetSchema,
  uuidSchema,
  webhookEventSchema,
} from '@app/shared';
import type { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { PublicRead, RequiresCapability, SignedWebhook } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { BillingService } from './billing.service';
import { PlanService } from './plan.service';

/**
 * Abonnements côté membre — 14-monetisation.md §7.1.
 *
 * LA CAPACITÉ DÉCLARÉE EST `content.read`, sur toutes les écritures de ce
 * contrôleur, et c'est un choix qui mérite sa phrase. La matrice du §7.3 de `00`
 * ne porte AUCUNE capacité de facturation : gérer son propre abonnement n'est pas
 * une action sur la plateforme, c'est un droit du titulaire du compte, ouvert dès
 * L0 — un membre encore en Afrique doit pouvoir payer en Mobile Money avant d'être
 * vérifié. C'est la même lecture que celle des consentements et des blocages, qui
 * déclarent déjà `content.read` sur leurs `POST`.
 *
 * Inventer une capacité `billing.manage` aurait demandé de modifier la matrice, qui
 * est la spec — et une capacité que la spec ne nomme pas est une capacité que le
 * front ne saura pas interpréter.
 */
@ApiTags('me')
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly plans: PlanService,
  ) {}

  // ── Catalogue ─────────────────────────────────────────────────────────────

  /**
   * `GET /plans` — lecture OUVERTE, et délibérément.
   *
   * §8 met le comparatif Gratuit / Premium sur l'écran « Passer Premium », qu'un
   * visiteur non connecté doit pouvoir lire : un prix caché derrière une
   * inscription est un prix qu'on soupçonne.
   */
  @Get('plans')
  @PublicRead()
  @ApiOperation({ summary: 'Les formules, leurs prix en EUR et en XOF, leurs limites' })
  async plansList() {
    /**
     * §5.3 : « Chaque liste renvoie `items` et `nextCursor` (null en fin) ».
     *
     * CETTE ROUTE N'EN RENVOYAIT PAS DU TOUT — découvert parce qu'un `pageSchema()`
     * du front a REFUSÉ la charge : `nextCursor` y est requis et nullable, pas
     * facultatif, et un client qui prend une enveloppe sans le champ pour une fin de
     * liste s'arrête sans raison visible.
     *
     * `null` est HONNÊTE ici, et c'est toute la différence avec les cinq routes qui
     * tronquaient : celles-là posaient un `take` puis affirmaient la fin. Celle-ci
     * rend l'ENSEMBLE COMPLET — aucune limite sur la liste rendue — donc « il n'y a
     * pas de suite » est un fait, pas une affirmation en l'air.
     */
    return { items: await this.plans.publicPlans(), nextCursor: null };
  }

  // ── Mon abonnement ────────────────────────────────────────────────────────

  @Get('me/subscription')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes abonnements, ma période, mes quotas du mois, mon essai' })
  async mySubscription(@Auth() auth: AuthContext) {
    return this.billing.mySubscription(auth.userId);
  }

  /**
   * `POST /me/subscription/checkout`.
   *
   * RÈGLE DURE (§4.1) : aucune donnée de carte ne transite par le serveur. Le
   * schéma `checkoutSchema` est `.strict()`, donc un corps qui porte `cardNumber`
   * ou `cvc` est refusé en 400 AVANT le service. Cette ligne est la barrière, et
   * elle est là où passe la requête.
   */
  @Post('me/subscription/checkout')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Ouvre un paiement : URL Stripe ou demande Mobile Money' })
  async checkout(
    @Auth() auth: AuthContext,
    @Body(zodPipe(checkoutSchema)) body: z.infer<typeof checkoutSchema>,
  ) {
    return this.billing.checkout(auth.userId, body);
  }

  @Post('me/subscription/cancel')
  // T4 §1 : 201 est réservé à une CRÉATION. Ces trois routes sont des ACTIONS
  // qui rendent l'état de l'abonnement, et Nest répond 201 par défaut sur un POST.
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Annule à la fin de la période, sans rien couper' })
  async cancel(
    @Auth() auth: AuthContext,
    @Body(zodPipe(subscriptionTargetSchema)) body: z.infer<typeof subscriptionTargetSchema>,
  ) {
    return this.billing.cancel(auth.userId, body.planCode);
  }

  @Post('me/subscription/resume')
  // T4 §1 : 201 est réservé à une CRÉATION. Ces trois routes sont des ACTIONS
  // qui rendent l'état de l'abonnement, et Nest répond 201 par défaut sur un POST.
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Reprend un abonnement annulé, jusqu’à la fin de période' })
  async resume(
    @Auth() auth: AuthContext,
    @Body(zodPipe(subscriptionTargetSchema)) body: z.infer<typeof subscriptionTargetSchema>,
  ) {
    return this.billing.resume(auth.userId, body.planCode);
  }

  @Post('me/subscription/change-period')
  // T4 §1 : 201 est réservé à une CRÉATION. Ces trois routes sont des ACTIONS
  // qui rendent l'état de l'abonnement, et Nest répond 201 par défaut sur un POST.
  @HttpCode(200)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mensuel ↔ annuel, au prochain renouvellement' })
  async changePeriod(
    @Auth() auth: AuthContext,
    @Body(zodPipe(changePeriodSchema)) body: z.infer<typeof changePeriodSchema>,
  ) {
    return this.billing.changePeriod(auth.userId, 'PREMIUM', body.period);
  }

  @Get('me/subscription/portal')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Le portail client Stripe — NOT_STRIPE sinon' })
  async portal(@Auth() auth: AuthContext) {
    return this.billing.portal(auth.userId, 'PREMIUM');
  }

  // ── Factures et quotas ────────────────────────────────────────────────────

  @Get('me/payments')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes paiements et leurs numéros de facture' })
  async myPayments(
    @Auth() auth: AuthContext,
    @Query(zodPipe(paymentsQuerySchema)) query: z.infer<typeof paymentsQuerySchema>,
  ) {
    return this.billing.myPayments(auth.userId, query);
  }

  @Get('me/payments/:id/invoice')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Ma facture PDF — 503 tant qu’aucun moteur de rendu n’est branché' })
  async invoice(@Auth() auth: AuthContext, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.billing.invoice(auth.userId, id);
  }

  @Get('me/usage')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes compteurs du mois et leur plafond' })
  async usage(@Auth() auth: AuthContext) {
    return this.billing.usage(auth.userId);
  }

  // ── Essai ─────────────────────────────────────────────────────────────────

  /**
   * `POST /me/trial/start` — le bouton « Activer mon essai » (§7.1).
   *
   * Le serveur déclenche déjà l'essai sur `journey.step_completed` ; cette route
   * est le geste explicite du membre, et elle applique la MÊME condition : une
   * étape franchie. §3 est catégorique — « pas à l'inscription ».
   */
  @Post('me/trial/start')
  @HttpCode(201)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Active les 14 jours d’essai, après une première étape franchie' })
  async startTrial(@Auth() auth: AuthContext) {
    return this.billing.startTrial(auth.userId);
  }

  // ── Webhooks (T4 §8) ──────────────────────────────────────────────────────

  /**
   * Les deux points d'entrée des fournisseurs.
   *
   * `@SignedWebhook('<fournisseur>')` et non `@RequiresCapability` : il n'y a pas de membre au
   * bout, et l'autorisation est la SIGNATURE. Le service la vérifie avant de lire
   * quoi que ce soit du corps — et refuse tout tant qu'aucun secret n'est
   * configuré, ce qui est le cas aujourd'hui pour les deux canaux.
   *
   * La réponse est 200 et RAPIDE, même quand rien n'a été fait : un fournisseur
   * qui reçoit une erreur réessaie, puis finit par désactiver le point d'entrée.
   */
  @Post('webhooks/stripe')
  @HttpCode(200)
  @SignedWebhook('stripe')
  @ApiOperation({ summary: 'Webhook Stripe — signé, idempotent' })
  async stripeWebhook(
    @Req() request: RawBodyRequest,
    @Body(zodPipe(webhookEventSchema)) body: z.infer<typeof webhookEventSchema>,
  ) {
    return this.billing.handleWebhook('stripe', request.rawBody, request.headers, body);
  }

  @Post('webhooks/mobile-money')
  @HttpCode(200)
  @SignedWebhook('mobile-money')
  @ApiOperation({ summary: 'Webhook Mobile Money — signé, idempotent' })
  async mobileMoneyWebhook(
    @Req() request: RawBodyRequest,
    @Body(zodPipe(webhookEventSchema)) body: z.infer<typeof webhookEventSchema>,
  ) {
    return this.billing.handleWebhook('mobile-money', request.rawBody, request.headers, body);
  }
}

/**
 * `rawBody` est posé par `NestFactory.create(AppModule, { rawBody: true })`.
 *
 * Déclaré `| undefined` et non supposé présent : une application construite sans
 * l'option — un test qui appelle `createNestApplication()` sans elle — ne l'aura
 * pas, et le vérificateur doit alors REFUSER plutôt que de lever. C'est
 * `HmacWebhookVerifier` qui traite ce cas, et il le traite en fermant.
 */
interface RawBodyRequest extends Request {
  readonly rawBody?: Buffer;
}
