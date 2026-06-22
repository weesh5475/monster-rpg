import { defineConfig } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// ────────────────────────────────────────────────────────────
// 자체 제작 PWA 플러그인 (vite-plugin-pwa 없이, 의존성 0).
//  빌드가 끝난 뒤 dist 를 훑어 전체 산출물 목록 + 버전 해시로 sw.js 를 생성한다.
//  - 산출물(index.html, assets, manifest, 아이콘)을 precache → 오프라인 실행
//  - 버전 해시가 산출물 변경 시 바뀜 → 브라우저가 sw 교체 → 자동 업데이트
//  - skipWaiting + clients.claim + 버전된 캐시명 + 옛 캐시 정리
// ────────────────────────────────────────────────────────────
function selfPwaPlugin() {
  let outDir = 'dist';
  return {
    name: 'self-pwa',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      // dist 안의 모든 파일을 재귀 수집
      const root = outDir;
      const files = [];
      const walk = (dir) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          const st = statSync(full);
          if (st.isDirectory()) walk(full);
          else files.push({ rel: relative(root, full).split('\\').join('/'), size: st.size });
        }
      };
      walk(root);

      // sw.js 자신은 precache 대상에서 제외
      const assets = files.filter((f) => f.rel !== 'sw.js');
      // 버전 해시: 파일 경로+크기로 산출 → 산출물 바뀌면 해시도 바뀜
      const version = createHash('md5')
        .update(assets.map((f) => `${f.rel}:${f.size}`).join('|'))
        .digest('hex')
        .slice(0, 10);

      // precache 목록(상대경로). 시작 URL './' 도 포함.
      const precache = ['./', ...assets.map((f) => './' + f.rel)];

      const sw = `// 자동 생성됨 (vite.config.js의 self-pwa 플러그인). 직접 수정하지 마세요.
const VERSION = '${version}';
const CACHE = 'jumoni-' + VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 0)};

// 설치: 산출물 미리 캐시 + 즉시 활성화 대기 건너뛰기
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
});

// 활성화: 옛 버전 캐시 정리 + 즉시 제어권 확보
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('jumoni-') && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// 가져오기 전략
//  - 페이지 이동(navigate): 네트워크 우선(최신 우선) → 실패 시 캐시(오프라인)
//  - 그 외 에셋: 캐시 우선 → 없으면 네트워크 후 캐시에 저장
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
          return res;
        } catch (e) {
          return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./'));
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })()
  );
});
`;
      writeFileSync(join(root, 'sw.js'), sw);
      // eslint-disable-next-line no-console
      console.log(`[self-pwa] sw.js 생성 (version ${version}, precache ${precache.length}개)`);
    },
  };
}

// 상대 경로 기반(./)으로 빌드해서 어디서 열어도 에셋 경로가 깨지지 않게 함.
export default defineConfig({
  base: './',
  plugins: [selfPwaPlugin()],
  server: {
    open: true, // dev 서버 실행 시 브라우저 자동 오픈
  },
});
