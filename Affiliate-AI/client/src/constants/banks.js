/**
 * Vietnamese banks with VietQR-compatible codes and logo URLs.
 * Logo source: https://api.vietqr.io/img/{bin}.png  (official VietQR CDN)
 * bin = bank bin number used by VietQR API
 */
export const VIET_BANKS = [
  { code: 'VCB',  name: 'Vietcombank',        bin: '970436', short: 'Vietcombank' },
  { code: 'BIDV', name: 'BIDV',               bin: '970418', short: 'BIDV' },
  { code: 'VTB',  name: 'Vietinbank',         bin: '970415', short: 'Vietinbank' },
  { code: 'AGR',  name: 'Agribank',           bin: '970405', short: 'Agribank' },
  { code: 'TCB',  name: 'Techcombank',        bin: '970407', short: 'Techcombank' },
  { code: 'MB',   name: 'MB Bank',            bin: '970422', short: 'MBBank' },
  { code: 'ACB',  name: 'ACB',                bin: '970416', short: 'ACB' },
  { code: 'VPB',  name: 'VPBank',             bin: '970432', short: 'VPBank' },
  { code: 'TPB',  name: 'TPBank',             bin: '970423', short: 'TPBank' },
  { code: 'STB',  name: 'Sacombank',          bin: '970403', short: 'Sacombank' },
  { code: 'HDB',  name: 'HDBank',             bin: '970437', short: 'HDBank' },
  { code: 'SHB',  name: 'SHB',               bin: '970443', short: 'SHB' },
  { code: 'OCB',  name: 'OCB',               bin: '970448', short: 'OCB' },
  { code: 'MSB',  name: 'MSB',               bin: '970426', short: 'MSB' },
  { code: 'SEAB', name: 'SeABank',            bin: '970440', short: 'SeABank' },
  { code: 'EIB',  name: 'Eximbank',           bin: '970431', short: 'Eximbank' },
  { code: 'LPB',  name: 'LienVietPostBank',   bin: '970449', short: 'LPB' },
  { code: 'NCB',  name: 'NCB',               bin: '970419', short: 'NCB' },
  { code: 'PGB',  name: 'PGBank',             bin: '970430', short: 'PGBank' },
  { code: 'CAKE', name: 'CAKE',              bin: '546034', short: 'CAKE' },
];

/** Get logo URL for a bank by code */
export function getBankLogoUrl(code) {
  const bank = VIET_BANKS.find(b => b.code === code);
  if (!bank) return null;
  return `https://api.vietqr.io/img/${bank.bin}.png`;
}

/** Build VietQR image URL */
export function buildVietQrUrl(bankCode, accountNo, amount = 0, description = '') {
  if (!bankCode || !accountNo) return null;
  const bank = VIET_BANKS.find(b => b.code === bankCode);
  const binOrCode = bank ? bank.bin : bankCode;
  const params = new URLSearchParams();
  if (amount > 0) params.set('amount', amount);
  if (description) params.set('addInfo', description);
  return `https://img.vietqr.io/image/${binOrCode}-${encodeURIComponent(accountNo)}-compact2.jpg?${params.toString()}`;
}
