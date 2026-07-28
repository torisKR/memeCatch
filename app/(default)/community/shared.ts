/**
 * 레인 3 — 커뮤니티 공용 타입/헬퍼.
 * community_* 테이블은 아직 lib/database.types.ts에 없어(레인 간 충돌 방지로 재생성 금지)
 * 여기서 로컬 타입으로 선언하고 쿼리 결과를 캐스팅한다.
 * // TODO: types regen 후 정리
 */

export const POSTS_PAGE_SIZE = 20;

export type CommunityMemeMini = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category:
    | "phrase"
    | "dance"
    | "song"
    | "image"
    | "comment"
    | "challenge";
  safety_level: "green" | "yellow" | "gray" | "red";
};

export type CommunityPostRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  meme_id: string | null;
  like_count: number;
  comment_count: number;
  status: "visible" | "hidden";
  created_at: string;
  profiles: { nickname: string } | null;
  memes: CommunityMemeMini | null;
};

export type CommunityCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { nickname: string } | null;
};

/** 목록/상세 임베드 select — profiles·memes 조인 포함.
 *  profiles 임베드는 FK 명시 필수 (community_post_likes 경유 M2M과 모호성 발생) */
export const POST_SELECT =
  "id,user_id,title,body,meme_id,like_count,comment_count,status,created_at,profiles!community_posts_user_id_fkey(nickname),memes(id,short_id,slug,title,summary,category,safety_level)";

export function timeAgo(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
