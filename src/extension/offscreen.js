// Offscreen Document — runs as a persistent hidden page
// Pings the Service Worker every 5s to prevent Chrome from terminating it.
// This is the ONLY reliable way to keep a MV3 SW alive indefinitely.
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'offscreen_ping' }).catch(() => {
    // SW may be briefly unavailable during restart — ignore
  });
}, 5000);
