// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HomeSearch } from "@/components/home/home-search";
import { consumeMemeIntentSubmit } from "@/lib/meme-intent-submit.client";

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("HomeSearch", () => {
  it("keeps a native GET form while marking only an explicit Korean submit", () => {
    const { container } = render(
      <HomeSearch
        locale="ko"
        action="/search"
        label="밈 검색"
        placeholder="밈 이름이나 상황으로 검색"
        button="검색"
      />,
    );
    const form = screen.getByRole("search");
    const input = screen.getByRole("searchbox");

    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/search");
    expect(container.querySelector('input[name="q"]')).toBe(input);
    expect(screen.getByText("검색어는 등록된 공개 밈 자료 안에서만 찾아요.")).toBeTruthy();
    expect(screen.queryByText(/AI 서비스/)).toBeNull();

    fireEvent.change(input, { target: { value: "친구 취향을 따라 할 때 쓰는 밈" } });
    expect(consumeMemeIntentSubmit("친구 취향을 따라 할 때 쓰는 밈", "ko")).toBe(false);
    fireEvent.submit(form);
    expect(consumeMemeIntentSubmit("친구 취향을 따라 할 때 쓰는 밈", "ko")).toBe(true);
  });

  it("does not mark non-Korean search or show the Korean catalog note", () => {
    render(
      <HomeSearch locale="en" action="/en/search" label="Search" placeholder="Search" button="Search" />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "a meme for work" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(consumeMemeIntentSubmit("a meme for work", "ko")).toBe(false);
    expect(screen.queryByText("검색어는 등록된 공개 밈 자료 안에서만 찾아요.")).toBeNull();
  });
});
