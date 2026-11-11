# json_xray — Desktop (Tauri + React + TypeScript)

Tauri-обёртка MVP «JSON Xray» (см. [roadmap.md](../../roadmap.md) и
[docs/mvp-features.md](../../docs/mvp-features.md)). Создана в рамках **Фазы 2**
через `create-tauri-app` (шаблон `react-ts`, сборщик Vite).

## Структура

```
apps/desktop/
├── src/                  # Фронтенд (React + TypeScript, сборка через Vite)
│   ├── components/       # UI-компоненты приложения
│   ├── hooks/            # Переиспользуемые React-хуки
│   ├── lib/              # Утилиты и логика, переносимая из JSON Crack
│   ├── App.tsx           # Корневой компонент (каркас: пустое окно)
│   └── main.tsx          # Точка входа
├── src-tauri/            # Rust-часть Tauri (окно, будущая нативная интеграция)
│   ├── src/lib.rs        # Настройка Builder'а Tauri
│   ├── src/main.rs       # Точка входа бинаря
│   ├── capabilities/     # Разрешения (capabilities) Tauri v2
│   └── tauri.conf.json   # Конфигурация приложения (productName: json-xray)
├── public/               # Статические файлы
└── vite.config.ts        # Конфигурация Vite (порт 1420, интеграция с Tauri)
```

## Переиспользование кода JSON Crack

- Канвас визуализации — workspace-пакет [`packages/jsoncrack-react`](../../packages/jsoncrack-react)
  (подключается в Фазе 3, п. 3.1, как зависимость `"jsoncrack-react": "workspace:*"`).
- Утилиты парсинга/конвертации форматов — портируются из
  [`apps/www`](../../apps/www) в `src/lib/` (Фазы 3–4).
- Приложение является членом pnpm-workspace (`apps/*`) и собирается через
  общий Turborepo (`turbo.json`).

## Команды

Из корня репозитория:

```sh
# Dev-режим: Vite + окно Tauri (пустое окно каркаса)
pnpm dev:desktop

# Продакшн-сборка фронтенда (tsc + vite build)
pnpm build:desktop
```

Из `apps/desktop`:

```sh
pnpm dev          # только Vite dev-сервер (без окна)
pnpm build        # tsc + vite build
pnpm tauri dev    # окно Tauri + Vite (аналог pnpm dev:desktop из корня)
pnpm tauri build --no-bundle  # portable exe (Фаза 6)
```

## Требования

Windows 11 (WebView2 Runtime из системы), см. корневой README.
