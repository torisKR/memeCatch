import { redirectRetiredProduct } from "@/lib/retired-product-redirects";

export function GET(): Response {
  return redirectRetiredProduct();
}
