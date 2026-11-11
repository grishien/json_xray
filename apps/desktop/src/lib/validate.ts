/**
 * Валидация ввода с позициями ошибок (Фаза 4, п. 4.1 roadmap).
 * Принцип: валидация соглашается ровно с тем, что принимает Visualize,
 * т.е. с теми же парсерами, что и `parse.ts` (п. 3.2).
 * Позиции (offset/length + line/column) нужны для подсветки в редакторе:
 * JSON — jsonc-parser, YAML — mark у исключения js-yaml,
 * XML — XMLValidator из fast-xml-parser (сам parser.parse молча «проглатывает»
 * битый XML, поэтому для валидации используется валидатор того же пакета),
 * CSV — json-2-csv (позиций не даёт, только сообщение).
 */
import type { ParseError } from "jsonc-parser";
import { FileFormat } from "./formats";

export interface ValidationError {
  message: string;
  /** Offset (0-based) начала ошибочного фрагмента, если известен. */
  offset?: number;
  /** Длина ошибочного фрагмента, если известна (для подсветки минимум 1). */
  length?: number;
  /** Строка ошибки, начиная с 1, если известна. */
  line?: number;
  /** Колонка ошибки, начиная с 1, если известна. */
  column?: number;
}

export interface HighlightSegment {
  text: string;
  hasError: boolean;
}

/** Offset (0-based) → строка/колонка (1-based). */
export const offsetToLineColumn = (
  text: string,
  offset: number
): { line: number; column: number } => {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, clamped);
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  const lastBreak = before.lastIndexOf("\n");
  const column = clamped - lastBreak;
  return { line, column };
};

/** Строка/колонка (1-based) → offset (0-based). */
export const lineColumnToOffset = (text: string, line: number, column: number): number => {
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf("\n", offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  return Math.min(offset + Math.max(column - 1, 0), text.length);
};

const firstLine = (message: string): string => message.split("\n")[0].trim();

const validateJson = async (value: string): Promise<ValidationError[]> => {
  const { parse, printParseErrorCode } = await import("jsonc-parser");
  const errors: ParseError[] = [];
  parse(value, errors);
  if (errors.length === 0) return [];

  // contentToJson (п. 3.2) при ошибках jsonc повторно парсит строгим
  // JSON.parse и падает только если не прошёл и он — например, jsonc
  // считает трейлинг-запятую ошибкой, и Visualize её тоже не принимает.
  try {
    JSON.parse(value);
    return [];
  } catch {
    const first = errors[0];
    const { line, column } = offsetToLineColumn(value, first.offset);
    return [
      {
        message: `${printParseErrorCode(first.error)} at ${line}:${column} (offset ${first.offset})`,
        offset: first.offset,
        length: Math.max(first.length, 1),
        line,
        column,
      },
    ];
  }
};

const validateYaml = async (value: string): Promise<ValidationError[]> => {
  const { load } = await import("js-yaml");
  try {
    load(value);
    return [];
  } catch (err) {
    const error: ValidationError = {
      message: err instanceof Error ? firstLine(err.message) : String(err),
    };
    // js-yaml кладёт позицию в mark (line/column — 0-based).
    const mark = (err as { mark?: { line?: number; column?: number } }).mark;
    if (typeof mark?.line === "number" && typeof mark?.column === "number") {
      const line = mark.line + 1;
      const column = mark.column + 1;
      error.line = line;
      error.column = column;
      error.offset = lineColumnToOffset(value, line, column);
      error.length = 1;
    }
    return [error];
  }
};

const validateXml = async (value: string): Promise<ValidationError[]> => {
  const { XMLValidator } = await import("fast-xml-parser");
  const result = XMLValidator.validate(value);
  if (result === true) return [];

  const error: ValidationError = { message: result.err.msg };
  // XMLValidator даёт line/col (1-based) без offset — восстанавливаем offset.
  if (typeof result.err.line === "number" && typeof result.err.col === "number") {
    error.line = result.err.line;
    error.column = result.err.col;
    error.offset = lineColumnToOffset(value, result.err.line, result.err.col);
    error.length = 1;
  }
  return [error];
};

const validateCsv = async (value: string): Promise<ValidationError[]> => {
  const { csv2json } = await import("json-2-csv");
  try {
    await csv2json(value, {
      trimFieldValues: true,
      trimHeaderFields: true,
      wrapBooleans: true,
      excelBOM: true,
    });
    return [];
  } catch (err) {
    // json-2-csv обычно молча парсит «кривой» CSV; ошибку даёт только на
    // структурные проблемы — позиций в сообщении нет.
    return [{ message: err instanceof Error ? firstLine(err.message) : String(err) }];
  }
};

/** Валидация ввода в указанном формате; пустой массив — ошибки нет. */
export const validateContent = async (
  value: string,
  format: FileFormat
): Promise<ValidationError[]> => {
  if (!value) return [];

  switch (format) {
    case FileFormat.JSON:
      return validateJson(value);
    case FileFormat.YAML:
      return validateYaml(value);
    case FileFormat.XML:
      return validateXml(value);
    case FileFormat.CSV:
      return validateCsv(value);
    default:
      return [];
  }
};

/**
 * Разбивает текст на сегменты для подсветки в редакторе: пересекающиеся
 * диапазоны ошибок объединяются, ошибки без offset подсветку не дают.
 */
export const highlightSegments = (
  text: string,
  errors: ValidationError[]
): HighlightSegment[] => {
  if (!text) return [];

  const ranges = errors
    .filter(e => typeof e.offset === "number" && e.offset >= 0 && e.offset < text.length)
    .map(e => {
      const start = Math.min(e.offset as number, text.length - 1);
      const end = Math.min(start + Math.max(e.length ?? 1, 1), text.length);
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), hasError: false });
    }
    segments.push({ text: text.slice(range.start, range.end), hasError: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hasError: false });
  }
  return segments;
};
