/**
 * Проверка «вся обработка данных локальна, без сети» (Фаза 5, п. 5.3).
 * CSP в tauri.conf.json должен запрещать внешние ресурсы: WebView сам
 * заблокирует любые запросы к сети. До Фазы 5 csp был null (без ограничений).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readTauriConf = () =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8") as string
  );

describe("локальность данных: CSP без сети (п. 5.3)", () => {
  it("production CSP is set and blocks external origins", () => {
    const conf = readTauriConf();
    const csp = conf.app?.security?.csp as string | undefined;

    expect(typeof csp).toBe("string");
    expect(csp!.length).toBeGreaterThan(0);
    // Базовое ограничение: всё только со «своего» источника.
    expect(csp).toContain("default-src 'self'");
    // IPC Tauri (invoke диалогов/фс) остаётся разрешён.
    expect(csp).toContain("ipc:");
    expect(csp).toContain("http://ipc.localhost");
    // Никаких исключений-подстановок: внешний интернет недоступен.
    expect(csp).not.toContain("*");
  });

  it("dev CSP keeps local vite/HMR and IPC only", () => {
    const conf = readTauriConf();
    const devCsp = conf.app?.security?.devCsp as string | undefined;

    expect(typeof devCsp).toBe("string");
    expect(devCsp).toContain("default-src 'self'");
    expect(devCsp).toContain("http://localhost:1420");
    expect(devCsp).toContain("ws://localhost:1421");
    expect(devCsp).toContain("http://ipc.localhost");
    expect(devCsp).not.toContain("*");
  });
});
