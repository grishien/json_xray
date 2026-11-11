/**
 * Экспорт визуализации в PNG/JPEG/SVG (Фаза 4, п. 4.3 roadmap).
 * Логика зеркалит `apps/www/src/features/modals/DownloadModal/index.tsx`:
 * html-to-image поверх DOM-узла канваса (`.jsoncrack-canvas`, как в www)
 * и скачивание data-URI через `<a download>`.
 */
export type ExportFormat = "png" | "jpeg" | "svg";

export interface ExportCanvasImageOptions {
  format: ExportFormat;
  /** Имя файла без расширения. По умолчанию `json-xray`. */
  filename?: string;
  /** Цвет фона картинки. По умолчанию белый, как в www. */
  backgroundColor?: string;
  /** Качество JPEG (0..1); PNG/SVG игнорируют (как в www). */
  quality?: number;
  /** Узел для захвата; по умолчанию `.jsoncrack-canvas`. */
  element?: HTMLElement;
}

/** Узел канваса для экспорта (тот же селектор, что в www DownloadModal). */
export const getCanvasElement = (doc: Document = document): HTMLElement | null =>
  (doc.querySelector(".jsoncrack-canvas") as HTMLElement | null) ??
  (doc.querySelector("svg[id*='ref']") as HTMLElement | null);

export const downloadUri = (uri: string, name: string): void => {
  const link = document.createElement("a");

  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** Рендерит канвас в картинку выбранного формата и скачивает её. Возвращает имя файла. */
export const exportCanvasImage = async ({
  format,
  filename = "json-xray",
  backgroundColor = "#FFFFFF",
  quality = 1,
  element,
}: ExportCanvasImageOptions): Promise<string> => {
  const target = element ?? getCanvasElement();
  if (!target) throw new Error("Canvas not found.");

  const { toPng, toJpeg, toSvg } = await import("html-to-image");
  const renderImage = format === "svg" ? toSvg : format === "png" ? toPng : toJpeg;

  // Опции как в www DownloadModal: качество (для JPEG), фон и пропуск
  // встраивания шрифтов. PNG/SVG качество игнорируют.
  const dataUri = await renderImage(target, { quality, backgroundColor, skipFonts: true });

  const name = `${filename}.${format}`;
  downloadUri(dataUri, name);
  return name;
};
