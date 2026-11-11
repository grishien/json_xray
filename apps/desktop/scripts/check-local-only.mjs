/**
 * Проверка локальности обработки данных (Фаза 5, п. 5.3 roadmap).
 *
 * Проверка двухслойная:
 * 1. CSP в tauri.conf.json запрещает WebView внешние запросы на уровне
 *    рантайма (connect-src только 'self'/ipc) — см. localOnly.test.ts.
 * 2. Этот скрипт статически сканирует собранный фронтенд (apps/desktop/dist)
 *    на внешние http(s) URL — ловит случайные подключение внешних скриптов,
 *    шрифтов, картинок и API.
 *
 * Разрешённые URL — только идентификаторы и тексты сообщений библиотек,
 * которые НИКОГДА не загружаются по сети:
 *   - localhost/ipc/tauri.localhost — локальные схемы Tauri;
 *   - www.w3.org — XML/SVG namespace-идентификаторы;
 *   - www.eclipse.org — EMF/ELK идентификаторы моделей в elkjs;
 *   - react.dev/errors, fb.me, github.com/apollographql/invariant-packages,
 *     github.com/wellyshen/react-cool-dimensions, rolldown.rs — тексты
 *     ошибок/предупреждений внутри бандлов React, prop-types, invariant,
 *     react-cool-dimensions и rolldown (для человека, не fetch);
 *   - `https://${e}` — шаблон из jsoncrack-react: рендер URL-подобного
 *     текста узлов как кликабельной <a>-ссылки (переход только по явному
 *     клику пользователя, сетевых запросов код не выполняет).
 *
 * Любой другой http(s) URL в бандле — ошибка.
 * Запуск после сборки: pnpm --filter desktop check:local
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const scannedExtensions = new Set([".js", ".html", ".css"]);

/** Префиксы/литералы URL, разрешённые в бандле (см. категории в шапке). */
const allowedPrefixes = [
  "http://ipc.localhost",
  "https://ipc.localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "http://localhost",
  "https://localhost",
  "ws://localhost",
  "wss://localhost",
  // XML/SVG namespace-идентификаторы, не сетевые ресурсы.
  "http://www.w3.org/",
  "https://www.w3.org/",
  // EMF/ELK идентификаторы моделей внутри elkjs.
  "http://www.eclipse.org/",
  "https://www.eclipse.org/",
  "http:///org/eclipse/",
  // Тексты ошибок/предупреждений библиотек (человеку, не fetch).
  "https://react.dev/errors/",
  "http://fb.me/",
  "https://fb.me/",
  "https://github.com/apollographql/invariant-packages",
  "https://github.com/wellyshen/react-cool-dimensions",
  "https://rolldown.rs/in-depth/bundling-cjs",
  // Шаблон кликабельной ссылки из данных пользователя (jsoncrack-react TextNode).
  "https://${",
];

const URL_PATTERN = /https?:\/\/[^\s"'`<>,\\)]+/g;

const isAllowed = url =>
  allowedPrefixes.some(prefix => url.toLowerCase().startsWith(prefix));

const walk = dir => {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) entries.push(...walk(full));
    else entries.push(full);
  }
  return entries;
};

let files;
try {
  files = walk(distDir).filter(path => scannedExtensions.has(extname(path)));
} catch {
  console.error(
    `[check-local-only] dist not found at ${distDir}. Run "pnpm --filter desktop build" first.`
  );
  process.exit(1);
}

if (files.length === 0) {
  console.error("[check-local-only] no dist assets found — nothing to check.");
  process.exit(1);
}

const violations = [];
let scanned = 0;
for (const file of files) {
  scanned += 1;
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(URL_PATTERN)) {
    const url = match[0];
    if (!isAllowed(url)) violations.push(`${file}: ${url}`);
  }
}

if (violations.length > 0) {
  console.error(
    `[check-local-only] found ${violations.length} external URL(s) in the bundle:`
  );
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(
  `[check-local-only] OK: ${scanned} file(s) scanned, no external network URLs.`
);
