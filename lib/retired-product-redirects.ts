import { NextResponse } from "next/server";

export function redirectRetiredProduct(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/", request.url), 308);
}
