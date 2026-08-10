// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlusOutcomeReceiptForm } from "@/components/premium/plus-outcome-receipt-form";
import { PLUS_OUTCOME_COPY } from "@/lib/plus-outcome-copy";

const item = {
  memeId: "11111111-1111-4111-8111-111111111111",
  locale: "en" as const,
  title: "Integrity fixture",
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "receipt_conflict" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PlusOutcomeReceiptForm", () => {
  it("explains a semantic retry conflict without calling the saved callback", async () => {
    const onSaved = vi.fn();

    render(
      <PlusOutcomeReceiptForm
        item={item}
        copy={PLUS_OUTCOME_COPY.en.receipt}
        defaultChannel="threads"
        defaultArtifactKind="creator_pack"
        compact
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("Post URL", { exact: false }), {
      target: { value: "https://example.com/integrity" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete & save receipt" }));

    expect(await screen.findByText(PLUS_OUTCOME_COPY.en.receipt.conflict)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
