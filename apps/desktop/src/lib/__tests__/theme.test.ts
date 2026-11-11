import { describe, expect, it } from "vitest";
import { toggleTheme } from "../theme";

describe("toggleTheme", () => {
  it("switches dark to light", () => {
    expect(toggleTheme("dark")).toBe("light");
  });

  it("switches light to dark", () => {
    expect(toggleTheme("light")).toBe("dark");
  });
});
