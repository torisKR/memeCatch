#!/usr/bin/env node
// Writes the cases server/src/routes/multipart.rs is held to: what
// `new Request(...).formData()` of Node 22 (undici 6), which the Next image
// (node:22-bookworm-slim) runs and the upload routes use through
// lib/request-body.ts, makes of each body.
//
//   <node 22> server/parity/multipart-fixture.mjs > server/tests/fixtures/multipart.json
//
// It refuses to run on another major version: Node 24 and 26 parse some of
// these bodies differently.
//
// Each case is a Content-Type header, a body (base64) and either `error: true`
// (formData() throws) or the entries in order: a text field has `value`, a
// file has `type`, `size` and `filename`.
if (process.versions.node.split(".")[0] !== "22") {
  throw new Error(`run this on Node 22, not ${process.versions.node}`);
}
const CRLF = "\r\n";
const B = "----axumboundary123";
const part = (headers, content) => `--${B}${CRLF}${headers.join(CRLF)}${CRLF}${CRLF}${content}${CRLF}`;
const file = (extra = "", content = "PNGDATA") => part([`Content-Disposition: form-data; name="file"; filename="a.png"`, ...(extra ? [extra] : [])], content);
const field = (name, value) => part([`Content-Disposition: form-data; name="${name}"`], value);
const end = `--${B}--${CRLF}`;
const multipart = `multipart/form-data; boundary=${B}`;
const bytes = (...chunks) => Buffer.concat(chunks.map((chunk) => (typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk)));

const cases = [
  ["a browser's body", multipart, field("rightsDeclaration", '{"accepted":true}') + file("Content-Type: image/png") + end],
  ["a file without a content type", multipart, file() + end],
  ["a content type in upper case", multipart, file("Content-Type: IMAGE/PNG") + end],
  ["a content type with a parameter", multipart, file("Content-Type: image/png; charset=binary") + end],
  ["a content type that is not ascii", multipart, bytes(file("Content-Type: image/pñg") + end)],
  ["an empty filename", multipart, part([`Content-Disposition: form-data; name="file"; filename=""`, "Content-Type: application/octet-stream"], "") + end],
  ["a field named file", multipart, field("file", "not a file") + end],
  ["two files named file", multipart, file("Content-Type: image/png", "first") + file("Content-Type: image/gif", "second") + end],
  ["a text field after the file", multipart, file("Content-Type: image/png") + field("sourceId", "x") + end],
  ["a quoted boundary", `multipart/form-data; boundary="${B}"`, file("Content-Type: image/png") + end],
  ["no boundary", "multipart/form-data", file("Content-Type: image/png") + end],
  ["another boundary", "multipart/form-data; boundary=other", file("Content-Type: image/png") + end],
  ["a charset before the boundary", `multipart/form-data; charset=utf-8; boundary=${B}`, file("Content-Type: image/png") + end],
  ["the media type in upper case", `Multipart/Form-Data; boundary=${B}`, file("Content-Type: image/png") + end],
  ["line feeds only", multipart, (file("Content-Type: image/png") + end).replaceAll(CRLF, "\n")],
  ["text before the first boundary", multipart, `preamble${CRLF}` + file("Content-Type: image/png") + end],
  ["a blank line before the first boundary", multipart, CRLF + file("Content-Type: image/png") + end],
  ["text after the last boundary", multipart, file("Content-Type: image/png") + end + "epilogue"],
  ["no closing boundary", multipart, file("Content-Type: image/png")],
  ["no line break after the closing boundary", multipart, file("Content-Type: image/png") + `--${B}--`],
  ["header names in lower case", multipart, part([`content-disposition: form-data; name="file"; filename="a.png"`, "content-type: image/png"], "x") + end],
  ["the filename before the name", multipart, part([`Content-Disposition: form-data; filename="a.png"; name="file"`, "Content-Type: image/png"], "x") + end],
  ["an unquoted name", multipart, part([`Content-Disposition: form-data; name=file; filename=a.png`, "Content-Type: image/png"], "x") + end],
  ["another header between", multipart, part([`Content-Disposition: form-data; name="file"; filename="a.png"`, "X-Other: 1", "Content-Type: image/png"], "x") + end],
  ["a content type before the disposition", multipart, part(["Content-Type: image/png", `Content-Disposition: form-data; name="file"; filename="a.png"`], "x") + end],
  ["no content disposition", multipart, part(["Content-Type: image/png"], "x") + end],
  ["a disposition that is not form-data", multipart, part([`Content-Disposition: attachment; name="file"; filename="a.png"`], "x") + end],
  ["content with line breaks and dashes", multipart, bytes(file("Content-Type: image/png", `a${CRLF}--${CRLF}--${B.slice(0, 8)}${CRLF}b`) + end)],
  ["binary content", multipart, bytes(part([`Content-Disposition: form-data; name="file"; filename="a.bin"`, "Content-Type: video/mp4"], ""), Buffer.from([0, 255, 13, 10, 45, 45, 0]), CRLF, end)],
  ["an empty file", multipart, file("Content-Type: image/png", "") + end],
  ["percent escapes in names", multipart, part([`Content-Disposition: form-data; name="fi%22le"; filename="a%0Ab.png"`, "Content-Type: image/png"], "x") + end],
  ["a name in Korean", multipart, field("이름", "값 ✓") + end],
  ["a text field that is not utf-8", multipart, bytes(part([`Content-Disposition: form-data; name="rightsDeclaration"`], ""), Buffer.from([0xff, 0xfe, 0x41]), CRLF, end)],
  ["a text field with a content type", multipart, part([`Content-Disposition: form-data; name="rightsDeclaration"`, "Content-Type: application/json"], '{"accepted":true}') + end],
  ["spaces after the boundary line", multipart, `--${B}  ${CRLF}` + file("Content-Type: image/png").slice(B.length + 4) + end],
  ["an empty body", multipart, ""],
  ["only the closing boundary", multipart, end],
  ["a form-urlencoded body", "application/x-www-form-urlencoded", "file=x&rightsDeclaration=%7B%22accepted%22%3Atrue%7D"],
  ["a json body", "application/json", '{"file":"x"}'],
  ["no content type", null, file("Content-Type: image/png") + end],
  ["a header line without a colon", multipart, part([`Content-Disposition: form-data; name="file"; filename="a.png"`, "broken"], "x") + end],
  ["a space before the header colon", multipart, part([`Content-Disposition : form-data; name="file"; filename="a.png"`], "x") + end],
  ["an extended filename", multipart, part([`Content-Disposition: form-data; name="file"; filename="x.png"; filename*=utf-8''a%20%EB%B0%88.png`, "Content-Type: image/png"], "x") + end],
  ["an extended filename in another charset", multipart, part([`Content-Disposition: form-data; name="file"; filename*=latin1''a.png`], "x") + end],
  ["a base64 part", multipart, part([`Content-Disposition: form-data; name="file"; filename="a.png"`, "Content-Type: image/png", "Content-Transfer-Encoding: base64"], "aGVsbG8gd29ybGQ=") + end],
  ["a base64 part with stray characters", multipart, part([`Content-Disposition: form-data; name="file"; filename="a.png"`, "Content-Transfer-Encoding: base64"], "aGVs bG8_\n-w=tail") + end],
  ["content that holds the boundary text", multipart, file("Content-Type: image/png", `before ${B} after`) + end],
  ["a disposition without a name", multipart, part([`Content-Disposition: form-data; filename="a.png"`], "x") + end],
  ["a boundary with an escaped quote", 'multipart/form-data; boundary="a\\"b"', `--a"b${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"${CRLF}${CRLF}x${CRLF}--a"b--${CRLF}`],
  ["a boundary parameter after a quoted one", `multipart/form-data; x="a;b"; boundary=${B}`, file("Content-Type: image/png") + end],
  ["a boundary followed by a space", `multipart/form-data; boundary=${B} `, file("Content-Type: image/png") + end],
  ["two boundary parameters", `multipart/form-data; boundary=${B}; boundary=other`, file("Content-Type: image/png") + end],
  ["a name with a byte order mark", multipart, bytes(`--${B}${CRLF}Content-Disposition: form-data; name="`, Buffer.from([0xef, 0xbb, 0xbf]), `file"${CRLF}${CRLF}`, Buffer.from([0xef, 0xbb, 0xbf]), `text${CRLF}`, end)],
  ["a tab after the header colon", multipart, part([`Content-Disposition:\tform-data; name="file"; filename="a.png"`, "Content-Type:\timage/png"], "x") + end],
  // Quirks of undici 6.
  ["blank lines around the body", multipart, CRLF + CRLF + file("Content-Type: image/png") + end + CRLF + CRLF],
  ["a body that stops after a boundary", multipart, file("Content-Type: image/png") + `--${B}`],
  ["a header line ended by CR and another byte", multipart, `--${B}${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"\rXContent-Type: image/png${CRLF}${CRLF}x${CRLF}${end}`],
  ["a header line ended by another byte and LF", multipart, `--${B}${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"X\nContent-Type: image/png${CRLF}${CRLF}x${CRLF}${end}`],
  ["a header line ended by LF alone", multipart, `--${B}${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"\nContent-Type: image/png${CRLF}${CRLF}x${CRLF}${end}`],
  ["an attribute after the filename", multipart, part([`Content-Disposition: form-data; name="file"; filename="a.png"; size=1`, "Content-Type: image/png"], "x") + end],
  ["an attribute between name and filename", multipart, part([`Content-Disposition: form-data; name="file"; x="1"; filename="a.png"`, "Content-Type: image/png"], "x") + end],
  ["a quoted extended filename", multipart, part([`Content-Disposition: form-data; name="file"; filename*="a.png"`, "Content-Type: image/png"], "x") + end],
  ["form-data in upper case", multipart, part([`Content-Disposition: Form-Data; name="file"; filename="a.png"`], "x") + end],
  ["two spaces after form-data", multipart, part([`Content-Disposition: form-data;  name="file"; filename="a.png"`], "x") + end],
  ["a base64 encoding in upper case", multipart, part([`Content-Disposition: form-data; name="file"; filename="a.png"`, "Content-Transfer-Encoding: BASE64"], "aGVsbG8=") + end],
  ["a text value with two byte order marks", multipart, bytes(`--${B}${CRLF}Content-Disposition: form-data; name="rightsDeclaration"${CRLF}${CRLF}`, Buffer.from([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf]), `{"accepted":true}${CRLF}`, end)],
  ["two content types joined", `text/plain, multipart/form-data; boundary=${B}`, file("Content-Type: image/png") + end],
  ["a wildcard after the content type", `multipart/form-data; boundary=${B}, */*`, file("Content-Type: image/png") + end],
  ["a json type after the content type", `multipart/form-data; boundary=${B}, application/json`, file("Content-Type: image/png") + end],
  ["a quoted comma in the content type", `multipart/form-data; x="a,b"; boundary=${B}`, file("Content-Type: image/png") + end],
  ["a boundary with a control character", `multipart/form-data; boundary="a\u0001b"`, `--a\u0001b${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"${CRLF}${CRLF}x${CRLF}--a\u0001b--${CRLF}`],
  ["a boundary with a Latin-1 letter", "multipart/form-data; boundary=ébound", bytes(`--ébound${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"${CRLF}${CRLF}x${CRLF}--ébound--${CRLF}`)],
  ["an empty quoted boundary", 'multipart/form-data; boundary=""', `--${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"${CRLF}${CRLF}x${CRLF}----${CRLF}`],
  ["a space before the boundary value", `multipart/form-data; boundary= ${B}`, file("Content-Type: image/png") + end],
  ["a boundary parameter name in upper case", `multipart/form-data; BOUNDARY=${B}`, file("Content-Type: image/png") + end],
  ["a boundary parameter without a value first", `multipart/form-data; boundary; boundary=${B}`, file("Content-Type: image/png") + end],
  ["spaces around the content type", `  multipart/form-data ; boundary=${B}  `, file("Content-Type: image/png") + end],
  ["a part that ends right after its headers", multipart, `--${B}${CRLF}Content-Disposition: form-data; name="file"; filename="a.png"${CRLF}${CRLF}`],
  ["a file part between two fields", multipart, field("a", "1") + file("Content-Type: video/webm", "abc") + field("b", "2") + end],
];

const out = [];
for (const [name, contentType, body] of cases) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  const entry = { name, contentType, body: payload.toString("base64") };
  try {
    const form = await new Request("http://localhost/", {
      method: "POST",
      headers: contentType === null ? {} : { "content-type": contentType },
      body: payload,
    }).formData();
    entry.entries = [];
    for (const [key, value] of form.entries()) {
      entry.entries.push(typeof value === "string"
        ? { name: key, value }
        : { name: key, type: value.type, size: value.size, filename: value.name });
    }
  } catch {
    entry.error = true;
  }
  out.push(entry);
}
process.stdout.write(`${JSON.stringify(out)}\n`);
