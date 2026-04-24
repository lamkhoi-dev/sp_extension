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
    
    await closeAnyModal();
    await delay(500);

    // 1. Find and fill the main URL textarea
    const urlTextarea = document.querySelector('textarea[placeholder*="liên kết"]');
    if (!urlTextarea) return { success: false, error: 'Cannot find URL Input' };
    setReactValue(urlTextarea, url);
    await delay(300);

    // 2. Find SubId inputs (Heuristic: placeholders ending with specific examples)
    const sub1Input = document.querySelector('input[placeholder*="SportShoes"]');
    if (sub1Input && subId1) {
      setReactValue(sub1Input, subId1);
    }
    
    const sub2Input = document.querySelector('input[placeholder*="InstagramFeed"]');
    if (sub2Input && subId2) {
      setReactValue(sub2Input, subId2);
    }
    
    await delay(300);

    // 3. Find and click "Lấy link" button
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('lấy link'));
    if (!submitBtn) return { success: false, error: 'Cannot find submit button' };
    
    submitBtn.click();
    
    // 4. Wait for Modal with short link
    // The modal usually has text "Link của Custom Link" or similar.
    let modalTextarea = null;
    let retries = 0;
    while (retries < 20) { // Max 10 seconds (20 * 500ms)
      await delay(500);
      
      // Look for a dialog or modal container
      const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.modal-wrapper') || document.body;
      
      // Look for textarea inside the dialog that contains s.shopee.vn
      const textareas = dialog.querySelectorAll('textarea');
      modalTextarea = Array.from(textareas).find(t => t.value.includes('shopee.vn'));
      
      if (modalTextarea) break;
      retries++;
    }

    if (!modalTextarea) {
       return { success: false, error: 'Timeout waiting for Short Link modal' };
    }

    const shortLink = modalTextarea.value;

    // 5. Cleanup: Close modal
    await closeAnyModal();
    // Also clear the inputs for next run
    setReactValue(urlTextarea, '');
    if (sub1Input) setReactValue(sub1Input, '');
    if (sub2Input) setReactValue(sub2Input, '');

    return {
      success: true,
      originalLink: url,
      shortLink: shortLink
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
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
