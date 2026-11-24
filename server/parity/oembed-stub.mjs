#!/usr/bin/env node
// The provider stub of the operator gates (B7): both servers' oEmbed requests
// (Next through oembed-intercept.mjs, Axum through AXUM_TEST_OEMBED_ORIGIN)
// come here under `/<host><path>`. YouTube's oEmbed answers a fixed title,
// a video ID of "b7gone" an error; every other provider 404.
//
//   node server/parity/oembed-stub.mjs [port]     # default 3640
import http from "node:http";

const port = Number(process.argv[2] ?? 3640);
const json = (response, status, value) => response.writeHead(status, { "content-type": "application/json" }).end(value === undefined ? "" : JSON.stringify(value));

http
  .createServer((request, response) => {
    const url = new URL(request.url, "http://stub");
    const [, host, ...rest] = url.pathname.split("/");
    if (host === "www.youtube.com" && rest.join("/") === "oembed") {
      const video = url.searchParams.get("url") ?? "";
      if (video.includes("b7gone")) return json(response, 404);
      return json(response, 200, { title: " B7 스텁 영상 ", author_name: "B7 채널", html: "<iframe>" });
    }
    return json(response, 404);
  })
  .listen(port, "127.0.0.1", () => console.log(`oembed stub on http://127.0.0.1:${port}`));
