import http from "node:http";

const proxyPort = Number(process.argv[2]);
const appPort = Number(process.argv[3]);

if (!proxyPort || !appPort) {
  console.error("usage: hangul-forward-proxy.mjs <proxy-port> <app-port>");
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: appPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${appPort}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
});

server.listen(proxyPort, "127.0.0.1");
