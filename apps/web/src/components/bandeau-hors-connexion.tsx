'use client';

import { useEffect, useState } from 'react';

/**
 * LE BANDEAU « HORS CONNEXION » — le navigateur sait quand le réseau tombe.
 *
 * Sans lui, une coupure ressemblait à une panne de l'application : écrans qui ne
 * chargent pas, envois qui échouent, sans explication. Il se pose en haut, annoncé
 * (`role="status"`), et disparaît dès le retour du réseau. Vert pâle de la maquette,
 * jamais de rouge.
 *
 * Le rendu serveur et la première peinture le supposent en ligne (`navigator.onLine`
 * n'est lu qu'après montage) : pas d'écart d'hydratation.
 */
export function BandeauHorsConnexion() {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    const maj = (): void => {
      setHorsLigne(!navigator.onLine);
    };
    maj();
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
    };
  }, []);

  if (!horsLigne) return null;
  return (
    <div
      role="status"
      data-hors-connexion=""
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: '#E3F0EB',
        color: '#0F5C48',
        fontSize: '13.5px',
        fontWeight: 600,
        textAlign: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid #CFE3DA',
      }}
    >
      Vous êtes hors connexion. Certaines fonctions reviendront dès que le réseau sera rétabli.
    </div>
  );
}
