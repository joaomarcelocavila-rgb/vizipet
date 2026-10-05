import { detectFile, safeDisplayName, validateUpload } from './file-validator';

const PDF = Buffer.from('%PDF-1.7 conteúdo');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('detectFile', () => {
  it('identifica pelos bytes, não pelo nome', () => {
    expect(detectFile(PDF)?.mime).toBe('application/pdf');
    expect(detectFile(JPEG)?.mime).toBe('image/jpeg');
    expect(detectFile(PNG)?.mime).toBe('image/png');
    expect(detectFile(Buffer.from('<svg/>'))).toBeNull();
    expect(detectFile(Buffer.from('PK\x03\x04'))).toBeNull();
  });
});

describe('validateUpload', () => {
  it('aceita JPEG com extensão .jpeg e gera caminho aleatório', () => {
    const result = validateUpload({ buffer: JPEG, originalname: 'foto.JPEG' }, 'photo');
    expect(result.storagePath).toMatch(/^photos\/[0-9a-f-]{36}\.jpg$/);
  });

  it('foto não aceita PDF', () => {
    expect(() => validateUpload({ buffer: PDF, originalname: 'a.pdf' }, 'photo')).toThrow();
  });

  it('respeita o limite de 5 MB para foto', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    expect(() => validateUpload({ buffer: big, originalname: 'a.png' }, 'photo')).toThrow(/5 MB/);
  });

  it('recusa extensão dupla perigosa', () => {
    expect(() => validateUpload({ buffer: PDF, originalname: 'boleto.html.pdf' }, 'document')).toThrow();
  });
});

describe('safeDisplayName', () => {
  it('remove diretórios e caracteres de controle', () => {
    expect(safeDisplayName('../../etc/pass\u0000wd.pdf')).toBe('passwd.pdf');
    expect(safeDisplayName('C:\\docs\\crmv.pdf')).toBe('crmv.pdf');
  });
});
