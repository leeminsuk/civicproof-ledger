// SPDX-License-Identifier: Apache-2.0
// Playwright E2E for the 160-second autopilot demo (local gate, no CI browser).
//   node scripts/e2e-autopilot.mjs --check     fast full run (apspeed=20):
//     the whole timeline must complete with zero console/page errors, 12/12
//     attacks blocked and the finale summary on screen.
//   node scripts/e2e-autopilot.mjs --record    real-time run recorded as a
//     1080p webm (plus mp4 when a system ffmpeg exists) — the contest video is
//     produced by the code itself, one take, hands-free.
// Uses playwright-core against the shared ms-playwright browser cache; nothing
// is downloaded. web/ is served by a built-in static server on a random port.
import { createServer } from 'node:http';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WEB = join(ROOT, 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json'
};

function serveWeb() {
  const server = createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    const file = join(WEB, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer({ server, port: server.address().port }));
  });
}

function findCachedChromium() {
  const candidates = [];
  for (const base of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base)) {
      if (!dir.startsWith('chromium-') || dir.includes('headless')) continue;
      for (const sub of [
        'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome'
      ]) {
        const path = join(base, dir, sub);
        if (existsSync(path)) candidates.push({ path, build: Number(dir.split('-')[1]) || 0 });
      }
    }
  }
  candidates.sort((a, b) => b.build - a.build);
  return candidates[0]?.path;
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? findCachedChromium();
    if (!executablePath) throw error;
    console.log(`[e2e] bundled browser missing, falling back to cache: ${executablePath}`);
    return chromium.launch({ executablePath });
  }
}

async function runCheck() {
  const { server, port } = await serveWeb();
  const browser = await launchBrowser();
  const consoleErrors = [];
  const pageErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`http://127.0.0.1:${port}/?apspeed=20`);
    await page.click('#autopilot-start');
    await page.waitForSelector('.ap-rec.done', { timeout: 40_000 });

    const state = await page.evaluate(() => ({
      score: document.querySelector('#attack-score')?.textContent,
      grade: document.querySelector('#gauge-grade')?.textContent,
      replay: document.querySelector('#replay-badge')?.textContent,
      finaleStats: [...document.querySelectorAll('.ap-stat span')].map((n) => n.textContent),
      ledger: document.querySelector('#ledger-count')?.textContent
    }));

    const failures = [];
    if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
    if (pageErrors.length > 0) failures.push(`page errors: ${pageErrors.join(' | ')}`);
    if (state.score !== '12 / 12') failures.push(`attack score ${state.score}`);
    if (state.grade !== 'EXCELLENT') failures.push(`CII grade ${state.grade}`);
    if (state.replay !== 'MATCH') failures.push(`replay ${state.replay}`);
    if (state.finaleStats.length !== 6) failures.push(`finale stats ${state.finaleStats.length}/6`);
    if (state.ledger !== '5건') failures.push(`ledger ${state.ledger}`);

    if (failures.length > 0) {
      console.error(`[e2e] FAIL\n - ${failures.join('\n - ')}`);
      process.exitCode = 1;
    } else {
      console.log(`[e2e] PASS — full autopilot run, 0 console errors, ${state.score} blocked, CII ${state.grade}, Replay ${state.replay}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function runRecord(outBase) {
  const { server, port } = await serveWeb();
  const browser = await launchBrowser();
  const videoDir = join(tmpdir(), `civicproof-video-${process.pid}`);
  await mkdir(videoDir, { recursive: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: videoDir, size: { width: 1920, height: 1080 } }
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForTimeout(1500); // fonts + hero canvas settled before the take
    console.log('[record] starting the 160s autopilot take…');
    await page.click('#autopilot-start');
    await page.waitForSelector('.ap-rec.done', { timeout: 200_000 });
    await page.waitForTimeout(3000); // hold the finale card
    const video = page.video();
    await context.close();
    const rawPath = await video.path();

    const webmOut = `${outBase}.webm`;
    await copyFile(rawPath, webmOut);
    console.log(`[record] webm saved: ${webmOut}`);

    const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    if (ffmpeg.status === 0) {
      const mp4Out = `${outBase}.mp4`;
      const convert = spawnSync(
        'ffmpeg',
        ['-y', '-i', webmOut, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-movflags', '+faststart', mp4Out],
        { stdio: 'ignore' }
      );
      if (convert.status === 0) console.log(`[record] mp4 saved: ${mp4Out}`);
      else console.warn('[record] ffmpeg conversion failed, webm is still valid for upload');
    } else {
      console.log('[record] no system ffmpeg, keeping webm (YouTube accepts webm)');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

const mode = process.argv[2] ?? '--check';
const outArg = process.argv.indexOf('--out');
const outBase =
  outArg > -1 ? process.argv[outArg + 1] : join(homedir(), 'Downloads', 'civicproof-autopilot-160s');

if (mode === '--record') await runRecord(outBase);
else await runCheck();
