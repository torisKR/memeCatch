/** A routing hint, never a source of meme facts, ranking, or publication status. */
export const MEME_INTENTS = ["lookup", "situation", "meaning", "origin", "usage", "out_of_scope", "unclear"] as const;
export type MemeIntent = (typeof MEME_INTENTS)[number];
export const MEME_INTENT_REASONS = [
  "local_only", "unsupported_locale", "input_not_sent", "aborted", "exact_match",
] as const;
export type MemeIntentReason = (typeof MEME_INTENT_REASONS)[number];
export type MemeIntentDecision = {
  intent: MemeIntent;
  source: "fallback";
  reason?: MemeIntentReason;
};

/** Conservative offline intent hints keep registered-data answers usable after expiry. */
export function fallbackMemeIntent(query: string): MemeIntent {
  const q = query.normalize("NFKC").trim();
  if (/(?:환불|결제|로그인|비밀번호|계정\s*복구|주식\s*추천|투자\s*추천|날씨|요리법|여행\s*일정|번역|자바스크립트|코드\s*(?:작성|짜)|스트레칭|한국\s*시간)/iu.test(q)) return "out_of_scope";
  if (/^(?:밈|뭐|이거|저거|그거|이런\s*건|뭐가\s*좋아|그런\s*느낌\s*있잖아|아무거나\s*하나|추천해|알려줘)(?:\s*(?:뭐야|뭐지|알려줘))?[?!.,\s]*$/u.test(q)) return "unclear";
  if (/(?:유래|기원|이른\s*사례|어디서\s*(?:시작|나왔)|누가\s*(?:처음|만들)|언제\s*(?:생겼|시작|나왔))/u.test(q)) return "origin";
  if (/(?:사용법|사용\s*(?:예|할)|어떻게\s*(?:써|쓰|사용)|언제\s*(?:써|쓰|사용)|어떤\s*상황에서\s*사용|쓰는\s*방법|주의점|주의할)/u.test(q)) return "usage";
  if (/(?:무슨\s*뜻|뜻|의미|뭐야|뭔가요|무엇|설명)/u.test(q)) return "meaning";
  if (/(?:할\s*때|했을\s*때|하는\s*상황|맞는\s*밈|쓸\s*밈|추천|따라\s*하|따라\s*할)/u.test(q)) return "situation";
  return "lookup";
}

/** Conservative local-routing gate; this is not a complete sensitive-data detector. */
export function canSendMemeIntent(query: string): boolean {
  const q = query.normalize("NFKC");
  return q.trim().length >= 2 && q.length <= 120
    && !/[\u0000-\u001f\u007f]/u.test(q)
    && !/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\+?82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}\b|\d[\d -]{10,}\d|https?:\/\/|www\.)/iu.test(q)
    && !/(?:주민\s*등록|여권\s*번호|신분증|계좌\s*번호|카드\s*번호|비밀\s*번호|비밀번호|인증\s*번호|api[ _-]?key|access[ _-]?token|진단\s*(?:서|명)|병력|의료\s*기록|건강\s*정보|성적\s*지향|종교\s*정보|내\s*(?:이름|주소|연락처|전화번호)|환불|결제|로그인)/iu.test(q)
    && !/(?:마약|대마|필로폰|코카인|도박|카지노|포르노|음란|소주|맥주|위스키|음주|술\s*(?:마|먹)|alcohol|porn|cocaine|cannabis|gambling)/iu.test(q)
    && !/(?:(?:이전|위의|시스템|지시|프롬프트).{0,20}(?:무시|실행|공개)|ignore.{0,25}(?:instruction|system|previous)|<\/?(?:script|system)|(?:delete|drop)\s+(?:table|from)|명령\s*실행)/iu.test(q);
}
