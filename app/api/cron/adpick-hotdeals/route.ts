import { retiredProductJson } from "@/lib/retired-products";

export function GET(): Response {
  return retiredProductJson();
}

export function POST(): Response {
  return retiredProductJson();
}
