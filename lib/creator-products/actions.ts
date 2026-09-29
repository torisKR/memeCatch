"use server";

import { revalidatePath } from "next/cache";
import {
  moderateCreatorProduct as moderate,
  submitCreatorProduct as submit,
  updateCreatorProduct as update,
} from "./server";
import type { CreatorProductInput } from "./index";

export async function submitCreatorProduct(input: CreatorProductInput) {
  const result = await submit(input);
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath("/products/mine");
    revalidatePath("/admin/creator-products");
  }
  return result;
}

export async function updateCreatorProduct(id: string, input: CreatorProductInput) {
  const result = await update(id, input);
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath("/products/mine");
    revalidatePath("/admin/creator-products");
  }
  return result;
}

export async function moderateCreatorProduct(
  id: string,
  decision: "approved" | "rejected",
  reason: string,
) {
  const result = await moderate(id, decision, reason);
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath("/products/mine");
    revalidatePath("/admin/creator-products");
  }
  return result;
}
