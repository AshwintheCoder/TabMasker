const RULES_KEY = 'perSiteRules';
const GROUPS_KEY = 'groups';
const tbody = document.querySelector('#rules tbody');
const gtbody = document.querySelector('#groupsTbl tbody');

function saveRules(rules) { chrome.storage.local.set({ [RULES_KEY]: rules }); }
function saveGroups(groups) { chrome.storage.local.set({ [GROUPS_KEY]: groups }); }

function loadAll() {
  chrome.storage.local.get([RULES_KEY, GROUPS_KEY], (res) => {
    renderRules(res[RULES_KEY] || []);
    renderGroups(res[GROUPS_KEY] || []);
  });
}

function renderRules(rules) {
  tbody.innerHTML = '';
  rules.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input data-type="rule" data-i="${i}" data-k="pattern" value="${r.pattern}"></td>
      <td><input data-type="rule" data-i="${i}" data-k="title" value="${r.title}"></td>
      <td><input data-type="rule" data-i="${i}" data-k="faviconUrl" value="${r.faviconUrl||''}"></td>
      <td class="center"><input type="checkbox" data-type="rule" data-i="${i}" data-k="enabled" ${r.enabled? 'checked':''}></td>
      <td><button data-type="rule" data-i="${i}" class="del">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGroups(groups) {
  gtbody.innerHTML = '';
  groups.forEach((g, i) => {
    const patternsText = (g.patterns || []).join('\\n');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input data-type="group" data-i="${i}" data-k="name" value="${g.name}"></td>
      <td class="center"><input type="checkbox" data-type="group" data-i="${i}" data-k="enabled" ${g.enabled? 'checked':''}></td>
      <td><textarea rows="4" data-type="group" data-i="${i}" data-k="patterns">${patternsText}</textarea></td>
      <td><input data-type="group" data-i="${i}" data-k="default.title" value="${g.default?.title||''}"></td>
      <td><input data-type="group" data-i="${i}" data-k="default.faviconUrl" value="${g.default?.faviconUrl||''}"></td>
      <td><button data-type="group" data-i="${i}" class="del">Delete</button></td>
    `;
    gtbody.appendChild(tr);
  });
}

document.body.addEventListener('input', (e) => {
  const t = e.target;
  const type = t.dataset.type;
  const i = +t.dataset.i;
  const k = t.dataset.k;
  if (type === 'rule') {
    chrome.storage.local.get([RULES_KEY], (res) => {
      const rules = res[RULES_KEY] || [];
      if (!rules[i]) return;
      if (t.type === 'checkbox') rules[i][k] = t.checked;
      else rules[i][k] = t.value;
      saveRules(rules);
    });
  } else if (type === 'group') {
    chrome.storage.local.get([GROUPS_KEY], (res) => {
      const groups = res[GROUPS_KEY] || [];
      if (!groups[i]) return;
      if (k === 'patterns') groups[i].patterns = t.value.split('\\n').map(s => s.trim()).filter(Boolean);
      else if (k === 'default.title') groups[i].default = { ...(groups[i].default||{}), title: t.value };
      else if (k === 'default.faviconUrl') groups[i].default = { ...(groups[i].default||{}), faviconUrl: t.value };
      else if (t.type === 'checkbox') groups[i][k] = t.checked;
      else groups[i][k] = t.value;
      saveGroups(groups);
    });
  }
});

document.body.addEventListener('click', (e) => {
  const t = e.target;
  if (!t.classList.contains('del')) return;
  const type = t.dataset.type;
  const i = +t.dataset.i;
  if (type === 'rule') {
    chrome.storage.local.get([RULES_KEY], (res) => {
      const rules = res[RULES_KEY] || [];
      rules.splice(i,1);
      saveRules(rules);
      renderRules(rules);
    });
  } else if (type === 'group') {
    chrome.storage.local.get([GROUPS_KEY], (res) => {
      const groups = res[GROUPS_KEY] || [];
      groups.splice(i,1);
      saveGroups(groups);
      renderGroups(groups);
    });
  }
});

// Add rule
document.getElementById('add').addEventListener('click', () => {
  const pat = document.getElementById('pat').value.trim();
  const title = document.getElementById('rtitle').value.trim() || 'Canvas Dashboard';
  const fav = document.getElementById('rfav').value.trim();
  if (!pat) return;
  chrome.storage.local.get([RULES_KEY], (res) => {
    const rules = res[RULES_KEY] || [];
    rules.push({ pattern: pat, title, faviconUrl: fav, enabled: true });
    saveRules(rules);
    renderRules(rules);
  });
});

// Add group
document.getElementById('gadd').addEventListener('click', () => {
  const name = document.getElementById('gname').value.trim();
  const title = document.getElementById('gtitle').value.trim() || 'Canvas Dashboard';
  const fav = document.getElementById('gfav').value.trim();
  if (!name) return;
  chrome.storage.local.get([GROUPS_KEY], (res) => {
    const groups = res[GROUPS_KEY] || [];
    const id = 'grp-' + name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    groups.push({ id, name, enabled: true, default: { title, faviconUrl: fav }, patterns: [] });
    saveGroups(groups);
    renderGroups(groups);
  });
});

loadAll();
