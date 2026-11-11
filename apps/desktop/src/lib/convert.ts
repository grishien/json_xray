/**
 * Конвертация между форматами (Фаза 4, п. 4.2 roadmap).
 * Направление content → JSON живёт в `parse.ts` (п. 3.2), здесь — обратное:
 * `jsonToContent` — зеркало `apps/www/src/lib/utils/jsonAdapter.ts`.
 * Отличие от www: ошибки конвертации пробрасываются наружу, а не «молча
 * возвращают исходный json» — десктопный UI должен показывать пользователю,
 * почему конвертация не удалась.
 */
import { FileFormat } from "./formats";
import { contentToJson } from "./parse";

export const jsonToContent = async (json: string, format: FileFormat): Promise<string> => {
  if (!json) return "";

  if (format === FileFormat.JSON) {
    return JSON.stringify(JSON.parse(json), null, 2);
  }

  if (format === FileFormat.YAML) {
    const { dump } = await import("js-yaml");
    const { parse } = await import("jsonc-parser");
    return dump(parse(json));
  }

  if (format === FileFormat.XML) {
    const { XMLBuilder } = await import("fast-xml-parser");
    const builder = new XMLBuilder({
      format: true,
      attributeNamePrefix: "$",
      ignoreAttributes: false,
    });

    return builder.build(JSON.parse(json));
  }

  if (format === FileFormat.CSV) {
    const { json2csv } = await import("json-2-csv");
    const parsedJson = JSON.parse(json);

    const data = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
    return json2csv(data, {
      expandArrayObjects: true,
      expandNestedObjects: true,
      // BOM уместен только при записи файла: в редакторе он виден как
      // невидимый символ в начале текста и ломает повторный парсинг,
      // поэтому в отличие от www отключён.
      excelBOM: false,
      wrapBooleans: true,
      trimFieldValues: true,
      trimHeaderFields: true,
    });
  }

  return json;
};

/** Конвертация текста из одного формата в другой: content → JSON → content. */
export const convertContent = async (
  value: string,
  from: FileFormat,
  to: FileFormat
): Promise<string> => {
  const data = await contentToJson(value, from);
  return jsonToContent(JSON.stringify(data), to);
};
