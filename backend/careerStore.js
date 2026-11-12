const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STAGES = ['Wishlist', 'Applied', 'OA / Screen', 'Interview', 'Offer', 'Archived'];

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildSeedApps() {
  return [
    {
      id: 'app-101',
      company: 'Systems Limited',
      role: 'Associate Software Engineer (Full-Stack)',
      location: 'Lahore / Hybrid',
      stage: 'Interview',
      priority: 'High',
      compensation: 'Competitive',
      resumeVersion: 'CV-v2.4-FullStack',
      deadline: addDaysIso(3),
      appliedDate: addDaysIso(-9),
      notes: 'Completed technical phone screen; preparing system design & REST security walkthrough.',
      url: 'https://www.systemsltd.com/'
    },
    {
      id: 'app-102',
      company: 'Folio3',
      role: 'Junior Backend Node.js Developer',
      location: 'Karachi / Remote',
      stage: 'OA / Screen',
      priority: 'High',
      compensation: 'Sample Track',
      resumeVersion: 'CV-v2.4-FullStack',
      deadline: addDaysIso(5),
      appliedDate: addDaysIso(-6),
      notes: 'HackerRank assessment due before Friday deadline.',
      url: 'https://folio3.com/'
    },
    {
      id: 'app-103',
      company: 'SecOps Labs (Sample)',
      role: 'Junior Security & Python Analyst Intern',
      location: 'Remote',
      stage: 'Applied',
      priority: 'High',
      compensation: 'Paid Internship',
      resumeVersion: 'CV-v2.2-CyberData',
      deadline: addDaysIso(10),
      appliedDate: addDaysIso(-4),
      notes: 'Highlighted NetworkScope packet analyzer & LinkLens URL heuristics project.',
      url: 'https://github.com/Muzammil-s'
    },
    {
      id: 'app-104',
      company: 'Arbisoft',
      role: 'Python & Data Engineering Trainee',
      location: 'Lahore',
      stage: 'Applied',
      priority: 'Medium',
      compensation: 'Trainee Stipend',
      resumeVersion: 'CV-v2.2-CyberData',
      deadline: addDaysIso(12),
      appliedDate: addDaysIso(-3),
      notes: 'Referenced DataLens CSV profiling studio.',
      url: 'https://arbisoft.com/'
    },
    {
      id: 'app-105',
      company: 'CloudScale (Sample)',
      role: 'Frontend React & UI Engineer Intern',
      location: 'Remote',
      stage: 'Wishlist',
      priority: 'Medium',
      compensation: '$1,200/mo Est.',
      resumeVersion: 'CV-v2.4-FullStack',
      deadline: addDaysIso(2),
      appliedDate: '',
      notes: 'Polish Fresh Basket & Portfolio case studies before submitting.',
      url: 'https://github.com/Muzammil-s'
    },
    {
      id: 'app-106',
      company: 'FinLedger Tech (Sample)',
      role: 'Junior QA & Automation Developer',
      location: 'Islamabad',
      stage: 'Offer',
      priority: 'Medium',
      compensation: 'Sample Benchmark',
      resumeVersion: 'CV-v2.4-FullStack',
      deadline: addDaysIso(7),
      appliedDate: addDaysIso(-21),
      notes: 'Example stage record demonstrating completed offer column in CareerOS.',
      url: 'https://github.com/Muzammil-s'
    }
  ];
}

function createCareerStore(dataFilePath) {
  const resolved = dataFilePath || path.join(__dirname, 'data', 'careeros.json');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  function read() {
    if (!fs.existsSync(resolved)) {
      const init = { applications: buildSeedApps() };
      fs.writeFileSync(resolved, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  function write(db) {
    fs.writeFileSync(resolved, JSON.stringify(db, null, 2));
  }

  return {
    list({ stage, priority, q } = {}) {
      let list = [...read().applications];
      if (stage && stage !== 'all') list = list.filter((a) => a.stage === stage);
      if (priority && priority !== 'all') list = list.filter((a) => a.priority === priority);
      if (q) {
        const needle = q.toLowerCase();
        list = list.filter(
          (a) =>
            a.company.toLowerCase().includes(needle) ||
            a.role.toLowerCase().includes(needle) ||
            a.resumeVersion.toLowerCase().includes(needle) ||
            (a.location || '').toLowerCase().includes(needle)
        );
      }
      return list;
    },
    create(payload) {
      if (!payload.company || !payload.role) {
        throw new Error('Company and role title are required.');
      }
      const db = read();
      const stage = STAGES.includes(payload.stage) ? payload.stage : 'Applied';
      const item = {
        id: 'app-' + crypto.randomBytes(4).toString('hex'),
        company: String(payload.company).trim(),
        role: String(payload.role).trim(),
        location: String(payload.location || 'Remote').trim(),
        stage,
        priority: ['High', 'Medium', 'Low'].includes(payload.priority) ? payload.priority : 'Medium',
        compensation: String(payload.compensation || 'Undisclosed').trim(),
        resumeVersion: String(payload.resumeVersion || 'CV-v2.4-FullStack').trim(),
        deadline: String(payload.deadline || addDaysIso(7)),
        appliedDate: stage === 'Wishlist' ? '' : String(payload.appliedDate || new Date().toISOString().slice(0, 10)),
        notes: String(payload.notes || '').trim(),
        url: String(payload.url || '').trim()
      };
      db.applications.unshift(item);
      write(db);
      return item;
    },
    update(id, updates) {
      const db = read();
      const idx = db.applications.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      const cur = db.applications[idx];
      const nextStage = updates.stage && STAGES.includes(updates.stage) ? updates.stage : cur.stage;
      db.applications[idx] = {
        ...cur,
        ...updates,
        id: cur.id,
        stage: nextStage,
        appliedDate: !cur.appliedDate && nextStage !== 'Wishlist' ? new Date().toISOString().slice(0, 10) : cur.appliedDate
      };
      write(db);
      return db.applications[idx];
    },
    remove(id) {
      const db = read();
      const before = db.applications.length;
      db.applications = db.applications.filter((a) => a.id !== id);
      if (db.applications.length === before) return false;
      write(db);
      return true;
    },
    getAnalytics() {
      const apps = read().applications;
      const stageCounts = {};
      for (const s of STAGES) stageCounts[s] = 0;
      const byResume = {};
      const today = new Date().toISOString().slice(0, 10);
      let upcomingDeadlines = 0;

      for (const a of apps) {
        stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1;
        const rv = a.resumeVersion || 'Unspecified';
        if (!byResume[rv]) byResume[rv] = { total: 0, advanced: 0 };
        byResume[rv].total += 1;
        if (['OA / Screen', 'Interview', 'Offer'].includes(a.stage)) {
          byResume[rv].advanced += 1;
        }
        if (a.deadline && a.stage !== 'Archived' && a.stage !== 'Offer') {
          const diffDays = (new Date(a.deadline) - new Date(today)) / (1000 * 60 * 60 * 24);
          if (diffDays <= 7) upcomingDeadlines += 1;
        }
      }

      const submittedCount = apps.filter((a) => a.stage !== 'Wishlist').length;
      const respondedCount = apps.filter((a) => ['OA / Screen', 'Interview', 'Offer'].includes(a.stage)).length;
      const responseRate = submittedCount > 0 ? Number(((respondedCount / submittedCount) * 100).toFixed(1)) : 0;

      return {
        total: apps.length,
        submittedCount,
        respondedCount,
        responseRate,
        upcomingDeadlines,
        stageCounts,
        byResume
      };
    }
  };
}

module.exports = { createCareerStore, STAGES };
