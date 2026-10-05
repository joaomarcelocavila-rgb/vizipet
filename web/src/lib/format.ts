const tz = 'America/Recife';
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const money = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? 'Preço a combinar'
    : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dayKey = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });
export const todayKey = () => dayKey(new Date());
export const plusDaysKey = (n: number) => dayKey(new Date(Date.now() + n * 86400000));

export function fmtDay(iso: string) {
  const key = dayKey(iso);
  if (key === todayKey()) return 'Hoje';
  if (key === plusDaysKey(1)) return 'Amanhã';
  return capitalize(new Date(iso).toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' }));
}
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: 'long' });

export function fmtAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return fmtDate(iso);
}

export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`);

export const fmtPhone = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

export const initial = (name: string) => name.replace(/^(Dra?\.)\s*/, '').charAt(0).toUpperCase();
export const firstName = (name: string) => name.replace(/^(Dra?\.)\s*/, '').split(' ')[0];

export const modalityLabel = (m: string) => (m === 'REMOTE' ? 'Online' : 'Presencial');

export function greeting() {
  const h = Number(new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit' }));
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
}
