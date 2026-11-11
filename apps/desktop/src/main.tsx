import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import MinimalCanvas from "./MinimalCanvas";
// Тема/стили канваса из jsoncrack-react, затем — глобальные стили приложения.
import "jsoncrack-react/style.css";
import "./index.css";

// Диагностический режим минимального канваса: «?minimal» в URL или сборка
// с VITE_MINIMAL=1 (см. MinimalCanvas.tsx). В обычном режиме — приложение.
const isMinimal =
  import.meta.env.VITE_MINIMAL === "1" ||
  new URLSearchParams(window.location.search).has("minimal");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isMinimal ? <MinimalCanvas /> : <App />}
  </React.StrictMode>
);
