/** About copy uses the sitemap's indexable Korean meme count, never a fixed claim. */
export function aboutDescription(count: number | null): string {
  const subject =
    count === null ? "한국 밈·유행어" : `한국 밈·유행어 ${count.toLocaleString("ko-KR")}건`;
  return `밈캐치는 ${subject}의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전입니다. 콘텐츠 검수 원칙과 운영 방침을 소개합니다.`;
}

export function aboutRecordedSentence(count: number | null): string {
  if (count === null) return "오늘까지 공개된 한국 밈을 기록하고 있습니다.";
  return `오늘까지 ${count.toLocaleString("ko-KR")}건의 밈을 기록하고 있습니다.`;
}
