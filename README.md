# JSON-Xray

Portable Windows desktop app for interactive JSON/YAML/XML/CSV visualization, formatting, conversion and export.

JSON-Xray renders JSON, YAML, XML and CSV as an interactive graph you can explore, format, validate, convert and export. It is built with Tauri (Rust + system WebView2) and React + TypeScript (Vite), with jsoncrack-react as the canvas engine.

![JSON-Xray screenshot](docs/screenshot.png)

## Download

1. Download the latest `json-xray-vX.Y.Z-portable-win64.exe` from [GitHub Releases](../../releases).
2. Put it in any folder — it is a single self-contained executable: no installer, no admin rights, no external DLLs.
3. Run it.

Optional: to add JSON-Xray to the Explorer "Open with" menu for `.json` and other supported files, keep the executable named `json-xray.exe` and double-click `json-xray-install.reg` from `apps/desktop/portable/` (undo with `json-xray-uninstall.reg`; see the README in that folder for details).

## Features

- Interactive graph for JSON, YAML, XML and CSV
- Zoom and pan
- Collapsible nodes
- Dark and light theme
- Formatting (pretty-print) and validation with error highlighting
- Conversion between JSON, YAML, XML and CSV
- Graph export to PNG, JPEG and SVG
- Open and save files via native dialogs
- Drag-and-drop files into the window
- Fully local data processing — no network access

## Platform

- **Windows 11 only.** The WebView2 runtime is taken from the operating system, so Windows 10 is not supported.

## Build

Prerequisites: Node.js >= 24, pnpm >= 10, Rust toolchain (stable, MSVC target).

```sh
pnpm install

# development
cd apps/desktop
pnpm tauri dev

# production build: single portable exe, no installer bundle
pnpm tauri build --no-bundle
```

The resulting executable is written to `apps/desktop/src-tauri/target/release/desktop.exe`. It is fully portable and can be renamed and shipped as is.

## Privacy

All data is processed locally on your machine. JSON-Xray makes no network requests and collects no telemetry — your files never leave your computer.

## Credits

Visualization engine powered by the open-source jsoncrack-react package (MIT).

## License

Distributed under the MIT license. See [`LICENSE`](LICENSE.md) for details.
