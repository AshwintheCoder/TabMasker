// content.js (v5) — persists title & favicon
let original = { title: null, favicons: [] };
let applied = false;
let desired = { title: null, faviconUrl: null };

function saveOriginal() {
  if (original.title === null) original.title = document.title;
  if (!original.favicons.length) {
    original.favicons = Array.from(document.querySelectorAll('link[rel~="icon"]'))
      .map(el => el.cloneNode(true));
  }
}
function setFavicon(url) {
  document.querySelectorAll('link[rel~="icon"]').forEach(el => el.remove());
  if (!url) return;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  document.head.appendChild(link);
}
function applyDisguise({ title, faviconUrl }) {
  saveOriginal();
  desired.title = title || desired.title;
  desired.faviconUrl = faviconUrl || desired.faviconUrl;
  if (desired.title) document.title = desired.title;
  setFavicon(desired.faviconUrl);
  applied = true;
}
function clearDisguise() {
  if (original.title !== null) document.title = original.title;
  document.querySelectorAll('link[rel~="icon"]').forEach(el => el.remove());
  for (const ico of original.favicons) document.head.appendChild(ico.cloneNode(true));
  applied = false;
}
chrome.runtime.onMessage.addEventListener?.bind(chrome.runtime.onMessage) || chrome.runtime.onMessage;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'APPLY_DISGUISE') applyDisguise(msg.payload);
  if (msg?.type === 'CLEAR_DISGUISE') clearDisguise();
});
const headObserver = new MutationObserver((mutations) => {
  if (!applied) return;
  if (desired.title && document.title !== desired.title) document.title = desired.title;
  const icon = document.querySelector('link[rel~="icon"]');
  if ((!icon && desired.faviconUrl) || (icon && desired.faviconUrl && icon.href !== desired.faviconUrl)) {
    setFavicon(desired.faviconUrl);
  }
});
headObserver.observe(document.head || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href','rel'] });
setInterval(() => {
  if (!applied) return;
  const icon = document.querySelector('link[rel~="icon"]');
  if ((!icon && desired.faviconUrl) || (icon && desired.faviconUrl && icon.href !== desired.faviconUrl)) {
    setFavicon(desired.faviconUrl);
  }
}, 1000);
if (!document.querySelector('title')) {
  const t = document.createElement('title');
  document.head.appendChild(t);
}
