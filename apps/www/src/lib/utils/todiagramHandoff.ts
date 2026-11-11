import type { FileFormat } from "../../enums/file.enum";

export const TODIAGRAM_ORIGIN = "https://todiagram.com";

// `source=jsoncrack` tells ToDiagram to expect the document over window.opener.
export const getToDiagramEditorUrl = ({
  medium,
  format,
}: {
  medium: string;
  format: FileFormat;
}): string =>
  `${TODIAGRAM_ORIGIN}/editor?utm_source=jsoncrack&utm_medium=${medium}&source=jsoncrack&format=${format}`;

interface OpenInToDiagramOptions {
  url: string;
  content: string;
  format: FileFormat;
  timeoutMs?: number;
}

/**
 * Opens ToDiagram in a new tab and, once it posts `handoff-ready`, sends the
 * document over `postMessage`. Returns `false` if the popup was blocked.
 */
export const openInToDiagram = ({
  url,
  content,
  format,
  // Generous: ToDiagram only announces itself after its editor has hydrated,
  // which can take a while on a cold load.
  timeoutMs = 90_000,
}: OpenInToDiagramOptions): boolean => {
  // Deliberately no "noopener": the new tab needs window.opener to reach us.
  // ToDiagram severs the link itself right after the document lands.
  const child = window.open(url, "_blank");
  if (!child) return false;

  let timer: number | null = null;

  const stop = () => {
    window.removeEventListener("message", onMessage);
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== child || event.origin !== TODIAGRAM_ORIGIN) return;

    const data = event.data;
    if (!data || data.source !== "todiagram" || data.type !== "handoff-ready") return;

    child.postMessage(
      { source: "jsoncrack", type: "handoff-load", content, format },
      TODIAGRAM_ORIGIN
    );
    stop();
  };

  window.addEventListener("message", onMessage);
  timer = window.setTimeout(stop, timeoutMs);

  return true;
};
