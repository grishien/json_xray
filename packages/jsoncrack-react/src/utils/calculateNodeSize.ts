import { isColorFormat } from "./colorFormat";

const NODE_DIMENSIONS = {
  ROW_HEIGHT: 30,
  PARENT_HEIGHT: 36,
} as const;

// .collapseButton in Node.module.css: 14px width + 2x1px border + 6px right margin
const COLLAPSE_BUTTON_WIDTH = 22;

// .colorPreview in TextRenderer.module.css: 12px width + 2x1px border + 4px flex gap
const COLOR_PREVIEW_WIDTH = 18;

// Must match .foreignObject in Node.module.css
const NODE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export type NodeTextRow = [string, string, boolean?];
type Text = number | string | NodeTextRow[];
type Size = { width: number; height: number };
type Line = { text: string; extraWidth: number };

const CACHE_TTL_MS = 120_000;
const sizeCache = new Map<string, Size>();
let lastCacheClearAt = Date.now();

const calculateLines = (text: Text): Line[] => {
  if (Array.isArray(text)) {
    return text.map(([k, v, hasCollapseButton]) => {
      let extraWidth = hasCollapseButton ? COLLAPSE_BUTTON_WIDTH : 0;
      if (isColorFormat(v)) extraWidth += COLOR_PREVIEW_WIDTH;

      return {
        text: `${k}: ${v.slice(0, 80)}`,
        extraWidth,
      };
    });
  }

  return `${text}`.split("\n").map(line => ({ text: line, extraWidth: 0 }));
};

const fallbackSize = (lines: Line[], single: boolean): Size => {
  const longestLine = lines.reduce(
    (max, line) => Math.max(max, line.text.length * 8 + line.extraWidth),
    0
  );

  return {
    width: Math.min(700, Math.max(45, longestLine + 24)),
    height: single ? NODE_DIMENSIONS.PARENT_HEIGHT : lines.length * NODE_DIMENSIONS.ROW_HEIGHT,
  };
};

const calculateWidthAndHeight = (lines: Line[], single = false): Size => {
  if (lines.every(line => !line.text)) return { width: 45, height: 45 };

  if (typeof document === "undefined") {
    return fallbackSize(lines, single);
  }

  const dummyElement = document.createElement("div");
  dummyElement.style.position = "absolute";
  dummyElement.style.visibility = "hidden";
  dummyElement.style.pointerEvents = "none";
  dummyElement.style.fontSize = "12px";
  dummyElement.style.width = "fit-content";
  dummyElement.style.padding = "0 10px";
  dummyElement.style.fontWeight = "500";
  dummyElement.style.fontFamily = NODE_FONT_FAMILY;

  for (const line of lines) {
    const lineElement = document.createElement("div");
    lineElement.style.whiteSpace = "nowrap";
    lineElement.style.width = "fit-content";
    if (line.extraWidth > 0) lineElement.style.paddingRight = `${line.extraWidth}px`;
    lineElement.textContent = line.text;
    dummyElement.appendChild(lineElement);
  }

  document.body.appendChild(dummyElement);
  const clientRect = dummyElement.getBoundingClientRect();

  const width = clientRect.width + 4;
  const height = single ? NODE_DIMENSIONS.PARENT_HEIGHT : lines.length * NODE_DIMENSIONS.ROW_HEIGHT;

  document.body.removeChild(dummyElement);
  return { width, height };
};

const maybeClearCache = () => {
  if (Date.now() - lastCacheClearAt < CACHE_TTL_MS) return;
  sizeCache.clear();
  lastCacheClearAt = Date.now();
};

export const calculateNodeSize = (text: Text, isParent = false) => {
  maybeClearCache();

  const cacheKey = `${JSON.stringify(text)}-${isParent}`;

  const cached = sizeCache.get(cacheKey);
  if (cached) return cached;

  const lines = calculateLines(text);
  const sizes = calculateWidthAndHeight(lines, typeof text === "string");

  if (isParent) sizes.width += 80;
  if (sizes.width > 700) sizes.width = 700;

  sizeCache.set(cacheKey, sizes);
  return sizes;
};
