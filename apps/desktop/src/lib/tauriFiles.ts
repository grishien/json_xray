/**
 * Нативная работа с файлами (Фаза 5, п. 5.1–5.2 roadmap).
 * Диалоги открытия/сохранения — @tauri-apps/plugin-dialog, чтение/запись —
 * @tauri-apps/plugin-fs, drag-and-drop — события вебвью onDragDropEvent
 * (@tauri-apps/api/webview). Все данные обрабатываются локально, сеть
 * не используется (см. п. 5.3 и CSP в tauri.conf.json).
 */
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { FileFormat } from "./formats";

/** Файл, загруженный из локальной ФС (диалог или drag-and-drop). */
export interface LoadedFile {
  path: string;
  content: string;
  format: FileFormat;
}

const extensionByFormat: Record<FileFormat, string> = {
  [FileFormat.JSON]: "json",
  [FileFormat.YAML]: "yaml",
  [FileFormat.XML]: "xml",
  [FileFormat.CSV]: "csv",
};

const formatByExtension: Record<string, FileFormat> = {
  json: FileFormat.JSON,
  yaml: FileFormat.YAML,
  yml: FileFormat.YAML,
  xml: FileFormat.XML,
  csv: FileFormat.CSV,
};

/** Все поддерживаемые расширения — для фильтра диалога открытия. */
export const dataFileExtensions = Object.keys(formatByExtension);

/** Расширение (без точки) по умолчанию для сохранения в этом формате. */
export const extensionForFormat = (format: FileFormat): string => extensionByFormat[format];

/** Имя файла из пути (учитываются и `\`, и `/`). */
export const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/** Формат по расширению пути; null — расширение не поддерживается. */
export const detectFormatFromPath = (path: string): FileFormat | null => {
  const dot = baseName(path).lastIndexOf(".");
  if (dot < 0) return null;
  const extension = baseName(path).slice(dot + 1).toLowerCase();
  return formatByExtension[extension] ?? null;
};

/** True внутри Tauri (вебвью с __TAURI_INTERNALS__), false в браузере/jsdom. */
export const isTauriEnv = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Чтение файла по пути (из диалога или drop-события) с определением формата.
 * Бросает ошибку, если расширение не поддерживается.
 */
export const loadDroppedFile = async (path: string): Promise<LoadedFile> => {
  const format = detectFormatFromPath(path);
  if (!format) throw new Error(`Unsupported file type: ${baseName(path)}`);
  const content = await readTextFile(path);
  return { path, content, format };
};

/** Диалог «Открыть» + чтение выбранного файла. null — выбор отменён. */
export const openDataFile = async (): Promise<LoadedFile | null> => {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: "Data files", extensions: dataFileExtensions },
      { name: "JSON", extensions: ["json"] },
      { name: "YAML", extensions: ["yaml", "yml"] },
      { name: "XML", extensions: ["xml"] },
      { name: "CSV", extensions: ["csv"] },
    ],
  });
  if (!path) return null;
  return loadDroppedFile(path);
};

/** Диалог «Сохранить» + запись текста. null — выбор отменён. */
export const saveDataFile = async (
  content: string,
  format: FileFormat
): Promise<string | null> => {
  const extension = extensionForFormat(format);
  const path = await save({
    defaultPath: `data.${extension}`,
    filters: [
      { name: extension.toUpperCase(), extensions: [extension] },
      ...(extension === "yaml" ? [{ name: "YML", extensions: ["yml"] }] : []),
    ],
  });
  if (!path) return null;
  await writeTextFile(path, content);
  return path;
};

export interface FileDropHandlers {
  /** Файл «занесён» в окно — показать оверлей. */
  onEnter: () => void;
  /** Перетаскивание отменено/вышло за окно — скрыть оверлей. */
  onLeave: () => void;
  /** Файл брошен в окно; берём первый путь. */
  onDrop: (paths: string[]) => void;
}

/**
 * Подписка на drag-and-drop файлов в окно (п. 5.2).
 * При dragDropEnabled (по умолчанию включён) Tauri перехватывает HTML5
 * drag-события вебвью и рассылает собственные enter/over/drop/leave
 * с путями файлов. Возвращает функцию отписки.
 */
export const subscribeFileDrop = async (
  handlers: FileDropHandlers
): Promise<() => void> =>
  getCurrentWebview().onDragDropEvent(event => {
    if (event.payload.type === "enter") handlers.onEnter();
    else if (event.payload.type === "leave") handlers.onLeave();
    else if (event.payload.type === "drop") handlers.onDrop(event.payload.paths);
  });
