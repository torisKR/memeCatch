import { redirectRetiredProduct } from "@/lib/retired-product-redirects";

export function GET(request: Request): Response {
  return redirectRetiredProduct(request);
}
