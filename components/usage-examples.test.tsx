// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageExamples } from "@/components/usage-examples";

const example = [{ situation: "일상 대화", text: "중꺾마 정신으로 끝까지 가보자고!" }];

function labelledBy(container: HTMLElement): string | null {
  return container.firstElementChild?.getAttribute("aria-labelledby") ?? null;
}

describe("UsageExamples headings", () => {
  it("points at the heading it renders", () => {
    const { container } = render(<UsageExamples examples={example} />);
    const region = container.querySelector("section");
    expect(region?.getAttribute("aria-labelledby")).toBe("usage-examples-title");
    expect(region?.querySelector("#usage-examples-title")?.textContent).toContain("이렇게 써요");
  });

  it("does not name a heading that was omitted", () => {
    const { container } = render(<UsageExamples examples={example} heading={false} />);
    expect(container.querySelector("section")).toBeNull();
    expect(container.querySelector("#usage-examples-title")).toBeNull();
    expect(labelledBy(container)).toBeNull();
    expect(container.textContent).toContain("중꺾마 정신으로 끝까지 가보자고!");
  });
});
