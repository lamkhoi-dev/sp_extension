console.log('[Shopee Ext] Content Script loaded!');

function setReactValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  const fallbackDescriptor = Object.getOwnPropertyDescriptor(
    element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    'value'
  );
  const setter = descriptor ? descriptor.set : fallbackDescriptor.set;
  
  if (setter) {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

async function findElementWithTimeout(selector, timeout = 3000) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to close the modal if it's currently open
async function closeAnyModal() {
  const closeBtn = document.querySelector('.icon-close, svg[viewBox="0 0 16 16"]'); // Heuristic for X button
  if (closeBtn) {
    // Try to click the closest button wrapping the SVG
    const btn = closeBtn.closest('button') || closeBtn;
    btn.click();
    await delay(300);
  }
}

async function executeConvertLink(payload) {
  try {
    const { url, subId1 = '', subId2 = '' } = payload;

    // Close any existing modal (only if one is open)
    const existingDialog = document.querySelector('[role="dialog"]');
    if (existingDialog) {
      await closeAnyModal();
      await delay(100);
    }

    // 1. Find and fill the main URL textarea
    const urlTextarea = document.querySelector('textarea[placeholder*="liên kết"]');
    if (!urlTextarea) return { success: false, error: 'Cannot find URL Input' };
    setReactValue(urlTextarea, url);
    await delay(50);

    // 2. Fill SubId inputs if provided
    if (subId1) {
      const sub1Input = document.querySelector('input[placeholder*="SportShoes"]');
      if (sub1Input) setReactValue(sub1Input, subId1);
    }
    if (subId2) {
      const sub2Input = document.querySelector('input[placeholder*="InstagramFeed"]');
      if (sub2Input) setReactValue(sub2Input, subId2);
    }
    await delay(50);

    // 3. Click "Lấy link" button
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('lấy link'));
    if (!submitBtn) return { success: false, error: 'Cannot find submit button' };
    submitBtn.click();

    // 4. Wait for modal with short link — use MutationObserver (instant detection)
    const shortLink = await waitForShortLink(8000);
    if (!shortLink) {
      return { success: false, error: 'Timeout waiting for Short Link modal' };
    }

    // 5. Cleanup: Close modal + clear inputs (non-blocking)
    closeAnyModal();
    setReactValue(urlTextarea, '');

    return { success: true, originalLink: url, shortLink };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

function waitForShortLink(timeout = 8000) {
  return new Promise((resolve) => {
    // Check if already visible
    const existing = findShortLinkTextarea();
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const link = findShortLinkTextarea();
      if (link) {
        observer.disconnect();
        resolve(link);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    setTimeout(() => {
      observer.disconnect();
      // Final fallback check
      resolve(findShortLinkTextarea());
    }, timeout);
  });
}

function findShortLinkTextarea() {
  const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.modal-wrapper');
  if (!dialog) return null;
  const textareas = dialog.querySelectorAll('textarea');
  const match = Array.from(textareas).find(t => t.value.includes('shopee.vn'));
  return match ? match.value : null;
}

// Ensure connection backwards to the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Shopee Ext] Received message:', request);
  if (request.action === 'convert_link') {
    executeConvertLink(request.payload).then(response => {
      sendResponse(response);
    });
    return true; // Indicate asynchronous response
  }
  
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
});
