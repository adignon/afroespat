'use client';

import { useState, type ReactNode } from 'react';
import {
  PAID_OPTION_CODES,
  PAID_OPTION_LABELS,
  adminPlansResponseSchema,
  billingConfigResponseSchema,
  type AdminPlan,
  type BillingConfigResponse,
  type PaidOptionCode,
  type PaymentMethodConfig,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, Etiquette, FenetreMotif, Interrupteur, Lecture, Message, Pastille, Titre, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ PAIEMENTS ET OFFRES — D14                                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « On va laisser les paiements. Tout sera gratuit pour le moment. » L'écran dit
 * donc d'abord ce qui est VRAI : tant que l'interrupteur global est éteint, tout est gratuit,
 * chaque membre a les droits Premium et aucun paiement n'est pris — aucun montant, aucun MRR.
 *
 * Il permet ensuite à l'équipe (SUPER_ADMIN) de préparer et d'ouvrir la vente SANS déploiement :
 *   · l'interrupteur global de monétisation ;
 *   · les moyens de paiement (carte, Mobile Money MTN, Mobile Money Moov) ;
 *   · les formules (Premium, Pro, Pro+), leur activation et leurs prix mensuel et annuel ;
 *   · les options payantes (offres sponsorisées, encarts partenaires, avantages à quota).
 *
 * CHAQUE bascule ou modification passe par une fenêtre de confirmation qui exige un MOTIF (10
 * caractères) : il est tracé dans le journal d'audit. Le paiement réel (Stripe, Mobile Money)
 * reste hors périmètre : allumer un moyen ne branche aucun fournisseur de plus.
 */

/** Le motif minimum du schéma de route (`motifSchema`, 10 caractères). */
const MOTIF_MIN = 10;

interface Geste {
  readonly titre: string;
  readonly consigne: string;
  readonly libelle: string;
  readonly executer: (motif: string) => Promise<unknown>;
}

const PLANS_PAYANTS = ['PREMIUM', 'PRO', 'PRO_PLUS'] as const;

function euros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** « 4,5 » ou « 4.50 » -> 450 centimes ; `null` si ce n'est pas un montant. */
function versCentimes(saisie: string): number | null {
  const propre = saisie.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Math.round(Number(propre) * 100);
}

function Section({ titre, aide, children }: { readonly titre: string; readonly aide: string; readonly children: ReactNode }) {
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <Etiquette>{titre}</Etiquette>
        <div style={{ fontSize: '13px', color: C.gris, marginTop: '4px', maxWidth: '680px', lineHeight: 1.6 }}>{aide}</div>
      </div>
      {children}
    </Carte>
  );
}

function Ligne({ nom, detail, actif, onChange, peut }: { readonly nom: string; readonly detail?: string; readonly actif: boolean; readonly onChange: (v: boolean) => void; readonly peut: boolean }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 0', borderTop: `1px solid ${C.traitLeger}`, listStyle: 'none' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>{nom}</div>
        {detail === undefined ? null : <div style={{ fontSize: '12.5px', color: C.gris }}>{detail}</div>}
      </div>
      <Pastille ton={actif ? 'vert' : 'neutre'}>{actif ? 'Activé' : 'Désactivé'}</Pastille>
      <Interrupteur actif={actif} onChange={onChange} libelle={`${nom} : ${actif ? 'activé' : 'désactivé'}`} disabled={!peut} />
    </li>
  );
}

function LignePrix({ plan, peut, demander }: { readonly plan: AdminPlan; readonly peut: boolean; readonly demander: (g: Geste) => void }) {
  const [mensuel, setMensuel] = useState((plan.priceCents / 100).toFixed(2).replace('.', ','));
  const [annuel, setAnnuel] = useState((plan.yearPriceCents / 100).toFixed(2).replace('.', ','));
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = () => {
    const m = versCentimes(mensuel);
    const a = versCentimes(annuel);
    if (m === null || a === null) {
      setErreur('Indiquez des montants en euros, par exemple 4,00.');
      return;
    }
    setErreur(null);
    demander({
      titre: `Modifier le prix de ${plan.nameFr}`,
      consigne: `${plan.nameFr} : ${euros(m)} par mois, ${euros(a)} par an. Les abonnés en cours gardent leur période payée.`,
      libelle: 'Enregistrer le prix',
      executer: (motif) =>
        staffApi.put(`/billing/plans/${plan.code}`, adminPlansResponseSchema, { body: { priceCents: m, yearPriceCents: a, reason: motif } }),
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap', paddingBottom: '10px' }}>
      <div style={{ width: '160px' }}>
        <Champ libelle={`${plan.nameFr} · prix mensuel (€)`} valeur={mensuel} onChange={setMensuel} inputMode="text" disabled={!peut} maxLength={10} />
      </div>
      <div style={{ width: '160px' }}>
        <Champ libelle={`${plan.nameFr} · prix annuel (€)`} valeur={annuel} onChange={setAnnuel} inputMode="text" disabled={!peut} maxLength={10} />
      </div>
      <Bouton onClick={enregistrer} disabled={!peut} petit>
        Modifier le prix
      </Bouton>
      {erreur === null ? null : (
        <div role="alert" style={{ fontSize: '12.5px', color: C.terre, fontWeight: 600 }}>
          {erreur}
        </div>
      )}
    </div>
  );
}

export function ContenuMonetisation() {
  const peut = useDroit('staffAdmin');
  const config = useCharge(() => staffApi.get('/billing/config', billingConfigResponseSchema), 'monetisation-config');
  const plans = useCharge(() => staffApi.get('/billing/plans', adminPlansResponseSchema), 'monetisation-plans');
  const action = useGeste();
  const [geste, setGeste] = useState<Geste | null>(null);

  const fermer = () => {
    if (!action.occupe) setGeste(null);
  };
  const confirmer = async (motif: string) => {
    if (geste === null) return;
    const ok = await action.lancer(() => geste.executer(motif), 'Modification enregistrée.');
    if (ok) {
      setGeste(null);
      config.recharger();
      plans.recharger();
    }
  };

  const basculeMoyen = (m: PaymentMethodConfig, enabled: boolean) =>
    setGeste({
      titre: `${enabled ? 'Activer' : 'Désactiver'} ${m.label}`,
      consigne: enabled
        ? 'Les membres pourront choisir ce moyen au moment de payer, si la monétisation est allumée.'
        : 'Ce moyen disparaît des choix de paiement. Les abonnements en cours ne sont pas coupés.',
      libelle: enabled ? 'Activer' : 'Désactiver',
      executer: (motif) => staffApi.put('/billing/payment-methods', billingConfigResponseSchema, { body: { methods: [{ code: m.code, enabled }], reason: motif } }),
    });

  const basculeOption = (code: PaidOptionCode, enabled: boolean) =>
    setGeste({
      titre: `${enabled ? 'Activer' : 'Désactiver'} : ${PAID_OPTION_LABELS[code]}`,
      consigne: enabled ? 'L’option s’applique dès maintenant à tous les membres concernés.' : 'L’option cesse de s’appliquer dès maintenant.',
      libelle: enabled ? 'Activer' : 'Désactiver',
      executer: (motif) => staffApi.put('/billing/paid-options', billingConfigResponseSchema, { body: { options: { [code]: enabled }, reason: motif } }),
    });

  const bascullePlan = (p: AdminPlan, isActive: boolean) =>
    setGeste({
      titre: `${isActive ? 'Proposer' : 'Retirer'} la formule ${p.nameFr}`,
      consigne: isActive ? 'La formule apparaît dans la liste publique et peut être souscrite.' : 'La formule n’est plus proposée. Les abonnés en cours ne sont pas coupés.',
      libelle: isActive ? 'Proposer' : 'Retirer',
      executer: (motif) => staffApi.put(`/billing/plans/${p.code}/enabled`, adminPlansResponseSchema, { body: { isActive, reason: motif } }),
    });

  const basculeGlobale = (active: boolean) =>
    setGeste({
      titre: active ? 'Allumer la monétisation' : 'Éteindre la monétisation',
      consigne: active
        ? 'Les limites des formules s’appliquent (selon les options allumées) et les membres peuvent payer avec les moyens activés.'
        : 'Tout redevient gratuit : tous les membres retrouvent les droits Premium et aucun paiement n’est possible.',
      libelle: active ? 'Allumer' : 'Éteindre',
      executer: (motif) => staffApi.put('/billing/monetisation', billingConfigResponseSchema, { body: { active, reason: motif } }),
    });

  return (
    <>
      <Titre titre="Paiements et offres" sous="Ouvrir ou fermer la vente, sans déploiement. Chaque modification demande un motif et est tracée." />

      {geste === null ? <Message message={action.message} /> : null}
      {peut ? null : <Bandeau ton="attention">Lecture seule : seul le rôle SUPER_ADMIN modifie les paiements et les offres.</Bandeau>}

      <Lecture etat={config.etat} recharger={config.recharger}>
        {(c: BillingConfigResponse) => (
          <>
            <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Etiquette>État</Etiquette>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, flex: '1 1 260px' }}>{c.monetisationActive ? 'Monétisation activée' : 'Monétisation désactivée'}</div>
                <Interrupteur actif={c.monetisationActive} onChange={basculeGlobale} libelle={`Monétisation : ${c.monetisationActive ? 'activée' : 'désactivée'}`} disabled={!peut} />
              </div>
              {c.monetisationActive ? (
                c.paymentsAvailable ? (
                  <Bandeau>Les membres peuvent payer : au moins un moyen et une formule sont activés.</Bandeau>
                ) : (
                  <Bandeau ton="attention">La monétisation est allumée, mais aucun membre ne peut payer : activez au moins un moyen de paiement et une formule.</Bandeau>
                )
              ) : (
                <div style={{ fontSize: '15px', lineHeight: 1.7, maxWidth: '680px' }}>
                  Tout est gratuit pour le moment : tous les membres bénéficient des droits Premium, aucune limite de formule ne s’applique et aucun paiement n’est pris. Les réglages ci-dessous se préparent à l’avance et ne produisent aucun effet tant que ce bouton reste éteint.
                </div>
              )}
            </Carte>

            <Section titre="Moyens de paiement" aide="Carte bancaire et Mobile Money. Un moyen éteint disparaît des choix de paiement et son checkout est refusé.">
              <ul style={{ margin: 0, padding: 0 }}>
                {c.methods.map((m) => (
                  <Ligne key={m.code} nom={m.label} detail={`Devise : ${m.currencies.join(', ')}`} actif={m.enabled} onChange={(v) => basculeMoyen(m, v)} peut={peut} />
                ))}
              </ul>
            </Section>

            <Section titre="Options payantes" aide="Ce qui se réserve aux abonnés. Une option éteinte est ouverte à tout le monde, même quand la monétisation est allumée.">
              <ul style={{ margin: 0, padding: 0 }}>
                {PAID_OPTION_CODES.map((code) => (
                  <Ligne key={code} nom={PAID_OPTION_LABELS[code]} actif={c.options[code]} onChange={(v) => basculeOption(code, v)} peut={peut} />
                ))}
              </ul>
            </Section>
          </>
        )}
      </Lecture>

      <Lecture etat={plans.etat} recharger={plans.recharger}>
        {(p) => (
          <Section titre="Formules" aide="Une formule désactivée n’est plus proposée ni souscriptible. Les abonnés en cours ne sont pas coupés. Les prix sont en euros ; l’équivalent en francs CFA est calculé à la parité fixe.">
            <ul style={{ margin: 0, padding: 0 }}>
              {p.items
                .filter((plan) => (PLANS_PAYANTS as readonly string[]).includes(plan.code))
                .map((plan) => (
                  <li key={plan.code} style={{ listStyle: 'none', borderTop: `1px solid ${C.traitLeger}` }}>
                    <ul style={{ margin: 0, padding: 0 }}>
                      <Ligne nom={plan.nameFr} detail={`${euros(plan.priceCents)} par mois · ${euros(plan.yearPriceCents)} par an`} actif={plan.isActive} onChange={(v) => bascullePlan(plan, v)} peut={peut} />
                    </ul>
                    <LignePrix key={`${plan.code}-${plan.priceCents}-${plan.yearPriceCents}`} plan={plan} peut={peut} demander={setGeste} />
                  </li>
                ))}
            </ul>
          </Section>
        )}
      </Lecture>

      <FenetreMotif
        ouverte={geste !== null}
        titre={geste?.titre ?? ''}
        consigne={geste?.consigne}
        min={MOTIF_MIN}
        max={500}
        libelleConfirmer={geste?.libelle ?? 'Confirmer'}
        onConfirmer={(m) => void confirmer(m)}
        onFermer={fermer}
        occupe={action.occupe}
        message={action.message}
      />
    </>
  );
}
