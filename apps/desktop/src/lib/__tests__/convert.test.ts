/**
 * Тесты конвертации форматов (Фаза 4, п. 4.2).
 * Ожидаемые строки выверены по фактическому выводу js-yaml 5.4.2,
 * fast-xml-parser 5.11.1 (XMLBuilder format: true) и json-2-csv 5.6.0.
 */
import { describe, expect, it } from "vitest";

import { FileFormat } from "../formats";
import { convertContent, jsonToContent } from "../convert";
import { contentToJson } from "../parse";

const rowsJson = JSON.stringify([
  { id: 1, label: "alpha" },
  { id: 2, label: "beta" },
]);

describe("jsonToContent", () => {
  it("pretty-prints JSON", async () => {
    expect(await jsonToContent('{"a":1}', FileFormat.JSON)).toBe('{\n  "a": 1\n}');
  });

  it("dumps YAML", async () => {
    expect(await jsonToContent('{"a":1}', FileFormat.YAML)).toBe("a: 1\n");
  });

  it("dumps nested YAML that loads back to the same data", async () => {
    const json = '{"a":1,"b":{"c":[1,2]}}';
    const yaml = await jsonToContent(json, FileFormat.YAML);
    expect(await contentToJson(yaml, FileFormat.YAML)).toEqual({ a: 1, b: { c: [1, 2] } });
  });

  it("builds pretty-printed XML", async () => {
    expect(await jsonToContent('{"root":{"a":1}}', FileFormat.XML)).toBe(
      "<root>\n  <a>1</a>\n</root>\n"
    );
  });

  it("builds CSV from an array of flat rows", async () => {
    expect(await jsonToContent(rowsJson, FileFormat.CSV)).toBe("id,label\n1,alpha\n2,beta");
  });

  it("wraps a single object into a one-row CSV", async () => {
    expect(await jsonToContent('{"id":1}', FileFormat.CSV)).toBe("id\n1");
  });

  it("adds no BOM (результат идёт в редактор, не в файл)", async () => {
    const csv = await jsonToContent(rowsJson, FileFormat.CSV);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("returns an empty string for empty input", async () => {
    expect(await jsonToContent("", FileFormat.YAML)).toBe("");
  });

  it("rejects invalid JSON instead of silently returning it", async () => {
    await expect(jsonToContent("{invalid", FileFormat.JSON)).rejects.toThrow();
    await expect(jsonToContent("{invalid", FileFormat.CSV)).rejects.toThrow();
  });
});

describe("convertContent", () => {
  it("converts YAML to pretty JSON", async () => {
    expect(await convertContent("a: 1\nb:\n  c: 2", FileFormat.YAML, FileFormat.JSON)).toBe(
      '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}'
    );
  });

  it("round-trips JSON through YAML", async () => {
    const json = '{"a":1,"b":{"c":[1,2],"d":"text"}}';
    const yaml = await convertContent(json, FileFormat.JSON, FileFormat.YAML);
    expect(await contentToJson(yaml, FileFormat.YAML)).toEqual({ a: 1, b: { c: [1, 2], d: "text" } });
  });

  it("round-trips JSON through XML", async () => {
    const json = '{"root":{"a":1,"b":"text"}}';
    const xml = await convertContent(json, FileFormat.JSON, FileFormat.XML);
    expect(await contentToJson(xml, FileFormat.XML)).toEqual({ root: { a: 1, b: "text" } });
  });

  it("round-trips JSON through CSV for flat rows", async () => {
    const csv = await convertContent(rowsJson, FileFormat.JSON, FileFormat.CSV);
    expect(csv).toBe("id,label\n1,alpha\n2,beta");
    expect(await contentToJson(csv, FileFormat.CSV)).toEqual([
      { id: 1, label: "alpha" },
      { id: 2, label: "beta" },
    ]);
  });

  it("converts YAML rows to CSV", async () => {
    const yaml = "- id: 1\n  label: alpha\n- id: 2\n  label: beta\n";
    expect(await convertContent(yaml, FileFormat.YAML, FileFormat.CSV)).toBe(
      "id,label\n1,alpha\n2,beta"
    );
  });

  it("converts CSV to YAML", async () => {
    const yaml = await convertContent("id,label\n1,alpha\n2,beta", FileFormat.CSV, FileFormat.YAML);
    expect(await contentToJson(yaml, FileFormat.YAML)).toEqual([
      { id: 1, label: "alpha" },
      { id: 2, label: "beta" },
    ]);
  });

  it("rejects unparseable source input", async () => {
    await expect(convertContent("{invalid", FileFormat.JSON, FileFormat.YAML)).rejects.toThrow();
    await expect(convertContent("a: [unclosed", FileFormat.YAML, FileFormat.JSON)).rejects.toThrow();
  });
});
