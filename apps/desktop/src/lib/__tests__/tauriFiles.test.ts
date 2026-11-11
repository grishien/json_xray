/**
 * Тесты нативной работы с файлами (Фаза 5, п. 5.1–5.2).
 * Tauri-плагины (dialog/fs) и API вебвью замоканы; проверяется логика
 * модуля: определение формата по расширению, потоки open/save (включая
 * отмену диалога и ошибки), разбор drop-событий.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(),
}));

import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  baseName,
  dataFileExtensions,
  detectFormatFromPath,
  extensionForFormat,
  isTauriEnv,
  loadDroppedFile,
  openDataFile,
  saveDataFile,
  subscribeFileDrop,
} from "../tauriFiles";
import { FileFormat } from "../formats";

const mockedOpen = vi.mocked(open);
const mockedSave = vi.mocked(save);
const mockedRead = vi.mocked(readTextFile);
const mockedWrite = vi.mocked(writeTextFile);

beforeEach(() => {
  mockedOpen.mockReset();
  mockedSave.mockReset();
  mockedRead.mockReset();
  mockedWrite.mockReset();
  vi.mocked(getCurrentWebview).mockReset();
});

describe("detectFormatFromPath", () => {
  it.each([
    ["C:\\data\\file.json", FileFormat.JSON],
    ["C:\\data\\file.JSON", FileFormat.JSON],
    ["/home/user/data.yaml", FileFormat.YAML],
    ["/home/user/data.YML", FileFormat.YAML],
    ["notes.xml", FileFormat.XML],
    ["rows.csv", FileFormat.CSV],
  ])("maps %s to its format", (path, format) => {
    expect(detectFormatFromPath(path)).toBe(format);
  });

  it.each([
    ["notes.txt", "unsupported extension"],
    ["README", "no extension"],
    ["", "empty path"],
  ])("returns null for %s (%s)", path => {
    expect(detectFormatFromPath(path)).toBeNull();
  });

  it("lists supported extensions and default save extensions", () => {
    expect([...dataFileExtensions].sort()).toEqual(["csv", "json", "xml", "yaml", "yml"]);
    expect(extensionForFormat(FileFormat.JSON)).toBe("json");
    expect(extensionForFormat(FileFormat.YAML)).toBe("yaml");
    expect(extensionForFormat(FileFormat.XML)).toBe("xml");
    expect(extensionForFormat(FileFormat.CSV)).toBe("csv");
  });

  it("extracts the base name from windows and unix paths", () => {
    expect(baseName("C:\\data\\rows.csv")).toBe("rows.csv");
    expect(baseName("/home/user/rows.csv")).toBe("rows.csv");
    expect(baseName("rows.csv")).toBe("rows.csv");
  });
});

describe("isTauriEnv", () => {
  it("is false without __TAURI_INTERNALS__ (jsdom/browser)", () => {
    expect(isTauriEnv()).toBe(false);
  });

  it("is true inside the Tauri webview", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    try {
      expect(isTauriEnv()).toBe(true);
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });
});

describe("loadDroppedFile", () => {
  it("reads the file and detects the format", async () => {
    mockedRead.mockResolvedValue("id,label\n1,alpha");
    const file = await loadDroppedFile("C:\\data\\rows.csv");
    expect(file).toEqual({
      path: "C:\\data\\rows.csv",
      content: "id,label\n1,alpha",
      format: FileFormat.CSV,
    });
    expect(mockedRead).toHaveBeenCalledWith("C:\\data\\rows.csv");
  });

  it("rejects unsupported extensions without touching the fs", async () => {
    await expect(loadDroppedFile("C:\\data\\notes.txt")).rejects.toThrow(
      /Unsupported file type/
    );
    expect(mockedRead).not.toHaveBeenCalled();
  });
});

describe("openDataFile", () => {
  it("opens the dialog with data-file filters and loads the file", async () => {
    mockedOpen.mockResolvedValue("C:\\data\\test.yaml");
    mockedRead.mockResolvedValue("name: opened");

    const file = await openDataFile();

    expect(mockedOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        multiple: false,
        directory: false,
        filters: expect.any(Array),
      })
    );
    expect(file).toEqual({
      path: "C:\\data\\test.yaml",
      content: "name: opened",
      format: FileFormat.YAML,
    });
  });

  it("returns null when the dialog is canceled", async () => {
    mockedOpen.mockResolvedValue(null);
    expect(await openDataFile()).toBeNull();
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("propagates fs read errors", async () => {
    mockedOpen.mockResolvedValue("C:\\data\\broken.json");
    mockedRead.mockRejectedValue(new Error("disk gone"));
    await expect(openDataFile()).rejects.toThrow("disk gone");
  });
});

describe("saveDataFile", () => {
  it("suggests an extension, saves and returns the path", async () => {
    mockedSave.mockResolvedValue("C:\\out\\data.json");

    const path = await saveDataFile('{"a":1}', FileFormat.JSON);

    expect(mockedSave).toHaveBeenCalledWith({
      defaultPath: "data.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(mockedWrite).toHaveBeenCalledWith("C:\\out\\data.json", '{"a":1}');
    expect(path).toBe("C:\\out\\data.json");
  });

  it("keeps the yaml filter but allows .yml as well", async () => {
    mockedSave.mockResolvedValue("C:\\out\\data.yml");
    await saveDataFile("a: 1", FileFormat.YAML);
    expect(mockedSave).toHaveBeenCalledWith({
      defaultPath: "data.yaml",
      filters: [
        { name: "YAML", extensions: ["yaml"] },
        { name: "YML", extensions: ["yml"] },
      ],
    });
    expect(mockedWrite).toHaveBeenCalledWith("C:\\out\\data.yml", "a: 1");
  });

  it("returns null and does not write when the dialog is canceled", async () => {
    mockedSave.mockResolvedValue(null);
    expect(await saveDataFile("x", FileFormat.XML)).toBeNull();
    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe("subscribeFileDrop", () => {
  it("dispatches enter/leave/drop events and unsubscribes", async () => {
    const unlisten = vi.fn();
    let handler: ((event: { payload: Record<string, unknown> }) => void) | null = null;
    vi.mocked(getCurrentWebview).mockReturnValue({
      onDragDropEvent: vi.fn(fn => {
        handler = fn;
        return unlisten;
      }),
    } as never);

    const handlers = {
      onEnter: vi.fn(),
      onLeave: vi.fn(),
      onDrop: vi.fn(),
    };
    const stop = await subscribeFileDrop(handlers);

    expect(stop).toBe(unlisten);
    handler!({ payload: { type: "enter", paths: ["C:\\a.json"] } });
    handler!({ payload: { type: "over", position: { x: 1, y: 2 } } });
    handler!({ payload: { type: "drop", paths: ["C:\\a.json", "C:\\b.json"] } });
    handler!({ payload: { type: "leave" } });

    expect(handlers.onEnter).toHaveBeenCalledTimes(1);
    // «over» не меняет состояние оверлея.
    expect(handlers.onDrop).toHaveBeenCalledWith(["C:\\a.json", "C:\\b.json"]);
    expect(handlers.onLeave).toHaveBeenCalledTimes(1);
  });
});
