/**
 * Тема приложения (Фаза 3, п. 3.4 roadmap).
 * Тип переиспользуется из `jsoncrack-react` (CanvasThemeMode), чтобы тема
 * приложения и темы канваса всегда совпадали.
 */
import type { CanvasThemeMode } from "jsoncrack-react";

export type AppTheme = CanvasThemeMode;

export const toggleTheme = (theme: AppTheme): AppTheme => (theme === "dark" ? "light" : "dark");
