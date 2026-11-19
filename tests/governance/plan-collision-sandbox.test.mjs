import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { snapshotSliceBaseline, verifySliceWhitelist } from '../../templates/scripts/plan-collision.mjs';
import { execFileSync } from 'node:child_process';

const ORIGINAL_CWD = process.cwd();

test('GF-01 Sandbox: Plan Collision Slice (isolated rootDir without process.chdir dependency)', async (t) => {
  const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-plan-sandbox-'));
  
  execFileSync('git', ['init'], { cwd: TEMP_DIR });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: TEMP_DIR });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: TEMP_DIR });

  t.after(() => {
    process.chdir(ORIGINAL_CWD);
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  await t.test('clean slice', () => {
    const sliceId = 'f1';
    const allowed = ['src/a.ts'];
    
    fs.mkdirSync(path.join(TEMP_DIR, 'src'), { recursive: true });
    snapshotSliceBaseline({ sliceId, allowedFiles: allowed, rootDir: TEMP_DIR });
    
    fs.writeFileSync(path.join(TEMP_DIR, 'src/a.ts'), 'content');
    
    const res = verifySliceWhitelist({ sliceId, allowedFiles: allowed, revertUnauthorized: false, rootDir: TEMP_DIR });
    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.unauthorizedFiles, []);
  });

  await t.test('dirty wave 1 and unauthorized file', () => {
    const sliceId = 'f2';
    const allowed = ['src/allowed.ts'];
    
    const dirtyContent = 'wave 1 dirty content';
    fs.writeFileSync(path.join(TEMP_DIR, 'src/wave1-dirty.ts'), dirtyContent);
    
    snapshotSliceBaseline({ sliceId, allowedFiles: allowed, rootDir: TEMP_DIR });
    
    fs.writeFileSync(path.join(TEMP_DIR, 'src/wave1-dirty.ts'), 'corrupted by wave 2');
    fs.writeFileSync(path.join(TEMP_DIR, 'src/intruso.ts'), 'arquivo nao permitido');
    
    const res = verifySliceWhitelist({ sliceId, allowedFiles: allowed, revertUnauthorized: true, rootDir: TEMP_DIR });
    
    assert.strictEqual(res.ok, false);
    assert.ok(res.unauthorizedFiles.includes('src/intruso.ts'));
    assert.ok(res.unauthorizedFiles.includes('src/wave1-dirty.ts'));
    
    assert.strictEqual(fs.existsSync(path.join(TEMP_DIR, 'src/intruso.ts')), false);
    assert.strictEqual(fs.readFileSync(path.join(TEMP_DIR, 'src/wave1-dirty.ts'), 'utf8'), dirtyContent);
  });

  await t.test('parallel slices', () => {
    const slice1 = 'f_parallel_1';
    const slice2 = 'f_parallel_2';
    const allowed1 = ['src/p1.ts'];
    const allowed2 = ['src/p2.ts'];
    
    snapshotSliceBaseline({ sliceId: slice1, allowedFiles: allowed1, rootDir: TEMP_DIR });
    snapshotSliceBaseline({ sliceId: slice2, allowedFiles: allowed2, rootDir: TEMP_DIR });
    
    fs.writeFileSync(path.join(TEMP_DIR, 'src/p2.ts'), 'modificado f2');
    
    const res1 = verifySliceWhitelist({ sliceId: slice1, allowedFiles: allowed1, revertUnauthorized: false, rootDir: TEMP_DIR });
    assert.strictEqual(res1.ok, true);
    assert.ok(!res1.unauthorizedFiles.includes('src/p2.ts'));
  });
});