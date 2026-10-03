#!/usr/bin/env python3
"""Free local Korean embeddings; bounded indexing uses existing Supabase credentials.

Uses an installed transformers/torch environment. Does not install packages,
start other services, create tokens, or publish any content.
"""
import argparse
import json
import math
import os
import subprocess
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

PROFILE = "multilingual-e5-small-v1"
MODEL = "intfloat/multilingual-e5-small"
REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
DIMENSIONS = 384
CACHE = Path(__file__).resolve().parents[1] / ".local" / "vector-models"


def validate_vector(vector):
    return isinstance(vector, list) and len(vector) == DIMENSIONS and all(
        isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)
        for value in vector
    ) and 0.99 <= math.hypot(*vector) <= 1.01


def validate_inputs(value):
    inputs = [value] if isinstance(value, str) else value
    if not isinstance(inputs, list) or not 1 <= len(inputs) <= 4:
        raise ValueError("invalid_input")
    for text in inputs:
        if not isinstance(text, str) or not text.strip() or len(text) > 7000:
            raise ValueError("invalid_input")
        if not text.startswith(("query: ", "passage: ")) or not text.split(": ", 1)[1].strip():
            raise ValueError("missing_e5_prefix")
    return inputs


class Encoder:
    def __init__(self):
        os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
        import torch
        from transformers import AutoModel, AutoTokenizer
        torch.set_num_threads(1)
        torch.set_num_interop_threads(1)
        self.torch = torch
        settings = dict(revision=REVISION, cache_dir=str(CACHE), token=False, trust_remote_code=False)
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL, **settings)
        self.model = AutoModel.from_pretrained(MODEL, use_safetensors=True, **settings).eval().to("cpu")

    def encode(self, inputs):
        batch = self.tokenizer(validate_inputs(inputs), max_length=512, padding=True, truncation=True, return_tensors="pt")
        with self.torch.inference_mode():
            output = self.model(**batch).last_hidden_state
            mask = batch["attention_mask"].unsqueeze(-1).bool()
            pooled = output.masked_fill(~mask, 0).sum(dim=1) / batch["attention_mask"].sum(dim=1).unsqueeze(-1)
            vectors = self.torch.nn.functional.normalize(pooled, p=2, dim=1).tolist()
        if not all(validate_vector(vector) for vector in vectors):
            raise ValueError("invalid_model_output")
        return vectors


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def rpc(url, key, name, body):
    request = Request(url.rstrip("/") + "/rest/v1/rpc/" + name,
                      data=json.dumps(body).encode(), method="POST",
                      headers={"content-type": "application/json", "apikey": key, "authorization": "Bearer " + key})
    with build_opener(NoRedirect()).open(request, timeout=30) as response:
        return json.load(response)


def local_connection():
    result = subprocess.run(["supabase", "status", "--output", "json"], check=True, capture_output=True, text=True)
    status = json.loads(result.stdout)
    return status["API_URL"], status["SERVICE_ROLE_KEY"]


def index_catalog(args):
    batches = getattr(args, "batches", 1)
    if isinstance(args.limit, bool) or not isinstance(args.limit, int) or not 1 <= args.limit <= 100:
        raise ValueError("limit_must_be_1_to_100")
    if isinstance(batches, bool) or not isinstance(batches, int) or not 1 <= batches <= 100:
        raise ValueError("batches_must_be_1_to_100")
    if args.limit * batches > 10000:
        raise ValueError("indexing_row_budget_exceeded")
    if args.local:
        url, key = local_connection()
    else:
        url, key = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    target = urlparse(url)
    loopback = target.hostname in ["localhost", "127.0.0.1", "::1"]
    if not key or target.username or target.password or target.query or target.fragment:
        raise ValueError("invalid_database_configuration")
    if not loopback and (not args.allow_remote or target.scheme != "https"):
        raise ValueError("remote_indexing_requires_allow_remote")
    # Public missing/changed documents only; a keyset skips stale rows until a fresh run.
    # Successful stores are individually atomic, so failures can be resumed by rerunning.
    encoder = None
    after = None
    indexed = stale = 0
    for batch_number in range(1, batches + 1):
        body = {"p_limit": args.limit}
        if after is not None:
            body["p_after"] = after
        jobs = rpc(url, key, "list_meme_embedding_jobs", body)
        if not isinstance(jobs, list) or len(jobs) > args.limit:
            raise ValueError("invalid_embedding_jobs_response")
        batch_indexed = batch_stale = 0
        if jobs:
            if encoder is None:
                encoder = Encoder()
            for offset in range(0, len(jobs), 4):
                batch = jobs[offset:offset + 4]
                vectors = encoder.encode(["passage: " + job["document"] for job in batch])
                if not isinstance(vectors, list) or len(vectors) != len(batch):
                    raise ValueError("invalid_model_output")
                for job, vector in zip(batch, vectors):
                    stored = rpc(url, key, "store_meme_embedding", {
                        "p_meme_id": job["meme_id"], "p_source_hash": job["source_hash"], "p_embedding": vector,
                    })
                    if not isinstance(stored, bool):
                        raise ValueError("invalid_embedding_store_response")
                    batch_indexed += stored is True
                    batch_stale += stored is False
            after = jobs[-1]["meme_id"]
        indexed += batch_indexed
        stale += batch_stale
        print(json.dumps({"profile": PROFILE, "batch": batch_number,
                          "batch_indexed": batch_indexed, "batch_stale": batch_stale,
                          "indexed": indexed, "stale": stale}), flush=True)
        if not jobs:
            break


def serve(args):
    encoder = Encoder()

    @lru_cache(maxsize=64)
    def encode_one(text):
        return encoder.encode([text])[0]

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.send_header("cache-control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def allowed(self):
            return self.headers.get("Host") in [f"127.0.0.1:{args.port}", f"localhost:{args.port}"] and not self.headers.get("Origin")

        def do_GET(self):
            if not self.allowed():
                return self.respond(403, {"error": "local_server_only"})
            self.respond(200 if self.path == "/health" else 404,
                         {"model": PROFILE, "dimensions": DIMENSIONS} if self.path == "/health" else {"error": "not_found"})

        def do_POST(self):
            if not self.allowed():
                return self.respond(403, {"error": "local_server_only"})
            if self.path != "/v1/embeddings":
                return self.respond(404, {"error": "not_found"})
            try:
                length = int(self.headers.get("content-length", "-1"))
                if not 0 <= length <= 40000:
                    return self.respond(413, {"error": "body_too_large"})
                payload = json.loads(self.rfile.read(length))
                if payload.get("model") != PROFILE:
                    return self.respond(400, {"error": "model_mismatch"})
                inputs = validate_inputs(payload.get("input"))
                vectors = [encode_one(inputs[0])] if len(inputs) == 1 else encoder.encode(inputs)
            except (ValueError, TypeError, AttributeError):
                return self.respond(400, {"error": "invalid_input"})
            except Exception:
                return self.respond(503, {"error": "embedding_failed"})
            self.respond(200, {"model": PROFILE, "data": [{"index": index, "embedding": vector} for index, vector in enumerate(vectors)]})

    # Single-threaded, loopback-only: do not expose this development server to the internet.
    server = HTTPServer(("127.0.0.1", args.port), Handler)
    server.timeout = 10
    print(json.dumps({"ready": True, "model": PROFILE, "port": args.port}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    serving = commands.add_parser("serve")
    serving.add_argument("--port", type=int, default=8766)
    indexing = commands.add_parser("index")
    indexing.add_argument("--local", action="store_true")
    indexing.add_argument("--allow-remote", action="store_true")
    indexing.add_argument("--limit", type=int, default=25)
    indexing.add_argument("--batches", type=int, default=1,
                          help="maximum keyset batches (1..100); total rows are limited to 10,000")
    args = parser.parse_args()
    if args.command == "serve":
        if not 1024 <= args.port <= 65535:
            parser.error("port must be 1024..65535")
        serve(args)
    else:
        if not 1 <= args.limit <= 100:
            parser.error("limit must be 1..100")
        if not 1 <= args.batches <= 100:
            parser.error("batches must be 1..100")
        index_catalog(args)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Do not print credentials, raw provider responses, or source document text.
        raise SystemExit("embedding operation failed; check dependencies, connection and schema")
