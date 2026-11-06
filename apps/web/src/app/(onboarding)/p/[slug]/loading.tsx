/** Le temps que l'API réponde : un message annoncé, sur le fond de l'application. */
export default function Chargement() {
  return (
    <main style={{ minHeight: '60vh', background: '#F6F8F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <p role="status" style={{ margin: 0, fontSize: '14px', color: '#5D6B66' }}>
        Chargement de la page…
      </p>
    </main>
  );
}
