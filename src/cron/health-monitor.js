const ShopeeAPI = require('../shopee-api');
const ShopeeDirectLink = require('../shopee-direct-link');
const logger = require('../logger');
const { sendMail } = require('../utils/mailer');
const linkRedirectStore = require('../api/link-redirect-store');


const shopeeAPI = new ShopeeAPI();

// Real product link with commission for accurate health checks
const TEST_LINK = 'https://shopee.vn/product/235894867/22449738795';
const PING_INTERVAL = 60 * 60 * 1000; // 1 hour
const REMINDER_INTERVAL = 3; // Send reminder every N consecutive failures

// Cleanup config
const CLEANUP_HOUR = 3;           // 3:00 AM local time
const CLEANUP_GRACE_DAYS = 7;     // Keep expired rows 7 days for debugging

let isHealthy = true;
let consecutiveFailures = 0;
let monitorInterval = null;
let cleanupTimeout = null;

async function runHealthCheck() {
  const mode = process.env.LINK_MODE || 'direct';
  logger.info('HealthMonitor', `Running health check (mode=${mode})...`);

  if (mode === 'direct') {
    return runDirectModeHealthCheck();
  }

  return runGraphqlModeHealthCheck();
}

/**
 * Direct mode health check:
 * 1. Test addlivetag API reachable (commission check)
 * 2. Verify an_redir URL generation
 * No extension needed — lightweight & fast
 */
async function runDirectModeHealthCheck() {
  try {
    const parsed = ShopeeDirectLink.parseProductUrl(TEST_LINK);
    if (!parsed || !parsed.itemId) {
      logger.error('HealthMonitor', 'Cannot parse test link');
      await handleFailure('Cannot parse test link URL');
      return;
    }

    // Test 1: addlivetag API
    const directLink = new ShopeeDirectLink(process.env.SHOPEE_AFFILIATE_ID);
    const commissionResult = await directLink.checkCommission(parsed.itemId);

    if (commissionResult.found) {
      logger.info('HealthMonitor', `✅ Direct mode OK — commission: ${commissionResult.commission}% (${commissionResult.productName})`);
    } else {
      logger.warn('HealthMonitor', 'Addlivetag API returned no commission data (may be temporary)');
    }

    // Test 2: Link generation
    const linkResult = directLink.generateLink(TEST_LINK, {
      sub1: 'health_check',
      sub4: 'from_direct',
    });

    if (!linkResult.success) {
      logger.error('HealthMonitor', `Link generation failed: ${linkResult.error}`);
      await handleFailure(linkResult.error);
      return;
    }

    logger.info('HealthMonitor', `✅ Direct mode healthy — link: ${linkResult.affiliateLink.slice(0, 60)}...`);
    await handleSuccess({
      shortLink: linkResult.affiliateLink,
      commission: commissionResult.commission || 0,
    });
  } catch (err) {
    logger.error('HealthMonitor', `Direct mode error: ${err.message}`);
    await handleFailure(err.message);
  }
}

/**
 * GraphQL mode health check:
 * 3 attempts with 10s delay between each — requires extension
 */
async function runGraphqlModeHealthCheck() {
  logger.info('HealthMonitor', 'Running GraphQL mode check (3 attempts)...');

  const ATTEMPTS = 3;
  const DELAY_BETWEEN = 10 * 1000;
  let lastError = null;

  for (let i = 1; i <= ATTEMPTS; i++) {
    logger.info('HealthMonitor', `Attempt ${i}/${ATTEMPTS}...`);

    try {
      const result = await shopeeAPI.checkAndConvert(
        TEST_LINK,
        { sub1: 'health_check' },
      );

      if (result.success || result.noCommission) {
        const detail = result.success
          ? `Link: ${result.shortLink}`
          : 'No commission but extension responsive';
        logger.info('HealthMonitor', `✅ Attempt ${i} passed. ${detail}`);
        await handleSuccess(result);
        return;
      }

      lastError = result.error;
      logger.warn('HealthMonitor', `Attempt ${i} failed: ${result.error}`);
    } catch (error) {
      lastError = error.message;
      logger.error('HealthMonitor', `Attempt ${i} error: ${error.message}`);
    }

    if (i < ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN));
    }
  }

  logger.error('HealthMonitor', `All ${ATTEMPTS} attempts failed. Last error: ${lastError}`);
  await handleFailure(lastError);
}

async function handleSuccess(result) {
  if (!isHealthy) {
    isHealthy = true;
    const failedHours = consecutiveFailures;
    consecutiveFailures = 0;

    const emails = process.env.NOTIFY_EMAILS;
    if (emails) {
      const mode = process.env.LINK_MODE || 'direct';
      await sendMail(
        emails,
        '✅ [Shopee Ext] Hệ thống đã khôi phục',
        [
          'Hệ thống đã hoạt động trở lại.',
          '',
          `Mode: ${mode.toUpperCase()}`,
          `Thời gian khôi phục: ${new Date().toLocaleString('vi-VN')}`,
          `Số giờ bị lỗi trước đó: ~${failedHours} giờ`,
          result.shortLink ? `Link test: ${result.shortLink}` : '(Kết nối OK, sản phẩm không có commission)',
        ].join('\n'),
      );
    }
  } else {
    consecutiveFailures = 0;
  }
}

async function handleFailure(errorMsg) {
  consecutiveFailures++;
  const emails = process.env.NOTIFY_EMAILS;
  const mode = process.env.LINK_MODE || 'direct';

  if (isHealthy) {
    isHealthy = false;
    if (emails) {
      const hints = mode === 'direct'
        ? [
            'Mode DIRECT: Lỗi có thể từ addlivetag API hoặc SHOPEE_AFFILIATE_ID sai.',
            'Kiểm tra biến SHOPEE_AFFILIATE_ID trong .env.',
            'Nếu addlivetag API down, link vẫn tạo được nhưng không có % hoa hồng.',
          ]
        : [
            'Nếu lỗi là "cookie incorrect", hệ thống đang tự reload trang.',
            'Nếu lỗi là "Extension chưa kết nối", hãy kiểm tra Chrome trên VPS.',
            'Nếu vẫn thất bại sau nhiều lần, hãy đăng nhập lại Shopee thủ công.',
          ];

      await sendMail(
        emails,
        '❌ [Shopee Ext] Cảnh báo lỗi kết nối',
        [
          'Hệ thống vừa gặp lỗi khi thực hiện health check.',
          '',
          `Mode: ${mode.toUpperCase()}`,
          `Lỗi: ${errorMsg}`,
          `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
          '',
          ...hints,
        ].join('\n'),
      );
    }
    return;
  }

  if (consecutiveFailures % REMINDER_INTERVAL === 0 && emails) {
    await sendMail(
      emails,
      `⚠️ [Shopee Ext] Vẫn đang lỗi (${consecutiveFailures} giờ liên tiếp)`,
      [
        `Hệ thống đã lỗi liên tục ${consecutiveFailures} giờ mà chưa tự khôi phục.`,
        '',
        `Mode: ${mode.toUpperCase()}`,
        `Lỗi gần nhất: ${errorMsg}`,
        `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
        '',
        'Cần kiểm tra VPS ngay.',
      ].join('\n'),
    );
  }
}

function startMonitor() {
  if (monitorInterval) return;

  setTimeout(() => {
    runHealthCheck();
    monitorInterval = setInterval(runHealthCheck, PING_INTERVAL);
  }, 2 * 60 * 1000);

  // Schedule first cleanup run at next 3:00 AM
  scheduleNextCleanup();

  const mode = process.env.LINK_MODE || 'direct';
  logger.info('HealthMonitor', `Started (mode=${mode}). First check in 2 min, then every ${PING_INTERVAL / 60000} min.`);
}

function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('HealthMonitor', 'Stopped.');
  }
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
    cleanupTimeout = null;
  }
}

/**
 * Schedule cleanup to run at exactly CLEANUP_HOUR:00:00 local time.
 * After each run, schedules the next one 24h later.
 */
function scheduleNextCleanup() {
  const now = new Date();
  const next = new Date();
  next.setHours(CLEANUP_HOUR, 0, 0, 0);

  // If 3AM has already passed today, schedule for tomorrow
  if (next <= now) next.setDate(next.getDate() + 1);

  const msUntil = next.getTime() - now.getTime();
  logger.info('HealthMonitor', `Cleanup scheduled in ${Math.round(msUntil / 3600000 * 10) / 10}h (${next.toLocaleString('vi-VN')})`);

  cleanupTimeout = setTimeout(async () => {
    await runCleanup();
    // Re-schedule for next day
    scheduleNextCleanup();
  }, msUntil);
}

/** Delete expired redirect rows (grace period: 7 days after expiry) */
async function runCleanup() {
  try {
    logger.info('HealthMonitor', `Running nightly cleanup (grace=${CLEANUP_GRACE_DAYS}d)...`);
    const { deletedLinks, deletedClicks } = await linkRedirectStore.cleanupExpired(CLEANUP_GRACE_DAYS);
    logger.info('HealthMonitor', `Cleanup done — removed ${deletedLinks} links, ${deletedClicks} click events`);
  } catch (err) {
    logger.error('HealthMonitor', `Cleanup failed: ${err.message}`);
  }
}

module.exports = { startMonitor, stopMonitor, runHealthCheck, runCleanup };
