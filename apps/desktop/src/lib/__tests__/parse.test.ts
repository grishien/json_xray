import { describe, expect, it } from "vitest";
import { FileFormat } from "../formats";
import { contentToJson } from "../parse";

describe("contentToJson (переиспользование логики apps/www jsonAdapter)", () => {
  it("defaults to JSON format", async () => {
    expect(await contentToJson('{"a":1}')).toEqual({ a: 1 });
  });

  describe("JSON", () => {
    it("parses objects", async () => {
      expect(await contentToJson('{"a":1,"b":[true,null]}', FileFormat.JSON)).toEqual({
        a: 1,
        b: [true, null],
      });
    });

    it("parses scalars", async () => {
      expect(await contentToJson("42", FileFormat.JSON)).toBe(42);
      expect(await contentToJson('"hello"', FileFormat.JSON)).toBe("hello");
    });

    it("tolerates JSONC comments (no syntax errors)", async () => {
      const result = await contentToJson(
        `{
          // comment
          "a": 1
        }`,
        FileFormat.JSON
      );
      expect(result).toEqual({ a: 1 });
    });

    // Логика www: jsonc-parser восстанавливает дерево, но возвращает ошибки —
    // тогда выполняется строгий fallback JSON.parse, который бросает исключение.
    it("rejects trailing commas via strict JSON fallback", async () => {
      await expect(
        contentToJson(
          `{
          "a": 1,
        }`,
          FileFormat.JSON
        )
      ).rejects.toThrow();
    });

    it("throws on invalid JSON", async () => {
      await expect(contentToJson("{invalid}", FileFormat.JSON)).rejects.toThrow();
    });
  });

  describe("YAML", () => {
    it("parses mappings and sequences", async () => {
      const yaml = "name: json-xray\nversion: 1\ntags:\n  - graph\n  - parse";
      expect(await contentToJson(yaml, FileFormat.YAML)).toEqual({
        name: "json-xray",
        version: 1,
        tags: ["graph", "parse"],
      });
    });

    it("parses nested structures", async () => {
      const yaml = "config:\n  theme: dark\n  zoom: 1.5";
      expect(await contentToJson(yaml, FileFormat.YAML)).toEqual({
        config: { theme: "dark", zoom: 1.5 },
      });
    });

    it("throws on invalid YAML", async () => {
      await expect(contentToJson("a: [unclosed", FileFormat.YAML)).rejects.toThrow();
    });
  });

  describe("XML", () => {
    it("parses elements and parses tag values", async () => {
      const xml = "<root><name>json-xray</name><version>2</version><active>true</active></root>";
      expect(await contentToJson(xml, FileFormat.XML)).toEqual({
        root: { name: "json-xray", version: 2, active: true },
      });
    });

    // fast-xml-parser v5: атрибут `id` получает удвоенный префикс "$$" (реальное
    // поведение переиспользуемых опций www), значения атрибутов парсятся в числа.
    it("keeps attributes with the $ prefix (v5 doubles it to $$)", async () => {
      const xml = '<root><item $id="1">a</item></root>';
      expect(await contentToJson(xml, FileFormat.XML)).toEqual({
        root: { item: { "$$id": 1, "#text": "a" } },
      });
    });

    // Парсер v5 толерантен: незакрытый тег восстанавливается в пустую строку,
    // а не бросает исключение (реальное поведение переиспользуемой логики).
    it("recovers leniently from unclosed tags", async () => {
      expect(await contentToJson("<root><unclosed>", FileFormat.XML)).toEqual({
        root: { unclosed: "" },
      });
    });
  });

  describe("CSV", () => {
    // json-2-csv v5 автоматически приводит числоподобные значения к числам.
    it("parses rows into an array of objects with typed values", async () => {
      const csv = "name,version\napple,1\n banana ,2";
      expect(await contentToJson(csv, FileFormat.CSV)).toEqual([
        { name: "apple", version: 1 },
        { name: "banana", version: 2 },
      ]);
    });

    it("trims header fields and keeps quoted values as strings", async () => {
      const csv = ' name , version \na,"007"';
      expect(await contentToJson(csv, FileFormat.CSV)).toEqual([{ name: "a", version: "007" }]);
    });

    it("returns an empty object for empty input", async () => {
      expect(await contentToJson("", FileFormat.CSV)).toEqual({});
    });
  });

  it("returns an empty object for empty input in any format", async () => {
    expect(await contentToJson("", FileFormat.JSON)).toEqual({});
    expect(await contentToJson("", FileFormat.YAML)).toEqual({});
    expect(await contentToJson("", FileFormat.XML)).toEqual({});
  });
});
