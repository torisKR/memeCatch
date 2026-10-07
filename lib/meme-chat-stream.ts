import type { MemeChatProgress, MemeChatStreamEvent } from "./meme-chat";

type MemeChatError = Extract<MemeChatStreamEvent, { type: "error" }>["error"];
type ReadOptions = {
  signal: AbortSignal;
  onProgress: (progress: MemeChatProgress) => void;
};
type TerminalEvent =
  | { type: "result"; result: unknown }
  | { type: "error"; error: MemeChatError };

const MAX_RESPONSE_BYTES = 64 * 1024;

export class MemeChatStreamError extends Error {
  constructor(public readonly error: MemeChatError) {
    super("Meme chat response unavailable.");
    this.name = "MemeChatStreamError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isProgress(value: unknown): value is MemeChatProgress {
  if (!isRecord(value)) return false;
  if (value.stage === "found") {
    return hasKeys(value, ["stage", "count"])
      && typeof value.count === "number"
      && Number.isInteger(value.count)
      && value.count >= 0
      && value.count <= 4;
  }
  return hasKeys(value, ["stage"])
    && (value.stage === "reading" || value.stage === "searching" || value.stage === "answering");
}

function isChatError(value: unknown): value is MemeChatError {
  return value === "request_cancelled" || value === "request_timed_out" || value === "search_unavailable";
}

function checkCancellation(signal: AbortSignal): void {
  if (signal.aborted) throw new MemeChatStreamError("request_cancelled");
}

async function readBody(
  response: Response,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<void> {
  if (!response.body) throw new MemeChatStreamError("search_unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let completed = false;
  let cancellationRequested = false;
  const cancel = () => {
    if (cancellationRequested) return;
    cancellationRequested = true;
    // The source's cancellation promise may never settle.
    void reader.cancel().catch(() => {});
  };
  let rejectAbort!: (error: MemeChatStreamError) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => {
    cancel();
    rejectAbort(new MemeChatStreamError("request_cancelled"));
  };
  signal.addEventListener("abort", onAbort, { once: true });

  const consume = async () => {
    let bytes = 0;
    for (;;) {
      checkCancellation(signal);
      const chunk = await reader.read();
      checkCancellation(signal);
      if (chunk.done) {
        onText(decoder.decode());
        completed = true;
        return;
      }
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new MemeChatStreamError("search_unavailable");
      onText(decoder.decode(chunk.value, { stream: true }));
    }
  };

  try {
    checkCancellation(signal);
    await Promise.race([consume(), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (!completed) cancel();
    reader.releaseLock();
  }
}

export async function readMemeChatResponse(
  response: Response,
  { signal, onProgress }: ReadOptions,
): Promise<unknown> {
  try {
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/x-ndjson") {
      let json = "";
      await readBody(response, signal, (text) => { json += text; });
      checkCancellation(signal);
      return JSON.parse(json) as unknown;
    }

    let pending = "";
    let terminal: TerminalEvent | undefined;
    const readLine = (line: string) => {
      checkCancellation(signal);
      if (terminal) throw new MemeChatStreamError("search_unavailable");
      const event: unknown = JSON.parse(line);
      if (!isRecord(event)) throw new MemeChatStreamError("search_unavailable");
      if (event.type === "progress" && hasKeys(event, ["type", "progress"]) && isProgress(event.progress)) {
        try { void Promise.resolve(onProgress(event.progress)).catch(() => {}); }
        catch { /* Observation cannot invalidate a valid response. */ }
      } else if (event.type === "result" && hasKeys(event, ["type", "result"])) {
        terminal = { type: "result", result: event.result };
      } else if (event.type === "error" && hasKeys(event, ["type", "error"]) && isChatError(event.error)) {
        terminal = { type: "error", error: event.error };
      } else {
        throw new MemeChatStreamError("search_unavailable");
      }
    };

    await readBody(response, signal, (text) => {
      pending += text;
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        readLine(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        newline = pending.indexOf("\n");
      }
    });
    if (pending.length) readLine(pending);
    checkCancellation(signal);
    if (!terminal) throw new MemeChatStreamError("search_unavailable");
    if (terminal.type === "error") throw new MemeChatStreamError(terminal.error);
    return terminal.result;
  } catch (error) {
    checkCancellation(signal);
    if (error instanceof MemeChatStreamError) throw error;
    throw new MemeChatStreamError("search_unavailable");
  }
}
