/**
 * Тесты проводки App → jsoncrack-react (Фаза 3) и базовых инструментов
 * (Фаза 4: форматирование, валидация с подсветкой, конвертация, экспорт).
 * Канвас замокан на границе пакета (тяжёлый ELK-лейаут не работает в jsdom),
 * html-to-image замокан для экспорта; вся остальная логика — реальная:
 * парсинг/конвертация через contentToJson/jsonToContent, валидация через
 * validateContent, состояние, тема, вызовы ref-методов канваса.
 * Фаза 5: Tauri-плагины dialog/fs и события вебвью (drag-and-drop)
 * замоканы на границе @tauri-apps/*; проверяется проводка кнопок Open/Save
 * и drop-событий на загрузку файла.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toJpeg, toPng, toSvg } from "html-to-image";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const canvasState = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  collapseAll: vi.fn(),
  expandAll: vi.fn(),
}));

vi.mock("jsoncrack-react", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const JSONCrack = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    canvasState.props = props;
    useImperativeHandle(
      ref,
      () => ({
        collapseAll: canvasState.collapseAll,
        expandAll: canvasState.expandAll,
      }),
      []
    );
    return (
      <div
        data-testid="canvas-mock"
        // Класс нужен, чтобы экспорт (п. 4.3) находил канвас так же, как в проде.
        className="jsoncrack-canvas"
        data-theme={String(props.theme)}
        data-json={String(props.json)}
      />
    );
  });
  return { JSONCrack };
});

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,AAAA"),
  toJpeg: vi.fn(async () => "data:image/jpeg;base64,BBBB"),
  toSvg: vi.fn(async () => "data:image/svg+xml;charset=utf-8,CCCC"),
}));

import App, { SAMPLE_INPUT } from "../App";

const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
const querySpy = vi.spyOn(document, "querySelector");

afterEach(cleanup);
beforeEach(() => {
  canvasState.props = null;
  vi.clearAllMocks();
  document.body.innerHTML = "";
  clickSpy.mockClear();
  querySpy.mockClear();
});

afterEach(() => {
  querySpy.mockReset();
});

describe("App", () => {
  it("renders the canvas with the default sample in dark theme", () => {
    render(<App />);
    const canvas = screen.getByTestId("canvas-mock");
    expect(canvas.getAttribute("data-theme")).toBe("dark");
    expect(canvas.getAttribute("data-json")).toBe(SAMPLE_INPUT);
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe("dark");
  });

  it("parses YAML input through contentToJson and passes JSON to the canvas", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input format"), { target: { value: "yaml" } });
    fireEvent.change(screen.getByLabelText("Input data"), {
      target: { value: "name: yaml-xray\ncount: 7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual({
        name: "yaml-xray",
        count: 7,
      });
    });
  });

  it("parses CSV input into an array of rows", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input format"), { target: { value: "csv" } });
    fireEvent.change(screen.getByLabelText("Input data"), {
      target: { value: "id,label\n1,alpha\n2,beta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual([
        { id: 1, label: "alpha" },
        { id: 2, label: "beta" },
      ]);
    });
  });

  it("shows an error banner on invalid input and keeps the previous graph", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input data"), { target: { value: "{invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toBeTruthy();
    // Предыдущий успешный граф не заменяется ошибочным вводом.
    expect(screen.getByTestId("canvas-mock").getAttribute("data-json")).toBe(SAMPLE_INPUT);
  });

  it("toggles dark/light theme for both the app chrome and the canvas", () => {
    render(<App />);
    expect(screen.getByTestId("canvas-mock").getAttribute("data-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
    expect(screen.getByTestId("canvas-mock").getAttribute("data-theme")).toBe("light");
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(screen.getByTestId("canvas-mock").getAttribute("data-theme")).toBe("dark");
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe("dark");
  });

  it("delegates collapse/expand to the canvas ref methods", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(canvasState.collapseAll).toHaveBeenCalledTimes(1);
    expect(canvasState.expandAll).toHaveBeenCalledTimes(1);
  });
});

describe("App: валидация с подсветкой (п. 4.1)", () => {
  it("highlights the broken fragment and shows a message while typing", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input data"), { target: { value: "{invalid" } });

    // Живая валидация (реальный jsonc-parser) подсвечивает «invalid».
    const highlight = await waitFor(() => {
      const span = document.querySelector(".errorHighlight");
      expect(span).toBeTruthy();
      return span as HTMLElement;
    });
    expect(highlight.textContent).toBe("invalid");
    await screen.findByRole("alert");
  });

  it("clears highlight and banner when the input becomes valid", async () => {
    render(<App />);
    const textarea = screen.getByLabelText("Input data");
    fireEvent.change(textarea, { target: { value: "{invalid" } });
    await waitFor(() => expect(document.querySelector(".errorHighlight")).toBeTruthy());

    fireEvent.change(textarea, { target: { value: '{ "a": 1 }' } });
    await waitFor(() => expect(document.querySelector(".errorHighlight")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("App: форматирование (п. 4.1)", () => {
  it("pretty-prints compact JSON", async () => {
    render(<App />);
    const textarea = screen.getByLabelText("Input data") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"name":"X","nested":{"a":1}}' } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));

    await waitFor(() => {
      expect(textarea.value).toBe('{\n  "name": "X",\n  "nested": {\n    "a": 1\n  }\n}');
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("formats YAML input in place", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input format"), { target: { value: "yaml" } });
    const textarea = screen.getByLabelText("Input data") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "a:  1\nb:\n c: 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));

    await waitFor(() => expect(textarea.value).toBe("a: 1\nb:\n  c: 2\n"));
  });

  it("keeps the input and shows a banner when formatting invalid input", async () => {
    render(<App />);
    const textarea = screen.getByLabelText("Input data") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "{invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Format" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toBeTruthy();
    expect(textarea.value).toBe("{invalid");
  });
});

describe("App: конвертация (п. 4.2)", () => {
  it("converts JSON to YAML and switches the input format", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Convert to"), { target: { value: "yaml" } });

    const textarea = await waitFor(() => {
      const el = screen.getByLabelText("Input data") as HTMLTextAreaElement;
      expect(el.value).toBe(
        "name: JSON Xray\nversion: 1\nfeatures:\n  - graph\n  - parsing\nconfig:\n  theme: dark\n  layout: RIGHT\n"
      );
      return el;
    });
    // Формат ввода переключился, селектор конвертации сброшен.
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("yaml");
    expect((screen.getByLabelText("Convert to") as HTMLSelectElement).value).toBe("");
    expect(textarea).toBeTruthy();
    // Подсветка/баннер валидации не остались от JSON-ввода.
    expect(document.querySelector(".errorHighlight")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("round-trips YAML back to JSON through the same control", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input format"), { target: { value: "yaml" } });
    const textarea = screen.getByLabelText("Input data") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "name: yaml-xray\ncount: 7" },
    });
    fireEvent.change(screen.getByLabelText("Convert to"), { target: { value: "json" } });

    await waitFor(() => {
      expect(textarea.value).toBe('{\n  "name": "yaml-xray",\n  "count": 7\n}');
    });
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("json");
    // Гонка с живой валидацией подавлена: баннер «не JSON» не возвращается
    // после успешной конвертации.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelector(".errorHighlight")).toBeNull();
  });

  it("shows a banner and keeps the source format when conversion fails", async () => {
    render(<App />);
    const textarea = screen.getByLabelText("Input data") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "{invalid" } });
    fireEvent.change(screen.getByLabelText("Convert to"), { target: { value: "yaml" } });

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toBeTruthy();
    expect(textarea.value).toBe("{invalid");
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("json");
  });
});

describe("App: экспорт (п. 4.3)", () => {
  it.each([
    ["Export PNG", toPng, "png"],
    ["Export JPEG", toJpeg, "jpeg"],
    ["Export SVG", toSvg, "svg"],
  ] as const)("%s captures the canvas and downloads the file", async (label, imageFn, format) => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(imageFn).toHaveBeenCalledTimes(1));
    const [element, options] = vi.mocked(imageFn).mock.calls[0];
    expect((element as HTMLElement).className).toContain("jsoncrack-canvas");
    expect(options).toEqual({ quality: 1, backgroundColor: "#1e1e1e", skipFonts: true });

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe(`json-xray.${format}`);
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("uses the light background after switching the theme", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));

    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    expect(toPng).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ backgroundColor: "#ffffff" })
    );
  });

  it("shows a banner when there is no canvas to export", async () => {
    querySpy.mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("Canvas not found.");
    expect(toPng).not.toHaveBeenCalled();
  });
});

describe("App: открытие/сохранение файлов через нативные диалоги (п. 5.1)", () => {
  it("opens a file, switches the format, visualizes and shows the file name", async () => {
    vi.mocked(open).mockResolvedValue("C:\\data\\test.yaml");
    vi.mocked(readTextFile).mockResolvedValue("name: opened\nrank: 3");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    const textarea = await waitFor(() => {
      const el = screen.getByLabelText("Input data") as HTMLTextAreaElement;
      expect(el.value).toBe("name: opened\nrank: 3");
      return el;
    });
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("yaml");
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual({
        name: "opened",
        rank: 3,
      });
    });
    expect(screen.getByTitle("C:\\data\\test.yaml").textContent).toBe("test.yaml");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(textarea).toBeTruthy();
  });

  it("keeps the input when the open dialog is canceled", async () => {
    vi.mocked(open).mockResolvedValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText("Input data") as HTMLTextAreaElement).value).toBe(SAMPLE_INPUT);
    expect(readTextFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a banner for unsupported file extensions", async () => {
    vi.mocked(open).mockResolvedValue("C:\\data\\notes.txt");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("Unsupported file type");
    expect(readTextFile).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Input data") as HTMLTextAreaElement).value).toBe(SAMPLE_INPUT);
  });

  it("shows a banner when reading the file fails", async () => {
    vi.mocked(open).mockResolvedValue("C:\\data\\broken.json");
    vi.mocked(readTextFile).mockRejectedValue(new Error("disk gone"));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("disk gone");
  });

  it("saves the input and shows the saved file name", async () => {
    vi.mocked(save).mockResolvedValue("C:\\out\\data.json");
    render(<App />);
    fireEvent.click(screen.getByTestId("save-file"));

    await waitFor(() =>
      expect(writeTextFile).toHaveBeenCalledWith("C:\\out\\data.json", SAMPLE_INPUT)
    );
    await waitFor(() =>
      expect(screen.getByTitle("C:\\out\\data.json").textContent).toBe("data.json")
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not write when the save dialog is canceled", async () => {
    vi.mocked(save).mockResolvedValue(null);
    render(<App />);
    fireEvent.click(screen.getByTestId("save-file"));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a banner when saving fails", async () => {
    vi.mocked(save).mockResolvedValue("C:\\out\\data.json");
    vi.mocked(writeTextFile).mockRejectedValue(new Error("readonly disk"));
    render(<App />);
    fireEvent.click(screen.getByTestId("save-file"));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("readonly disk");
  });
});

describe("App: drag-and-drop файлов в окно (п. 5.2)", () => {
  let dropHandler: ((event: { payload: Record<string, unknown> }) => void) | null;
  const unlisten = vi.fn();

  const waitSubscribed = async () => {
    await waitFor(() => expect(dropHandler).not.toBeNull());
  };

  beforeEach(() => {
    // isTauriEnv() видит Tauri-окружение — App подписывается на drop-события.
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    dropHandler = null;
    unlisten.mockClear();
    vi.mocked(getCurrentWebview).mockReturnValue({
      onDragDropEvent: vi.fn(fn => {
        dropHandler = fn;
        return unlisten;
      }),
    } as never);
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it("shows the overlay while dragging and loads the dropped file", async () => {
    vi.mocked(readTextFile).mockResolvedValue("id,label\n1,alpha");
    render(<App />);
    await waitSubscribed();

    act(() => dropHandler!({ payload: { type: "enter", paths: ["C:\\d\\rows.csv"] } }));
    expect(screen.getByTestId("drop-overlay")).toBeTruthy();

    act(() => dropHandler!({ payload: { type: "leave" } }));
    expect(screen.queryByTestId("drop-overlay")).toBeNull();

    act(() => dropHandler!({ payload: { type: "drop", paths: ["C:\\d\\rows.csv"] } }));
    const textarea = await waitFor(() => {
      const el = screen.getByLabelText("Input data") as HTMLTextAreaElement;
      expect(el.value).toBe("id,label\n1,alpha");
      return el;
    });
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("csv");
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual([
        { id: 1, label: "alpha" },
      ]);
    });
    expect(screen.getByTitle("C:\\d\\rows.csv")).toBeTruthy();
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(textarea).toBeTruthy();
  });

  it("shows a banner for unsupported dropped files", async () => {
    render(<App />);
    await waitSubscribed();

    act(() => dropHandler!({ payload: { type: "drop", paths: ["C:\\d\\notes.txt"] } }));
    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("Unsupported file type");
    expect(readTextFile).not.toHaveBeenCalled();
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
  });

  it("unsubscribes from drag-and-drop on unmount", async () => {
    const view = render(<App />);
    await waitSubscribed();

    view.unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});

describe("App: чек-лист MVP (п. 6.3 roadmap)", () => {
  it("passes the full chain: open file → visualize → edit → convert → export", async () => {
    // 1. Открыть файл через нативный диалог.
    vi.mocked(open).mockResolvedValue("C:\\mvp\\config.yaml");
    vi.mocked(readTextFile).mockResolvedValue("service: xray\nreplicas: 2");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    const textarea = await waitFor(() => {
      const el = screen.getByLabelText("Input data") as HTMLTextAreaElement;
      expect(el.value).toBe("service: xray\nreplicas: 2");
      return el;
    });
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("yaml");

    // 2. Файл визуализирован: граф получил распарсенный JSON.
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual({
        service: "xray",
        replicas: 2,
      });
    });

    // 3. Отредактировать: изменить данные и пере-визуализировать.
    fireEvent.change(textarea, {
      target: { value: "service: xray\nreplicas: 5\nfeatures:\n  - graph" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual({
        service: "xray",
        replicas: 5,
        features: ["graph"],
      });
    });

    // 4. Конвертировать YAML → JSON (двусторонняя конвертация, п. 4.2).
    fireEvent.change(screen.getByLabelText("Convert to"), { target: { value: "json" } });
    await waitFor(() => {
      const el = screen.getByLabelText("Input data") as HTMLTextAreaElement;
      expect(JSON.parse(el.value)).toEqual({
        service: "xray",
        replicas: 5,
        features: ["graph"],
      });
    });
    expect((screen.getByLabelText("Input format") as HTMLSelectElement).value).toBe("json");

    // 5. Экспортировать визуализацию в PNG (п. 4.3).
    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("json-xray.png");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
