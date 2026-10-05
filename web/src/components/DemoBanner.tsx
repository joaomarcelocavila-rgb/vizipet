import { session } from '../lib/api';

export function DemoBanner() {
  async function restart() {
    const { resetDemo } = await import('../demo/mock');
    resetDemo();
    session.clear();
    window.location.reload();
  }

  return (
    <div className="demo-banner">
      <span><strong>Demonstração</strong> · dados fictícios, só neste aparelho</span>
      <button type="button" onClick={restart}>Recomeçar</button>
    </div>
  );
}
