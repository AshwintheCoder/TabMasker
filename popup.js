const $ = (s) => document.querySelector(s);
const TITLE = $('#title');
const FAV = $('#favicon');
const PRESET = $('#preset');
const STATUS = $('#status');
const SUGS = $('#groupSuggestions');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(msg, ok) {
  STATUS.style.display = 'block';
  STATUS.textContent = msg;
  STATUS.style.color = ok ? '#0a7f3f' : '#b00020';
}

function baseDomain(u) {
  try { const h = new URL(u).hostname.split('.'); return h.length<=2 ? h.join('.') : h.slice(-2).join('.'); }
  catch { return ''; }
}

function loadPresets() {
  // Use a small built-in set like before
  const presets = [
    { id: 'canvas', label: 'Canvas', title: 'Canvas Dashboard', faviconUrl: 'https://canvas.instructure.com/favicon.ico' },
    { id: 'gmail', label: 'Gmail', title: 'Gmail', faviconUrl: 'https://mail.google.com/favicon.ico' },
    { id: 'docs', label: 'Google Docs', title: 'Untitled document - Google Docs', faviconUrl: 'https://docs.google.com/favicon.ico' }
  ];
  PRESET.innerHTML = '<option value="">— None —</option>' + presets.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
  PRESET.addEventListener('change', async () => {
    const sel = presets.find(p => p.id === PRESET.value);
    if (sel) {
      TITLE.value = sel.title;
      const dataUrl = await new Promise((resolve)=>{
        chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url: sel.faviconUrl }, (resp)=> resolve((resp && resp.dataUrl) ? resp.dataUrl : sel.faviconUrl));
      });
      FAV.value = dataUrl || sel.faviconUrl || '';
    }
  });
}
loadPresets();

// Suggestions UI chips
async function renderSuggestions() {
  const tab = await getActiveTab();
  const domain = baseDomain(tab.url||'');
  if (!domain) return;
  chrome.runtime.sendMessage({ type: 'GET_GROUPS' }, (groups=[]) => {
    SUGS.innerHTML = '';
    groups.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = g.name;
      chip.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'ADD_DOMAIN_TO_GROUP', groupId: g.id, url: tab.url }, (resp) => {
          if (resp && resp.ok) setStatus(`Added ${domain} to ${g.name}`, true);
          else setStatus('Could not add domain to group', false);
        });
      });
      SUGS.appendChild(chip);
    });
  });
}
renderSuggestions();

$('#copyFromUrl').addEventListener('click', async () => {
  const input = document.getElementById('sourceUrl');
  const raw = (input.value || '').trim();
  if (!raw) return;
  try {
    const url = new URL(raw);
    setStatus('Fetching…');
    const resp = await fetch(url.toString(), { credentials: 'omit' });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('title')?.textContent || '').trim();
    let fav = null;
    const links = [...doc.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')];
    if (links.length) {
      const href = links[0].getAttribute('href');
      if (href) fav = new URL(href, url.origin).toString();
    }
    if (!fav) fav = new URL('/favicon.ico', url.origin).toString();
    if (fav) {
      fav = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url: fav }, (resp) => resolve((resp && resp.dataUrl) ? resp.dataUrl : fav));
      });
    }
    if (title) TITLE.value = title;
    if (fav) FAV.value = fav;
    setStatus('Copied title & favicon from source.', true);
  } catch (e) {
    console.error(e);
    setStatus('Could not read that URL. Check the link.', false);
  }
});

$('#apply').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const rawFav = FAV.value || '';
  const resolvedFav = await new Promise((resolve)=>{
    if (!rawFav || rawFav.startsWith('data:')) return resolve(rawFav);
    chrome.runtime.sendMessage({type:'RESOLVE_FAVICON', url: rawFav}, (resp)=> resolve((resp && resp.dataUrl) ? resp.dataUrl : rawFav));
  });
  const disguise = { title: TITLE.value || 'Canvas Dashboard', faviconUrl: resolvedFav, enabled: true };
  const key = 'perTabDisguises';
  chrome.storage.local.get([key], (res) => {
    const map = res[key] || {};
    map[tab.id] = disguise;
    chrome.storage.local.set({ [key]: map }, async () => {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'APPLY_DISGUISE', payload: disguise });
      // After manual apply, show suggestion chips (in case user wants to add to a group)
      renderSuggestions();
      setStatus('Applied to this tab.', true);
    });
  });
});

$('#siteRule').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const url = new URL(tab.url);
  const pattern = `${url.protocol}//${url.hostname}/*`;
  const rawFav = FAV.value || '';
  const resolvedFav = await new Promise((resolve)=>{
    if (!rawFav || rawFav.startsWith('data:')) return resolve(rawFav);
    chrome.runtime.sendMessage({type:'RESOLVE_FAVICON', url: rawFav}, (resp)=> resolve((resp && resp.dataUrl) ? resp.dataUrl : rawFav));
  });
  const rule = { pattern, title: TITLE.value || 'Canvas Dashboard', faviconUrl: resolvedFav || '', enabled: true };
  const key = 'perSiteRules';
  chrome.storage.local.get([key], (res) => {
    const rules = res[key] || [];
    const idx = rules.findIndex(r => r.pattern === pattern);
    if (idx >= 0) rules[idx] = rule; else rules.push(rule);
    chrome.storage.local.set({ [key]: rules }, () => setStatus('Saved site rule.', true));
  });
});

$('#openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});