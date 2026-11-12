import { NextResponse } from "next/server";

/**
 * 308 to the home page.
 * Location is a relative path. Building it with `new URL("/", request.url)`
 * copies the bind host through the proxy (`https://0.0.0.0:3000/...`).
 */
export function redirectRetiredProduct(): NextResponse {
  return new NextResponse(null, {
    status: 308,
    headers: { Location: "/" },
  });
}
