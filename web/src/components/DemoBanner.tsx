import { session } from '../api';

export function DemoBanner() {
  async function restart() {
    const { resetDemo } = await import('../demo/mock');
    resetDemo();
    session.clear();
    window.location.reload();
  }

  return (
    <div className="demo-banner">
      <span>
        <strong>Demonstração.</strong> Os dados são fictícios e ficam só neste navegador; nada é enviado para um servidor.
      </span>
      <button type="button" onClick={restart}>Recomeçar do zero</button>
    </div>
  );
}
