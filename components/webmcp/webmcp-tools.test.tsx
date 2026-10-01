// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { AdminWebMcpTools } from "./admin-tools";
import { PublicWebMcpTools } from "./public-tools";

afterEach(() => cleanup());

describe("WebMCP progressive enhancement", () => {
  it("keeps public and admin pages usable when document.modelContext is unsupported", () => {
    expect(document.modelContext).toBeUndefined();
    expect(() => render(<><PublicWebMcpTools /><AdminWebMcpTools /></>)).not.toThrow();
  });
});
