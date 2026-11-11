/**
 * Тесты валидации ввода (Фаза 4, п. 4.1).
 * Ожидания позиций проверены по фактическому поведению библиотек:
 * jsonc-parser 3.3.1, js-yaml 5.4.2, fast-xml-parser 5.11.1, json-2-csv 5.6.0.
 */
import { csv2json } from "json-2-csv";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FileFormat } from "../formats";
import {
  highlightSegments,
  lineColumnToOffset,
  offsetToLineColumn,
  validateContent,
} from "../validate";

// Оборачиваем csv2json в vi.fn с делегированием в реальную реализацию,
// чтобы один тест мог проверить ветку обработки ошибки парсинга.
vi.mock("json-2-csv", async importOriginal => {
  const actual = await importOriginal<typeof import("json-2-csv")>();
  return {
    ...actual,
    csv2json: vi.fn(
      (...args: Parameters<typeof actual.csv2json>) => actual.csv2json(...args)
    ),
  };
});

beforeEach(() => {
  vi.mocked(csv2json).mockClear();
});

describe("offsetToLineColumn / lineColumnToOffset", () => {
  const text = "ab\ncd";

  it("converts offset to 1-based line/column", () => {
    expect(offsetToLineColumn(text, 0)).toEqual({ line: 1, column: 1 });
    expect(offsetToLineColumn(text, 2)).toEqual({ line: 1, column: 3 });
    expect(offsetToLineColumn(text, 3)).toEqual({ line: 2, column: 1 });
    expect(offsetToLineColumn(text, 5)).toEqual({ line: 2, column: 3 });
  });

  it("clamps out-of-range offsets", () => {
    expect(offsetToLineColumn(text, -5)).toEqual({ line: 1, column: 1 });
    expect(offsetToLineColumn(text, 100)).toEqual({ line: 2, column: 3 });
  });

  it("converts line/column back to offset", () => {
    expect(lineColumnToOffset(text, 1, 3)).toBe(2);
    expect(lineColumnToOffset(text, 2, 2)).toBe(4);
    expect(lineColumnToOffset(text, 3, 1)).toBe(text.length);
    expect(lineColumnToOffset(text, 2, -3)).toBe(3);
  });

  it("round-trips offsets through lines/columns", () => {
    const multi = '{\n  "a": 1,\n  "b": [2, 3]\n}';
    for (let offset = 0; offset <= multi.length; offset += 3) {
      const { line, column } = offsetToLineColumn(multi, offset);
      expect(lineColumnToOffset(multi, line, column)).toBe(Math.min(offset, multi.length));
    }
  });
});

describe("validateContent: JSON", () => {
  it("accepts valid JSON", async () => {
    expect(await validateContent('{ "a": [1, 2] }', FileFormat.JSON)).toEqual([]);
  });

  it("accepts JSON with comments (jsonc superset)", async () => {
    expect(await validateContent('{ /* c */ "a": 1 }', FileFormat.JSON)).toEqual([]);
  });

  it("reports position for broken JSON", async () => {
    const errors = await validateContent("{invalid", FileFormat.JSON);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("InvalidSymbol at 1:2 (offset 1)");
    expect(errors[0].offset).toBe(1);
    expect(errors[0].length).toBe(7);
    expect(errors[0].line).toBe(1);
    expect(errors[0].column).toBe(2);
  });

  it("rejects trailing commas (strict JSON, как Visualize)", async () => {
    const errors = await validateContent('{"a":1,}', FileFormat.JSON);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].column).toBeGreaterThan(0);
    expect(errors[0].offset).toBeGreaterThanOrEqual(0);
  });
});

describe("validateContent: YAML", () => {
  it("accepts valid YAML", async () => {
    expect(await validateContent("a: 1\nb:\n  c: 2", FileFormat.YAML)).toEqual([]);
  });

  it("reports position from the js-yaml mark", async () => {
    const errors = await validateContent("a: [unclosed", FileFormat.YAML);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("unexpected end of the stream");
    expect(errors[0].line).toBe(1);
    expect(errors[0].column).toBe(13);
    expect(errors[0].offset).toBe(12);
    expect(errors[0].length).toBe(1);
  });

  it("maps the mark to the right offset on later lines", async () => {
    const errors = await validateContent("a: 1\nb: [unclosed", FileFormat.YAML);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
    expect(errors[0].column).toBe(13);
    expect(errors[0].offset).toBe(17);
  });
});

describe("validateContent: XML", () => {
  it("accepts valid XML", async () => {
    expect(await validateContent("<root><a>1</a></root>", FileFormat.XML)).toEqual([]);
  });

  it("reports position for a mismatched closing tag", async () => {
    const errors = await validateContent("<a><b></a>", FileFormat.XML);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Expected closing tag 'b'");
    expect(errors[0].line).toBe(1);
    expect(errors[0].column).toBe(7);
    expect(errors[0].offset).toBe(6);
  });
});

describe("validateContent: CSV", () => {
  it("accepts valid CSV", async () => {
    expect(await validateContent("id,label\n1,alpha\n2,beta", FileFormat.CSV)).toEqual([]);
  });

  it("is as lenient as the parser (no false positives)", async () => {
    // json-2-csv молча парсит «кривой» CSV — валидация не должна быть строже.
    expect(await validateContent('"unclosed', FileFormat.CSV)).toEqual([]);
    expect(await validateContent("a,b\n1", FileFormat.CSV)).toEqual([]);
  });

  it("surfaces parser errors without positions", async () => {
    vi.mocked(csv2json).mockRejectedValueOnce(new Error("Cannot parse CSV"));
    const errors = await validateContent("whatever", FileFormat.CSV);
    expect(errors).toEqual([{ message: "Cannot parse CSV" }]);
  });
});

describe("validateContent", () => {
  it("returns no errors for empty input", async () => {
    expect(await validateContent("", FileFormat.JSON)).toEqual([]);
    expect(await validateContent("", FileFormat.YAML)).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("splits text around an error range", () => {
    const segments = highlightSegments("hello world", [
      { message: "x", offset: 6, length: 5 },
    ]);
    expect(segments).toEqual([
      { text: "hello ", hasError: false },
      { text: "world", hasError: true },
    ]);
  });

  it("merges overlapping error ranges", () => {
    const segments = highlightSegments("abcdef", [
      { message: "x", offset: 0, length: 3 },
      { message: "y", offset: 2, length: 4 },
    ]);
    expect(segments).toEqual([{ text: "abcdef", hasError: true }]);
  });

  it("keeps gaps between ranges", () => {
    const segments = highlightSegments("abcdef", [
      { message: "x", offset: 0, length: 1 },
      { message: "y", offset: 4, length: 2 },
    ]);
    expect(segments).toEqual([
      { text: "a", hasError: true },
      { text: "bcd", hasError: false },
      { text: "ef", hasError: true },
    ]);
  });

  it("ignores errors without offsets and out-of-text offsets", () => {
    const segments = highlightSegments("abc", [
      { message: "no position" },
      { message: "too far", offset: 10, length: 1 },
    ]);
    expect(segments).toEqual([{ text: "abc", hasError: false }]);
  });

  it("highlights at least one character for zero-length errors", () => {
    const segments = highlightSegments("abc", [{ message: "x", offset: 2, length: 0 }]);
    expect(segments).toEqual([
      { text: "ab", hasError: false },
      { text: "c", hasError: true },
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(highlightSegments("", [{ message: "x", offset: 0, length: 1 }])).toEqual([]);
  });
});
