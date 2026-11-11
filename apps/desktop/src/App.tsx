/**
 * Основное окно приложения (Фаза 3 roadmap).
 * Слева — ввод данных (JSON/YAML/XML/CSV), справа — интерактивный канвас
 * из пакета `jsoncrack-react`: зум, панорамирование, раскрытие/сворачивание
 * узлов (п. 3.1, 3.3), тема переключается тёмная/светлая (п. 3.4).
 */
import { useCallback, useRef, useState } from "react";
import { JSONCrack } from "jsoncrack-react";
import type { JSONCrackRef } from "jsoncrack-react";
import { FileFormat, formats } from "./lib/formats";
import { contentToJson } from "./lib/parse";
import { toggleTheme, type AppTheme } from "./lib/theme";

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

export default function App() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [format, setFormat] = useState<FileFormat>(FileFormat.JSON);
  const [json, setJson] = useState(SAMPLE_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const canvasRef = useRef<JSONCrackRef>(null);

  const handleVisualize = useCallback(async () => {
    try {
      const data = await contentToJson(input, format);
      setJson(JSON.stringify(data, null, 2));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [input, format]);

  const handleThemeToggle = useCallback(() => setTheme(toggleTheme), []);

  return (
    <div className="app" data-theme={theme}>
      <header className="toolbar">
        <span className="toolbarTitle">JSON Xray</span>
        <select
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
          <textarea
            className="textarea"
            aria-label="Input data"
            value={input}
            spellCheck={false}
            onChange={event => setInput(event.target.value)}
          />
          {error && (
            <div className="errorBanner" role="alert">
              {error}
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
