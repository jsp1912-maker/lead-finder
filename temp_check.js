
let allLeads = [];
let allEvents = [];
let activeFilter = 'all';
let activeTab = 'business';
let activeSort = 'added';
let pollTimers = {};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadLeads(), loadEvents()]);
}

async function loadLeads() {
  const r = await fetch('/api/leads');
  allLeads = await r.json();
  renderLeads();
  updateStats();
  renderFollowupBanner();
}

async function loadEvents() {
  const r = await fetch('/api/events');
  allEvents = await r.json();
  updateStats();
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  ['business','sport','events'].forEach(t => {
    document.getElementById(`panel-${t}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`nav-${t}`).classList.toggle('active', t === tab);
  });
  document.getElementById('filter-bar').style.display = tab === 'events' ? 'none' : 'flex';
  document.getElementById('leads-grid').style.display = tab === 'events' ? 'none' : 'grid';
  document.getElementById('events-grid').style.display = tab === 'events' ? 'grid' : 'none';

  const titles = {
    business: ['Eetgelegenheden zoeken', 'Vind lokale restaurants en eetgelegenheden'],
    sport: ['Sportverenigingen zoeken', 'Vind clubs en scrape het bestuur automatisch'],
    events: ['Evenementen zoeken', 'Vind lokale evenementen en hun organisatoren'],
  };
  document.getElementById('topbar-title').textContent = titles[tab][0];
  document.getElementById('topbar-sub').textContent = titles[tab][1];

  // Auto-filter op type bij wisselen van tab
  if (tab === 'sport') activeFilter = 'sport';
  else if (tab === 'business') activeFilter = 'business';

  if (tab === 'events') renderEvents();
  else renderLeads();
}

function switchView(filter) {
  activeTab = 'business';
  ['business','sport','events'].forEach(t => {
    document.getElementById(`panel-${t}`).style.display = t === 'business' ? 'block' : 'none';
    document.getElementById(`nav-${t}`).classList.remove('active');
  });
  document.getElementById('filter-bar').style.display = 'flex';
  document.getElementById('leads-grid').style.display = 'grid';
  document.getElementById('events-grid').style.display = 'none';
  setFilter(filter, null);
}

// ── Searches ──────────────────────────────────────────────────────────────────
async function startBusinessSearch() {
  const niche = document.getElementById('b-niche').value.trim();
  const city = document.getElementById('b-city').value.trim();
  const max = document.getElementById('b-max').value;
  if (!niche || !city) { toast('Vul niche en stad in', '#ef4444'); return; }
  await doSearch({niche, city, max: parseInt(max)}, 'b');
}

async function startSportSearch() {
  const niche = document.getElementById('s-niche').value.trim();
  const city = document.getElementById('s-city').value.trim();
  const max = document.getElementById('s-max').value;
  if (!niche || !city) { toast('Vul sport en stad in', '#ef4444'); return; }
  await doSearch({niche, city, max: parseInt(max)}, 's');
}

function quickSport(sport) {
  document.getElementById('s-niche').value = sport;
}

function quickBusiness(type) {
  document.getElementById('b-niche').value = type;
}

function quickEvent(type) {
  document.getElementById('e-type').value = type;
}

function switchSearchTab(panel, mode) {
  const prefix = panel === 'business' ? 'b' : 's';
  document.getElementById(`${prefix}-broad`).style.display = mode === 'broad' ? 'block' : 'none';
  document.getElementById(`${prefix}-name`).style.display  = mode === 'name'  ? 'block' : 'none';
  document.getElementById(`${prefix}t-broad`).classList.toggle('active', mode === 'broad');
  document.getElementById(`${prefix}t-name`).classList.toggle('active', mode === 'name');
}

const noteTimers = {};
function onNoteInput(leadId, textarea) {
  clearTimeout(noteTimers[leadId]);
  noteTimers[leadId] = setTimeout(() => saveNote(leadId, textarea), 600);
}

async function saveNote(leadId, textarea) {
  const note = textarea.value;
  await fetch(`/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
  const indicator = document.getElementById(`note-saved-${leadId}`);
  if (indicator) {
    indicator.style.display = 'block';
    setTimeout(() => { indicator.style.display = 'none'; }, 2000);
  }
}

async function startExcelSearch(type, input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const isSport = type === 'sport';
  const pwId = isSport ? 'pw-s' : 'pw-b';
  const pfId = isSport ? 'pf-s' : 'pf-b';
  const pmId = isSport ? 'pm-s' : 'pm-b';

  document.getElementById(pwId).style.display = 'block';
  document.getElementById(pfId).style.width = '5%';
  document.getElementById(pmId).textContent = 'Excel inlezen...';

  const formData = new FormData();
  formData.append('file', file);
  const r = await fetch('/api/upload-excel', { method: 'POST', body: formData });
  const { names, error } = await r.json();

  if (error || !names || names.length === 0) {
    toast(error || 'Geen namen gevonden in het bestand', '#ef4444');
    document.getElementById(pwId).style.display = 'none';
    return;
  }

  toast(`${names.length} namen gevonden, zoeken gestart...`, '#10b981');

  let done = 0;
  for (const name of names) {
    document.getElementById(pfId).style.width = Math.round((done / names.length) * 100) + '%';
    document.getElementById(pmId).textContent = `Zoeken (${done + 1} van ${names.length}): ${name}`;

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche: name, city: '', max_results: 1, force_type: type })
    });
    const { job_id } = await res.json();

    await new Promise(resolve => {
      const t = setInterval(async () => {
        const jr = await fetch(`/api/job/${job_id}`);
        const job = await jr.json();
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(t);
          resolve();
        }
      }, 1500);
    });

    done++;
  }

  document.getElementById(pfId).style.width = '100%';
  document.getElementById(pmId).textContent = `Klaar! ${done} namen verwerkt.`;
  await loadLeads();
  setTimeout(() => { document.getElementById(pwId).style.display = 'none'; }, 2000);
  toast(`Excel verwerkt — ${done} namen gezocht!`, '#10b981');
}

async function startNameSearch(type) {
  const isSport = type === 'sport';
  const inputId = isSport ? 's-name-input' : 'b-name-input';
  const pwId    = isSport ? 'pw-s' : 'pw-b';
  const pfId    = isSport ? 'pf-s' : 'pf-b';
  const pmId    = isSport ? 'pm-s' : 'pm-b';

  const name = document.getElementById(inputId).value.trim();
  if (!name) { toast('Vul een naam in', '#ef4444'); return; }

  document.getElementById(pwId).style.display = 'block';
  document.getElementById(pfId).style.width = '30%';
  document.getElementById(pmId).textContent = `Zoeken naar "${name}"...`;

  const r = await fetch('/api/search', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ niche: name, city: '', max_results: 1, force_type: type })
  });
  const { job_id } = await r.json();

  pollJob(job_id, pfId, pmId, pwId, async () => {
    await loadLeads();
    document.getElementById(pwId).style.display = 'none';
    toast(`Lead toegevoegd!`, '#10b981');
  });
}

async function startEventsSearch() {
  const city = document.getElementById('e-city').value.trim();
  const max = document.getElementById('e-max').value;
  if (!city) { toast('Vul een stad in', '#ef4444'); return; }

  document.getElementById('btn-e').disabled = true;
  document.getElementById('pw-e').style.display = 'block';

  const r = await fetch('/api/events/search', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({city, max: parseInt(max)})
  });
  const {job_id} = await r.json();
  pollJob(job_id, 'e', async () => {
    await loadEvents();
    renderEvents();
    document.getElementById('btn-e').disabled = false;
  });
}

async function doSearch(payload, prefix) {
  document.getElementById(`btn-${prefix}`).disabled = true;
  document.getElementById(`pw-${prefix}`).style.display = 'block';

  const r = await fetch('/api/search', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const {job_id} = await r.json();
  pollJob(job_id, prefix, async () => {
    await loadLeads();
    document.getElementById(`btn-${prefix}`).disabled = false;
  });
}

function pollJob(job_id, prefix, onDone) {
  const t = setInterval(async () => {
    const r = await fetch(`/api/job/${job_id}`);
    const job = await r.json();
    document.getElementById(`pf-${prefix}`).style.width = job.progress + '%';
    document.getElementById(`pm-${prefix}`).textContent = job.message || '';
    if (job.status === 'done') {
      clearInterval(t);
      document.getElementById(`pw-${prefix}`).style.display = 'none';
      toast(`${job.count} resultaten gevonden!`);
      onDone();
    } else if (job.status === 'error') {
      clearInterval(t);
      toast('Fout: ' + job.message, '#ef4444');
      document.getElementById(`pw-${prefix}`).style.display = 'none';
    }
  }, 2000);
}

// ── Filter ────────────────────────────────────────────────────────────────────
function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLeads();
}

// ── Render leads ──────────────────────────────────────────────────────────────
function renderLeads() {
  const grid = document.getElementById('leads-grid');
  let leads = allLeads;

  // Tab filter (only apply when not in status-view mode)
  if (!activeFilter.startsWith('status-')) {
    if (activeTab === 'sport') leads = leads.filter(l => l.type === 'sport');
    else leads = leads.filter(l => l.type !== 'sport');
  }

  if (activeFilter.startsWith('q-'))
    leads = leads.filter(l => qualityKey(l) === activeFilter);

  if (activeFilter.startsWith('status-')) {
    const s = activeFilter.replace('status-', '');
    leads = leads.filter(l => (l.status || 'nieuw') === s);
  }

  leads = applySort(leads);

  if (!leads.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">Geen leads. Gebruik het zoekveld hierboven.</div></div>`;
    return;
  }
  grid.innerHTML = leads.map(cardHTML).join('');
}

function cardHTML(l) {
  return l.type === 'sport' ? sportCardHTML(l) : businessCardHTML(l);
}

function qualityKey(l) {
  let score = 0;
  if (l.website) score++;
  if (l.email) score++;
  if (l.phone) score++;
  if (l.type === 'sport' ? l.board_page : l.contact_person) score++;
  if (score === 0) return 'q-low';
  if (score <= 1)  return 'q-low';
  if (score <= 2)  return 'q-mid';
  if (score <= 3)  return 'q-high';
  return 'q-full';
}

function leadQuality(l) {
  const key = qualityKey(l);
  const labels = { 'q-low': 'Weinig gevonden', 'q-mid': 'Gedeeltelijk', 'q-high': 'Goede lead', 'q-full': 'Volledig' };
  return `<span class="badge ${key}">${labels[key]}</span>`;
}

function businessCardHTML(l) {
  const img = l.screenshot
    ? `<img class="card-img" src="/screenshots/${l.screenshot}" loading="lazy" alt="">`
    : `<div class="card-no-img"><div class="card-no-img-icon">🍽️</div><span>${l.website ? 'Geen screenshot' : 'Geen website'}</span></div>`;

  const web = l.website
    ? `<a href="${l.website}" target="_blank">${l.website.replace(/^https?:\/\//,'').split('?')[0].substring(0,40)}</a>`
    : `<span class="unfound">Geen website</span>`;

  const email = l.email ? `<span class="found">${l.email}</span>` : `<span class="unfound">Niet gevonden</span>`;
  const phone = l.phone ? `<span>${l.phone}</span>` : `<span class="unfound">Niet gevonden</span>`;
  const contact = l.contact_person ? `<span class="found">${l.contact_person}</span>` : `<span class="unfound">Onbekend</span>`;
  const rating = l.rating ? ` ★${l.rating}` : '';

  return `<div class="card" id="card-${l.id}">
    ${img}
    <div class="card-body">
      <div class="card-top">
        <div>
          <div class="card-name">${esc(l.name)}${rating}</div>
          <div class="card-sub">${esc(l.niche)} · ${esc(l.city)}</div>
        </div>
        ${leadQuality(l)}
      </div>
      <div class="info-row"><span class="info-ic">📍</span><span class="info-val">${esc(l.address||'Onbekend')}</span></div>
      <div class="info-row"><span class="info-ic">🌐</span><span class="info-val">${web}</span></div>
      <div class="info-row"><span class="info-ic">📧</span><span class="info-val">${email}</span></div>
      <div class="info-row"><span class="info-ic">📞</span><span class="info-val">${phone}</span></div>
      <div class="info-row"><span class="info-ic">👤</span><span class="info-val">${contact}</span></div>
      <div style="margin-top:10px">${statusBadgeHTML(l)}</div>
      <textarea class="note-area" placeholder="Notitie toevoegen..." oninput="onNoteInput('${l.id}', this)">${esc(l.note||'')}</textarea>
      <div class="note-saved" id="note-saved-${l.id}">✓ Opgeslagen</div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
        <span style="font-size:0.78rem;color:#64748b">📅 Follow-up:</span>
        <input type="date" class="followup-input" value="${l.followup_date||''}" onchange="saveFollowup('${l.id}', this.value)" />
        ${l.followup_date ? '<button class="btn-sm" style="padding:2px 7px;font-size:0.72rem" onclick="saveFollowup(\'' + l.id + '\',\'\')">✕</button>' : ''}
      </div>
      <div class="card-actions">
        <button class="btn-sm" onclick="showEmail('${l.id}')">📧 Email</button>
        <button class="btn-sm danger" onclick="deleteLead('${l.id}')">Verwijder</button>
      </div>
    </div>
  </div>`;
}

function sportCardHTML(l) {
  const rating = l.rating ? ` ★${l.rating}` : '';

  const img = l.screenshot
    ? `<img class="card-img" src="/screenshots/${l.screenshot}" loading="lazy" alt="">`
    : `<div class="card-no-img"><div class="card-no-img-icon">⚽</div><span>${l.website ? 'Geen screenshot' : 'Geen website'}</span></div>`;

  const web = l.website
    ? `<a href="${l.website}" target="_blank">${l.website.replace(/^https?:\/\//,'').split('?')[0].substring(0,40)}</a>`
    : `<span class="unfound">Geen website</span>`;

  const email = l.email ? `<span class="found">${l.email}</span>` : `<span class="unfound">Niet gevonden</span>`;
  const phone = l.phone ? `<span>${l.phone}</span>` : `<span class="unfound">Niet gevonden</span>`;
  const contact = l.contact_person ? `<span class="found">${l.contact_person}</span>` : `<span class="unfound">Onbekend</span>`;

  const boardPageBtn = l.board_page
    ? `<a href="${esc(l.board_page)}" target="_blank" class="board-page-btn">
        <span style="opacity:1">📋 Bekijk bestuurspagina</span><span>→</span>
      </a>`
    : l.website
      ? `<a href="${esc(l.website)}" target="_blank" class="board-page-btn board-page-btn-dim">
          <span style="opacity:1">🌐 Open website</span><span>→</span>
        </a>`
      : '';

  return `<div class="card sport-card" id="card-${l.id}">
    ${img}
    <div class="card-body">
      <div class="card-top">
        <div>
          <div class="card-name">${esc(l.name)}${rating}</div>
          <div class="card-sub">${esc(l.niche)} · ${esc(l.city)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <span class="badge b-sport">Club</span>
          ${leadQuality(l)}
        </div>
      </div>
      <div class="info-row"><span class="info-ic">📍</span><span class="info-val">${esc(l.address||'Onbekend')}</span></div>
      <div class="info-row"><span class="info-ic">🌐</span><span class="info-val">${web}</span></div>
      <div class="info-row"><span class="info-ic">📧</span><span class="info-val">${email}</span></div>
      <div class="info-row"><span class="info-ic">📞</span><span class="info-val">${phone}</span></div>
      <div class="info-row"><span class="info-ic">👤</span><span class="info-val">${contact}</span></div>
      ${boardPageBtn ? `<div style="margin-top:10px">${boardPageBtn}</div>` : ''}
      <div style="margin-top:10px">${statusBadgeHTML(l)}</div>
      <textarea class="note-area" placeholder="Notitie toevoegen..." oninput="onNoteInput('${l.id}', this)">${esc(l.note||'')}</textarea>
      <div class="note-saved" id="note-saved-${l.id}">✓ Opgeslagen</div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
        <span style="font-size:0.78rem;color:#64748b">📅 Follow-up:</span>
        <input type="date" class="followup-input" value="${l.followup_date||''}" onchange="saveFollowup('${l.id}', this.value)" />
        ${l.followup_date ? '<button class="btn-sm" style="padding:2px 7px;font-size:0.72rem" onclick="saveFollowup(\'' + l.id + '\',\'\')">✕</button>' : ''}
      </div>
      <div class="card-actions">
        <button class="btn-sm" onclick="showEmail('${l.id}')">📧 Email schrijven</button>
        <button class="btn-sm danger" onclick="deleteLead('${l.id}')">Verwijder</button>
      </div>
    </div>
  </div>`;
}

function renderBoardPreview(board) {
  const roles = Object.entries(board).slice(0, 4);
  if (!roles.length) return '';
  return `<div class="board-section">
    <div class="board-title">Bestuur gevonden</div>
    <div class="board-grid">
      ${roles.map(([role, info]) => `
        <div class="board-role">
          <div class="board-role-name">${role}</div>
          <div class="board-role-person">${info.name || '—'}</div>
          ${info.email ? `<div class="board-role-email">${info.email}</div>` : ''}
        </div>
      `).join('')}
    </div>
  </div>`;
}


// ── Render events ─────────────────────────────────────────────────────────────
function renderEvents() {
  const grid = document.getElementById('events-grid');
  if (!allEvents.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">Geen evenementen. Zoek hierboven.</div></div>`;
    return;
  }
  grid.innerHTML = allEvents.map(e => `
    <div class="event-card">
      <div class="event-title">${esc(e.title)}</div>
      ${e.date ? `<div class="event-date">📅 ${esc(e.date)}</div>` : ''}
      <div class="event-meta">📍 ${esc(e.location||e.city)}</div>
      ${e.organizer ? `<div class="event-meta">👤 ${esc(e.organizer)}</div>` : ''}
      ${e.email ? `<div class="event-meta found">📧 ${esc(e.email)}</div>` : ''}
      ${e.phone ? `<div class="event-meta">📞 ${esc(e.phone)}</div>` : ''}
      <span class="event-source">${esc(e.source)}</span>
      <div class="event-actions">
        ${e.link ? `<a class="btn-sm" href="${e.link}" target="_blank" style="text-align:center;text-decoration:none">Bekijk</a>` : ''}
        <button class="btn-sm danger" onclick="deleteEvent('${e.id}')">Verwijder</button>
      </div>
    </div>
  `).join('');
}

// ── Modals ────────────────────────────────────────────────────────────────────
function showEmail(id) {
  const l = allLeads.find(x => x.id === id);
  if (!l) return;
  document.getElementById('modal-name').textContent = l.name;
  document.getElementById('modal-text').value = l.cold_email || 'Geen email beschikbaar';
  document.getElementById('modal-email').classList.add('open');
}

function showBoard(id) {
  const l = allLeads.find(x => x.id === id);
  if (!l || !l.board) return;
  document.getElementById('board-name').textContent = `Bestuur — ${l.name}`;
  const roles = Object.entries(l.board);
  if (!roles.length) {
    document.getElementById('board-content').innerHTML = '<p style="color:#64748b;font-size:14px">Geen bestuursleden gevonden op de website.</p>';
  } else {
    document.getElementById('board-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${roles.map(([role, info]) => `
          <div style="background:#0f1117;border-radius:8px;padding:14px;border:1px solid #1e2333">
            <div style="font-size:11px;color:#64748b;text-transform:capitalize;margin-bottom:4px">${esc(role)}</div>
            <div style="font-size:15px;font-weight:600;color:#f1f5f9">${esc(info.name||'Onbekend')}</div>
            ${info.email ? `<div style="font-size:12px;color:#818cf8;margin-top:4px">${esc(info.email)}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
  }
  document.getElementById('modal-board').classList.add('open');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function copyEmail() {
  navigator.clipboard.writeText(document.getElementById('modal-text').value)
    .then(() => toast('Email gekopieerd!'));
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteLead(id) {
  await fetch(`/api/leads/${id}`, {method:'DELETE'});
  allLeads = allLeads.filter(l => l.id !== id);
  renderLeads(); updateStats();
}

async function deleteEvent(id) {
  await fetch(`/api/events/${id}`, {method:'DELETE'});
  allEvents = allEvents.filter(e => e.id !== id);
  renderEvents(); updateStats();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const total = allLeads.length;
  const clubs = allLeads.filter(l => l.type === 'sport').length;
  const emails = allLeads.filter(l => l.email).length;
  const byStatus = s => allLeads.filter(l => (l.status || 'nieuw') === s).length;

  document.getElementById('s-total').textContent = total;
  document.getElementById('s-missing').textContent = clubs;
  document.getElementById('s-email').textContent = emails;
  document.getElementById('s-events').textContent = allEvents.length;
  document.getElementById('chip-total').textContent = `${total} leads`;
  document.getElementById('chip-missing').textContent = `${clubs} clubs`;
  document.getElementById('chip-email').textContent = `${emails} emails`;

  document.getElementById('nc-all').textContent = total;
  document.getElementById('nc-nieuw').textContent = byStatus('nieuw');
  document.getElementById('nc-gecontacteerd').textContent = byStatus('gecontacteerd');
  document.getElementById('nc-geinteresseerd').textContent = byStatus('geinteresseerd');
  document.getElementById('nc-afgewezen').textContent = byStatus('afgewezen');
}

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  nieuw: '🆕 Nieuw',
  gecontacteerd: '📤 Gecontacteerd',
  geinteresseerd: '⭐ Geïnteresseerd',
  afgewezen: '❌ Afgewezen',
};

function statusBadgeHTML(lead) {
  const s = lead.status || 'nieuw';
  return `<button class="status-badge status-${s}" onclick="openStatusMenu(event,'${lead.id}')">${STATUS_LABELS[s]} ▾</button>`;
}

function openStatusMenu(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.status-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'status-menu';
  menu.style.cssText = 'position:fixed;z-index:9999';
  const rect = e.target.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';
  Object.entries(STATUS_LABELS).forEach(([val, label]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => { setStatus(id, val); menu.remove(); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), {once:true}), 0);
}

function toggleSortMenu(btn) {
  const menu = document.getElementById('sort-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  document.addEventListener('click', function handler(e) {
    if (!btn.closest('div').contains(e.target)) {
      menu.style.display = 'none';
      document.removeEventListener('click', handler);
    }
  });
}

const qualityScore = l => { let s=0; if(l.website)s++; if(l.email)s++; if(l.phone)s++; if(l.board_page||l.contact_person)s++; return s; };
const statusOrder = { geinteresseerd:0, gecontacteerd:1, nieuw:2, afgewezen:3 };

function setSort(sort) {
  activeSort = sort;
  document.getElementById('sort-menu').style.display = 'none';
  document.querySelectorAll('[id^="sort-opt-"]').forEach(b => b.style.fontWeight = 'normal');
  document.getElementById(`sort-opt-${sort}`).style.fontWeight = 'bold';
  renderLeads();
}

function applySort(leads) {
  const arr = [...leads];
  if (activeSort === 'name') arr.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'nl'));
  else if (activeSort === 'quality') arr.sort((a,b) => qualityScore(b) - qualityScore(a));
  else if (activeSort === 'status') arr.sort((a,b) => (statusOrder[a.status||'nieuw']||2) - (statusOrder[b.status||'nieuw']||2));
  return arr;
}

function toggleExportMenu(btn) {
  const menu = document.getElementById('export-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  document.addEventListener('click', function handler(e) {
    if (!btn.closest('div').contains(e.target)) {
      menu.style.display = 'none';
      document.removeEventListener('click', handler);
    }
  });
}

function doExport(mode) {
  document.getElementById('export-menu').style.display = 'none';
  let leads = allLeads;
  if (mode === 'view') {
    if (activeTab === 'sport') leads = leads.filter(l => l.type === 'sport');
    else if (activeTab === 'business') leads = leads.filter(l => l.type !== 'sport');
    if (activeFilter.startsWith('q-')) leads = leads.filter(l => qualityKey(l) === activeFilter);
    if (activeFilter.startsWith('status-')) leads = leads.filter(l => (l.status||'nieuw') === activeFilter.replace('status-',''));
  } else if (mode !== 'all') {
    leads = leads.filter(l => (l.status||'nieuw') === mode);
  }
  const ids = leads.map(l => l.id);
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/export';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'ids';
  input.value = JSON.stringify(ids);
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

async function saveFollowup(leadId, date) {
  await fetch(`/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followup_date: date })
  });
  const lead = allLeads.find(l => l.id === leadId);
  if (lead) lead.followup_date = date;
  renderLeads();
  renderFollowupBanner();
}

function renderFollowupBanner() {
  const today = new Date().toISOString().split('T')[0];
  const due = allLeads.filter(l => l.followup_date && l.followup_date <= today);
  const banner = document.getElementById('followup-banner');
  const list = document.getElementById('followup-list');
  if (!due.length) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  list.innerHTML = due.map(l => {
    const overdue = l.followup_date < today;
    return `<div style="display:flex;align-items:center;gap:10px;font-size:0.82rem">
      <span style="color:${overdue ? '#fca5a5' : '#4ade80'}">${overdue ? '⚠️ Te laat' : '📅 Vandaag'}</span>
      <span style="color:#e2e8f0;font-weight:600">${esc(l.name)}</span>
      <span style="color:#64748b">${esc(l.city)}</span>
      ${l.note ? `<span style="color:#94a3b8;font-style:italic">"${esc(l.note.substring(0,50))}${l.note.length>50?'...':''}"</span>` : ''}
      <button class="btn-sm" style="margin-left:auto;padding:2px 8px;font-size:0.72rem" onclick="saveFollowup('${l.id}','')">✓ Afgehandeld</button>
    </div>`;
  }).join('');
}

async function flushPendingNotes() {
  const pending = Object.keys(noteTimers);
  await Promise.all(pending.map(leadId => {
    clearTimeout(noteTimers[leadId]);
    delete noteTimers[leadId];
    const textarea = document.querySelector(`#card-${leadId} .note-area`);
    if (textarea) return saveNote(leadId, textarea);
  }));
}

async function setStatus(id, status) {
  await flushPendingNotes();
  await fetch(`/api/leads/${id}/status`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({status})
  });
  const lead = allLeads.find(l => l.id === id);
  if (lead) lead.status = status;
  renderLeads();
  updateStats();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toast(msg, color='#10b981') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = color; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

// Close overlays on background click
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

// Enter key
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const tag = document.activeElement.tagName;
  if (tag !== 'INPUT') return;
  if (activeTab === 'business') startBusinessSearch();
  else if (activeTab === 'sport') startSportSearch();
  else if (activeTab === 'events') startEventsSearch();
});

init();
