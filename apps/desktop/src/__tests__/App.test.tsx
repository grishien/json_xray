/**
 * Тесты проводки App → jsoncrack-react (Фаза 3).
 * Канвас замокан на границе пакета (тяжёлый ELK-лейаут не работает в jsdom),
 * вся остальная логика — реальная: парсинг через contentToJson, состояние,
 * тема, вызовы ref-методов канваса.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const canvasState = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  collapseAll: vi.fn(),
  expandAll: vi.fn(),
}));

vi.mock("jsoncrack-react", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const JSONCrack = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    canvasState.props = props;
    useImperativeHandle(
      ref,
      () => ({
        collapseAll: canvasState.collapseAll,
        expandAll: canvasState.expandAll,
      }),
      []
    );
    return (
      <div
        data-testid="canvas-mock"
        data-theme={String(props.theme)}
        data-json={String(props.json)}
      />
    );
  });
  return { JSONCrack };
});

import App, { SAMPLE_INPUT } from "../App";

afterEach(cleanup);
beforeEach(() => {
  canvasState.props = null;
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders the canvas with the default sample in dark theme", () => {
    render(<App />);
    const canvas = screen.getByTestId("canvas-mock");
    expect(canvas.getAttribute("data-theme")).toBe("dark");
    expect(canvas.getAttribute("data-json")).toBe(SAMPLE_INPUT);
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe("dark");
  });

  it("parses YAML input through contentToJson and passes JSON to the canvas", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input format"), { target: { value: "yaml" } });
    fireEvent.change(screen.getByLabelText("Input data"), {
      target: { value: "name: yaml-xray\ncount: 7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual({
        name: "yaml-xray",
        count: 7,
      });
    });
  });

  it("parses CSV input into an array of rows", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input format"), { target: { value: "csv" } });
    fireEvent.change(screen.getByLabelText("Input data"), {
      target: { value: "id,label\n1,alpha\n2,beta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("canvas-mock").getAttribute("data-json")!)).toEqual([
        { id: 1, label: "alpha" },
        { id: 2, label: "beta" },
      ]);
    });
  });

  it("shows an error banner on invalid input and keeps the previous graph", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Input data"), { target: { value: "{invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Visualize" }));

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toBeTruthy();
    // Предыдущий успешный граф не заменяется ошибочным вводом.
    expect(screen.getByTestId("canvas-mock").getAttribute("data-json")).toBe(SAMPLE_INPUT);
  });

  it("toggles dark/light theme for both the app chrome and the canvas", () => {
    render(<App />);
    expect(screen.getByTestId("canvas-mock").getAttribute("data-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
    expect(screen.getByTestId("canvas-mock").getAttribute("data-theme")).toBe("light");
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(screen.getByTestId("canvas-mock").getAttribute("data-theme")).toBe("dark");
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe("dark");
  });

  it("delegates collapse/expand to the canvas ref methods", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(canvasState.collapseAll).toHaveBeenCalledTimes(1);
    expect(canvasState.expandAll).toHaveBeenCalledTimes(1);
  });
});
