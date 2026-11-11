/**
 * Парсинг JSON/YAML/XML/CSV в JSON-объект для визуализации (Фаза 3, п. 3.2 roadmap).
 * Логика переиспользована из репозитория JSON Crack:
 * `apps/www/src/lib/utils/jsonAdapter.ts` (`contentToJson`, направление content → JSON).
 * Настройки парсеров YAML/XML/CSV совпадают с www, чтобы поведение было идентичным.
 */
import type { ParseError } from "jsonc-parser";
import { FileFormat } from "./formats";

export const contentToJson = async (value: string, format = FileFormat.JSON): Promise<object> => {
  if (!value) return {};

  if (format === FileFormat.JSON) {
    const { parse } = await import("jsonc-parser");
    const errors: ParseError[] = [];
    const result = parse(value, errors);
    if (errors.length > 0) JSON.parse(value);
    return result as object;
  }

  if (format === FileFormat.YAML) {
    const { load } = await import("js-yaml");
    return load(value) as object;
  }

  if (format === FileFormat.XML) {
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({
      attributeNamePrefix: "$",
      ignoreAttributes: false,
      allowBooleanAttributes: true,
      parseAttributeValue: true,
      trimValues: true,
      parseTagValue: true,
    });
    return parser.parse(value);
  }

  if (format === FileFormat.CSV) {
    const { csv2json } = await import("json-2-csv");
    const result = await csv2json(value, {
      trimFieldValues: true,
      trimHeaderFields: true,
      wrapBooleans: true,
      excelBOM: true,
    });
    return result;
  }

  return {};
};
