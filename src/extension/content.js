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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Close modal — wait for it to disappear via observer instead of fixed delay
function closeAnyModal() {
  return new Promise((resolve) => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return resolve();

    const closeBtn = dialog.querySelector('.icon-close, svg[viewBox="0 0 16 16"]');
    if (!closeBtn) return resolve();

    const btn = closeBtn.closest('button') || closeBtn;

    // Watch for dialog removal
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[role="dialog"]')) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    btn.click();

    // Safety timeout — don't hang forever
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 1000);
  });
}

async function executeConvertLink(payload) {
  try {
    const { url, subId1 = '', subId2 = '' } = payload;

    // Close existing modal — MUST await to prevent stale result
    if (document.querySelector('[role="dialog"]')) {
      await closeAnyModal();
    }

    // 1. Fill URL textarea — no delay needed, React setState is sync after event dispatch
    const urlTextarea = document.querySelector('textarea[placeholder*="liên kết"]');
    if (!urlTextarea) return { success: false, error: 'Cannot find URL Input' };
    setReactValue(urlTextarea, url);

    // 2. Fill SubId inputs if provided (no delay between fills)
    if (subId1) {
      const sub1Input = document.querySelector('input[placeholder*="SportShoes"]');
      if (sub1Input) setReactValue(sub1Input, subId1);
    }
    if (subId2) {
      const sub2Input = document.querySelector('input[placeholder*="InstagramFeed"]');
      if (sub2Input) setReactValue(sub2Input, subId2);
    }

    // 3. Click "Lấy link" button — immediate after filling
    const submitBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.innerText && b.innerText.toLowerCase().includes('lấy link'));
    if (!submitBtn) return { success: false, error: 'Cannot find submit button' };
    submitBtn.click();

    // 4. Wait for short link via MutationObserver (instant detection)
    const shortLink = await waitForShortLink(8000);
    if (!shortLink) {
      return { success: false, error: 'Timeout waiting for Short Link modal' };
    }

    // 5. Cleanup — MUST await to prevent next request from seeing stale link
    await closeAnyModal();
    setReactValue(urlTextarea, '');

    return { success: true, originalLink: url, shortLink };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

function waitForShortLink(timeout = 8000) {
  return new Promise((resolve) => {
    // Check immediately
    const existing = findShortLinkTextarea();
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const link = findShortLinkTextarea();
      if (link) {
        observer.disconnect();
        resolve(link);
      }
    });
    // Watch for new nodes + attribute + characterData changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    setTimeout(() => {
      observer.disconnect();
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

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convert_link') {
    executeConvertLink(request.payload).then(sendResponse);
    return true;
  }
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
});
