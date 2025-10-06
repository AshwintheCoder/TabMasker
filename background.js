// background.js (v5) — groups + suggestions + precedence
const KEY_PER_TAB = 'perTabDisguises';
const KEY_PER_SITE = 'perSiteRules';
const KEY_GROUPS   = 'groups';

// Starter groups (first-run only)
const STARTER_GROUPS = [
  {
    id: 'grp-social',
    name: 'Social',
    enabled: true,
    default: { title: 'Canvas Dashboard', faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQoU2NkYGD4z0AEYBxVSFQGQ3E0Gk0Gg0EwDAwMAAA8kQXh0c1APwAAAABJRU5ErkJggg==' },
    patterns: ['*instagram.com/*','*m.instagram.com/*','*tiktok.com/*','*x.com/*','*twitter.com/*','*facebook.com/*','*reddit.com/*','*snapchat.com/*','*pinterest.com/*']
  },
  {
    id: 'grp-shopping',
    name: 'Shopping',
    enabled: false,
    default: { title: 'Canvas Dashboard', faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQoU2NkYGD4z0AEYBxVSFQGQ3E0Gk0Gg0EwDAwMAAA8kQXh0c1APwAAAABJRU5ErkJggg==' },
    patterns: ['*amazon.com/*','*ebay.com/*','*aliexpress.com/*','*etsy.com/*','*walmart.com/*','*target.com/*']
  },
  {
    id: 'grp-streaming',
    name: 'Streaming',
    enabled: false,
    default: { title: 'Canvas Dashboard', faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQoU2NkYGD4z0AEYBxVSFQGQ3E0Gk0Gg0EwDAwMAAA8kQXh0c1APwAAAABJRU5ErkJggg==' },
    patterns: ['*youtube.com/*','*netflix.com/*','*hulu.com/*','*disneyplus.com/*','*twitch.tv/*','*hbomax.com/*','*max.com/*']
  },
  {
    id: 'grp-gaming',
    name: 'Gaming',
    enabled: false,
    default: { title: 'Canvas Dashboard', faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQoU2NkYGD4z0AEYBxVSFQGQ3E0Gk0Gg0EwDAwMAAA8kQXh0c1APwAAAABJRU5ErkJggg==' },
    patterns: ['*steampowered.com/*','*store.steampowered.com/*','*epicgames.com/*','*roblox.com/*','*minecraft.net/*','*leagueoflegends.com/*']
  }
];

async function ensureStarterGroups() {
  const cur = await getState([KEY_GROUPS]);
  if (!cur[KEY_GROUPS] || !Array.isArray(cur[KEY_GROUPS]) || cur[KEY_GROUPS].length === 0) {
    const seeded = JSON.parse(JSON.stringify(STARTER_GROUPS));
    await setState({ [KEY_GROUPS]: seeded });
  }
}

async function getState(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (res) => resolve(res)));
}
async function setState(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));
}

function urlMatchesPattern(url, pattern) {
  if (!pattern) return false;
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  try { return new RegExp('^' + esc + '$').test(url); } catch { return false; }
}

function baseDomain(u) {
  try {
    const { hostname } = new URL(u);
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    // naive eTLD+1: last two labels
    return parts.slice(-2).join('.');
  } catch { return ''; }
}

async function applyDisguiseToTab(tabId, disguise) {
  if (!disguise || !disguise.enabled) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'APPLY_DISGUISE', payload: disguise });
  } catch {}
}
async function clearDisguiseFromTab(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_DISGUISE' });
  } catch {}
}

chrome.runtime.onInstalled.addListener(() => {
  ensureStarterGroups();
});
chrome.runtime.onStartup.addListener(() => {
  ensureStarterGroups();
});

// Precedence engine
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const { [KEY_PER_TAB]: perTab = {}, [KEY_PER_SITE]: perSite = [], [KEY_GROUPS]: groups = [] } = await getState([KEY_PER_TAB, KEY_PER_SITE, KEY_GROUPS]);
  const url = tab?.url || '';

  // 1) Per-tab
  const tabMask = perTab?.[tabId];
  if (tabMask?.enabled) return applyDisguiseToTab(tabId, tabMask);

  // 2) Per-site
  const siteRule = (perSite || []).find(r => r.enabled && urlMatchesPattern(url, r.pattern));
  if (siteRule) return applyDisguiseToTab(tabId, siteRule);

  // 3) Groups
  const grp = (groups || []).find(g => g.enabled && (g.patterns || []).some(p => urlMatchesPattern(url, p)));
  if (grp) return applyDisguiseToTab(tabId, { ...grp.default, enabled: true });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const { [KEY_PER_TAB]: perTab = {} } = await getState([KEY_PER_TAB]);
  const mask = perTab?.[tabId];
  if (mask?.enabled) applyDisguiseToTab(tabId, mask);
});

// Commands (same as prior versions)
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const tabId = tab.id;
  const state = await getState([KEY_PER_TAB]);
  const perTab = state[KEY_PER_TAB] || {};
  if (command === 'toggle_disguise') {
    const curr = perTab[tabId];
    if (curr?.enabled) {
      perTab[tabId] = { ...curr, enabled: false };
      await setState({ [KEY_PER_TAB]: perTab });
      await clearDisguiseFromTab(tabId);
    } else {
      perTab[tabId] = { title: 'Canvas Dashboard', faviconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIElEQVQoU2NkYGD4z0AEYBxVSFQGQ3E0Gk0Gg0EwDAwMAAA8kQXh0c1APwAAAABJRU5ErkJggg==', enabled: true };
      await setState({ [KEY_PER_TAB]: perTab });
      await applyDisguiseToTab(tabId, perTab[tabId]);
    }
  }
  if (command === 'abort_disguise') {
    if (!perTab[tabId]) return;
    delete perTab[tabId];
    await setState({ [KEY_PER_TAB]: perTab });
    await clearDisguiseFromTab(tabId);
  }
});

// Messaging: presets passthrough + favicon resolve + groups APIs
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'GET_GROUPS') {
      await ensureStarterGroups();
      const { [KEY_GROUPS]: groups = [] } = await getState([KEY_GROUPS]);
      return sendResponse(groups);
    }
    if (msg?.type === 'UPSERT_GROUP') {
      const { [KEY_GROUPS]: groups = [] } = await getState([KEY_GROUPS]);
      const idx = groups.findIndex(g => g.id === msg.group.id);
      if (idx >= 0) groups[idx] = msg.group; else groups.push(msg.group);
      await setState({ [KEY_GROUPS]: groups });
      return sendResponse({ ok: true });
    }
    if (msg?.type === 'ADD_DOMAIN_TO_GROUP') {
      const { groupId, url } = msg;
      const dom = baseDomain(url);
      if (!dom) return sendResponse({ ok: false });
      const pattern = `*${dom}/*`;
      const state = await getState([KEY_GROUPS]);
      const groups = state[KEY_GROUPS] || [];
      const g = groups.find(x => x.id === groupId);
      if (!g) return sendResponse({ ok: false });
      if (!g.patterns) g.patterns = [];
      if (!g.patterns.includes(pattern)) g.patterns.push(pattern);
      await setState({ [KEY_GROUPS]: groups });
      return sendResponse({ ok: true, addedPattern: pattern });
    }
    if (msg?.type === 'RESOLVE_FAVICON' && msg.url) {
      try {
        const resp = await fetch(msg.url, { credentials: 'omit' });
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ dataUrl: reader.result });
        reader.readAsDataURL(blob);
      } catch (e) {
        sendResponse({ dataUrl: null });
      }
      return;
    }
  })();
  return true; // async
});
