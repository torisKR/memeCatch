#!/usr/bin/env python3
"""Bounded read-only ranking evaluation; corpus/vectors stay in an untracked cache.

Capture uses the existing production URL and a project-matching service-role key.
It reads public approved/limited metadata and search RPCs only, never writes DB
rows or starts a service. Local fixed-model inference is CPU-one-thread and
offline; ranking variants reuse query vectors. Relevance labels are provisional.
"""
import argparse
import base64
import hashlib
import importlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
import time
import unicodedata
import unittest
from urllib.parse import urlencode, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "scripts/fixtures/meme-reference-queries.json"
SNAPSHOT = Path("/tmp/memecatch-reference-search-evaluation-20261004.json")
OUTPUT = ROOT / "artifacts/vector/20261004/search-ranking-evaluation.json"
PROFILE = "multilingual-e5-small-v1"
MODEL = "intfloat/multilingual-e5-small"
REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
DIMENSIONS = 384
PUBLIC = {"approved", "limited"}
STOPWORDS = set("사람 행동 상황 하는 하는데 하고 같은 어떤 이렇게 누가 있는 없는 많이 너무 그냥 밈 추천 찾아 찾기 때 것 수 말 뜻 어떻게 정말".split())
PARTICLES = ("으로", "에서", "에게", "한테", "처럼", "까지", "부터", "보다", "라고", "하고", "와", "과", "을", "를", "은", "는", "이", "가", "의", "에", "도", "만")


def normalized(text):
    return unicodedata.normalize("NFKC", str(text or "")).lower()


def compact(text):
    return re.sub(r"\s+", "", normalized(text))


def query_tokens(query):
    result = []
    for token in re.findall(r"[^\W_]+", normalized(query)):
        if len(token) < 2 or token in STOPWORDS:
            continue
        if re.fullmatch(r"[가-힣]+", token):
            for suffix in PARTICLES:
                if token.endswith(suffix) and len(token) - len(suffix) >= 2:
                    token = token[:-len(suffix)]
                    break
        if token not in STOPWORDS and token not in result:
            result.append(token)
        if len(result) == 12:
            break
    return result


def prepare_row(row):
    names = [normalized(row.get("title")), *[normalized(alias) for alias in row.get("aliases") or []]]
    return {**row, "_names": names, "_compact_names": [re.sub(r"\s+", "", name) for name in names],
            "_summary": normalized(row.get("summary")),
            "_document": normalized(" ".join(str(row.get(field) or "")[:cap]
                                             for field, cap in [("description", 3000), ("origin", 1500), ("usage_note", 1000)]))}


def lexical_score(row, query, tokens):
    literal = compact(query)
    raw_initials = re.sub(r"\s+", "", query.lower())
    names = row["_compact_names"]
    priority = 2 if literal and literal in names else 0
    if not priority and literal and any(literal in name for name in names):
        priority = 1
    if not priority and re.fullmatch(r"[ㄱ-ㅎ]+", raw_initials) and raw_initials in str(row.get("title_chosung") or ""):
        priority = 1
    points = sum(3 * any(token in name for name in row["_names"])
                 + 2 * (token in row["_summary"])
                 + (token in row["_document"]) for token in tokens)
    coverage = points / (6 * len(tokens)) if tokens else 0.0
    return priority, coverage


def lexical_candidates(corpus, query):
    tokens = query_tokens(query)
    matches = []
    for row in corpus:
        priority, score = lexical_score(row, query, tokens)
        if priority or score > 0:
            matches.append({"id": row["id"], "priority": priority, "score": score})
    return sorted(matches, key=lambda row: (-row["priority"], -row["score"], row["id"]))[:40]


def fuse(keyword, semantic, k=60, lexical_weight=1.0, pin_names=False, original_ties=False):
    scores, priorities, positions = {}, {}, {}
    for ranking, weight in [(keyword, lexical_weight), (semantic, 1.0)]:
        seen = set()
        for index, entry in enumerate(ranking):
            item_id = entry["id"]
            if item_id in seen:
                continue
            seen.add(item_id)
            positions.setdefault(item_id, len(positions))
            scores[item_id] = scores.get(item_id, 0.0) + weight / (k + index + 1)
            priorities[item_id] = max(priorities.get(item_id, 0), entry.get("priority", 0))
    return sorted(scores, key=lambda item_id: (-priorities[item_id] if pin_names else 0,
                                               -scores[item_id], positions[item_id] if original_ties else item_id))


def query_metrics(ranking, relevant_ids):
    ranks = [index + 1 for index, item_id in enumerate(ranking) if item_id in relevant_ids]
    first = min(ranks) if ranks else None
    ideal = sum(1 / math.log2(index + 2) for index in range(min(5, len(relevant_ids))))
    dcg = sum(1 / math.log2(rank + 1) for rank in ranks if rank <= 5)
    return {"mrr_at_10": 1 / first if first is not None and first <= 10 else 0.0,
            "ndcg_at_5": dcg / ideal if ideal else 0.0,
            "recall_at_20": sum(rank <= 20 for rank in ranks) / len(relevant_ids),
            "hit_at_12": float(first is not None and first <= 12), "first_relevant_rank": first}


def validate_fixture(fixture):
    targets = fixture.get("targets", [])
    queries = fixture.get("queries", [])
    if len(targets) != 12 or len(queries) != 48:
        raise ValueError("fixture_requires_12_targets_and_48_queries")
    by_key = {target["key"]: target for target in targets}
    if len(by_key) != 12 or len({query["id"] for query in queries}) != 48:
        raise ValueError("duplicate_fixture_identity")
    for target in targets:
        if target["split"] not in {"dev", "holdout"} or not target.get("acceptable_titles"):
            raise ValueError("invalid_target")
        group = [query for query in queries if query["target"] == target["key"]]
        if len(group) != 4 or any(query["split"] != target["split"] for query in group):
            raise ValueError("target_split_leakage")
    if any(len([query for query in queries if query["split"] == split]) != 24 for split in ["dev", "holdout"]):
        raise ValueError("unbalanced_splits")
    for query in queries + fixture.get("policy_probes", []):
        if not isinstance(query.get("query"), str) or not 2 <= len(query["query"].strip()) <= 120:
            raise ValueError("invalid_query_length")
    if any(query["target"] not in by_key for query in queries):
        raise ValueError("unknown_target")
    return fixture


def load_env(path):
    values = {}
    for line in path.read_text().splitlines():
        match = re.match(r"^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$", line.strip())
        if match:
            value = match[2].strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
                value = value[1:-1]
            values[match[1]] = value
    return values


def connection():
    production = load_env(ROOT / ".env.production")
    development = load_env(ROOT / ".env.development")
    url = production.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = development.get("SUPABASE_SERVICE_ROLE_KEY", "")
    parsed = urlparse(url)
    if parsed.scheme != "https" or not re.fullmatch(r"[a-z0-9]+\.supabase\.co", parsed.hostname or "") or parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
        raise ValueError("invalid_database_url")
    try:
        parts = key.split(".")
        if len(parts) != 3:
            raise ValueError("invalid_service_key")
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        if payload.get("role") != "service_role" or payload.get("ref") != parsed.hostname.split(".")[0]:
            raise ValueError("credential_project_or_role_mismatch")
        if isinstance(payload.get("exp"), (float, int)) and payload["exp"] <= time.time():
            raise ValueError("credential_expired")
    except (ValueError, TypeError, KeyError) as error:
        raise ValueError("invalid_existing_server_credential") from error
    return url.rstrip("/"), key


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def request_json(url, key, path, params=None, body=None):
    target = url + "/rest/v1/" + path
    if params:
        target += "?" + urlencode(params)
    payload = None if body is None else json.dumps(body).encode()
    headers = {"apikey": key, "authorization": "Bearer " + key, "content-type": "application/json"}
    response = build_opener(NoRedirect()).open(Request(target, data=payload, headers=headers), timeout=30)
    with response:
        if int(response.headers.get("content-length", "0")) > 30_000_000:
            raise ValueError("response_size_exceeded")
        data = response.read(30_000_001)
        if len(data) > 30_000_000:
            raise ValueError("response_size_exceeded")
        return json.loads(data)


def public_corpus(url, key):
    fields = "id,title,aliases,summary,description,usage_note,origin,title_chosung,moderation_status"
    rows = []
    for offset in range(0, 10000, 1000):
        batch = request_json(url, key, "memes", {"select": fields, "moderation_status": "in.(approved,limited)",
                                                "order": "id.asc", "limit": 1000, "offset": offset})
        if not isinstance(batch, list) or len(batch) > 1000 or any(row.get("moderation_status") not in PUBLIC for row in batch):
            raise ValueError("nonpublic_or_invalid_corpus")
        rows.extend(batch)
        if len(batch) < 1000:
            break
    else:
        raise ValueError("corpus_row_budget_exceeded")
    if len({row["id"] for row in rows}) != len(rows):
        raise ValueError("duplicate_corpus_identity")
    return rows


def resolve_targets(fixture, corpus):
    resolved = {}
    for target in fixture["targets"]:
        titles = {compact(title) for title in target["acceptable_titles"]}
        found = [row for row in corpus if compact(row["title"]) in titles]
        if not found:
            found = [row for row in corpus if compact(target["canonical_title"]) in
                     {compact(alias) for alias in row.get("aliases") or []}]
        if not found or len(found) > 5:
            raise ValueError("unresolved_public_target:" + target["key"])
        resolved[target["key"]] = [{"id": row["id"], "title": row["title"]} for row in found]
    dev = {row["id"] for target in fixture["targets"] if target["split"] == "dev" for row in resolved[target["key"]]}
    holdout = {row["id"] for target in fixture["targets"] if target["split"] == "holdout" for row in resolved[target["key"]]}
    if dev & holdout:
        raise ValueError("resolved_target_split_leakage")
    return resolved


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def fixture_hash(fixture):
    return hashlib.sha256(json.dumps(fixture, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def capture(fixture, snapshot_path):
    started = time.perf_counter()
    url, key = connection()
    cached = json.loads(snapshot_path.read_text()) if snapshot_path.exists() else None
    project_ref = urlparse(url).hostname.split(".")[0]
    fresh_metadata = cached and cached.get("project_ref") == project_ref and time.time() - cached.get("metadata_captured_epoch", 0) < 600
    corpus = cached["public_corpus"] if fresh_metadata else public_corpus(url, key)
    if any(row.get("moderation_status") not in PUBLIC for row in corpus):
        raise ValueError("nonpublic_cached_corpus")
    checkpoint = {"schema_version": 1, "project_ref": project_ref, "metadata_captured_epoch": time.time(),
                  "fixture_sha256": fixture_hash(fixture), "model": MODEL, "revision": REVISION, "profile": PROFILE,
                  "dimensions": DIMENSIONS, "public_corpus": corpus, "stage": "metadata",
                  "captured_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    atomic_json(snapshot_path, checkpoint)
    targets = resolve_targets(fixture, corpus)
    queries = fixture["queries"] + fixture.get("policy_probes", [])
    allowed = {row["id"] for row in corpus}
    if cached and cached.get("fixture_sha256") == fixture_hash(fixture) and cached.get("revision") == REVISION and cached.get("profile") == PROFILE:
        vectors = {query_id: entry["vector"] for query_id, entry in cached.get("queries", {}).items()}
    else:
        vectors = {}
    encoder = None
    inference_seconds = 0.0
    for offset in range(0, len(queries), 4):
        group = [query for query in queries[offset:offset + 4] if query["id"] not in vectors]
        if not group:
            continue
        if encoder is None:
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
            os.environ["TOKENIZERS_PARALLELISM"] = "false"
            module = importlib.import_module("meme_embeddings")
            if (module.MODEL, module.REVISION, module.DIMENSIONS, module.PROFILE) != (MODEL, REVISION, DIMENSIONS, PROFILE):
                raise ValueError("existing_encoder_profile_mismatch")
            tick = time.perf_counter()
            encoder = module.Encoder()
            inference_seconds += time.perf_counter() - tick
        tick = time.perf_counter()
        encoded = encoder.encode(["query: " + query["query"] for query in group])
        inference_seconds += time.perf_counter() - tick
        vectors.update({query["id"]: vector for query, vector in zip(group, encoded)})
        print(json.dumps({"phase": "query_vectors", "completed": len(vectors), "total": len(queries)}), flush=True)
    checkpoint.update({"targets": targets, "stage": "vectors", "queries": {query_id: {"vector": vector} for query_id, vector in vectors.items()}})
    atomic_json(snapshot_path, checkpoint)
    entries = {}
    for index, query in enumerate(queries):
        keyword = request_json(url, key, "rpc/search_memes", {"p_query": query["query"], "p_limit": 20,
                                "select": "id", "moderation_status": "in.(approved,limited)"})
        semantic = request_json(url, key, "rpc/match_meme_embeddings",
                                body={"p_embedding": vectors[query["id"]], "p_limit": 40})
        if not isinstance(keyword, list) or not isinstance(semantic, list) or len(keyword) > 20 or len(semantic) > 40:
            raise ValueError("invalid_candidate_response")
        if any(row["id"] not in allowed for row in keyword) or any(row["meme_id"] not in allowed for row in semantic):
            raise ValueError("nonpublic_candidate_returned")
        entries[query["id"]] = {"vector": vectors[query["id"]], "keyword": [{"id": row["id"]} for row in keyword],
                                "semantic": [{"id": row["meme_id"], "similarity": row["similarity"]} for row in semantic]}
        if (index + 1) % 4 == 0 or index + 1 == len(queries):
            print(json.dumps({"phase": "candidate_snapshot", "completed": index + 1, "total": len(queries)}), flush=True)
    snapshot = {"schema_version": 1, "stage": "complete", "project_ref": project_ref, "metadata_captured_epoch": checkpoint["metadata_captured_epoch"], "fixture_sha256": fixture_hash(fixture), "model": MODEL, "revision": REVISION,
                "profile": PROFILE, "dimensions": DIMENSIONS, "captured_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "public_corpus": corpus, "targets": targets, "queries": entries,
                "timing": {"capture_seconds": time.perf_counter() - started, "inference_seconds": inference_seconds}}
    atomic_json(snapshot_path, snapshot)
    return snapshot


def variants():
    return [{"name": "baseline_limit12_rrf60", "source": "keyword", "limit": 12, "k": 60, "weight": 1.0, "pins": False, "original_ties": True},
            {"name": "overfetch_rrf60", "source": "keyword", "limit": 40, "k": 60, "weight": 1.0, "pins": False, "original_ties": False},
            *[{"name": f"tokens_pins_rrf{k}_lex{weight:g}", "source": "tokens", "limit": 40, "k": k,
               "weight": weight, "pins": True, "original_ties": False} for k in [20, 60] for weight in [0.75, 1.0, 1.25]]]


def evaluate(fixture, snapshot, output):
    if snapshot.get("stage") != "complete":
        raise ValueError("snapshot_capture_incomplete")
    if snapshot.get("fixture_sha256") != fixture_hash(fixture) or snapshot.get("revision") != REVISION or snapshot.get("profile") != PROFILE:
        raise ValueError("snapshot_fixture_or_profile_mismatch")
    corpus = [prepare_row(row) for row in snapshot["public_corpus"]]
    titles = {row["id"]: row["title"] for row in corpus}
    lexical = {query["id"]: lexical_candidates(corpus, query["query"])
               for query in fixture["queries"] + fixture.get("policy_probes", [])}
    all_variants = variants()
    per_variant, summaries = {}, {}
    def details_for(variant, query):
        entry = snapshot["queries"][query["id"]]
        keyword = lexical[query["id"]] if variant["source"] == "tokens" else entry["keyword"]
        ranking = fuse(keyword[:variant["limit"]], entry["semantic"][:variant["limit"]], variant["k"],
                       variant["weight"], variant["pins"], variant["original_ties"])
        relevant = {row["id"] for row in snapshot["targets"][query["target"]]}
        return {**query_metrics(ranking, relevant), "top5": [{"id": item_id, "title": titles[item_id]} for item_id in ranking[:5]]}
    def summary(details, split):
        groups = {"all": [], "natural_intents": [], "named_forms": []}
        for query in fixture["queries"]:
            if query["split"] == split:
                row = details[query["id"]]
                groups["all"].append(row)
                groups["natural_intents" if query["kind"] in {"intent", "paraphrase"} else "named_forms"].append(row)
        return {group: {metric: round(sum(row[metric] for row in rows) / len(rows), 6)
                        for metric in ["mrr_at_10", "ndcg_at_5", "recall_at_20", "hit_at_12"]}
                for group, rows in groups.items()}
    # Freeze the variant using development targets before calculating holdout ranks/metrics.
    for variant in all_variants:
        details = {query["id"]: details_for(variant, query) for query in fixture["queries"] if query["split"] == "dev"}
        per_variant[variant["name"]] = details
        summaries[variant["name"]] = summary(details, "dev")
    candidates = [variant for variant in all_variants if variant["source"] == "tokens"]
    selected = max(candidates, key=lambda variant: (summaries[variant["name"]]["all"]["ndcg_at_5"],
                   summaries[variant["name"]]["all"]["mrr_at_10"], summaries[variant["name"]]["all"]["recall_at_20"],
                   -abs(variant["weight"] - 1), -variant["k"]))
    selection_frozen_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    baseline = all_variants[0]
    for variant in [baseline, selected]:
        per_variant[variant["name"]].update({query["id"]: details_for(variant, query)
                                            for query in fixture["queries"] if query["split"] == "holdout"})
    def heldout(variant):
        return summary(per_variant[variant["name"]], "holdout")
    probes = []
    for probe in fixture.get("policy_probes", []):
        entry = snapshot["queries"][probe["id"]]
        ranking = fuse(lexical[probe["id"]], entry["semantic"], selected["k"], selected["weight"], True)
        forbidden = {compact(name) for name in probe["forbidden_target_names"]}
        probes.append({"id": probe["id"], "excluded_from_relevance_metrics": True,
                       "forbidden_named_target_returned": any(compact(titles[item_id]) in forbidden for item_id in ranking),
                       "top5": [{"id": item_id, "title": titles[item_id]} for item_id in ranking[:5]]})
    report = {"schema_version": 1, "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
              "model": {"name": MODEL, "revision": REVISION, "profile": PROFILE, "dimensions": DIMENSIONS},
              "snapshot": {"captured_at_utc": snapshot["captured_at_utc"], "public_rows": len(corpus), "fixture_sha256": fixture_hash(fixture)},
              "evaluation": {"queries": 48, "dev": 24, "holdout": 24, "target_disjoint_splits": True,
                             "labels": "Agent-authored provisional relevant sets; duplicate public definitions accepted; no independent human relevance review.",
                             "recall_at_20_scope": "Fused ranking before final display cap12; hit_at_12 records display-cap success.",
                             "selection": "Selected only on dev nDCG@5 then MRR@10/Recall@20; ties prefer weight1 then k20.",
                             "selection_frozen_at_utc": selection_frozen_at,
                             "natural_intents_per_split": 12, "named_forms_per_split": 12,
                             "holdout_variants_reported": "Baseline and one dev-selected token variant only; do not retune on holdout.",
                             "query_inference_reused_across_variants": True},
              "scorer": {"token_cap": 12, "stopwords": sorted(STOPWORDS), "particles": list(PARTICLES),
                         "field_weights": {"title_or_alias": 3, "summary": 2, "description_or_origin_or_usage_note": 1},
                         "document_caps": {"description": 3000, "origin": 1500, "usage_note": 1000},
                         "name_priority": "2 exact compact title/alias; 1 literal compact contains or raw initial consonants; pins before RRF"},
              "dev_variants": summaries, "selected_variant": selected,
              "holdout": {"baseline": heldout(baseline), "selected": heldout(selected)},
              "targets": snapshot["targets"],
              "query_results": [{**query, "baseline": per_variant[baseline["name"]][query["id"]],
                                 "selected": per_variant[selected["name"]][query["id"]]} for query in fixture["queries"]],
              "policy_probes": probes, "timing": snapshot["timing"],
              "limitations": ["One bounded public capture, not one database transaction; the catalog can change between metadata and RPC reads.",
                              "Score gains are not production accuracy guarantees.",
                              "Candidate overfetch uses keyword20 and semantic40; vector/profile/document construction unchanged.",
                              "Final SQL RPC parity and actual deployed HTTP behavior require separate verification.",
                              "No full corpus, query vectors, credentials, or private rows are stored in this tracked report."]}
    atomic_json(output, report)
    print(json.dumps({"phase": "evaluation_complete", "queries": 48, "public_rows": len(corpus),
                      "selected": selected["name"], "holdout": report["holdout"], "output": str(output.relative_to(ROOT)) if output.is_relative_to(ROOT) else str(output)}, ensure_ascii=False), flush=True)
    return report


def verify_sql(fixture, snapshot, output):
    """Compare one frozen variant to the deployed read-only RPC; never encode."""
    if snapshot.get("stage") != "complete" or snapshot.get("fixture_sha256") != fixture_hash(fixture):
        raise ValueError("complete_matching_snapshot_required")
    report = json.loads(output.read_text())
    selected = report["selected_variant"]
    if (selected["k"], selected["weight"], selected["pins"]) != (60, 1.0, True):
        raise ValueError("unexpected_frozen_variant")
    url, key = connection()
    corpus = [prepare_row(row) for row in snapshot["public_corpus"]]
    allowed = {row["id"] for row in corpus}
    durations, checks = [], []
    state = {"rpc": "search_meme_references", "role": "service_role", "model_calls": 0,
             "retuned": False, "requested_limit": 20, "complete": False,
             "public_filter_required": True, "recorded_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    try:
        for query in fixture["queries"]:
            entry = snapshot["queries"][query["id"]]
            expected = fuse(lexical_candidates(corpus, query["query"]), entry["semantic"],
                            selected["k"], selected["weight"], selected["pins"])[:20]
            tick = time.perf_counter()
            actual = request_json(url, key, "rpc/search_meme_references",
                                  body={"p_query": query["query"], "p_embedding": entry["vector"], "p_limit": 20})
            elapsed = (time.perf_counter() - tick) * 1000
            if not isinstance(actual, list) or len(actual) > 20 or any(row.get("id") not in allowed for row in actual):
                raise ValueError("invalid_or_nonpublic_final_rpc_result")
            actual_ids = [row["id"] for row in actual]
            if len(actual_ids) != len(set(actual_ids)):
                raise ValueError("duplicate_final_rpc_identity")
            durations.append(elapsed)
            check = {"query_id": query["id"], "matches_exact_ids": actual_ids == expected,
                     "expected_count": len(expected), "actual_count": len(actual_ids),
                     "http_elapsed_ms": round(elapsed, 3)}
            if actual_ids != expected:
                position = next(index for index in range(max(len(expected), len(actual_ids)))
                                if (expected[index] if index < len(expected) else None) !=
                                   (actual_ids[index] if index < len(actual_ids) else None))
                check["first_mismatch"] = {"position": position + 1,
                                          "expected_public_id": expected[position] if position < len(expected) else None,
                                          "actual_public_id": actual_ids[position] if position < len(actual_ids) else None}
            checks.append(check)
            if len(checks) % 12 == 0:
                print(json.dumps({"phase": "sql_parity", "completed": len(checks), "total": 48}), flush=True)
        state["complete"] = True
    except Exception as error:
        state["failure_type"] = type(error).__name__
        raise
    finally:
        ordered = sorted(durations)
        state.update({"verified_queries": len(checks), "matched_queries": sum(check["matches_exact_ids"] for check in checks),
                      "mismatched_queries": sum(not check["matches_exact_ids"] for check in checks),
                      "checks": checks, "http_latency_ms": {"includes_network": True,
                           "p50": round(ordered[math.ceil(len(ordered) * 0.50) - 1], 3) if ordered else None,
                           "p95": round(ordered[math.ceil(len(ordered) * 0.95) - 1], 3) if ordered else None,
                           "max": round(max(ordered), 3) if ordered else None,
                           "total": round(sum(ordered), 3)}})
        report["sql_verification"] = state
        atomic_json(output, report)
    print(json.dumps({"phase": "sql_parity_complete", "complete": state["complete"],
                      "matched_queries": state["matched_queries"], "total": 48,
                      "http_latency_ms": state["http_latency_ms"]}), flush=True)
    return 0 if state["matched_queries"] == 48 else 1


class LightweightTests(unittest.TestCase):
    def test_token_bounds_and_stops(self):
        self.assertEqual(query_tokens("친구에게 하는 상황을 정말 추천"), ["친구"])
        self.assertEqual(len(query_tokens(" ".join("token" + str(index) for index in range(20)))), 12)
        self.assertEqual(query_tokens("사과 와"), ["사과"])
        self.assertEqual(query_tokens("ＴＭＩ를 déjà_vu"), ["tmi를", "déjà", "vu"])

    def test_nfkc_and_initial_pin(self):
        self.assertEqual(normalized("ＦＬＥＸ"), "flex")
        row = prepare_row({"id": "a", "title": "갑분싸", "title_chosung": "ㄱㅂㅆ"})
        self.assertEqual(lexical_score(row, "ㄱ ㅂ ㅆ", [])[0], 1)

    def test_boolean_field_weight(self):
        row = prepare_row({"id": "a", "title": "친구", "aliases": ["친구"], "summary": "친구", "description": "친구", "origin": "친구", "usage_note": "친구"})
        self.assertEqual(lexical_score(row, "친구 이야기", ["친구"])[1], 1.0)
        self.assertEqual(lexical_score(row, "친 구", [])[0], 2)

    def test_baseline_rrf_and_duplicate(self):
        self.assertEqual(fuse([{"id": "b"}, {"id": "a"}], [{"id": "a"}, {"id": "c"}], original_ties=True), ["a", "b", "c"])
        self.assertEqual(fuse([{"id": "b"}, {"id": "b"}], [{"id": "a"}]), ["a", "b"])

    def test_name_pin_and_determinism(self):
        self.assertEqual(fuse([{"id": "z", "priority": 2}], [{"id": "a"}], pin_names=True)[0], "z")
        self.assertEqual(fuse([{"id": "z"}], [{"id": "a"}]), ["a", "z"])

    def test_metrics_accept_duplicate_definitions(self):
        result = query_metrics(["a", "b", "x"], {"a", "b"})
        self.assertEqual(result["mrr_at_10"], 1)
        self.assertEqual(result["ndcg_at_5"], 1)
        self.assertEqual(result["recall_at_20"], 1)

    def test_fixture_groups(self):
        fixture = validate_fixture(json.loads(FIXTURE.read_text()))
        fixture["queries"][0]["split"] = "holdout"
        with self.assertRaises(ValueError):
            validate_fixture(fixture)

    def test_public_target_resolution(self):
        fixture = json.loads(FIXTURE.read_text())
        corpus = [{"id": target["key"] + "-" + str(index), "title": title} for target in fixture["targets"] for index, title in enumerate(target["acceptable_titles"])]
        resolved = resolve_targets(fixture, corpus)
        self.assertEqual(len(resolved), 12)
        self.assertEqual(len(resolved["flex"]), 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixtures", type=Path, default=FIXTURE)
    parser.add_argument("--snapshot", type=Path, default=SNAPSHOT)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--capture", action="store_true", help="Read public metadata/RPCs and run offline fixed-model query inference once.")
    parser.add_argument("--verify-sql", action="store_true", help="After migration, compare frozen offline top20 to the deployed read-only RPC using cached vectors only.")
    parser.add_argument("--allow-remote", action="store_true", help="Explicit acknowledgement for production read-only capture.")
    parser.add_argument("--check-fixtures", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(LightweightTests))
        return 0 if result.wasSuccessful() else 1
    fixture = validate_fixture(json.loads(args.fixtures.read_text()))
    if args.check_fixtures:
        print(json.dumps({"valid": True, "queries": 48, "dev": 24, "holdout": 24, "target_groups": 12}))
        return 0
    if args.capture and args.verify_sql:
        parser.error("--capture and --verify-sql are mutually exclusive")
    if (args.capture or args.verify_sql) and not args.allow_remote:
        parser.error("Remote reads require --allow-remote")
    try:
        snapshot = capture(fixture, args.snapshot) if args.capture else json.loads(args.snapshot.read_text())
        if args.verify_sql:
            return verify_sql(fixture, snapshot, args.output)
        evaluate(fixture, snapshot, args.output)
    except Exception as error:
        print(json.dumps({"phase": "failed", "error_type": type(error).__name__,
                          "reason": str(error) if isinstance(error, ValueError) else "capture_or_evaluation_failed_no_credentials_logged"}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
