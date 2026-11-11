/**
 * Поддерживаемые форматы ввода (Фаза 3, п. 3.2 roadmap).
 * Зеркало `apps/www/src/enums/file.enum.ts` (FileFormat + formats).
 */
export enum FileFormat {
  JSON = "json",
  YAML = "yaml",
  XML = "xml",
  CSV = "csv",
}

export const formats = [
  { value: FileFormat.JSON, label: "JSON" },
  { value: FileFormat.YAML, label: "YAML" },
  { value: FileFormat.XML, label: "XML" },
  { value: FileFormat.CSV, label: "CSV" },
] as const;
