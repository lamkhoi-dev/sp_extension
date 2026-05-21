console.log('[Shopee Ext] Auto-login script loaded.');

function triggerInputEvents(input) {
  // Dispatch events to notify React/Vue of the autofilled value
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function attemptLogin() {
  // Ensure inputs are recognized (Chrome autofill sometimes doesn't trigger React state)
  const inputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="password"]');
  inputs.forEach(input => {
    if (input.value) triggerInputEvents(input);
  });

  // Find login button — support both Vietnamese and English text
  const allButtons = Array.from(document.querySelectorAll('button, a[role="button"]'));
  const loginButton = allButtons.find(btn => {
    const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
    return text.includes('đăng nhập') || text.includes('log in') || text.includes('login');
  });

  if (!loginButton) {
    console.log('[Shopee Ext] Login button not found yet.');
    return false;
  }

  if (loginButton.disabled) {
    console.log('[Shopee Ext] Login button disabled, waiting for autofill...');
    return false;
  }

  console.log('[Shopee Ext] Clicking login button!');
  loginButton.click();
  return true;
}

// Retry with increasing delays to account for slow autofill
const DELAYS = [2000, 3000, 4000, 5000, 6000, 8000, 10000];
let attempt = 0;

function scheduleNext() {
  if (attempt >= DELAYS.length) {
    console.log('[Shopee Ext] Auto-login gave up after all retries.');
    return;
  }
  setTimeout(() => {
    if (!attemptLogin()) {
      attempt++;
      scheduleNext();
    }
  }, DELAYS[attempt]);
}

scheduleNext();
