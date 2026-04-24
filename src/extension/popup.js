const serverDot = document.getElementById('serverDot');
const serverStatus = document.getElementById('serverStatus');
const tabDot = document.getElementById('tabDot');
const tabStatus = document.getElementById('tabStatus');
const toggleActive = document.getElementById('toggleActive');
const infoBox = document.getElementById('infoBox');

async function checkStatus() {
  // 1. Check Server
  try {
    const res = await fetch('http://localhost:3456/api/status', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    serverDot.classList.add('ok');
    serverStatus.textContent = 'Online';
  } catch {
    serverDot.classList.remove('ok');
    serverStatus.textContent = 'Offline';
  }

  // 2. Check Shopee Tab
  const tabs = await chrome.tabs.query({ url: '*://affiliate.shopee.vn/*' });
  if (tabs.length > 0) {
    tabDot.classList.add('ok');
    tabStatus.textContent = `Tìm thấy (${tabs.length} tab)`;
  } else {
    tabDot.classList.remove('ok');
    tabStatus.textContent = 'Chưa mở';
  }

  // 3. Check toggle state
  const { botActive } = await chrome.storage.local.get('botActive');
  toggleActive.checked = botActive !== false; // default ON

  updateInfoBox(tabs.length > 0);
}

function updateInfoBox(hasTab) {
  const serverOk = serverDot.classList.contains('ok');
  const active = toggleActive.checked;

  if (!serverOk) {
    infoBox.innerHTML = '⚠️ Server chưa chạy.<br>Mở Terminal: <code>npm start</code>';
  } else if (!hasTab) {
    infoBox.innerHTML = '⚠️ Chưa mở tab Shopee.<br>👉 <a href="#" id="openShopee">Mở Shopee Affiliate</a>';
    document.getElementById('openShopee')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://affiliate.shopee.vn/offer/custom_link' });
    });
  } else if (!active) {
    infoBox.textContent = '⏸️ Bot đang TẮT. Bật toggle để kích hoạt.';
  } else {
    infoBox.textContent = '✅ Mọi thứ sẵn sàng! Bot đang hoạt động.';
  }
}

// Toggle handler
toggleActive.addEventListener('change', async () => {
  const active = toggleActive.checked;
  await chrome.storage.local.set({ botActive: active });

  // Notify background script
  chrome.runtime.sendMessage({ type: 'toggle_bot', active });

  const tabs = await chrome.tabs.query({ url: '*://affiliate.shopee.vn/*' });
  updateInfoBox(tabs.length > 0);
});

checkStatus();
