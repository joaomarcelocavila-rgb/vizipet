import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Sheet } from './ui';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// O navegador pode avisar que dá para instalar antes da tela montar: guarda o aviso aqui.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((fn) => fn());
});

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  // Dentro de um iframe (prévia) não há como instalar.
  const framed = window.self !== window.top;
  if (isStandalone() || framed) return { mode: 'none' as const };
  if (deferred) return { mode: 'prompt' as const };
  if (isIos()) return { mode: 'ios' as const };
  return { mode: 'none' as const };
}

/** Cartão "Instalar o app". Some quando já está instalado ou o navegador não permite. */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  const { mode } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (mode === 'none') return null;

  async function install() {
    if (mode === 'ios') return setIosHelp(true);
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    deferred = null;
    listeners.forEach((fn) => fn());
  }

  return (
    <>
      <button type="button" className={compact ? 'menu-item' : 'install-card'} onClick={install}>
        {compact ? (
          <>
            <Icon name="download" /> <span className="grow">Instalar o app</span>
            <Icon name="chevron" size={18} className="muted" />
          </>
        ) : (
          <>
            <span className="install-icon"><Icon name="download" /></span>
            <span className="grow">
              <strong>Instalar o Vizipet</strong>
              <small>Ícone na tela inicial, abre em tela cheia e funciona sem internet.</small>
            </span>
            <span className="btn btn-sm">Instalar</span>
          </>
        )}
      </button>
      <Sheet open={iosHelp} onClose={() => setIosHelp(false)} title="Instalar no iPhone">
        <ol className="install-steps">
          <li>Abra esta página no <strong>Safari</strong>.</li>
          <li>Toque em <strong>Compartilhar</strong> <Icon name="share" size={18} /> na barra de baixo.</li>
          <li>Role e toque em <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Toque em <strong>Adicionar</strong>. O ícone do Vizipet aparece junto dos outros apps.</li>
        </ol>
      </Sheet>
    </>
  );
}
