// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreatorProduct } from "@/lib/creator-products";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  submitCreatorProduct: vi.fn(),
  updateCreatorProduct: vi.fn(),
  uploadCreatorProductImage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/lib/creator-products/actions", () => ({
  submitCreatorProduct: mocks.submitCreatorProduct,
  updateCreatorProduct: mocks.updateCreatorProduct,
}));

vi.mock("@/lib/creator-products/upload", () => ({
  uploadCreatorProductImage: mocks.uploadCreatorProductImage,
}));

import { CreatorProductForm } from "./creator-product-form";

const uploadedPath = "creator-products/owner-1/image.png";
const product: CreatorProduct = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "owner-1",
  title: "기존 상품",
  description: "기존 상품 설명입니다.",
  external_url: "https://shop.example.com/existing",
  image_path: "creator-products/owner-1/existing.png",
  price: 12_000,
  category: "apparel",
  relationship_disclosure: "creator",
  moderation_status: "approved",
  rejection_reason: null,
  created_at: "2026-09-20T00:00:00.000Z",
  updated_at: "2026-09-20T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function uploadImage(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(
    screen.getByLabelText("상품 이미지"),
    new File(["image"], "product.png", { type: "image/png" }),
  );
  expect(await screen.findByText("이미지 준비 완료")).toBeTruthy();
}

async function fillCreateFields(
  user: ReturnType<typeof userEvent.setup>,
  options: { title?: string; acceptRights?: boolean } = {},
) {
  const title = "title" in options ? options.title ?? "" : "테스트 상품";
  if (title) await user.type(screen.getByLabelText(/상품 이름/), title);
  await user.type(screen.getByLabelText(/상품 설명/), "테스트 상품 설명입니다.");
  await user.type(screen.getByLabelText(/상품을 볼 수 있는 주소/), "https://shop.example.com/item");
  await user.type(screen.getByLabelText(/^가격/), "19000");
  await user.selectOptions(screen.getByLabelText("상품 종류"), "prints");
  await user.selectOptions(screen.getByLabelText("홍보 관계 공개"), "creator");
  if (options.acceptRights !== false) {
    await user.click(screen.getByRole("checkbox", { name: /게시 권한/ }));
  }
}

describe("CreatorProductForm", () => {
  it("submits the valid create payload and navigates to the owner's products", async () => {
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: true, path: uploadedPath });
    mocks.submitCreatorProduct.mockResolvedValue({ ok: true, data: { id: product.id } });
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await uploadImage(user);
    await fillCreateFields(user);
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));

    await waitFor(() => {
      expect(mocks.submitCreatorProduct).toHaveBeenCalledWith({
        title: "테스트 상품",
        description: "테스트 상품 설명입니다.",
        externalUrl: "https://shop.example.com/item",
        imagePath: uploadedPath,
        price: "19000",
        category: "prints",
        relationshipDisclosure: "creator",
        rightsAccepted: true,
      });
    });
    expect(await screen.findByText("상품을 접수했어요. 검토가 끝나면 공개돼요.")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith("/products/mine");
    const submitButton = screen.getByRole("button", { name: "검토 요청하기" }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    await user.click(submitButton);
    expect(mocks.submitCreatorProduct).toHaveBeenCalledOnce();
  });

  it("keeps an invalid field from reaching the authenticated action", async () => {
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: true, path: uploadedPath });
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await uploadImage(user);
    await fillCreateFields(user, { title: "" });
    const title = screen.getByLabelText(/상품 이름/) as HTMLInputElement;
    expect(title.checkValidity()).toBe(false);
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));

    expect(mocks.submitCreatorProduct).not.toHaveBeenCalled();
  });

  it("requires rights acceptance before calling the authenticated action", async () => {
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: true, path: uploadedPath });
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await uploadImage(user);
    await fillCreateFields(user, { acceptRights: false });
    const rights = screen.getByRole("checkbox", { name: /게시 권한/ }) as HTMLInputElement;
    expect(rights.checkValidity()).toBe(false);
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));

    expect(mocks.submitCreatorProduct).not.toHaveBeenCalled();
  });

  it("shows upload failure without enabling submission", async () => {
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: false, error: "이미지 업로드 실패" });
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await user.upload(
      screen.getByLabelText("상품 이미지"),
      new File(["bad"], "bad.png", { type: "image/png" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain("이미지 업로드 실패");
    expect(screen.queryByText("이미지 준비 완료")).toBeNull();
    expect((screen.getByRole("button", { name: "검토 요청하기" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("recovers when the upload transport throws", async () => {
    mocks.uploadCreatorProductImage.mockRejectedValue(new Error("upload transport unavailable"));
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await user.upload(
      screen.getByLabelText("상품 이미지"),
      new File(["image"], "product.png", { type: "image/png" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain("상품 이미지 업로드에 실패했어요");
    expect(screen.queryByText("이미지를 올리고 있어요…")).toBeNull();
    expect((screen.getByRole("button", { name: "검토 요청하기" }) as HTMLButtonElement).disabled).toBe(true);

    mocks.uploadCreatorProductImage.mockResolvedValueOnce({ ok: true, path: uploadedPath });
    await user.upload(
      screen.getByLabelText("상품 이미지"),
      new File(["retry"], "retry.png", { type: "image/png" }),
    );
    expect(await screen.findByText("이미지 준비 완료")).toBeTruthy();
  });

  it("shows upload progress and enables submission only after upload success", async () => {
    const upload = deferred<{ ok: true; path: string }>();
    mocks.uploadCreatorProductImage.mockReturnValue(upload.promise);
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    const uploading = user.upload(
      screen.getByLabelText("상품 이미지"),
      new File(["image"], "product.png", { type: "image/png" }),
    );
    expect(await screen.findByText("이미지를 올리고 있어요…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "검토 요청하기" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => upload.resolve({ ok: true, path: uploadedPath }));
    await uploading;
    expect(await screen.findByText("이미지 준비 완료")).toBeTruthy();
    expect((screen.getByRole("button", { name: "검토 요청하기" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables submission while the create action is pending", async () => {
    const submission = deferred<{ ok: true; data: { id: string } }>();
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: true, path: uploadedPath });
    mocks.submitCreatorProduct.mockReturnValue(submission.promise);
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await uploadImage(user);
    await fillCreateFields(user);
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));

    const pendingButton = await screen.findByRole("button", { name: "접수 중…" });
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    await act(async () => submission.resolve({ ok: true, data: { id: product.id } }));
    expect(await screen.findByText("상품을 접수했어요. 검토가 끝나면 공개돼요.")).toBeTruthy();
  });

  it("shows authenticated action validation failures without navigating", async () => {
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: true, path: uploadedPath });
    mocks.submitCreatorProduct.mockResolvedValue({ ok: false, error: "상품 이름은 2~120자로 입력해 주세요." });
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await uploadImage(user);
    await fillCreateFields(user);
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));

    expect((await screen.findByRole("alert")).textContent).toContain("상품 이름은 2~120자로 입력해 주세요.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("recovers when the create action transport throws", async () => {
    mocks.uploadCreatorProductImage.mockResolvedValue({ ok: true, path: uploadedPath });
    mocks.submitCreatorProduct.mockRejectedValue(new Error("action transport unavailable"));
    const user = userEvent.setup();
    render(<CreatorProductForm />);

    await uploadImage(user);
    await fillCreateFields(user);
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));

    expect((await screen.findByRole("alert")).textContent).toContain("요청을 처리하지 못했어요");
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "검토 요청하기" }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

    mocks.submitCreatorProduct.mockResolvedValueOnce({ ok: true, data: { id: product.id } });
    await user.click(screen.getByRole("button", { name: "검토 요청하기" }));
    await waitFor(() => expect(mocks.submitCreatorProduct).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("상품을 접수했어요. 검토가 끝나면 공개돼요.")).toBeTruthy();
    expect(mocks.push).toHaveBeenCalledWith("/products/mine");
  });

  it("uses update rather than create for an existing product", async () => {
    mocks.updateCreatorProduct.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CreatorProductForm product={product} />);

    expect(screen.getByText("이미지 준비 완료")).toBeTruthy();
    await user.clear(screen.getByLabelText(/상품 이름/));
    await user.type(screen.getByLabelText(/상품 이름/), "수정 상품");
    await user.click(screen.getByRole("checkbox", { name: /게시 권한/ }));
    await user.click(screen.getByRole("button", { name: "수정 내용 검토 요청" }));

    await waitFor(() => {
      expect(mocks.updateCreatorProduct).toHaveBeenCalledWith(product.id, {
        title: "수정 상품",
        description: product.description,
        externalUrl: product.external_url,
        imagePath: product.image_path,
        price: String(product.price),
        category: product.category,
        relationshipDisclosure: product.relationship_disclosure,
        rightsAccepted: true,
      });
    });
    expect(mocks.submitCreatorProduct).not.toHaveBeenCalled();
  });
});
