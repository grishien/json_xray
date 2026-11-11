/**
 * Тесты экспорта визуализации в PNG/JPEG/SVG (Фаза 4, п. 4.3).
 * html-to-image замокан: проверяем выбор функции под формат, опции
 * (как в www DownloadModal), имя файла и скачивание через <a download>.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toJpeg, toPng, toSvg } from "html-to-image";

import {
  downloadUri,
  exportCanvasImage,
  getCanvasElement,
} from "../exportImage";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,AAAA"),
  toJpeg: vi.fn(async () => "data:image/jpeg;base64,BBBB"),
  toSvg: vi.fn(async () => "data:image/svg+xml;charset=utf-8,CCCC"),
}));

const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

const clickedAnchor = (): HTMLAnchorElement =>
  clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;

describe("getCanvasElement", () => {
  it("finds the .jsoncrack-canvas element", () => {
    const canvas = document.createElement("div");
    canvas.className = "jsoncrack-canvas";
    document.body.appendChild(canvas);
    expect(getCanvasElement()).toBe(canvas);
  });

  it("falls back to the reaflow svg, как в www", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "ref-1");
    document.body.appendChild(svg);
    expect(getCanvasElement()).toBe(svg);
  });

  it("returns null when there is no canvas", () => {
    expect(getCanvasElement()).toBeNull();
  });
});

describe("exportCanvasImage", () => {
  it("uses toPng for png and downloads the data URI", async () => {
    const canvas = document.createElement("div");
    canvas.className = "jsoncrack-canvas";
    document.body.appendChild(canvas);

    const name = await exportCanvasImage({ format: "png" });

    expect(name).toBe("json-xray.png");
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toPng).toHaveBeenCalledWith(canvas, {
      quality: 1,
      backgroundColor: "#FFFFFF",
      skipFonts: true,
    });
    expect(toJpeg).not.toHaveBeenCalled();
    expect(toSvg).not.toHaveBeenCalled();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickedAnchor();
    expect(anchor.download).toBe("json-xray.png");
    expect(anchor.href).toBe("data:image/png;base64,AAAA");
    // Ссылка не остаётся в документе.
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("uses toJpeg for jpeg", async () => {
    const canvas = document.createElement("div");
    canvas.className = "jsoncrack-canvas";
    document.body.appendChild(canvas);

    const name = await exportCanvasImage({ format: "jpeg" });

    expect(name).toBe("json-xray.jpeg");
    expect(toJpeg).toHaveBeenCalledTimes(1);
    expect(toPng).not.toHaveBeenCalled();
    expect(clickedAnchor().download).toBe("json-xray.jpeg");
  });

  it("uses toSvg for svg", async () => {
    const canvas = document.createElement("div");
    canvas.className = "jsoncrack-canvas";
    document.body.appendChild(canvas);

    const name = await exportCanvasImage({ format: "svg" });

    expect(name).toBe("json-xray.svg");
    expect(toSvg).toHaveBeenCalledTimes(1);
    expect(clickedAnchor().download).toBe("json-xray.svg");
    expect(clickedAnchor().href).toBe("data:image/svg+xml;charset=utf-8,CCCC");
  });

  it("passes explicit element, filename, background and quality", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    await exportCanvasImage({
      format: "jpeg",
      element,
      filename: "graph",
      backgroundColor: "#000000",
      quality: 0.5,
    });

    expect(toJpeg).toHaveBeenCalledWith(element, {
      quality: 0.5,
      backgroundColor: "#000000",
      skipFonts: true,
    });
    expect(clickedAnchor().download).toBe("graph.jpeg");
  });

  it("rejects when there is no canvas to capture", async () => {
    await expect(exportCanvasImage({ format: "png" })).rejects.toThrow("Canvas not found.");
    expect(toPng).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe("downloadUri", () => {
  it("creates, clicks and removes the download anchor", () => {
    downloadUri("data:image/png;base64,XXXX", "file.png");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickedAnchor();
    expect(anchor.download).toBe("file.png");
    expect(anchor.href).toBe("data:image/png;base64,XXXX");
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });
});
