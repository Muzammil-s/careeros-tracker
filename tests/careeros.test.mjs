import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCareerServer } = require('../backend/server.js');

function startCareerServer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'careeros-test-'));
  const dataFilePath = path.join(tmpDir, 'careeros.json');
  const server = createCareerServer({ dataFilePath });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () =>
          new Promise((done) => {
            server.close(() => {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              done();
            });
          })
      });
    });
  });
}

test('create, stage update, analytics funnel, and delete workflow', async () => {
  const srv = await startCareerServer();
  try {
    const createRes = await fetch(`${srv.baseUrl}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'Acme Tech',
        role: 'Junior Security Engineer',
        stage: 'Applied',
        priority: 'High',
        resumeVersion: 'CV-v2.2-CyberData'
      })
    });
    assert.equal(createRes.status, 201);
    const { application } = await createRes.json();

    const moveRes = await fetch(`${srv.baseUrl}/api/applications/${application.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'Interview' })
    });
    assert.equal(moveRes.status, 200);
    assert.equal((await moveRes.json()).application.stage, 'Interview');

    const ana = await (await fetch(`${srv.baseUrl}/api/analytics`)).json();
    assert.ok(ana.responseRate > 0);
    assert.ok(ana.stageCounts.Interview >= 2);
    assert.ok(ana.byResume['CV-v2.2-CyberData'].advanced >= 1);

    const delRes = await fetch(`${srv.baseUrl}/api/applications/${application.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
  } finally {
    await srv.close();
  }
});
