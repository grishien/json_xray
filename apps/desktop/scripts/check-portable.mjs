/**
 * Проверка portable-сборки (Фаза 6, п. 6.2 roadmap).
 *
 * Tauri v2 встраивает фронтенд-ассеты (frontendDist) прямо в exe, а
 * WebView2Loader линкуется статически (webview2-com-sys), поэтому собранный
 * `tauri build --no-bundle` бинарник не должен требовать ничего, кроме
 * системных DLL Windows 11 (WebView2-рантайм подгружается из системы уже
 * после запуска, через COM/стандартные системные библиотеки).
 *
 * Скрипт статически разбирает PE-заголовок exe и проверяет:
 *   1. Таблицу импортов и таблицу отложенных импортов (delay imports):
 *      каждая DLL — системная для чистой Windows 11 (whitelist + API-set
 *      имена api-ms-win-* / ext-ms-*), внешних DLL нет;
 *      в частности WebView2Loader.dll НЕ должен импортироваться.
 *   2. Отсутствие Win32-ресурсов, ссылающихся на внешние пути (Icons/RT_ICON
 *      допустимы — они встроены; файл .exe самодостаточен по ассетам).
 *
 * Запуск после сборки: pnpm --filter desktop check:portable
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const targetDir = fileURLToPath(new URL("../src-tauri/target/release", import.meta.url));

function findExe(dir) {
  if (!existsSync(dir)) return null;
  const exes = readdirSync(dir).filter(name => name.toLowerCase().endsWith(".exe"));
  // Основной бинарник — самый крупный exe (desktop_lib.dll и прочее — не exe).
  const candidates = exes
    .map(name => ({ name, size: readFileSync(join(dir, name)).length }))
    .sort((a, b) => b.size - a.size);
  return candidates[0] ?? null;
}

const exeInfo = findExe(targetDir);
if (!exeInfo) {
  console.error(
    `[check-portable] no .exe found in ${targetDir}. Run "pnpm tauri build --no-bundle" first.`
  );
  process.exit(1);
}

const exePath = join(targetDir, exeInfo.name);
const image = readFileSync(exePath);

// --- Разбор PE -------------------------------------------------------------

const u16 = offset => image.readUInt16LE(offset);
const u32 = offset => image.readUInt32LE(offset);

if (u16(0) !== 0x5a4d) {
  console.error(`[check-portable] ${exeInfo.name}: not a PE file (missing MZ signature).`);
  process.exit(1);
}
const peOffset = u32(0x3c);
if (image.readUInt32LE(peOffset) !== 0x00004550) {
  console.error(`[check-portable] ${exeInfo.name}: invalid PE signature.`);
  process.exit(1);
}

const sizeOfOptionalHeader = u16(peOffset + 4 + 16);
const optionalHeaderOffset = peOffset + 4 + 20;
const magic = u16(optionalHeaderOffset);
const isPe32Plus = magic === 0x20b;
if (!isPe32Plus && magic !== 0x10b) {
  console.error(`[check-portable] ${exeInfo.name}: unknown optional header magic 0x${magic.toString(16)}.`);
  process.exit(1);
}
// Смещение массива data directories внутри optional header.
const dataDirectoriesOffset = optionalHeaderOffset + (isPe32Plus ? 112 : 96);
const numberOfDirectories = u32(
  optionalHeaderOffset + (isPe32Plus ? 108 : 92)
);

const numberOfSections = u16(peOffset + 4 + 2);
const sectionsOffset = optionalHeaderOffset + sizeOfOptionalHeader;

/** RVA -> смещение в файле (null, если RVA вне секций). */
function rvaToFileOffset(rva) {
  for (let i = 0; i < numberOfSections; i += 1) {
    const base = sectionsOffset + i * 40;
    const virtualSize = u32(base + 8);
    const virtualAddress = u32(base + 12);
    const sizeOfRawData = u32(base + 16);
    const pointerToRawData = u32(base + 20);
    const size = Math.max(virtualSize, sizeOfRawData);
    if (rva >= virtualAddress && rva < virtualAddress + size) {
      return rva - virtualAddress + pointerToRawData;
    }
  }
  return null;
}

/** ASCII-строка с нулевым терминатором по смещению в файле. */
function readCString(offset) {
  const end = image.indexOf(0, offset);
  if (end === -1) return null;
  return image.toString("latin1", offset, end);
}

/** DLL-имена из таблицы импортов (data directory index 1). */
function readImportedDlls() {
  if (numberOfDirectories < 2) return [];
  const rva = u32(dataDirectoriesOffset + 1 * 8);
  const size = u32(dataDirectoriesOffset + 1 * 8 + 4);
  if (rva === 0 || size === 0) return [];
  const names = [];
  let entryOffset = rvaToFileOffset(rva);
  if (entryOffset === null) return names;
  // IMAGE_IMPORT_DESCRIPTOR: 20 байт, массив завершается нулевой записью.
  while (entryOffset + 20 <= image.length) {
    const nameRva = u32(entryOffset + 12);
    if (nameRva === 0) break;
    const nameOffset = rvaToFileOffset(nameRva);
    if (nameOffset === null) break;
    const name = readCString(nameOffset);
    if (name) names.push(name);
    entryOffset += 20;
  }
  return names;
}

/** DLL-имена из таблицы отложенных импортов (data directory index 13). */
function readDelayImportedDlls() {
  if (numberOfDirectories < 14) return [];
  const rva = u32(dataDirectoriesOffset + 13 * 8);
  const size = u32(dataDirectoriesOffset + 13 * 8 + 4);
  if (rva === 0 || size === 0) return [];
  const names = [];
  let entryOffset = rvaToFileOffset(rva);
  if (entryOffset === null) return names;
  // ImgDelayDescr: 32 байта, массив завершается нулевой записью.
  while (entryOffset + 32 <= image.length) {
    const nameRva = u32(entryOffset + 4);
    if (nameRva === 0) break;
    const nameOffset = rvaToFileOffset(nameRva);
    if (nameOffset === null) break;
    const name = readCString(nameOffset);
    if (name) names.push(name);
    entryOffset += 32;
  }
  return names;
}

// --- Whitelist системных DLL чистой Windows 11 -----------------------------
// Поставляются в составе ОС (или WinSxS/системные компоненты), не требуют
// установки отдельного рантайма. API-set-имена (api-ms-win-*, ext-ms-*,
// *-l1-*.dll и т.п.) резолвятся ядром и тоже считаются системными.

const systemDlls = new Set(
  [
    "ntdll.dll",
    "kernel32.dll",
    "kernelbase.dll",
    "user32.dll",
    "gdi32.dll",
    "shell32.dll",
    "shlwapi.dll",
    "advapi32.dll",
    "sechost.dll",
    "rpcrt4.dll",
    "ole32.dll",
    "oleaut32.dll",
    "combase.dll",
    "ws2_32.dll",
    "bcrypt.dll",
    "bcryptprimitives.dll",
    "ncrypt.dll",
    "ncryptprov.dll",
    "crypt32.dll",
    "cryptbase.dll",
    "msasn1.dll",
    "comctl32.dll",
    "comdlg32.dll",
    "uxtheme.dll",
    "dwmapi.dll",
    "msimg32.dll",
    "winmm.dll",
    "imm32.dll",
    "version.dll",
    "wintrust.dll",
    "wldp.dll",
    "userenv.dll",
    "sspicli.dll",
    "sspisrv.dll",
    "ntmarta.dll",
    "msvcrt.dll",
    "dbghelp.dll",
    "dwrite.dll",
    "dcomp.dll",
    "dxgi.dll",
    "d3d11.dll",
    "d2d1.dll",
    "d3d10warp.dll",
    "dxcore.dll",
    "imagehlp.dll",
    "powrprof.dll",
    "setupapi.dll",
    "cfgmgr32.dll",
    "devobj.dll",
    "win32u.dll",
    "gdi32full.dll",
    "mscoree.dll",
    "profapi.dll",
    "wtsapi32.dll",
    "propsys.dll",
    "apphelp.dll",
    "windows.storage.dll",
    "shcore.dll",
    "twinapi.dll",
    "twinapi.appcore.dll",
    "rmclient.dll",
    "wintypes.dll",
    "policymanager.dll",
  ].map(name => name.toLowerCase())
);

/** CRT из VC++ Redistributable: на чистой Win11 их нет, Rust линкует CRT статически. */
const vcRedistDlls = /^(vcruntime140(_1)?|msvcp140(_1|_2|_atomic)?|concrt140)\.dll$/i;

function isSystemDll(name) {
  const lower = name.toLowerCase();
  if (systemDlls.has(lower)) return true;
  // API-set контракты: api-ms-win-*, ext-ms-*, и имена вида *-l1-1-0.dll.
  if (/^(api-ms-|ext-ms-)/.test(lower)) return true;
  if (/-l[12]-\d+-\d+\.dll$/.test(lower)) return true;
  return false;
}

const imports = readImportedDlls();
const delayImports = readDelayImportedDlls();
const allImports = [...new Set([...imports, ...delayImports])];

const external = allImports.filter(name => !isSystemDll(name));

console.log(`[check-portable] exe: ${exePath}`);
console.log(`[check-portable] size: ${(exeInfo.size / 1024 / 1024).toFixed(2)} MiB`);
console.log(
  `[check-portable] imports (${allImports.length}, delay: ${delayImports.length}):`
);
for (const name of allImports) console.log(`  ${name}`);

const problems = [];
if (external.length > 0) {
  problems.push(
    `non-system DLL import(s): ${external.join(", ")} — exe потребует установки внешних компонентов.`
  );
}
const webview2Loader = allImports.find(name => name.toLowerCase() === "webview2loader.dll");
if (webview2Loader) {
  problems.push(
    "WebView2Loader.dll найден в импортах — ожидается статическая линковка (webview2-com-sys)."
  );
}
const vcRedist = allImports.filter(name => vcRedistDlls.test(name));
if (vcRedist.length > 0) {
  problems.push(
    `VC++ Redistributable DLL в импортах (${vcRedist.join(", ")}): на чистой Win11 их нет — нужен статический CRT (crt-static).`
  );
}

// Внешние ресурсы: bundle.resources в tauri.conf.json кладёт файлы РЯДОМ с exe
// (или в папку установки) — portable-сборка этого не допускает.
const confPath = fileURLToPath(new URL("../src-tauri/tauri.conf.json", import.meta.url));
const conf = JSON.parse(readFileSync(confPath, "utf8"));
const resources = conf?.bundle?.resources;
if (resources !== undefined && resources !== null && resources !== []) {
  const listed = Array.isArray(resources) ? resources.join(", ") : String(resources);
  problems.push(
    `bundle.resources в tauri.conf.json не пуст (${listed}) — внешние ресурсы ломают portable-сборку.`
  );
}

if (problems.length > 0) {
  console.error("[check-portable] FAILED:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  "[check-portable] OK: все импорты — системные DLL Windows 11; внешних DLL, VC++ Redistributable, WebView2Loader.dll и внешних ресурсов нет."
);
