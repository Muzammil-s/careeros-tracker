const STAGES = ['Wishlist', 'Applied', 'OA / Screen', 'Interview', 'Offer'];
const ALL_STAGES = [...STAGES, 'Archived'];

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const SEED_APPS = [
  { id: 'app-101', company: 'Systems Limited', role: 'Associate Software Engineer (Full-Stack)', location: 'Lahore / Hybrid', stage: 'Interview', priority: 'High', compensation: 'Competitive', resumeVersion: 'CV-v2.4-FullStack', deadline: addDaysIso(3), appliedDate: addDaysIso(-9), notes: 'Completed phone screen; preparing REST & DB walkthrough.', url: 'https://www.systemsltd.com/' },
  { id: 'app-102', company: 'Folio3', role: 'Junior Backend Node.js Developer', location: 'Karachi / Remote', stage: 'OA / Screen', priority: 'High', compensation: 'Sample Track', resumeVersion: 'CV-v2.4-FullStack', deadline: addDaysIso(5), appliedDate: addDaysIso(-6), notes: 'Coding challenge due Friday.', url: 'https://folio3.com/' },
  { id: 'app-103', company: 'SecOps Labs (Sample)', role: 'Junior Security & Python Analyst Intern', location: 'Remote', stage: 'Applied', priority: 'High', compensation: 'Paid Internship', resumeVersion: 'CV-v2.2-CyberData', deadline: addDaysIso(10), appliedDate: addDaysIso(-4), notes: 'Highlighted NetworkScope & LinkLens.', url: 'https://github.com/Muzammil-s' },
  { id: 'app-104', company: 'Arbisoft', role: 'Python & Data Engineering Trainee', location: 'Lahore', stage: 'Applied', priority: 'Medium', compensation: 'Trainee Stipend', resumeVersion: 'CV-v2.2-CyberData', deadline: addDaysIso(12), appliedDate: addDaysIso(-3), notes: 'Referenced DataLens CSV studio.', url: 'https://arbisoft.com/' },
  { id: 'app-105', company: 'CloudScale (Sample)', role: 'Frontend React & UI Engineer Intern', location: 'Remote', stage: 'Wishlist', priority: 'Medium', compensation: '$1,200/mo Est.', resumeVersion: 'CV-v2.4-FullStack', deadline: addDaysIso(2), appliedDate: '', notes: 'Finalize Fresh Basket case study.', url: 'https://github.com/Muzammil-s' },
  { id: 'app-106', company: 'FinLedger Tech (Sample)', role: 'Junior QA & Automation Developer', location: 'Islamabad', stage: 'Offer', priority: 'Medium', compensation: 'Sample Benchmark', resumeVersion: 'CV-v2.4-FullStack', deadline: addDaysIso(7), appliedDate: addDaysIso(-21), notes: 'Example completed offer column.', url: 'https://github.com/Muzammil-s' }
];

const state = {
  apiOnline: false,
  apps: [],
  analytics: null,
  q: '',
  priority: 'all',
  dragId: null
};

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

function getLocalApps() {
  const raw = localStorage.getItem('careeros_demo_apps');
  if (raw) return JSON.parse(raw);
  localStorage.setItem('careeros_demo_apps', JSON.stringify(SEED_APPS));
  return SEED_APPS;
}

function saveLocalApps(list) {
  localStorage.setItem('careeros_demo_apps', JSON.stringify(list));
}

function computeLocalAnalytics(apps) {
  const stageCounts = {};
  for (const s of ALL_STAGES) stageCounts[s] = 0;
  const byResume = {};
  const today = new Date().toISOString().slice(0, 10);
  let upcomingDeadlines = 0;
  for (const a of apps) {
    stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1;
    const rv = a.resumeVersion || 'Unspecified';
    if (!byResume[rv]) byResume[rv] = { total: 0, advanced: 0 };
    byResume[rv].total += 1;
    if (['OA / Screen', 'Interview', 'Offer'].includes(a.stage)) byResume[rv].advanced += 1;
    if (a.deadline && a.stage !== 'Archived' && a.stage !== 'Offer') {
      const diff = (new Date(a.deadline) - new Date(today)) / 86400000;
      if (diff <= 7) upcomingDeadlines += 1;
    }
  }
  const submittedCount = apps.filter((a) => a.stage !== 'Wishlist').length;
  const respondedCount = apps.filter((a) => ['OA / Screen', 'Interview', 'Offer'].includes(a.stage)).length;
  return {
    total: apps.length,
    submittedCount,
    respondedCount,
    responseRate: submittedCount > 0 ? Number(((respondedCount / submittedCount) * 100).toFixed(1)) : 0,
    upcomingDeadlines,
    stageCounts,
    byResume
  };
}

async function detectApi() {
  if (window.location.hostname.endsWith('.vercel.app') || window.location.hostname.endsWith('.github.io')) {
    state.apiOnline = false;
  } else {
    try {
      const res = await fetch('/api/health');
      state.apiOnline = res.ok;
    } catch {
      state.apiOnline = false;
    }
  }
  document.getElementById('api-badge').textContent = state.apiOnline ? 'Live Node API Connected' : 'Standalone Browser Demo';
}

async function loadData() {
  if (state.apiOnline) {
    const [appsRes, anaRes] = await Promise.all([fetch('/api/applications'), fetch('/api/analytics')]);
    state.apps = (await appsRes.json()).applications;
    state.analytics = await anaRes.json();
  } else {
    state.apps = getLocalApps();
    state.analytics = computeLocalAnalytics(state.apps);
  }
  document.getElementById('top-total').textContent = String(state.analytics.total);
  document.getElementById('top-rate').textContent = `${state.analytics.responseRate}%`;
  document.getElementById('top-due').textContent = String(state.analytics.upcomingDeadlines);
  renderKanban();
  renderAnalytics();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(dateStr) - new Date(today)) / 86400000);
}

function getFilteredApps() {
  const needle = state.q.toLowerCase();
  return state.apps.filter((a) => {
    const matchPrio = state.priority === 'all' || a.priority === state.priority;
    const matchQ = !needle || a.company.toLowerCase().includes(needle) || a.role.toLowerCase().includes(needle) || (a.resumeVersion || '').toLowerCase().includes(needle) || (a.location || '').toLowerCase().includes(needle);
    return matchPrio && matchQ;
  });
}

function renderKanban() {
  const board = document.getElementById('view-board');
  board.innerHTML = '';
  const visible = getFilteredApps();

  for (const stage of STAGES) {
    const col = el('div', 'column');
    col.dataset.stage = stage;
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (state.dragId) await moveStage(state.dragId, stage);
    });

    const cards = visible.filter((a) => a.stage === stage);
    const head = el('div', 'col-head');
    head.append(el('strong', '', stage), el('span', 'col-count', String(cards.length)));
    col.appendChild(head);

    for (const app of cards) {
      const card = el('article', 'job-card');
      card.draggable = true;
      card.addEventListener('dragstart', () => { state.dragId = app.id; });
      card.addEventListener('dragend', () => { state.dragId = null; });

      const top = el('div', 'job-top');
      top.append(el('span', `prio-tag prio-${app.priority}`, app.priority), el('span', 'job-meta', app.resumeVersion));

      const title = el('div', 'job-title', app.role);
      title.addEventListener('click', () => openModal(app));

      const meta = el('div', 'job-meta', `${app.company} • ${app.location}`);
      const d = daysUntil(app.deadline);
      const dueText = d === null ? 'No deadline' : d < 0 ? `Overdue ${Math.abs(d)}d` : `Due in ${d}d (${app.deadline})`;
      const due = el('div', `due-badge ${d !== null && d <= 5 ? 'due-urgent' : 'due-ok'}`, dueText);

      const moveSel = el('select', 'stage-move');
      moveSel.setAttribute('aria-label', `Move ${app.role} stage`);
      for (const optStage of ALL_STAGES) {
        const opt = el('option', '', `Move: ${optStage}`);
        opt.value = optStage;
        if (optStage === app.stage) opt.selected = true;
        moveSel.appendChild(opt);
      }
      moveSel.addEventListener('change', (e) => moveStage(app.id, e.target.value));

      card.append(top, title, meta, due, moveSel);
      col.appendChild(card);
    }
    board.appendChild(col);
  }
}

async function moveStage(id, newStage) {
  if (state.apiOnline) {
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });
  } else {
    const list = getLocalApps();
    const item = list.find((a) => a.id === id);
    if (item) item.stage = newStage;
    saveLocalApps(list);
  }
  await loadData();
}

function renderAnalytics() {
  const a = state.analytics;
  if (!a) return;

  const funnel = document.getElementById('funnel-chart');
  funnel.innerHTML = '';
  const maxC = Math.max(...STAGES.map((s) => a.stageCounts[s] || 0), 1);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 540 ${STAGES.length * 42 + 12}`);
  svg.style.width = '100%';
  STAGES.forEach((stage, i) => {
    const count = a.stageCounts[stage] || 0;
    const y = i * 42 + 8;
    const w = Math.round((count / maxC) * 320);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', '0');
    txt.setAttribute('y', String(y + 18));
    txt.setAttribute('fill', '#cbd5e1');
    txt.setAttribute('font-size', '13');
    txt.textContent = stage;

    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', '120');
    bar.setAttribute('y', String(y + 4));
    bar.setAttribute('width', String(Math.max(8, w)));
    bar.setAttribute('height', '20');
    bar.setAttribute('rx', '6');
    bar.setAttribute('fill', '#818cf8');

    const num = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    num.setAttribute('x', String(132 + Math.max(8, w)));
    num.setAttribute('y', String(y + 18));
    num.setAttribute('fill', '#94a3b8');
    num.setAttribute('font-size', '12');
    num.textContent = `${count} roles`;

    svg.append(txt, bar, num);
  });
  funnel.appendChild(svg);

  const resHost = document.getElementById('resume-stats');
  resHost.innerHTML = '';
  for (const [rv, metrics] of Object.entries(a.byResume || {})) {
    const row = el('div', 'resume-row');
    const rate = metrics.total > 0 ? Math.round((metrics.advanced / metrics.total) * 100) : 0;
    row.append(el('strong', '', rv), el('span', 'job-meta', `${metrics.advanced}/${metrics.total} callbacks (${rate}%)`));
    resHost.appendChild(row);
  }

  const tbody = document.getElementById('deadline-tbody');
  tbody.innerHTML = '';
  const sorted = [...state.apps].filter((x) => x.stage !== 'Archived').sort((x, y) => String(x.deadline).localeCompare(String(y.deadline)));
  for (const item of sorted) {
    const d = daysUntil(item.deadline);
    const tr = document.createElement('tr');
    tr.append(
      el('td', '', item.company),
      el('td', '', item.role),
      el('td', '', item.stage),
      el('td', '', item.resumeVersion),
      el('td', '', item.deadline || '-'),
      el('td', '', d === null ? '-' : d < 0 ? `Overdue ${Math.abs(d)}d` : `${d} days`)
    );
    tbody.appendChild(tr);
  }
}

function openModal(app = null) {
  document.getElementById('modal-title').textContent = app ? 'Edit Tracked Application' : 'Track New Job Application';
  document.getElementById('edit-id').value = app ? app.id : '';
  document.getElementById('f-company').value = app ? app.company : '';
  document.getElementById('f-role').value = app ? app.role : '';
  document.getElementById('f-location').value = app ? app.location : 'Remote';
  document.getElementById('f-comp').value = app ? app.compensation : 'Competitive';
  document.getElementById('f-stage').value = app ? app.stage : 'Applied';
  document.getElementById('f-priority').value = app ? app.priority : 'Medium';
  document.getElementById('f-deadline').value = app ? app.deadline : addDaysIso(7);
  document.getElementById('f-resume').value = app ? app.resumeVersion : 'CV-v2.4-FullStack';
  document.getElementById('f-url').value = app ? app.url || '' : '';
  document.getElementById('f-notes').value = app ? app.notes || '' : '';
  document.getElementById('btn-delete-app').hidden = !app;
  document.getElementById('app-modal').hidden = false;
}

function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const v = btn.dataset.view;
      document.getElementById('view-board').hidden = v !== 'board';
      document.getElementById('view-analytics').hidden = v !== 'analytics';
    });
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.q = e.target.value.trim();
    renderKanban();
  });
  document.getElementById('priority-filter').addEventListener('change', (e) => {
    state.priority = e.target.value;
    renderKanban();
  });

  document.getElementById('btn-new-app').addEventListener('click', () => openModal(null));
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('app-modal').hidden = true;
  });

  document.getElementById('app-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const payload = {
      company: document.getElementById('f-company').value.trim(),
      role: document.getElementById('f-role').value.trim(),
      location: document.getElementById('f-location').value.trim(),
      compensation: document.getElementById('f-comp').value.trim(),
      stage: document.getElementById('f-stage').value,
      priority: document.getElementById('f-priority').value,
      deadline: document.getElementById('f-deadline').value,
      resumeVersion: document.getElementById('f-resume').value.trim(),
      url: document.getElementById('f-url').value.trim(),
      notes: document.getElementById('f-notes').value.trim()
    };

    if (state.apiOnline) {
      if (editId) {
        await fetch(`/api/applications/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
    } else {
      const list = getLocalApps();
      if (editId) {
        const idx = list.findIndex((a) => a.id === editId);
        if (idx !== -1) list[idx] = { ...list[idx], ...payload };
      } else {
        list.unshift({ id: 'app-' + Date.now(), appliedDate: new Date().toISOString().slice(0, 10), ...payload });
      }
      saveLocalApps(list);
    }
    document.getElementById('app-modal').hidden = true;
    await loadData();
  });

  document.getElementById('btn-delete-app').addEventListener('click', async () => {
    const editId = document.getElementById('edit-id').value;
    if (!editId) return;
    if (state.apiOnline) {
      await fetch(`/api/applications/${editId}`, { method: 'DELETE' });
    } else {
      saveLocalApps(getLocalApps().filter((a) => a.id !== editId));
    }
    document.getElementById('app-modal').hidden = true;
    await loadData();
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), applications: state.apps }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'careeros-pipeline.json';
    a.click();
  });
}

(async function init() {
  bindEvents();
  await detectApi();
  await loadData();
})();
