/**
 * Минимальная диагностическая страница (отладка «вечного спиннера» в Tauri).
 * Рендерит только <JSONCrack> на фиксированных 500px — изолирует канвас от
 * тулбара, валидации, файловых диалогов и маршрутизации. Дополнительно
 * выводит на экран CSP-нарушения и необработанные ошибки: в release-сборке
 * devtools выключены (tauri без feature "devtools"), поэтому без этого
 * репортёра ошибки воркеров/CSP в упакованном приложении просто не видны.
 *
 * Как включить: «?minimal» в URL (pnpm dev:desktop → http://localhost:1420/?minimal)
 * или собрать с VITE_MINIMAL=1 (powershell: $env:VITE_MINIMAL="1"; pnpm build:desktop).
 */
import { useCallback, useEffect, useState } from "react";
import { JSONCrack } from "jsoncrack-react";

const MINIMAL_JSON = `{"a":1}`;

export default function MinimalCanvas() {
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const append = useCallback((line: string) => {
    setDiagnostics(prev => (prev.includes(line) ? prev : [...prev, line]));
  }, []);

  useEffect(() => {
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      append(`CSP: ${event.violatedDirective} заблокировал ${event.blockedURI}`);
    };
    const onError = (event: ErrorEvent) => {
      append(`error: ${event.message}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      append(`unhandled rejection: ${String(event.reason)}`);
    };
    document.addEventListener("securitypolicyviolation", onViolation);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      document.removeEventListener("securitypolicyviolation", onViolation);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [append]);

  return (
    <div style={{ fontFamily: "monospace", padding: 8 }}>
      {/* Обёртка с ЯВНОЙ высотой: jsoncrack-react растягивается на 100% родителя. */}
      <div data-testid="minimal-canvas" style={{ height: 500, border: "1px solid #3c3c3c" }}>
        <JSONCrack json={MINIMAL_JSON} />
      </div>
      <p style={{ color: "#9da0a6" }}>
        Minimal canvas 500px. Если граф ниже отрисован — канвас исправен, проблема
        в обвязке приложения. Диагностика:
      </p>
      <pre
        data-testid="minimal-diagnostics"
        style={{ color: "#f66", whiteSpace: "pre-wrap", margin: 0 }}
      >
        {diagnostics.length > 0 ? diagnostics.join("\n") : "— ошибок не зафиксировано —"}
      </pre>
    </div>
  );
}
