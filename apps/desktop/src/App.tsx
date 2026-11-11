/**
 * Основное окно приложения (Фазы 3–4 roadmap).
 * Слева — ввод данных (JSON/YAML/XML/CSV) с живой валидацией и подсветкой
 * ошибок (п. 4.1), форматированием (п. 4.1) и конвертацией форматов (п. 4.2).
 * Справа — интерактивный канвас из пакета `jsoncrack-react`: зум,
 * панорамирование, раскрытие/сворачивание узлов (п. 3.1, 3.3) и экспорт
 * в PNG/JPEG/SVG (п. 4.3). Тема: тёмная/светлая (п. 3.4).
 */
import { useCallback, useRef, useState } from "react";
import { JSONCrack } from "jsoncrack-react";
import type { JSONCrackRef } from "jsoncrack-react";
import { FileFormat, formats } from "./lib/formats";
import { convertContent, jsonToContent } from "./lib/convert";
import { exportCanvasImage, type ExportFormat } from "./lib/exportImage";
import { contentToJson } from "./lib/parse";
import { toggleTheme, type AppTheme } from "./lib/theme";
import { highlightSegments, validateContent, type ValidationError } from "./lib/validate";

const SAMPLE_INPUT = `{
  "name": "JSON Xray",
  "version": 1,
  "features": ["graph", "parsing"],
  "config": {
    "theme": "dark",
    "layout": "RIGHT"
  }
}`;

export { SAMPLE_INPUT };

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export default function App() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [format, setFormat] = useState<FileFormat>(FileFormat.JSON);
  const [json, setJson] = useState(SAMPLE_INPUT);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState("");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const canvasRef = useRef<JSONCrackRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLPreElement>(null);
  // Защита от гонки живой валидации: применяется только последний ответ.
  const validationSeqRef = useRef(0);

  const runValidation = useCallback(async (value: string, fmt: FileFormat) => {
    const seq = validationSeqRef.current + 1;
    validationSeqRef.current = seq;
    const errors = await validateContent(value, fmt);
    if (seq === validationSeqRef.current) setValidationErrors(errors);
  }, []);

  // Сброс подсветки с инвалидацией летящей валидации — иначе её поздний
  // ответ перезатрёт состояние после Format/Convert (например, останется
  // «ошибка» для ввода, который уже заменён на отконвертированный).
  const clearValidation = useCallback(() => {
    validationSeqRef.current += 1;
    setValidationErrors([]);
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      void runValidation(value, format);
    },
    [format, runValidation]
  );

  const handleVisualize = useCallback(async () => {
    try {
      const data = await contentToJson(input, format);
      setJson(JSON.stringify(data, null, 2));
      setActionError(null);
    } catch (err) {
      setActionError(toErrorMessage(err));
    }
  }, [input, format]);

  /** Pretty-print ввода в текущем формате (п. 4.1). */
  const handleFormat = useCallback(async () => {
    try {
      const data = await contentToJson(input, format);
      const pretty = await jsonToContent(JSON.stringify(data), format);
      setInput(pretty);
      clearValidation();
      setActionError(null);
    } catch (err) {
      setActionError(toErrorMessage(err));
    }
  }, [input, format, clearValidation]);

  /** Конвертация ввода в выбранный формат с переключением редактора (п. 4.2). */
  const handleConvert = useCallback(
    async (target: FileFormat) => {
      try {
        const converted = await convertContent(input, format, target);
        setInput(converted);
        setFormat(target);
        clearValidation();
        setActionError(null);
      } catch (err) {
        setActionError(toErrorMessage(err));
      } finally {
        setConvertTarget("");
      }
    },
    [input, format, clearValidation]
  );

  /** Экспорт канваса в PNG/JPEG/SVG (п. 4.3). */
  const handleExport = useCallback(
    async (target: ExportFormat) => {
      try {
        await exportCanvasImage({
          format: target,
          filename: "json-xray",
          backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
          quality: 1,
        });
        setActionError(null);
      } catch (err) {
        setActionError(toErrorMessage(err));
      }
    },
    [theme]
  );

  const handleThemeToggle = useCallback(() => setTheme(toggleTheme), []);

  const syncMirrorScroll = useCallback(() => {
    const mirror = mirrorRef.current;
    const textarea = textareaRef.current;
    if (!mirror || !textarea) return;
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }, []);

  const segments = highlightSegments(input, validationErrors);
  const bannerText =
    actionError ??
    (validationErrors.length > 0
      ? validationErrors.map(error => error.message).join("\n")
      : null);

  return (
    <div className="app" data-theme={theme}>
      <header className="toolbar">
        <span className="toolbarTitle">JSON Xray</span>
        <select
          className="select"
          aria-label="Input format"
          value={format}
          onChange={event => setFormat(event.target.value as FileFormat)}
        >
          {formats.map(f => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button className="button buttonPrimary" onClick={handleVisualize}>
          Visualize
        </button>
        <button className="button" title="Pretty-print input" onClick={handleFormat}>
          Format
        </button>
        <select
          className="select"
          aria-label="Convert to"
          title="Convert input to another format"
          value={convertTarget}
          onChange={event => {
            const target = event.target.value;
            setConvertTarget(target);
            if (target) void handleConvert(target as FileFormat);
          }}
        >
          <option value="" disabled hidden>
            Convert to…
          </option>
          {formats.map(f => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button className="button" title="Export graph as PNG" onClick={() => handleExport("png")}>
          Export PNG
        </button>
        <button
          className="button"
          title="Export graph as JPEG"
          onClick={() => handleExport("jpeg")}
        >
          Export JPEG
        </button>
        <button className="button" title="Export graph as SVG" onClick={() => handleExport("svg")}>
          Export SVG
        </button>
        <button
          className="button"
          title="Collapse first-level nodes"
          onClick={() => canvasRef.current?.collapseAll()}
        >
          Collapse all
        </button>
        <button
          className="button"
          title="Expand all nodes"
          onClick={() => canvasRef.current?.expandAll()}
        >
          Expand all
        </button>
        <span className="toolbarSpacer" />
        <button className="button" onClick={handleThemeToggle}>
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
      </header>
      <main className="main">
        <section className="editorPane" aria-label="Input editor">
          <div className="editorWrapper">
            {/* Зеркало под textarea: рисует текст с подсветкой ошибок (п. 4.1),
                сама textarea прозрачна, виден только каретка и выделение. */}
            <pre className="editorMirror" aria-hidden ref={mirrorRef}>
              {segments.map((segment, index) =>
                segment.hasError ? (
                  <span key={index} className="errorHighlight">
                    {segment.text}
                  </span>
                ) : (
                  segment.text
                )
              )}
            </pre>
            <textarea
              ref={textareaRef}
              className="textarea"
              aria-label="Input data"
              value={input}
              spellCheck={false}
              wrap="off"
              onChange={event => handleInputChange(event.target.value)}
              onScroll={syncMirrorScroll}
            />
          </div>
          {bannerText && (
            <div className="errorBanner" role="alert">
              {bannerText}
            </div>
          )}
        </section>
        <section className="canvasPane" aria-label="Graph canvas">
          <JSONCrack ref={canvasRef} json={json} theme={theme} />
        </section>
      </main>
    </div>
  );
}
