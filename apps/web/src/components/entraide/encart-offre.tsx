'use client';

import Link from 'next/link';
import { useCapacites } from '@/lib/capacites';

/**
 * AJOUT — l'encart « OFFRE · NIVEAU L0 » de H03.
 *
 * La maquette le dessine pour un membre L0 : « Proposer son aide demande une identité
 * vérifiée », puis un bouton « Vérifier mon identité » qui n'était qu'un `<div>`. Il
 * était affiché à TOUS, y compris à un membre L1 qui peut parfaitement publier une
 * offre — et son bouton ne menait nulle part.
 *
 * `lib/capacites.ts` sert à ÉTEINDRE ou masquer un contrôle et à dire pourquoi, jamais
 * à ouvrir une porte (AMORCAGE §5) : l'encart n'apparaît donc que pour qui ne peut pas
 * encore proposer (`help.offer`), et le bouton mène à la page qui fait franchir la
 * marche. Tant que le niveau n'est pas connu, rien n'est affiché — une explication de
 * refus posée sur une supposition serait fausse pour qui a le droit.
 */
export function EncartOffre() {
  const { niveau, peut } = useCapacites();
  if (niveau === null || peut('help.offer')) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '18px', flexShrink: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
        OFFRE · NIVEAU {niveau}
      </div>
      <div style={{ marginTop: '10px', background: '#E3F0EB', borderRadius: '14px', padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F5C48' }}>
          Proposer son aide demande une identité vérifiée
        </div>
        <Link
          href="/compte/verification"
          style={{ marginTop: '8px', display: 'inline-block', background: '#16785E', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '7px 12px', borderRadius: '999px', textDecoration: 'none' }}
        >
          Vérifier mon identité
        </Link>
      </div>
    </div>
  );
}
