import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOUSE_ORIGINAL } from "@/lib/house-original";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: isOp, error: opErr } = await supabase.rpc("is_operator");
    if (opErr || !isOp) {
      return NextResponse.json({ ok: false, error: "운영자 권한이 필요해요." }, { status: 403 });
    }

    const dataFile = resolve(process.cwd(), "data/memehub-memes.json");
    if (!existsSync(dataFile)) {
      return NextResponse.json({ ok: false, error: "data/memehub-memes.json 파일이 없습니다." }, { status: 404 });
    }

    const items = JSON.parse(readFileSync(dataFile, "utf8"));
    const admin = createAdminClient();

    let createdCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const item of items) {
      const { data: existing } = await admin
        .from("memes")
        .select("id, slug, moderation_status")
        .or(`slug.eq.${item.slug},title.eq.${item.title}`)
        .maybeSingle();

      if (existing) {
        results.push({ title: item.title, status: "skipped", memeId: existing.id });
        skippedCount++;
        continue;
      }

      const { data: memeRow, error: memeErr } = await admin
        .from("memes")
        .insert({
          title: item.title,
          slug: item.slug,
          aliases: item.aliases || [],
          summary: item.summary,
          description: item.description,
          origin: item.origin,
          origin_kind: HOUSE_ORIGINAL,
          moderation_status: "pending",
          category: item.category,
          safety_level: item.safety_level,
          difficulty: item.difficulty,
          sentiment: item.sentiment,
          origin_year: item.origin_year,
          usage_context: item.usage_context,
        })
        .select("id, slug")
        .single();

      if (memeErr || !memeRow) {
        results.push({ title: item.title, status: "error", error: memeErr?.message });
        continue;
      }

      const memeId = memeRow.id;

      for (const src of item.sources) {
        await admin.from("meme_sources").insert({
          meme_id: memeId,
          platform: src.platform === "youtube_shorts" ? "youtube" : src.platform,
          source_url: src.url,
          title: src.title,
          creator_name: src.creator_name,
          source_role: src.source_role || "original",
          rights_basis: src.rights_basis || "creator_permission",
          copyright_status: "embeddable",
        });

        const { data: mediaSrc } = await admin
          .from("media_sources")
          .upsert(
            {
              platform: src.platform,
              external_id: src.external_id || "",
              canonical_url: src.url,
              title: src.title,
              channel_name: src.creator_name,
              public_status: "active",
              embeddable: true,
              last_checked_at: new Date().toISOString(),
            },
            { onConflict: "canonical_url" },
          )
          .select("id")
          .single();

        if (mediaSrc?.id) {
          await admin.from("meme_media").insert({
            meme_id: memeId,
            source_id: mediaSrc.id,
            source_role: src.source_role || "original",
            rights_basis: src.rights_basis || "creator_permission",
            review_state: "reviewed",
          });
        }
      }

      await admin.from("meme_market_profiles").insert({
        meme_id: memeId,
        market_code: item.country || "KR",
        language_tag: item.country === "US" ? "en-US" : "ko-KR",
        role: "origin",
        local_title: item.local_title || item.title,
        review_state: "reviewed",
        reviewed_at: new Date().toISOString(),
      });

      if (item.claims?.length) {
        for (const claim of item.claims) {
          await admin.from("meme_claims").insert({
            meme_id: memeId,
            claim_type: claim.claim_type,
            claim_text: claim.claim_text,
            confidence: claim.confidence || "high",
            verified: true,
          });
        }
      }

      if (item.tags?.length) {
        for (const tagName of item.tags) {
          const cleanTag = tagName.trim().toLowerCase();
          const { data: tagRow } = await admin
            .from("tags")
            .upsert({ name: cleanTag }, { onConflict: "name" })
            .select("id")
            .single();
          if (tagRow?.id) {
            await admin
              .from("meme_tags_map")
              .upsert({ meme_id: memeId, tag_id: tagRow.id }, { onConflict: "meme_id,tag_id" });
          }
        }
      }

      await admin.rpc("publish_house_original", {
        p_meme_id: memeId,
        p_to: "approved",
        p_attested: true,
      });

      results.push({ title: item.title, status: "created", memeId });
      createdCount++;
    }

    return NextResponse.json({
      ok: true,
      summary: { total: items.length, created: createdCount, skipped: skippedCount },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
