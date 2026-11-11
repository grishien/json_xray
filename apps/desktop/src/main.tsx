import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Тема/стили канваса из jsoncrack-react, затем — глобальные стили приложения.
import "jsoncrack-react/style.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
