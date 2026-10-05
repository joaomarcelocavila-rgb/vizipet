import { checkPublicHttpsUrl, isPrivateAddress } from './safe-url';

describe('checkPublicHttpsUrl', () => {
  it.each(['https://www.gov.br/agricultura', 'https://recife.pe.gov.br:443/campanha?x=1'])('aceita %s', (url) => {
    expect(checkPublicHttpsUrl(url).ok).toBe(true);
  });

  it.each([
    ['http://www.gov.br', 'HTTPS'],
    ['ftp://www.gov.br', 'HTTPS'],
    ['https://127.0.0.1', 'IP'],
    ['https://[::1]/', 'IP'],
    ['https://localhost', 'interno'],
    ['https://printer.local', 'interno'],
    ['https://a:b@www.gov.br', 'credenciais'],
    ['https://www.gov.br:8443', 'Porta'],
    ['não é url', 'inválida'],
  ])('recusa %s', (url, reason) => {
    const result = checkPublicHttpsUrl(url);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain(reason);
  });
});

describe('isPrivateAddress', () => {
  it.each([
    '10.1.2.3',
    '172.16.0.1',
    '192.168.0.10',
    '127.0.0.1',
    '169.254.169.254',
    '::1',
    'fd00::1',
    '::ffff:10.0.0.1',
  ])('%s é privado', (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '200.160.2.3', '2001:4860:4860::8888'])('%s é público', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});
