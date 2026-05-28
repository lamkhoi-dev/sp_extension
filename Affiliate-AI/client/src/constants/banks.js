/**
 * Vietnamese banks with VietQR-compatible codes.
 * Source: https://api.vietqr.io/v2/banks (65 banks total)
 * Logo: https://cdn.vietqr.io/img/{code}.png
 * Filtered: transferSupported = 1 only (usable for receiving payments)
 * Last synced: 2026-05-28
 */
export const VIET_BANKS = [
  // ── Big 4 + State-owned ──────────────────────────────────
  { code: 'VCB',      name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',       bin: '970436', short: 'Vietcombank' },
  { code: 'ICB',      name: 'Ngân hàng TMCP Công thương Việt Nam',         bin: '970415', short: 'VietinBank' },
  { code: 'BIDV',     name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', bin: '970418', short: 'BIDV' },
  { code: 'VBA',      name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn', bin: '970405', short: 'Agribank' },

  // ── Top private banks ────────────────────────────────────
  { code: 'TCB',      name: 'Ngân hàng TMCP Kỹ thương Việt Nam',          bin: '970407', short: 'Techcombank' },
  { code: 'MB',       name: 'Ngân hàng TMCP Quân đội',                    bin: '970422', short: 'MBBank' },
  { code: 'ACB',      name: 'Ngân hàng TMCP Á Châu',                      bin: '970416', short: 'ACB' },
  { code: 'VPB',      name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',        bin: '970432', short: 'VPBank' },
  { code: 'TPB',      name: 'Ngân hàng TMCP Tiên Phong',                  bin: '970423', short: 'TPBank' },
  { code: 'STB',      name: 'Ngân hàng TMCP Sài Gòn Thương Tín',          bin: '970403', short: 'Sacombank' },
  { code: 'HDB',      name: 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh',  bin: '970437', short: 'HDBank' },
  { code: 'VIB',      name: 'Ngân hàng TMCP Quốc tế Việt Nam',            bin: '970441', short: 'VIB' },
  { code: 'SHB',      name: 'Ngân hàng TMCP Sài Gòn - Hà Nội',           bin: '970443', short: 'SHB' },
  { code: 'EIB',      name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam',     bin: '970431', short: 'Eximbank' },
  { code: 'MSB',      name: 'Ngân hàng TMCP Hàng Hải Việt Nam',           bin: '970426', short: 'MSB' },
  { code: 'OCB',      name: 'Ngân hàng TMCP Phương Đông',                 bin: '970448', short: 'OCB' },
  { code: 'LPB',      name: 'Ngân hàng TMCP Lộc Phát Việt Nam',           bin: '970449', short: 'LPBank' },
  { code: 'SEAB',     name: 'Ngân hàng TMCP Đông Nam Á',                  bin: '970440', short: 'SeABank' },

  // ── Other commercial banks ───────────────────────────────
  { code: 'ABB',      name: 'Ngân hàng TMCP An Bình',                     bin: '970425', short: 'ABBANK' },
  { code: 'BAB',      name: 'Ngân hàng TMCP Bắc Á',                       bin: '970409', short: 'BacABank' },
  { code: 'BVB',      name: 'Ngân hàng TMCP Bảo Việt',                    bin: '970438', short: 'BaoVietBank' },
  { code: 'VCCB',     name: 'Ngân hàng TMCP Bản Việt',                    bin: '970454', short: 'VietCapitalBank' },
  { code: 'KLB',      name: 'Ngân hàng TMCP Kiên Long',                   bin: '970452', short: 'KienLongBank' },
  { code: 'NAB',      name: 'Ngân hàng TMCP Nam Á',                       bin: '970428', short: 'NamABank' },
  { code: 'NCB',      name: 'Ngân hàng TMCP Quốc Dân',                    bin: '970419', short: 'NCB' },
  { code: 'PGB',      name: 'Ngân hàng TMCP Thịnh vượng và Phát triển',   bin: '970430', short: 'PGBank' },
  { code: 'PVCB',     name: 'Ngân hàng TMCP Đại Chúng Việt Nam',          bin: '970412', short: 'PVcomBank' },
  { code: 'SCB',      name: 'Ngân hàng TMCP Sài Gòn',                     bin: '970429', short: 'SCB' },
  { code: 'SGICB',    name: 'Ngân hàng TMCP Sài Gòn Công Thương',         bin: '970400', short: 'SaigonBank' },
  { code: 'VAB',      name: 'Ngân hàng TMCP Việt Á',                      bin: '970427', short: 'VietABank' },
  { code: 'VIETBANK', name: 'Ngân hàng TMCP Việt Nam Thương Tín',         bin: '970433', short: 'VietBank' },
  { code: 'COOPBANK', name: 'Ngân hàng Hợp tác xã Việt Nam',              bin: '970446', short: 'COOPBANK' },
  { code: 'MBV',      name: 'Ngân hàng TNHH MTV Việt Nam Hiện Đại',       bin: '970414', short: 'MBV' },
  { code: 'PVDB',     name: 'Ngân hàng số PVcomBank',                      bin: '971133', short: 'PVcomBank Pay' },

  // ── Foreign banks in Vietnam ─────────────────────────────
  { code: 'SHBVN',    name: 'Ngân hàng TNHH MTV Shinhan Việt Nam',        bin: '970424', short: 'ShinhanBank' },
  { code: 'CIMB',     name: 'Ngân hàng TNHH MTV CIMB Việt Nam',           bin: '422589', short: 'CIMB' },
  { code: 'WVN',      name: 'Ngân hàng TNHH MTV Woori Việt Nam',          bin: '970457', short: 'Woori' },
  { code: 'KBank',    name: 'Ngân hàng Đại chúng TNHH Kasikornbank',      bin: '668888', short: 'KBank' },

  // ── Digital banks / Fintech ──────────────────────────────
  { code: 'CAKE',     name: 'CAKE by VPBank',                              bin: '546034', short: 'CAKE' },
  { code: 'Ubank',    name: 'Ubank by VPBank',                             bin: '546035', short: 'Ubank' },
  { code: 'momo',     name: 'MoMo',                                        bin: '971025', short: 'MoMo' },
];

/** Get logo URL for a bank by code (uses VietQR official CDN) */
export function getBankLogoUrl(code) {
  const bank = VIET_BANKS.find(b => b.code === code);
  if (!bank) return null;
  return `https://cdn.vietqr.io/img/${bank.code}.png`;
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
