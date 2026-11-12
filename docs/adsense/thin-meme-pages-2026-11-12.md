# 색인 가능한 얇은 밈 페이지 (2026-11-12)

QA가 이 목록을 초안 작업의 고정 목록으로 쓴다. 이 파일은 목록만 담고, 본문 초안은 넣지 않았다.

## 개수

- 얇은 페이지 **454**. 사이트맵에 있는 색인 가능 페이지 중 비교 본문 400자 미만 **448**개와, 사이트맵에는 없고 `noindex`도 없는 큐레이션 문서 **6**개다.
- 상위 10은 그 454개 중 라이브 `trend_score` 상위 9개에, 디자인 리뷰가 확정한 분좋카를 10번째로 넣은 것이다.
- 400자 이상인데 예문이 2개 미만인 페이지 **60**개와, 비교 본문 451자인 중꺾마는 454개 밖이다. 글자 수와 별개로 아래 패딩 표시에 남긴다.

## 측정

기준 시각은 2026-11-12이고, 페이지를 다시 받은 배포는 `3e25217e74480ed9a09d7483b9ed03cff1bc5828`이다. `https://catchmeme.com/sitemap.xml`은 같은 배포에서 568개 URL, 그중 한국어 밈 URL 531개였다. 큐레이션 문서 7개의 짧은 ID는 사이트맵에 없다. 531개 URL을 0.35초 간격으로 순서대로 조회했고 모두 HTTP 200이었다. 한국어 상세 URL만 대상이다. 사이트맵에 `/en`, `/ja`, `/zh` 밈 URL은 없다.

비교 본문은 2026-11-11 400자 기준과 같다. `description` + 상투구가 아닌 `origin` + `usage_note` 전체 + 사용 예문의 `situation`과 `text`다. `usage_note`가 40자 미만이어도 이 합계에는 넣는다. 빼는 것은 한 줄 요약, 주의문, 제목, 소제목, 내비게이션, 푸터, 태그, 관련 밈 카드, 공유 카드의 틀 문구다. `origin`이 `공개 Wikimedia 기록을 바탕으로`에 맞으면 유래 글자 수는 0이다. 이 조건에 해당하는 페이지는 Boxxy(`kecg9kfp`) 하나이고, 본문 188자로 목록에 있다. `moderation_status`가 `limited`인 페이지도 이 페이지뿐이다. 사이트맵에 있고 `noindex`가 아니라서 포함했다.

사이트맵 531개는 모두 `noindex`가 아니고, 관련 밈 카드가 6개다. 그래서 이 448개의 빠진 섹션에 `비슷한 밈`은 없다. 색인 게이트(본문 150자와 점수 5)는 이 페이지들이 이미 통과한 기준이고, 여기 400자 기준은 그 게이트보다 높다.

섹션이 비어 있지 않아도 다음보다 짧으면 빠진 섹션으로 적는다. 뜻 150자, 유래 80자, 쓰임 40자, 예문 2개, 비슷한 밈 2개. 예문은 `situation`과 `text`가 모두 있는 항목만 센다. 큐레이션 문서의 예문 1개는 상황 라벨 하나다. 대사 줄이 두 개여도 예문 2개로 세지 않는다.

패딩 표시는 글자 수와 따로 붙인다.

- `정의 반복`: 한 줄 정의와 뜻의 공백을 지운 문자열이 서로를 포함하는 경우. 카탈로그 531개에서는 0건이다. 분좋카는 그 검사에 걸리지 않고, 디자인 리뷰와 조회된 문장으로 표시한다. 한 줄 정의는 분위기 좋은 카페의 줄임말이고, 뜻은 그 말을 편안한 축약어라고 다시 말한다.
- `유래 무출처`: 공개 출처 URL의 외부 도메인이 0개다. `catchmeme.com` 자기 링크는 외부 출처로 세지 않는다. 짧은 유래에 유튜브나 나무위키 URL이 있으면 짧아서 유래 칸에 남고, 무출처로는 표시하지 않는다.
- `유래 추정(년경)`: 유래 문장에 `년경`이 있다.
- `예문<2`: 예문이 2개 미만이다.
- `주의 과장`: 주의문에 `100% 무해` 또는 `완전 무해`가 있다. 카탈로그 본문에는 없고, 분좋카 라이브 주의문에만 있다.

우선순위는 라이브 페이지의 `trend_score`다. 공개 페이지에 검색량이나 조회수 필드는 없다. 점수가 같으면 `published_at`이 늦은 쪽, 그다음 `short_id` 오름차순이다. 큐레이션 문서에는 라이브 `trend_score`가 없다. 저장소 시드의 `trend_score` 100은 라이브 화면에 없어서 순위 키로 쓰지 않았다.

## 상위 10

| 순위 | key | URL | 본문 글자 | 빠진 섹션 | 패딩 | 순위 이유 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | gnact78h | https://catchmeme.com/memes/gnact78h-%ED%9E%88%EB%94%A9%ED%81%AC-%22%EB%82%98%EB%8A%94-%EC%95%84%EC%A7%81-%EB%B0%B0%EA%B0%80-%EA%B3%A0%ED%94%84%EB%8B%A4%22 | 226 | 뜻 126/150; 유래 33/80; 쓰임 23/40 | 없음 | 라이브 trend_score 362.09로 400자 미만 페이지 중 1위다. 본문 226자이고 뜻, 유래, 쓰임이 기준보다 짧다. 유래는 한 문장이고 출처는 유튜브 1개다. |
| 2 | n8x6kv6e | https://catchmeme.com/memes/n8x6kv6e-%EB%8C%80%EC%9E%A5%EA%B8%88-%ED%99%8D%EC%8B%9C%EB%A7%9B-%EB%AA%85%EB%8C%80%EC%82%AC | 391 | 뜻 121/150; 쓰임 25/40; 예문 0/2 | 예문<2 | trend_score 357.91, 2위. 본문 391자로 400자에 가장 가깝지만 예문이 0개다. 유래는 245자로 기준을 넘고 외부 출처도 있다. |
| 3 | acm59har | https://catchmeme.com/memes/acm59har-%EC%96%BC%EB%A7%88%EB%A9%B4-%EB%8F%BC%2C-%EC%96%BC%EB%A7%88%EB%A9%B4-%EB%90%98%EB%8A%94%EB%8D%B0 | 210 | 뜻 96/150; 유래 33/80; 쓰임 17/40 | 없음 | trend_score 355.83, 3위. 본문 210자. 뜻, 유래, 쓰임이 짧다. 예문은 2개이고 출처는 유튜브 1개다. |
| 4 | 6y2ze2tp | https://catchmeme.com/memes/6y2ze2tp-%EC%9D%B4%EA%B0%80%ED%83%84-%EC%94%B9%EA%B3%A0-%EB%9C%AF%EA%B3%A0-%EB%A7%9B%EB%B3%B4%EA%B3%A0-%EC%A6%90%EA%B8%B0%EA%B3%A0 | 231 | 유래 32/80; 쓰임 38/40; 예문 0/2 | 예문<2; 유래 추정(년경) | trend_score 348.17, 4위. 본문 231자. 예문이 없고 유래는 32자다. 유래의 `2004년경`은 추정 표시를 붙인다. 출처는 나무위키와 유튜브다. |
| 5 | aufsna4z | https://catchmeme.com/memes/aufsna4z-%EC%82%B0%ED%83%80%EB%8A%94-%EC%97%86%EA%B1%B0%EB%93%A0 | 209 | 유래 32/80; 쓰임 22/40; 예문 0/2 | 예문<2 | trend_score 346.84, 5위. 본문 209자. 예문이 없고 유래 32자, 쓰임 22자다. |
| 6 | aqv9he5e | https://catchmeme.com/memes/aqv9he5e-%EB%B0%95%EC%A7%80%EC%84%B1-%EB%91%90-%EA%B0%9C%EC%9D%98-%EC%8B%AC%EC%9E%A5 | 256 | 유래 33/80; 쓰임 34/40; 예문 0/2 | 예문<2 | trend_score 342.98, 6위. 본문 256자. 예문이 없고 유래 33자, 쓰임 34자다. |
| 7 | xhz2hekj | https://catchmeme.com/memes/xhz2hekj-%ED%99%8D%EC%8B%9C%EB%A7%9B%EC%9D%B4-%EB%82%98%EC%84%9C-%ED%99%8D%EC%8B%9C%EB%9D%BC-%EC%83%9D%EA%B0%81%ED%96%88%EB%8A%94%EB%8D%B0 | 231 | 뜻 107/150; 유래 38/80; 쓰임 32/40 | 없음 | trend_score 341.09, 7위. 본문 231자. 뜻, 유래, 쓰임이 짧다. 예문은 2개다. |
| 8 | sxshbu5b | https://catchmeme.com/memes/sxshbu5b-%EB%82%A8%EC%9E%90%EC%9D%98-%EC%9E%90%EA%B2%A9-%EC%B2%AD%EC%B6%98%ED%95%A9%EC%B0%BD%EB%8B%A8-%EB%84%AC%EB%9D%BC-%ED%8C%90%ED%83%80%EC%A7%80%EC%95%84 | 240 | 유래 39/80; 쓰임 20/40; 예문 0/2 | 예문<2 | trend_score 338.12, 8위. 본문 240자. 예문이 없고 유래 39자, 쓰임 20자다. |
| 9 | wjdwmwxp | https://catchmeme.com/memes/wjdwmwxp-%EA%B9%80%EB%8F%84%EC%98%81-%EB%8B%88-%EB%95%80%EC%8B%9C-%EC%82%B4%EC%96%B4%EC%95%BC-%EB%B0%88 | 210 | 유래 39/80; 쓰임 15/40; 예문 0/2 | 예문<2 | trend_score 336.97, 9위. 본문 210자. 예문이 없고 유래 39자, 쓰임 15자다. 이 점수 아래의 400자 미만 페이지는 상위 10에 넣지 않았다. |
| 10 | bjk2021k | https://catchmeme.com/memes/bjk2021k-bun-jo-ka | 192 (리뷰 본문 487) | 뜻 65/150; 유래 46/80; 쓰임 0/40; 예문 1/2; 비슷한 밈 0/2 | 정의 반복; 유래 무출처; 유래 추정(2021년경); 예문<2; 주의 과장(100% 무해한 표현) | 디자인 리뷰가 얇은 페이지로 확정해서 10번째에 고정했다. 비교 본문은 192자다. 뜻 65, 유래 46, 예문 1개(상황 라벨과 대사 두 줄, 화자 이름 제외) 81이다. 리뷰가 적는 본문은 487자다. 이 조회는 192자 공식으로 487을 재현하지 못했다. 화면에 보이는 한 줄 정의, 뜻, 유래, 예문, 주의문을 더하면 284자이고, 화자 이름을 넣으면 292자다. 공유 카드 문구까지 더하면 486자라 리뷰의 487과 1자 차이다. 487자로 세도 목록에 남긴다. 뜻은 한 줄 정의를 축약어라고 반복하고, 유래는 출처 없는 한 문장으로 `2021년경`이 들어가며, 예문은 1개, 주의문 `100% 무해한 표현`은 과장이다. 라이브 trend_score는 없다. 시드 SQL의 trend_score 100과 시드 출처 `https://catchmeme.com/memes/bjk2021k-bun-jo-ka` 자기 링크는 순위 키로 쓰지 않았다. 시드 행의 usage_note는 한 줄 정의와 같은 문장이고, 시드 주의문은 `완전 무해한 일상 관용어입니다.`다. 라이브 화면은 그 시드 문장이 아니라 큐레이션 문서의 `100% 무해한 표현`이다. 이 고정 때문에 trend 10위 Be the Reds 티셔츠(skhdpv3y, 335.73, 본문 245자)는 전체 목록 11번째다. |

## 얇은 페이지 전체

순위 1–9는 trend_score 순이고, 10번은 분좋카 고정이다. 11번부터는 나머지 400자 미만 카탈로그 페이지를 같은 정렬로 잇고, 마지막에 라이브 trend_score가 없는 큐레이션 문서 5개를 본문이 짧은 순으로 둔다.

| 순위 | key | 제목 | URL | 본문 글자 | 빠진 섹션 | 패딩 | 우선순위 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | gnact78h | 히딩크 "나는 아직 배가 고프다" | https://catchmeme.com/memes/gnact78h-%ED%9E%88%EB%94%A9%ED%81%AC-%22%EB%82%98%EB%8A%94-%EC%95%84%EC%A7%81-%EB%B0%B0%EA%B0%80-%EA%B3%A0%ED%94%84%EB%8B%A4%22 | 226 | 뜻 126/150; 유래 33/80; 쓰임 23/40 | 없음 | 362.09 |
| 2 | n8x6kv6e | 대장금 홍시맛 명대사 | https://catchmeme.com/memes/n8x6kv6e-%EB%8C%80%EC%9E%A5%EA%B8%88-%ED%99%8D%EC%8B%9C%EB%A7%9B-%EB%AA%85%EB%8C%80%EC%82%AC | 391 | 뜻 121/150; 쓰임 25/40; 예문 0/2 | 예문<2 | 357.91 |
| 3 | acm59har | 얼마면 돼, 얼마면 되는데 | https://catchmeme.com/memes/acm59har-%EC%96%BC%EB%A7%88%EB%A9%B4-%EB%8F%BC%2C-%EC%96%BC%EB%A7%88%EB%A9%B4-%EB%90%98%EB%8A%94%EB%8D%B0 | 210 | 뜻 96/150; 유래 33/80; 쓰임 17/40 | 없음 | 355.83 |
| 4 | 6y2ze2tp | 이가탄 씹고 뜯고 맛보고 즐기고 | https://catchmeme.com/memes/6y2ze2tp-%EC%9D%B4%EA%B0%80%ED%83%84-%EC%94%B9%EA%B3%A0-%EB%9C%AF%EA%B3%A0-%EB%A7%9B%EB%B3%B4%EA%B3%A0-%EC%A6%90%EA%B8%B0%EA%B3%A0 | 231 | 유래 32/80; 쓰임 38/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 348.17 |
| 5 | aufsna4z | 산타는 없거든 | https://catchmeme.com/memes/aufsna4z-%EC%82%B0%ED%83%80%EB%8A%94-%EC%97%86%EA%B1%B0%EB%93%A0 | 209 | 유래 32/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 346.84 |
| 6 | aqv9he5e | 박지성 두 개의 심장 | https://catchmeme.com/memes/aqv9he5e-%EB%B0%95%EC%A7%80%EC%84%B1-%EB%91%90-%EA%B0%9C%EC%9D%98-%EC%8B%AC%EC%9E%A5 | 256 | 유래 33/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 342.98 |
| 7 | xhz2hekj | 홍시맛이 나서 홍시라 생각했는데 | https://catchmeme.com/memes/xhz2hekj-%ED%99%8D%EC%8B%9C%EB%A7%9B%EC%9D%B4-%EB%82%98%EC%84%9C-%ED%99%8D%EC%8B%9C%EB%9D%BC-%EC%83%9D%EA%B0%81%ED%96%88%EB%8A%94%EB%8D%B0 | 231 | 뜻 107/150; 유래 38/80; 쓰임 32/40 | 없음 | 341.09 |
| 8 | sxshbu5b | 남자의 자격 청춘합창단 넬라 판타지아 | https://catchmeme.com/memes/sxshbu5b-%EB%82%A8%EC%9E%90%EC%9D%98-%EC%9E%90%EA%B2%A9-%EC%B2%AD%EC%B6%98%ED%95%A9%EC%B0%BD%EB%8B%A8-%EB%84%AC%EB%9D%BC-%ED%8C%90%ED%83%80%EC%A7%80%EC%95%84 | 240 | 유래 39/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 338.12 |
| 9 | wjdwmwxp | 김도영 니 땀시 살어야 밈 | https://catchmeme.com/memes/wjdwmwxp-%EA%B9%80%EB%8F%84%EC%98%81-%EB%8B%88-%EB%95%80%EC%8B%9C-%EC%82%B4%EC%96%B4%EC%95%BC-%EB%B0%88 | 210 | 유래 39/80; 쓰임 15/40; 예문 0/2 | 예문<2 | 336.97 |
| 10 | bjk2021k | 분좋카 (분위기 좋은 카페) | https://catchmeme.com/memes/bjk2021k-bun-jo-ka | 192 (리뷰 본문 487) | 뜻 65/150; 유래 46/80; 쓰임 0/40; 예문 1/2; 비슷한 밈 0/2 | 정의 반복; 유래 무출처; 유래 추정(2021년경); 예문<2; 주의 과장(100% 무해한 표현) | 리뷰 고정 |
| 11 | skhdpv3y | Be the Reds 티셔츠 | https://catchmeme.com/memes/skhdpv3y-Be-the-Reds-%ED%8B%B0%EC%85%94%EC%B8%A0 | 245 | 뜻 131/150; 유래 38/80; 쓰임 27/40 | 없음 | 335.73 |
| 12 | g9jsxkfb | SS501 U R Man 암욜맨 | https://catchmeme.com/memes/g9jsxkfb-SS501-U-R-Man-%EC%95%94%EC%9A%9C%EB%A7%A8 | 223 | 뜻 117/150; 유래 30/80; 쓰임 26/40 | 없음 | 332.57 |
| 13 | m7m38srp | 해적왕이 될 남자다 | https://catchmeme.com/memes/m7m38srp-%ED%95%B4%EC%A0%81%EC%99%95%EC%9D%B4-%EB%90%A0-%EB%82%A8%EC%9E%90%EB%8B%A4 | 208 | 유래 33/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 332.27 |
| 14 | 2djmbuqb | 다모 아프냐 나도 아프다 | https://catchmeme.com/memes/2djmbuqb-%EB%8B%A4%EB%AA%A8-%EC%95%84%ED%94%84%EB%83%90-%EB%82%98%EB%8F%84-%EC%95%84%ED%94%84%EB%8B%A4 | 344 | 뜻 109/150; 쓰임 16/40; 예문 0/2 | 예문<2 | 331.55 |
| 15 | umbkdcjs | 안정환 반지 세레모니 | https://catchmeme.com/memes/umbkdcjs-%EC%95%88%EC%A0%95%ED%99%98-%EB%B0%98%EC%A7%80-%EC%84%B8%EB%A0%88%EB%AA%A8%EB%8B%88 | 243 | 뜻 138/150; 유래 30/80; 쓰임 24/40 | 없음 | 331.00 |
| 16 | uhe6h8eu | 요아정 | https://catchmeme.com/memes/uhe6h8eu-%EC%9A%94%EC%95%84%EC%A0%95 | 209 | 유래 36/80; 쓰임 16/40; 예문 0/2 | 예문<2 | 329.85 |
| 17 | f2u4n8u2 | 열심히 일한 당신, 떠나라 | https://catchmeme.com/memes/f2u4n8u2-%EC%97%B4%EC%8B%AC%ED%9E%88-%EC%9D%BC%ED%95%9C-%EB%8B%B9%EC%8B%A0%2C-%EB%96%A0%EB%82%98%EB%9D%BC | 384 | 뜻 109/150; 쓰임 27/40; 예문 0/2 | 예문<2 | 329.80 |
| 18 | srrux63v | 소녀시대 Gee 개다리춤 | https://catchmeme.com/memes/srrux63v-%EC%86%8C%EB%85%80%EC%8B%9C%EB%8C%80-Gee-%EA%B0%9C%EB%8B%A4%EB%A6%AC%EC%B6%A4 | 248 | 뜻 145/150; 유래 30/80; 쓰임 25/40 | 없음 | 328.87 |
| 19 | zhntapsm | 간 때문이야 | https://catchmeme.com/memes/zhntapsm-%EA%B0%84-%EB%95%8C%EB%AC%B8%EC%9D%B4%EC%95%BC | 234 | 유래 30/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 328.37 |
| 20 | hy3gqdv6 | 몸짱 아줌마 | https://catchmeme.com/memes/hy3gqdv6-%EB%AA%B8%EC%A7%B1-%EC%95%84%EC%A4%8C%EB%A7%88 | 283 | 뜻 144/150; 유래 56/80; 쓰임 30/40 | 없음 | 328.37 |
| 21 | 5u8q26cc | 꿍싯꿍싯 챌린지 | https://catchmeme.com/memes/5u8q26cc-%EA%BF%8D%EC%8B%AF%EA%BF%8D%EC%8B%AF-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 236 | 유래 38/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 328.26 |
| 22 | zg2usdxu | 갈갈이 삼형제 - 무를 주세요 | https://catchmeme.com/memes/zg2usdxu-%EA%B0%88%EA%B0%88%EC%9D%B4-%EC%82%BC%ED%98%95%EC%A0%9C---%EB%AC%B4%EB%A5%BC-%EC%A3%BC%EC%84%B8%EC%9A%94 | 184 | 뜻 83/150; 유래 30/80; 쓰임 24/40 | 없음 | 328.23 |
| 23 | kq34dyyr | 묵찌빠(오페라 리타) 밈 | https://catchmeme.com/memes/kq34dyyr-%EB%AC%B5%EC%B0%8C%EB%B9%A0(%EC%98%A4%ED%8E%98%EB%9D%BC-%EB%A6%AC%ED%83%80)-%EB%B0%88 | 231 | 유래 44/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 327.76 |
| 24 | wy2srcyb | 한국지형에 강하다 | https://catchmeme.com/memes/wy2srcyb-%ED%95%9C%EA%B5%AD%EC%A7%80%ED%98%95%EC%97%90-%EA%B0%95%ED%95%98%EB%8B%A4 | 228 | 뜻 114/150; 유래 32/80; 쓰임 30/40 | 없음 | 327.58 |
| 25 | etesjj5w | 이대호 조선의 4번타자 | https://catchmeme.com/memes/etesjj5w-%EC%9D%B4%EB%8C%80%ED%98%B8-%EC%A1%B0%EC%84%A0%EC%9D%98-4%EB%B2%88%ED%83%80%EC%9E%90 | 249 | 유래 32/80; 쓰임 39/40; 예문 0/2 | 예문<2 | 327.41 |
| 26 | facgycuz | 한 뚝배기 하실래예 | https://catchmeme.com/memes/facgycuz-%ED%95%9C-%EB%9A%9D%EB%B0%B0%EA%B8%B0-%ED%95%98%EC%8B%A4%EB%9E%98%EC%98%88 | 225 | 유래 30/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 327.03 |
| 27 | dthdz8ts | 야인시대 사딸라 | https://catchmeme.com/memes/dthdz8ts-%EC%95%BC%EC%9D%B8%EC%8B%9C%EB%8C%80-%EC%82%AC%EB%94%B8%EB%9D%BC | 395 | 뜻 101/150; 쓰임 28/40; 예문 0/2 | 예문<2 | 327.03 |
| 28 | t2fpqhcs | 테스형 | https://catchmeme.com/memes/t2fpqhcs-%ED%85%8C%EC%8A%A4%ED%98%95 | 290 | 유래 74/80; 예문 0/2 | 예문<2 | 327.03 |
| 29 | jjuvahfy | 싸이 - 챔피언 | https://catchmeme.com/memes/jjuvahfy-%EC%8B%B8%EC%9D%B4---%EC%B1%94%ED%94%BC%EC%96%B8 | 262 | 뜻 138/150; 유래 48/80; 쓰임 26/40 | 없음 | 326.10 |
| 30 | 6bq59hy5 | 박인비 골든 커리어 그랜드슬램 | https://catchmeme.com/memes/6bq59hy5-%EB%B0%95%EC%9D%B8%EB%B9%84-%EA%B3%A8%EB%93%A0-%EC%BB%A4%EB%A6%AC%EC%96%B4-%EA%B7%B8%EB%9E%9C%EB%93%9C%EC%8A%AC%EB%9E%A8 | 262 | 유래 33/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 325.60 |
| 31 | bucts34h | 고마워요 사토 (G.G.사토) | https://catchmeme.com/memes/bucts34h-%EA%B3%A0%EB%A7%88%EC%9B%8C%EC%9A%94-%EC%82%AC%ED%86%A0-(G.G.%EC%82%AC%ED%86%A0) | 290 | 유래 36/80; 예문 0/2 | 예문<2 | 325.60 |
| 32 | rst6agpj | 국물이 끝내줘요 | https://catchmeme.com/memes/rst6agpj-%EA%B5%AD%EB%AC%BC%EC%9D%B4-%EB%81%9D%EB%82%B4%EC%A4%98%EC%9A%94 | 373 | 뜻 106/150; 쓰임 31/40; 예문 0/2 | 예문<2 | 325.15 |
| 33 | 6fjgt5q8 | 가루삼겹살 | https://catchmeme.com/memes/6fjgt5q8-%EA%B0%80%EB%A3%A8%EC%82%BC%EA%B2%B9%EC%82%B4 | 218 | 유래 30/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 324.98 |
| 34 | jajqn55r | 팝캣 | https://catchmeme.com/memes/jajqn55r-%ED%8C%9D%EC%BA%A3 | 253 | 유래 40/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 324.76 |
| 35 | 6mcwe79h | 두쫀쿠 신드롬 | https://catchmeme.com/memes/6mcwe79h-%EB%91%90%EC%AB%80%EC%BF%A0-%EC%8B%A0%EB%93%9C%EB%A1%AC | 240 | 유래 41/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 324.76 |
| 36 | t4n9can6 | 내 마음속에 저장 | https://catchmeme.com/memes/t4n9can6-%EB%82%B4-%EB%A7%88%EC%9D%8C%EC%86%8D%EC%97%90-%EC%A0%80%EC%9E%A5 | 364 | 유래 56/80 | 없음 | 324.26 |
| 37 | g9d78e49 | 지민 Like Crazy 챌린지 | https://catchmeme.com/memes/g9d78e49-%EC%A7%80%EB%AF%BC-Like-Crazy-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 205 | 뜻 123/150; 유래 62/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 323.86 |
| 38 | hnvnf5z5 | 서태지 - 울트라맨이야 | https://catchmeme.com/memes/hnvnf5z5-%EC%84%9C%ED%83%9C%EC%A7%80---%EC%9A%B8%ED%8A%B8%EB%9D%BC%EB%A7%A8%EC%9D%B4%EC%95%BC | 251 | 뜻 132/150; 유래 31/80; 쓰임 36/40 | 없음 | 323.36 |
| 39 | wguaekkj | 바꿔줘(정여사) | https://catchmeme.com/memes/wguaekkj-%EB%B0%94%EA%BF%94%EC%A4%98(%EC%A0%95%EC%97%AC%EC%82%AC) | 216 | 뜻 96/150; 유래 36/80; 쓰임 24/40 | 없음 | 323.36 |
| 40 | xedax3m5 | 안 나오면 쳐들어간다 | https://catchmeme.com/memes/xedax3m5-%EC%95%88-%EB%82%98%EC%98%A4%EB%A9%B4-%EC%B3%90%EB%93%A4%EC%96%B4%EA%B0%84%EB%8B%A4 | 212 | 유래 33/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 323.18 |
| 41 | 3qc4nr6p | PPAP (펜-파인애플-애플-펜) | https://catchmeme.com/memes/3qc4nr6p-PPAP-(%ED%8E%9C-%ED%8C%8C%EC%9D%B8%EC%95%A0%ED%94%8C-%EC%95%A0%ED%94%8C-%ED%8E%9C) | 240 | 유래 35/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 322.83 |
| 42 | 7jtq8bwe | 따름 챌린지 | https://catchmeme.com/memes/7jtq8bwe-%EB%94%B0%EB%A6%84-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 249 | 유래 35/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 322.71 |
| 43 | ame4e8hb | That That 챌린지 | https://catchmeme.com/memes/ame4e8hb-That-That-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 176 | 뜻 96/150; 유래 62/80; 쓰임 18/40; 예문 0/2 | 예문<2 | 322.71 |
| 44 | k8mw8gvx | 나루토 런 | https://catchmeme.com/memes/k8mw8gvx-%EB%82%98%EB%A3%A8%ED%86%A0-%EB%9F%B0 | 220 | 유래 30/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 322.21 |
| 45 | t45jn8wp | 코요태 '순정' | https://catchmeme.com/memes/t45jn8wp-%EC%BD%94%EC%9A%94%ED%83%9C-%EC%88%9C%EC%A0%95 | 387 | 뜻 102/150; 쓰임 29/40; 예문 0/2 | 예문<2 | 322.21 |
| 46 | xm89ke6m | SG워너비 - Timeless | https://catchmeme.com/memes/xm89ke6m-SG%EC%9B%8C%EB%84%88%EB%B9%84---Timeless | 236 | 뜻 104/150; 유래 30/80; 쓰임 31/40 | 없음 | 322.21 |
| 47 | r57ffqg6 | 이말년 씨리즈 | https://catchmeme.com/memes/r57ffqg6-%EC%9D%B4%EB%A7%90%EB%85%84-%EC%94%A8%EB%A6%AC%EC%A6%88 | 232 | 뜻 136/150; 유래 35/80; 쓰임 19/40 | 없음 | 322.21 |
| 48 | pwb8uaxr | KTF Na 아버지 나는 누구예요 나도 잘 몰러 | https://catchmeme.com/memes/pwb8uaxr-KTF-Na-%EC%95%84%EB%B2%84%EC%A7%80-%EB%82%98%EB%8A%94-%EB%88%84%EA%B5%AC%EC%98%88%EC%9A%94-%EB%82%98%EB%8F%84-%EC%9E%98-%EB%AA%B0%EB%9F%AC | 235 | 유래 32/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 322.04 |
| 49 | r2fg5gqv | 잘자 내꿈꿔 | https://catchmeme.com/memes/r2fg5gqv-%EC%9E%98%EC%9E%90-%EB%82%B4%EA%BF%88%EA%BF%94 | 381 | 뜻 82/150; 쓰임 27/40; 예문 0/2 | 예문<2 | 321.68 |
| 50 | czzvakr7 | 케데헌 Golden 챌린지 | https://catchmeme.com/memes/czzvakr7-%EC%BC%80%EB%8D%B0%ED%97%8C-Golden-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 241 | 유래 33/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 321.09 |
| 51 | dghtnqqj | 무궁화 꽃이 피었습니다 챌린지 | https://catchmeme.com/memes/dghtnqqj-%EB%AC%B4%EA%B6%81%ED%99%94-%EA%BD%83%EC%9D%B4-%ED%94%BC%EC%97%88%EC%8A%B5%EB%8B%88%EB%8B%A4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 237 | 유래 42/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 321.09 |
| 52 | rnyv6jwt | 아무노래 챌린지 | https://catchmeme.com/memes/rnyv6jwt-%EC%95%84%EB%AC%B4%EB%85%B8%EB%9E%98-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 236 | 유래 56/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 321.09 |
| 53 | w9maxfw2 | KT n016 잘자 내꿈꿔 | https://catchmeme.com/memes/w9maxfw2-KT-n016-%EC%9E%98%EC%9E%90-%EB%82%B4%EA%BF%88%EA%BF%94 | 211 | 유래 30/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 321.06 |
| 54 | segffxbc | 피식대학 한사랑산악회 | https://catchmeme.com/memes/segffxbc-%ED%94%BC%EC%8B%9D%EB%8C%80%ED%95%99-%ED%95%9C%EC%82%AC%EB%9E%91%EC%82%B0%EC%95%85%ED%9A%8C | 225 | 유래 40/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 320.83 |
| 55 | 8bd7enj4 | 최동원-선동열 무쇠팔 라이벌전 | https://catchmeme.com/memes/8bd7enj4-%EC%B5%9C%EB%8F%99%EC%9B%90-%EC%84%A0%EB%8F%99%EC%97%B4-%EB%AC%B4%EC%87%A0%ED%8C%94-%EB%9D%BC%EC%9D%B4%EB%B2%8C%EC%A0%84 | 287 | 유래 49/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 320.59 |
| 56 | xawqwxax | 형님먼저 아우먼저 | https://catchmeme.com/memes/xawqwxax-%ED%98%95%EB%8B%98%EB%A8%BC%EC%A0%80-%EC%95%84%EC%9A%B0%EB%A8%BC%EC%A0%80 | 229 | 유래 38/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 320.59 |
| 57 | 3xv7rk9v | 범 내려온다 | https://catchmeme.com/memes/3xv7rk9v-%EB%B2%94-%EB%82%B4%EB%A0%A4%EC%98%A8%EB%8B%A4 | 306 | 유래 62/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 320.59 |
| 58 | xgzqteb3 | 컴백홈 | https://catchmeme.com/memes/xgzqteb3-%EC%BB%B4%EB%B0%B1%ED%99%88 | 248 | 뜻 137/150; 유래 37/80; 쓰임 24/40 | 없음 | 320.59 |
| 59 | ehwqcvex | 베이비복스 - Get Up | https://catchmeme.com/memes/ehwqcvex-%EB%B2%A0%EC%9D%B4%EB%B9%84%EB%B3%B5%EC%8A%A4---Get-Up | 230 | 뜻 116/150; 유래 41/80; 쓰임 26/40 | 없음 | 320.59 |
| 60 | 995wdcdd | 존버는 승리한다 | https://catchmeme.com/memes/995wdcdd-%EC%A1%B4%EB%B2%84%EB%8A%94-%EC%8A%B9%EB%A6%AC%ED%95%9C%EB%8B%A4 | 195 | 뜻 86/150; 유래 42/80; 쓰임 21/40 | 없음 | 320.59 |
| 61 | 64u6wftq | SKY 캐슬 쓰앵님 | https://catchmeme.com/memes/64u6wftq-SKY-%EC%BA%90%EC%8A%AC-%EC%93%B0%EC%95%B5%EB%8B%98 | 229 | 유래 36/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 320.33 |
| 62 | 6xrk92pw | 차범근 차붐 | https://catchmeme.com/memes/6xrk92pw-%EC%B0%A8%EB%B2%94%EA%B7%BC-%EC%B0%A8%EB%B6%90 | 280 | 유래 39/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 320.06 |
| 63 | ra86attn | 봉숭아학당 그까이꺼 대충 | https://catchmeme.com/memes/ra86attn-%EB%B4%89%EC%88%AD%EC%95%84%ED%95%99%EB%8B%B9-%EA%B7%B8%EA%B9%8C%EC%9D%B4%EA%BA%BC-%EB%8C%80%EC%B6%A9 | 350 | 뜻 88/150; 쓰임 18/40; 예문 0/2 | 예문<2 | 319.94 |
| 64 | ef2cynar | 기린(이광수 별명) | https://catchmeme.com/memes/ef2cynar-%EA%B8%B0%EB%A6%B0(%EC%9D%B4%EA%B4%91%EC%88%98-%EB%B3%84%EB%AA%85) | 208 | 뜻 106/150; 유래 32/80; 쓰임 20/40 | 없음 | 319.94 |
| 65 | pu9eqb3k | 이걸 나진이 이기네 | https://catchmeme.com/memes/pu9eqb3k-%EC%9D%B4%EA%B1%B8-%EB%82%98%EC%A7%84%EC%9D%B4-%EC%9D%B4%EA%B8%B0%EB%84%A4 | 251 | 유래 38/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 319.09 |
| 66 | jt6zznzd | 마시마로 | https://catchmeme.com/memes/jt6zznzd-%EB%A7%88%EC%8B%9C%EB%A7%88%EB%A1%9C | 271 | 뜻 128/150; 유래 59/80; 쓰임 39/40 | 없음 | 319.09 |
| 67 | 46x2hg97 | 박세리 맨발 투혼 | https://catchmeme.com/memes/46x2hg97-%EB%B0%95%EC%84%B8%EB%A6%AC-%EB%A7%A8%EB%B0%9C-%ED%88%AC%ED%98%BC | 257 | 뜻 141/150; 유래 36/80; 쓰임 27/40 | 없음 | 318.71 |
| 68 | pvfba9qk | 있지 마피아(Mafia In the morning) 챌린지 | https://catchmeme.com/memes/pvfba9qk-%EC%9E%88%EC%A7%80-%EB%A7%88%ED%94%BC%EC%95%84(Mafia-In-the-morning)-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 235 | 유래 65/80; 쓰임 19/40; 예문 0/2 | 예문<2 | 318.32 |
| 69 | cuqu24ds | 짜장면 시키신 분 | https://catchmeme.com/memes/cuqu24ds-%EC%A7%9C%EC%9E%A5%EB%A9%B4-%EC%8B%9C%ED%82%A4%EC%8B%A0-%EB%B6%84 | 251 | 뜻 127/150; 유래 35/80; 쓰임 37/40 | 없음 | 318.32 |
| 70 | chmhpbjd | 너 T야? | https://catchmeme.com/memes/chmhpbjd-%EB%84%88-T%EC%95%BC%3F | 198 | 뜻 138/150; 유래 35/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 318.29 |
| 71 | f2gv8ybc | 홍수환 4전5기 | https://catchmeme.com/memes/f2gv8ybc-%ED%99%8D%EC%88%98%ED%99%98-4%EC%A0%845%EA%B8%B0 | 314 | 유래 31/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 317.82 |
| 72 | zvuyp9yh | 뭬야?! | https://catchmeme.com/memes/zvuyp9yh-%EB%AD%AC%EC%95%BC%3F! | 201 | 뜻 104/150; 유래 40/80; 쓰임 25/40 | 없음 | 317.82 |
| 73 | 5qw2ggqg | 회상(터보) | https://catchmeme.com/memes/5qw2ggqg-%ED%9A%8C%EC%83%81(%ED%84%B0%EB%B3%B4) | 226 | 뜻 123/150; 유래 31/80; 쓰임 27/40 | 없음 | 317.82 |
| 74 | m8nj7cm6 | 사쿠란보 챌린지 | https://catchmeme.com/memes/m8nj7cm6-%EC%82%AC%EC%BF%A0%EB%9E%80%EB%B3%B4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 256 | 유래 45/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 317.78 |
| 75 | v2kq6jp9 | 그래 결심했어 | https://catchmeme.com/memes/v2kq6jp9-%EA%B7%B8%EB%9E%98-%EA%B2%B0%EC%8B%AC%ED%96%88%EC%96%B4 | 226 | 뜻 123/150; 유래 32/80; 쓰임 26/40 | 없음 | 317.78 |
| 76 | vxb8bxb5 | 차인표 짤 | https://catchmeme.com/memes/vxb8bxb5-%EC%B0%A8%EC%9D%B8%ED%91%9C-%EC%A7%A4 | 271 | 뜻 148/150; 유래 32/80; 쓰임 27/40 | 없음 | 317.78 |
| 77 | d58xyjdr | 룩어 | https://catchmeme.com/memes/d58xyjdr-%EB%A3%A9%EC%96%B4 | 226 | 유래 31/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 317.28 |
| 78 | 3gu4bjs6 | 리중딱(리버풀은 중위권이 딱이야) | https://catchmeme.com/memes/3gu4bjs6-%EB%A6%AC%EC%A4%91%EB%94%B1(%EB%A6%AC%EB%B2%84%ED%92%80%EC%9D%80-%EC%A4%91%EC%9C%84%EA%B6%8C%EC%9D%B4-%EB%94%B1%EC%9D%B4%EC%95%BC) | 258 | 유래 40/80; 쓰임 17/40; 예문 0/2 | 예문<2 | 317.28 |
| 79 | es8j9hve | 부먹 vs 찍먹 | https://catchmeme.com/memes/es8j9hve-%EB%B6%80%EB%A8%B9-vs-%EC%B0%8D%EB%A8%B9 | 227 | 유래 34/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 317.28 |
| 80 | sx46pp6f | 조성모 - 아시나요 | https://catchmeme.com/memes/sx46pp6f-%EC%A1%B0%EC%84%B1%EB%AA%A8---%EC%95%84%EC%8B%9C%EB%82%98%EC%9A%94 | 254 | 유래 31/80; 쓰임 27/40 | 없음 | 317.28 |
| 81 | f2a8sgp8 | 황희찬 웃통 탈의 세리머니 | https://catchmeme.com/memes/f2a8sgp8-%ED%99%A9%ED%9D%AC%EC%B0%AC-%EC%9B%83%ED%86%B5-%ED%83%88%EC%9D%98-%EC%84%B8%EB%A6%AC%EB%A8%B8%EB%8B%88 | 220 | 유래 44/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 317.17 |
| 82 | ay8znvqu | 마지막 승부·농구대잔치 열풍 | https://catchmeme.com/memes/ay8znvqu-%EB%A7%88%EC%A7%80%EB%A7%89-%EC%8A%B9%EB%B6%80%C2%B7%EB%86%8D%EA%B5%AC%EB%8C%80%EC%9E%94%EC%B9%98-%EC%97%B4%ED%92%8D | 397 | 뜻 118/150; 쓰임 31/40; 예문 0/2 | 예문<2 | 317.17 |
| 83 | jehcehhf | 나니가스키 챌린지 | https://catchmeme.com/memes/jehcehhf-%EB%82%98%EB%8B%88%EA%B0%80%EC%8A%A4%ED%82%A4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 221 | 유래 48/80; 쓰임 15/40; 예문 0/2 | 예문<2 | 317.17 |
| 84 | jd9t24mf | 허니버터칩 품절대란 | https://catchmeme.com/memes/jd9t24mf-%ED%97%88%EB%8B%88%EB%B2%84%ED%84%B0%EC%B9%A9-%ED%92%88%EC%A0%88%EB%8C%80%EB%9E%80 | 222 | 뜻 125/150; 유래 30/80; 쓰임 23/40 | 없음 | 317.17 |
| 85 | q8x298nw | 박지성 국가대표 은퇴 (2011) | https://catchmeme.com/memes/q8x298nw-%EB%B0%95%EC%A7%80%EC%84%B1-%EA%B5%AD%EA%B0%80%EB%8C%80%ED%91%9C-%EC%9D%80%ED%87%B4-(2011) | 280 | 유래 35/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 316.67 |
| 86 | aqe4w6bu | 정일영 선생님 화법 밈 | https://catchmeme.com/memes/aqe4w6bu-%EC%A0%95%EC%9D%BC%EC%98%81-%EC%84%A0%EC%83%9D%EB%8B%98-%ED%99%94%EB%B2%95-%EB%B0%88 | 247 | 유래 30/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 316.67 |
| 87 | qpdjqu4q | 무릎팍도사 | https://catchmeme.com/memes/qpdjqu4q-%EB%AC%B4%EB%A6%8E%ED%8C%8D%EB%8F%84%EC%82%AC | 261 | 뜻 148/150; 유래 34/80; 쓰임 29/40 | 없음 | 316.67 |
| 88 | zsfh8dr5 | 도전 골든벨 | https://catchmeme.com/memes/zsfh8dr5-%EB%8F%84%EC%A0%84-%EA%B3%A8%EB%93%A0%EB%B2%A8 | 268 | 유래 43/80; 쓰임 29/40 | 없음 | 316.67 |
| 89 | ckzrrca9 | 히밥 | https://catchmeme.com/memes/ckzrrca9-%ED%9E%88%EB%B0%A5 | 208 | 유래 31/80; 쓰임 19/40; 예문 0/2 | 예문<2 | 316.44 |
| 90 | nreumpyz | Into the Arena | https://catchmeme.com/memes/nreumpyz-Into-the-Arena | 244 | 뜻 118/150; 유래 37/80; 쓰임 25/40 | 없음 | 316.44 |
| 91 | nuvanjq7 | 티아라 보핍보핍 고양이춤 | https://catchmeme.com/memes/nuvanjq7-%ED%8B%B0%EC%95%84%EB%9D%BC-%EB%B3%B4%ED%95%8D%EB%B3%B4%ED%95%8D-%EA%B3%A0%EC%96%91%EC%9D%B4%EC%B6%A4 | 273 | 유래 42/80; 쓰임 23/40 | 없음 | 316.44 |
| 92 | acueznbz | 봄바르디로 크로코딜로(Bombardiro Crocodilo) | https://catchmeme.com/memes/acueznbz-%EB%B4%84%EB%B0%94%EB%A5%B4%EB%94%94%EB%A1%9C-%ED%81%AC%EB%A1%9C%EC%BD%94%EB%94%9C%EB%A1%9C(Bombardiro-Crocodilo) | 251 | 유래 64/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 315.94 |
| 93 | 47exgvcf | 이한석 기자 모형탑 훈련 | https://catchmeme.com/memes/47exgvcf-%EC%9D%B4%ED%95%9C%EC%84%9D-%EA%B8%B0%EC%9E%90-%EB%AA%A8%ED%98%95%ED%83%91-%ED%9B%88%EB%A0%A8 | 300 | 유래 50/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 315.94 |
| 94 | up49tmk9 | 난 알아요 & 회오리춤 | https://catchmeme.com/memes/up49tmk9-%EB%82%9C-%EC%95%8C%EC%95%84%EC%9A%94-%26-%ED%9A%8C%EC%98%A4%EB%A6%AC%EC%B6%A4 | 290 | 뜻 145/150; 유래 43/80; 쓰임 25/40 | 없음 | 315.94 |
| 95 | chz4au5f | 순풍, 순풍, 순풍, 야! | https://catchmeme.com/memes/chz4au5f-%EC%88%9C%ED%92%8D%2C-%EC%88%9C%ED%92%8D%2C-%EC%88%9C%ED%92%8D%2C-%EC%95%BC! | 210 | 뜻 83/150; 유래 50/80; 쓰임 31/40 | 없음 | 315.94 |
| 96 | m266mu7d | 정주영 소떼 방북 | https://catchmeme.com/memes/m266mu7d-%EC%A0%95%EC%A3%BC%EC%98%81-%EC%86%8C%EB%96%BC-%EB%B0%A9%EB%B6%81 | 247 | 뜻 143/150; 유래 32/80; 쓰임 26/40 | 없음 | 315.94 |
| 97 | r8cyrjhy | 롬곡옾눞 | https://catchmeme.com/memes/r8cyrjhy-%EB%A1%AC%EA%B3%A1%EC%98%BE%EB%88%9E | 184 | 뜻 90/150; 유래 32/80; 쓰임 25/40 | 없음 | 315.94 |
| 98 | qz6c5pkw | 무한도전 나비효과 | https://catchmeme.com/memes/qz6c5pkw-%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84-%EB%82%98%EB%B9%84%ED%9A%A8%EA%B3%BC | 270 | 유래 44/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 315.55 |
| 99 | 2eqshahe | (여자)아이들 TOMBOY 챌린지 | https://catchmeme.com/memes/2eqshahe-(%EC%97%AC%EC%9E%90)%EC%95%84%EC%9D%B4%EB%93%A4-TOMBOY-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 223 | 유래 48/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 315.55 |
| 100 | pfuqy4ep | 성불(김도) | https://catchmeme.com/memes/pfuqy4ep-%EC%84%B1%EB%B6%88(%EA%B9%80%EB%8F%84) | 238 | 유래 49/80; 쓰임 22/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 315.55 |
| 101 | pxuqzg4s | 너두 나두 야나두 | https://catchmeme.com/memes/pxuqzg4s-%EB%84%88%EB%91%90-%EB%82%98%EB%91%90-%EC%95%BC%EB%82%98%EB%91%90 | 220 | 유래 31/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 315.55 |
| 102 | zx9s3kd9 | 헤이마마 챌린지 | https://catchmeme.com/memes/zx9s3kd9-%ED%97%A4%EC%9D%B4%EB%A7%88%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 254 | 유래 44/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 315.55 |
| 103 | p9mcw2st | 지드래곤 홈 스윗 홈 챌린지 | https://catchmeme.com/memes/p9mcw2st-%EC%A7%80%EB%93%9C%EB%9E%98%EA%B3%A4-%ED%99%88-%EC%8A%A4%EC%9C%97-%ED%99%88-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 249 | 유래 55/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 315.55 |
| 104 | 25kmycfs | 원더걸스 So Hot V라인댄스 | https://catchmeme.com/memes/25kmycfs-%EC%9B%90%EB%8D%94%EA%B1%B8%EC%8A%A4-So-Hot-V%EB%9D%BC%EC%9D%B8%EB%8C%84%EC%8A%A4 | 258 | 뜻 144/150; 유래 41/80; 쓰임 23/40 | 없음 | 315.55 |
| 105 | 7nh5djcf | 슬릭백 챌린지 | https://catchmeme.com/memes/7nh5djcf-%EC%8A%AC%EB%A6%AD%EB%B0%B1-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 344 | 유래 60/80; 쓰임 23/40 | 없음 | 315.55 |
| 106 | twfwrn7c | 탑블레이드 열풍 | https://catchmeme.com/memes/twfwrn7c-%ED%83%91%EB%B8%94%EB%A0%88%EC%9D%B4%EB%93%9C-%EC%97%B4%ED%92%8D | 230 | 뜻 117/150; 유래 32/80; 쓰임 29/40 | 없음 | 315.55 |
| 107 | c53mvndr | 한솔PCS 018 묻지마 다쳐 | https://catchmeme.com/memes/c53mvndr-%ED%95%9C%EC%86%94PCS-018-%EB%AC%BB%EC%A7%80%EB%A7%88-%EB%8B%A4%EC%B3%90 | 229 | 유래 41/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 315.05 |
| 108 | 4s37dzvz | 너 T야 밈 | https://catchmeme.com/memes/4s37dzvz-%EB%84%88-T%EC%95%BC-%EB%B0%88 | 252 | 유래 47/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 315.05 |
| 109 | 9kezw2ss | 재벌집 막내아들 순양그룹 | https://catchmeme.com/memes/9kezw2ss-%EC%9E%AC%EB%B2%8C%EC%A7%91-%EB%A7%89%EB%82%B4%EC%95%84%EB%93%A4-%EC%88%9C%EC%96%91%EA%B7%B8%EB%A3%B9 | 235 | 유래 43/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 315.05 |
| 110 | zna5qgat | 귀여워서 미안해 | https://catchmeme.com/memes/zna5qgat-%EA%B7%80%EC%97%AC%EC%9B%8C%EC%84%9C-%EB%AF%B8%EC%95%88%ED%95%B4 | 271 | 유래 51/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 315.05 |
| 111 | q832kx9m | 신호등 색깔 밈 | https://catchmeme.com/memes/q832kx9m-%EC%8B%A0%ED%98%B8%EB%93%B1-%EC%83%89%EA%B9%94-%EB%B0%88 | 221 | 유래 31/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 315.05 |
| 112 | 99u2rws3 | 핑클 '영원한 사랑' | https://catchmeme.com/memes/99u2rws3-%ED%95%91%ED%81%B4-%EC%98%81%EC%9B%90%ED%95%9C-%EC%82%AC%EB%9E%91 | 377 | 뜻 90/150; 쓰임 33/40; 예문 0/2 | 예문<2 | 315.05 |
| 113 | jsmncrum | 핑계 | https://catchmeme.com/memes/jsmncrum-%ED%95%91%EA%B3%84 | 216 | 뜻 115/150; 유래 17/80; 쓰임 22/40 | 없음 | 315.05 |
| 114 | dbpscccv | 화니지니 | https://catchmeme.com/memes/dbpscccv-%ED%99%94%EB%8B%88%EC%A7%80%EB%8B%88 | 227 | 뜻 119/150; 유래 41/80; 쓰임 21/40 | 없음 | 315.05 |
| 115 | knk2hsye | 우정의 무대 그리운 어머니 | https://catchmeme.com/memes/knk2hsye-%EC%9A%B0%EC%A0%95%EC%9D%98-%EB%AC%B4%EB%8C%80-%EA%B7%B8%EB%A6%AC%EC%9A%B4-%EC%96%B4%EB%A8%B8%EB%8B%88 | 256 | 유래 28/80; 쓰임 25/40 | 없음 | 315.05 |
| 116 | xy7w7jnk | 서남용의 사물흉내개그 | https://catchmeme.com/memes/xy7w7jnk-%EC%84%9C%EB%82%A8%EC%9A%A9%EC%9D%98-%EC%82%AC%EB%AC%BC%ED%9D%89%EB%82%B4%EA%B0%9C%EA%B7%B8 | 193 | 뜻 84/150; 유래 45/80; 쓰임 18/40 | 없음 | 315.05 |
| 117 | tsv8ufqq | 강남스타일 | https://catchmeme.com/memes/tsv8ufqq-%EA%B0%95%EB%82%A8%EC%8A%A4%ED%83%80%EC%9D%BC | 239 | 뜻 123/150; 유래 35/80; 쓰임 30/40 | 없음 | 315.05 |
| 118 | cpujgv78 | 임요환 "테란의 황제" | https://catchmeme.com/memes/cpujgv78-%EC%9E%84%EC%9A%94%ED%99%98-%22%ED%85%8C%EB%9E%80%EC%9D%98-%ED%99%A9%EC%A0%9C%22 | 236 | 뜻 122/150; 유래 36/80; 쓰임 29/40 | 없음 | 315.05 |
| 119 | buvhcxqg | N분할 브이로그 | https://catchmeme.com/memes/buvhcxqg-N%EB%B6%84%ED%95%A0-%EB%B8%8C%EC%9D%B4%EB%A1%9C%EA%B7%B8 | 239 | 뜻 135/150; 유래 62/80; 예문 0/2 | 예문<2 | 314.39 |
| 120 | j75ahdbj | 푸바오 | https://catchmeme.com/memes/j75ahdbj-%ED%91%B8%EB%B0%94%EC%98%A4 | 267 | 뜻 143/150; 유래 36/80; 쓰임 28/40 | 없음 | 314.39 |
| 121 | cdbz9qs3 | 벤투호 위대한 도전 | https://catchmeme.com/memes/cdbz9qs3-%EB%B2%A4%ED%88%AC%ED%98%B8-%EC%9C%84%EB%8C%80%ED%95%9C-%EB%8F%84%EC%A0%84 | 284 | 유래 30/80; 쓰임 37/40; 예문 0/2 | 예문<2 | 314.39 |
| 122 | c92pedkz | 매끈매끈하다 챌린지 | https://catchmeme.com/memes/c92pedkz-%EB%A7%A4%EB%81%88%EB%A7%A4%EB%81%88%ED%95%98%EB%8B%A4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 266 | 유래 33/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 314.39 |
| 123 | gxbhnrhy | 진양철 명대사 | https://catchmeme.com/memes/gxbhnrhy-%EC%A7%84%EC%96%91%EC%B2%A0-%EB%AA%85%EB%8C%80%EC%82%AC | 222 | 유래 43/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 314.39 |
| 124 | msz5exe2 | 베이비몬스터 Batter Up 댄스 챌린지 | https://catchmeme.com/memes/msz5exe2-%EB%B2%A0%EC%9D%B4%EB%B9%84%EB%AA%AC%EC%8A%A4%ED%84%B0-Batter-Up-%EB%8C%84%EC%8A%A4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 226 | 유래 51/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 314.39 |
| 125 | 22nefatc | 개그콘서트 마빡이 | https://catchmeme.com/memes/22nefatc-%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8-%EB%A7%88%EB%B9%A1%EC%9D%B4 | 392 | 뜻 99/150; 쓰임 17/40; 예문 0/2 | 예문<2 | 314.39 |
| 126 | 4d23r2x4 | 허팝 액체괴물(슬라임) 챌린지 | https://catchmeme.com/memes/4d23r2x4-%ED%97%88%ED%8C%9D-%EC%95%A1%EC%B2%B4%EA%B4%B4%EB%AC%BC(%EC%8A%AC%EB%9D%BC%EC%9E%84)-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 241 | 유래 33/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 314.39 |
| 127 | c29wcm7h | 여자친구 '시간을 달려서' 안무 챌린지 | https://catchmeme.com/memes/c29wcm7h-%EC%97%AC%EC%9E%90%EC%B9%9C%EA%B5%AC-%EC%8B%9C%EA%B0%84%EC%9D%84-%EB%8B%AC%EB%A0%A4%EC%84%9C-%EC%95%88%EB%AC%B4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 234 | 유래 45/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 314.39 |
| 128 | kmj2qd8h | 도쿄올림픽 픽토그램 밈 | https://catchmeme.com/memes/kmj2qd8h-%EB%8F%84%EC%BF%84%EC%98%AC%EB%A6%BC%ED%94%BD-%ED%94%BD%ED%86%A0%EA%B7%B8%EB%9E%A8-%EB%B0%88 | 249 | 유래 47/80; 쓰임 36/40; 예문 0/2 | 예문<2 | 314.39 |
| 129 | u5a9yfwr | 삐끼삐끼 챌린지 | https://catchmeme.com/memes/u5a9yfwr-%EC%82%90%EB%81%BC%EC%82%90%EB%81%BC-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 234 | 유래 46/80; 쓰임 18/40; 예문 0/2 | 예문<2 | 314.39 |
| 130 | xyfnse8f | 니가 가라 하와이 | https://catchmeme.com/memes/xyfnse8f-%EB%8B%88%EA%B0%80-%EA%B0%80%EB%9D%BC-%ED%95%98%EC%99%80%EC%9D%B4 | 319 | 유래 51/80; 쓰임 24/40 | 없음 | 314.39 |
| 131 | cmvz4am7 | 성수 꽃집 챌린지 | https://catchmeme.com/memes/cmvz4am7-%EC%84%B1%EC%88%98-%EA%BD%83%EC%A7%91-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 177 | 뜻 75/150; 유래 32/80; 쓰임 16/40 | 없음 | 314.39 |
| 132 | gtajd35w | 레네게이드 댄스(Renegade Dance) | https://catchmeme.com/memes/gtajd35w-%EB%A0%88%EB%84%A4%EA%B2%8C%EC%9D%B4%EB%93%9C-%EB%8C%84%EC%8A%A4(Renegade-Dance) | 250 | 유래 60/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 313.89 |
| 133 | bj4qp6vu | 어~ 그렇게 드로우를 많이 하면? | https://catchmeme.com/memes/bj4qp6vu-%EC%96%B4~-%EA%B7%B8%EB%A0%87%EA%B2%8C-%EB%93%9C%EB%A1%9C%EC%9A%B0%EB%A5%BC-%EB%A7%8E%EC%9D%B4-%ED%95%98%EB%A9%B4%3F | 223 | 유래 34/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 313.89 |
| 134 | f8ttp9w6 | 강호동 최연소 천하장사 | https://catchmeme.com/memes/f8ttp9w6-%EA%B0%95%ED%98%B8%EB%8F%99-%EC%B5%9C%EC%97%B0%EC%86%8C-%EC%B2%9C%ED%95%98%EC%9E%A5%EC%82%AC | 267 | 유래 31/80; 쓰임 36/40; 예문 0/2 | 예문<2 | 313.89 |
| 135 | gh6sac5f | 도레미마켓 | https://catchmeme.com/memes/gh6sac5f-%EB%8F%84%EB%A0%88%EB%AF%B8%EB%A7%88%EC%BC%93 | 259 | 유래 30/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 313.89 |
| 136 | h49br6xs | 백종원의 골목식당 포방터시장 홍탁집 | https://catchmeme.com/memes/h49br6xs-%EB%B0%B1%EC%A2%85%EC%9B%90%EC%9D%98-%EA%B3%A8%EB%AA%A9%EC%8B%9D%EB%8B%B9-%ED%8F%AC%EB%B0%A9%ED%84%B0%EC%8B%9C%EC%9E%A5-%ED%99%8D%ED%83%81%EC%A7%91 | 246 | 유래 35/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 313.89 |
| 137 | 3j8hyh9s | 쿠퍼스 너나 걱정하세요 | https://catchmeme.com/memes/3j8hyh9s-%EC%BF%A0%ED%8D%BC%EC%8A%A4-%EB%84%88%EB%82%98-%EA%B1%B1%EC%A0%95%ED%95%98%EC%84%B8%EC%9A%94 | 231 | 유래 33/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 313.89 |
| 138 | nbwvq7ja | 포카리스웨트 라라라 | https://catchmeme.com/memes/nbwvq7ja-%ED%8F%AC%EC%B9%B4%EB%A6%AC%EC%8A%A4%EC%9B%A8%ED%8A%B8-%EB%9D%BC%EB%9D%BC%EB%9D%BC | 236 | 유래 31/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 313.89 |
| 139 | 9uyxmw4g | 중요한 건 꺾이지 않는 마음 | https://catchmeme.com/memes/9uyxmw4g-%EC%A4%91%EC%9A%94%ED%95%9C-%EA%B1%B4-%EA%BA%BE%EC%9D%B4%EC%A7%80-%EC%95%8A%EB%8A%94-%EB%A7%88%EC%9D%8C | 327 | 유래 45/80; 예문 0/2 | 예문<2 | 313.89 |
| 140 | 7jwfbdck | 아기상어 (핑크퐁) | https://catchmeme.com/memes/7jwfbdck-%EC%95%84%EA%B8%B0%EC%83%81%EC%96%B4-(%ED%95%91%ED%81%AC%ED%90%81) | 249 | 유래 52/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 313.89 |
| 141 | xb9jpwd7 | 베이비복스 '야야야' | https://catchmeme.com/memes/xb9jpwd7-%EB%B2%A0%EC%9D%B4%EB%B9%84%EB%B3%B5%EC%8A%A4-%EC%95%BC%EC%95%BC%EC%95%BC | 374 | 뜻 100/150; 쓰임 32/40; 예문 0/2 | 예문<2 | 313.89 |
| 142 | r8tcbycr | 줄을 서시오 | https://catchmeme.com/memes/r8tcbycr-%EC%A4%84%EC%9D%84-%EC%84%9C%EC%8B%9C%EC%98%A4 | 215 | 뜻 112/150; 유래 30/80; 쓰임 33/40 | 없음 | 313.89 |
| 143 | hrmrecke | 우리의 개그는 죽도록 웃긴 개그 | https://catchmeme.com/memes/hrmrecke-%EC%9A%B0%EB%A6%AC%EC%9D%98-%EA%B0%9C%EA%B7%B8%EB%8A%94-%EC%A3%BD%EB%8F%84%EB%A1%9D-%EC%9B%83%EA%B8%B4-%EA%B0%9C%EA%B7%B8 | 237 | 뜻 97/150; 유래 46/80; 쓰임 25/40 | 없음 | 313.89 |
| 144 | 4szgv4km | 사이다 | https://catchmeme.com/memes/4szgv4km-%EC%82%AC%EC%9D%B4%EB%8B%A4 | 204 | 뜻 101/150; 유래 49/80; 쓰임 20/40 | 유래 추정(년경) | 313.89 |
| 145 | nfgz4d4k | 비상대책위원회 '야 안돼' | https://catchmeme.com/memes/nfgz4d4k-%EB%B9%84%EC%83%81%EB%8C%80%EC%B1%85%EC%9C%84%EC%9B%90%ED%9A%8C-%EC%95%BC-%EC%95%88%EB%8F%BC | 207 | 뜻 114/150; 유래 33/80; 쓰임 17/40 | 없음 | 313.89 |
| 146 | u239n2ds | god의 육아일기 - 재민이 | https://catchmeme.com/memes/u239n2ds-god%EC%9D%98-%EC%9C%A1%EC%95%84%EC%9D%BC%EA%B8%B0---%EC%9E%AC%EB%AF%BC%EC%9D%B4 | 277 | 유래 46/80; 쓰임 19/40 | 없음 | 313.89 |
| 147 | 5x34cpwg | 김국진 여보세요~ | https://catchmeme.com/memes/5x34cpwg-%EA%B9%80%EA%B5%AD%EC%A7%84-%EC%97%AC%EB%B3%B4%EC%84%B8%EC%9A%94~ | 215 | 뜻 115/150; 유래 34/80; 쓰임 23/40 | 없음 | 313.89 |
| 148 | q6t3gkuy | 모태범 밴쿠버올림픽 금메달 | https://catchmeme.com/memes/q6t3gkuy-%EB%AA%A8%ED%83%9C%EB%B2%94-%EB%B0%B4%EC%BF%A0%EB%B2%84%EC%98%AC%EB%A6%BC%ED%94%BD-%EA%B8%88%EB%A9%94%EB%8B%AC | 238 | 유래 31/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 312.77 |
| 149 | 36dchkt4 | 르세라핌 UNFORGIVEN 챌린지 | https://catchmeme.com/memes/36dchkt4-%EB%A5%B4%EC%84%B8%EB%9D%BC%ED%95%8C-UNFORGIVEN-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 256 | 유래 48/80; 쓰임 17/40; 예문 0/2 | 예문<2 | 312.77 |
| 150 | 5tzq929b | 얼음(제프프) | https://catchmeme.com/memes/5tzq929b-%EC%96%BC%EC%9D%8C(%EC%A0%9C%ED%94%84%ED%94%84) | 229 | 유래 35/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 312.77 |
| 151 | av9fpdec | SPOT! 챌린지 | https://catchmeme.com/memes/av9fpdec-SPOT!-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 226 | 유래 30/80; 쓰임 17/40; 예문 0/2 | 예문<2 | 312.77 |
| 152 | grjbe3me | 굿바이 선언 핑거텃팅 챌린지 | https://catchmeme.com/memes/grjbe3me-%EA%B5%BF%EB%B0%94%EC%9D%B4-%EC%84%A0%EC%96%B8-%ED%95%91%EA%B1%B0%ED%85%83%ED%8C%85-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 263 | 유래 54/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 312.77 |
| 153 | t8wncvva | BTS 다이너마이트 챌린지 | https://catchmeme.com/memes/t8wncvva-BTS-%EB%8B%A4%EC%9D%B4%EB%84%88%EB%A7%88%EC%9D%B4%ED%8A%B8-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 217 | 유래 34/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 312.77 |
| 154 | utt454nr | 마인크래프트인데 챌린지 | https://catchmeme.com/memes/utt454nr-%EB%A7%88%EC%9D%B8%ED%81%AC%EB%9E%98%ED%94%84%ED%8A%B8%EC%9D%B8%EB%8D%B0-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 254 | 유래 31/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 312.77 |
| 155 | zyphpj9x | 우영우 고래 상상 | https://catchmeme.com/memes/zyphpj9x-%EC%9A%B0%EC%98%81%EC%9A%B0-%EA%B3%A0%EB%9E%98-%EC%83%81%EC%83%81 | 222 | 유래 39/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 312.77 |
| 156 | wyq9pwfx | 아파트 챌린지 | https://catchmeme.com/memes/wyq9pwfx-%EC%95%84%ED%8C%8C%ED%8A%B8-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 281 | 유래 62/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 312.77 |
| 157 | khtzbzpz | 롤린 챌린지 | https://catchmeme.com/memes/khtzbzpz-%EB%A1%A4%EB%A6%B0-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 202 | 뜻 120/150; 유래 61/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 312.77 |
| 158 | dbyg5vmr | 김병만의 달인 | https://catchmeme.com/memes/dbyg5vmr-%EA%B9%80%EB%B3%91%EB%A7%8C%EC%9D%98-%EB%8B%AC%EC%9D%B8 | 271 | 유래 29/80; 쓰임 20/40 | 없음 | 312.77 |
| 159 | 345hhqyt | 말하지 않아도 알아요 | https://catchmeme.com/memes/345hhqyt-%EB%A7%90%ED%95%98%EC%A7%80-%EC%95%8A%EC%95%84%EB%8F%84-%EC%95%8C%EC%95%84%EC%9A%94 | 236 | 뜻 111/150; 유래 33/80; 쓰임 29/40 | 없음 | 312.77 |
| 160 | 95779y4j | Sweet Venom 챌린지 | https://catchmeme.com/memes/95779y4j-Sweet-Venom-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 245 | 뜻 136/150; 유래 35/80; 쓰임 18/40 | 없음 | 312.77 |
| 161 | yqyfvsbf | WICKED 챌린지 | https://catchmeme.com/memes/yqyfvsbf-WICKED-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 238 | 뜻 149/150; 유래 64/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 312.77 |
| 162 | wb9xzdk9 | 아기상어 챌린지 | https://catchmeme.com/memes/wb9xzdk9-%EC%95%84%EA%B8%B0%EC%83%81%EC%96%B4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 249 | 유래 65/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 312.77 |
| 163 | xtm69k7y | 밥은 먹고 다니냐 | https://catchmeme.com/memes/xtm69k7y-%EB%B0%A5%EC%9D%80-%EB%A8%B9%EA%B3%A0-%EB%8B%A4%EB%8B%88%EB%83%90 | 204 | 뜻 96/150; 유래 20/80; 쓰임 29/40 | 없음 | 312.77 |
| 164 | bbncxqzh | 안정환 반지 세리머니 | https://catchmeme.com/memes/bbncxqzh-%EC%95%88%EC%A0%95%ED%99%98-%EB%B0%98%EC%A7%80-%EC%84%B8%EB%A6%AC%EB%A8%B8%EB%8B%88 | 264 | 뜻 145/150; 유래 40/80; 쓰임 29/40 | 없음 | 312.77 |
| 165 | ah2zk3m5 | 나만 아니면 돼 | https://catchmeme.com/memes/ah2zk3m5-%EB%82%98%EB%A7%8C%20%EC%95%84%EB%8B%88%EB%A9%B4%20%EB%8F%BC | 330 | 유래 56/80; 쓰임 20/40 | 없음 | 312.27 |
| 166 | tnnfvu2g | 베리 데뮤어 베리 마인드풀(Very Demure) | https://catchmeme.com/memes/tnnfvu2g-%EB%B2%A0%EB%A6%AC-%EB%8D%B0%EB%AE%A4%EC%96%B4-%EB%B2%A0%EB%A6%AC-%EB%A7%88%EC%9D%B8%EB%93%9C%ED%92%80(Very-Demure) | 236 | 유래 63/80; 쓰임 19/40; 예문 0/2 | 예문<2 | 312.27 |
| 167 | fz5m2esm | 대만 카스테라 (기대와 실제) | https://catchmeme.com/memes/fz5m2esm-%EB%8C%80%EB%A7%8C-%EC%B9%B4%EC%8A%A4%ED%85%8C%EB%9D%BC-(%EA%B8%B0%EB%8C%80%EC%99%80-%EC%8B%A4%EC%A0%9C) | 301 | 쓰임 29/40; 예문 0/2 | 예문<2 | 312.27 |
| 168 | xzuq6vjn | 발레코어 | https://catchmeme.com/memes/xzuq6vjn-%EB%B0%9C%EB%A0%88%EC%BD%94%EC%96%B4 | 292 | 쓰임 36/40; 예문 0/2 | 예문<2 | 312.27 |
| 169 | vgvk953t | 난 대표 난 직원 | https://catchmeme.com/memes/vgvk953t-%EB%82%9C-%EB%8C%80%ED%91%9C-%EB%82%9C-%EC%A7%81%EC%9B%90 | 267 | 유래 78/80; 쓰임 33/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 312.27 |
| 170 | 3adrpfgm | 짱구는 못말려 어른제국의 역습 발냄새 명장면 | https://catchmeme.com/memes/3adrpfgm-%EC%A7%B1%EA%B5%AC%EB%8A%94-%EB%AA%BB%EB%A7%90%EB%A0%A4-%EC%96%B4%EB%A5%B8%EC%A0%9C%EA%B5%AD%EC%9D%98-%EC%97%AD%EC%8A%B5-%EB%B0%9C%EB%83%84%EC%83%88-%EB%AA%85%EC%9E%A5%EB%A9%B4 | 221 | 유래 31/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 312.27 |
| 171 | evszsngb | 삼연벙 | https://catchmeme.com/memes/evszsngb-%EC%82%BC%EC%97%B0%EB%B2%99 | 266 | 유래 43/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 312.27 |
| 172 | 3y38wqtq | 맥심 TOP 네가 그냥 커피였다면 이여자는 TOP야 | https://catchmeme.com/memes/3y38wqtq-%EB%A7%A5%EC%8B%AC-TOP-%EB%84%A4%EA%B0%80-%EA%B7%B8%EB%83%A5-%EC%BB%A4%ED%94%BC%EC%98%80%EB%8B%A4%EB%A9%B4-%EC%9D%B4%EC%97%AC%EC%9E%90%EB%8A%94-TOP%EC%95%BC | 264 | 유래 39/80; 쓰임 37/40; 예문 0/2 | 예문<2 | 312.27 |
| 173 | 4my2fxb8 | SK텔레콤 잘생겼다 | https://catchmeme.com/memes/4my2fxb8-SK%ED%85%94%EB%A0%88%EC%BD%A4-%EC%9E%98%EC%83%9D%EA%B2%BC%EB%8B%A4 | 238 | 유래 42/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 312.27 |
| 174 | 5qxk2b2d | 흔한 여고생들의 뻘짓 | https://catchmeme.com/memes/5qxk2b2d-%ED%9D%94%ED%95%9C-%EC%97%AC%EA%B3%A0%EC%83%9D%EB%93%A4%EC%9D%98-%EB%BB%98%EC%A7%93 | 214 | 유래 33/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 312.27 |
| 175 | gsbfuwbr | 오니기리 댄스 | https://catchmeme.com/memes/gsbfuwbr-%EC%98%A4%EB%8B%88%EA%B8%B0%EB%A6%AC-%EB%8C%84%EC%8A%A4 | 256 | 유래 61/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 312.27 |
| 176 | seyvwjtz | 요나요나 댄스 | https://catchmeme.com/memes/seyvwjtz-%EC%9A%94%EB%82%98%EC%9A%94%EB%82%98-%EB%8C%84%EC%8A%A4 | 249 | 유래 67/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 312.27 |
| 177 | 4adudx69 | 워크맨 선넘규 | https://catchmeme.com/memes/4adudx69-%EC%9B%8C%ED%81%AC%EB%A7%A8-%EC%84%A0%EB%84%98%EA%B7%9C | 226 | 유래 34/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 312.27 |
| 178 | g338yhcj | PICK ME (국민 프로듀서) | https://catchmeme.com/memes/g338yhcj-PICK-ME-(%EA%B5%AD%EB%AF%BC-%ED%94%84%EB%A1%9C%EB%93%80%EC%84%9C) | 261 | 유래 50/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 312.27 |
| 179 | mar9fhpz | 오버워치 씨나인(C9) | https://catchmeme.com/memes/mar9fhpz-%EC%98%A4%EB%B2%84%EC%9B%8C%EC%B9%98-%EC%94%A8%EB%82%98%EC%9D%B8(C9) | 216 | 유래 31/80; 쓰임 21/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 312.27 |
| 180 | wsb3xunv | 현진영 '흐린 기억 속의 그대' | https://catchmeme.com/memes/wsb3xunv-%ED%98%84%EC%A7%84%EC%98%81-%ED%9D%90%EB%A6%B0-%EA%B8%B0%EC%96%B5-%EC%86%8D%EC%9D%98-%EA%B7%B8%EB%8C%80 | 394 | 뜻 86/150; 쓰임 34/40; 예문 0/2 | 예문<2 | 312.27 |
| 181 | ytztxw8w | 크레이지아케이드 | https://catchmeme.com/memes/ytztxw8w-%ED%81%AC%EB%A0%88%EC%9D%B4%EC%A7%80%EC%95%84%EC%BC%80%EC%9D%B4%EB%93%9C | 386 | 뜻 101/150; 쓰임 35/40; 예문 0/2 | 예문<2 | 312.27 |
| 182 | sexkn7zy | 2026 이즈 더 뉴 2016 | https://catchmeme.com/memes/sexkn7zy-2026-%EC%9D%B4%EC%A6%88-%EB%8D%94-%EB%89%B4-2016 | 222 | 유래 33/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 312.27 |
| 183 | uy9b4gse | god - 촛불하나 | https://catchmeme.com/memes/uy9b4gse-god---%EC%B4%9B%EB%B6%88%ED%95%98%EB%82%98 | 252 | 뜻 129/150; 유래 32/80; 쓰임 27/40 | 없음 | 312.27 |
| 184 | jmdj7dnn | 미끄러우니까 | https://catchmeme.com/memes/jmdj7dnn-%EB%AF%B8%EB%81%84%EB%9F%AC%EC%9A%B0%EB%8B%88%EA%B9%8C | 212 | 뜻 109/150; 유래 42/80; 쓰임 27/40 | 없음 | 312.27 |
| 185 | fu9du7qr | 젝스키스 해체 | https://catchmeme.com/memes/fu9du7qr-%EC%A0%9D%EC%8A%A4%ED%82%A4%EC%8A%A4-%ED%95%B4%EC%B2%B4 | 261 | 뜻 133/150; 유래 46/80; 쓰임 33/40 | 없음 | 312.27 |
| 186 | h5ragtd9 | 이수영 - 라라라 | https://catchmeme.com/memes/h5ragtd9-%EC%9D%B4%EC%88%98%EC%98%81---%EB%9D%BC%EB%9D%BC%EB%9D%BC | 222 | 뜻 102/150; 유래 40/80; 쓰임 26/40 | 없음 | 312.27 |
| 187 | h96gngqq | 아브라카다브라 시건방춤 | https://catchmeme.com/memes/h96gngqq-%EC%95%84%EB%B8%8C%EB%9D%BC%EC%B9%B4%EB%8B%A4%EB%B8%8C%EB%9D%BC-%EC%8B%9C%EA%B1%B4%EB%B0%A9%EC%B6%A4 | 202 | 뜻 97/150; 유래 33/80; 쓰임 24/40 | 없음 | 312.27 |
| 188 | 6zthbesc | 붉은악마 치우천왕 로고 | https://catchmeme.com/memes/6zthbesc-%EB%B6%89%EC%9D%80%EC%95%85%EB%A7%88-%EC%B9%98%EC%9A%B0%EC%B2%9C%EC%99%95-%EB%A1%9C%EA%B3%A0 | 277 | 유래 48/80; 쓰임 27/40 | 없음 | 312.27 |
| 189 | vvnu9avn | 됐어! 나 빈정 상했어!(감수성) | https://catchmeme.com/memes/vvnu9avn-%EB%90%90%EC%96%B4!-%EB%82%98-%EB%B9%88%EC%A0%95-%EC%83%81%ED%96%88%EC%96%B4!(%EA%B0%90%EC%88%98%EC%84%B1) | 242 | 뜻 128/150; 유래 36/80; 쓰임 29/40 | 없음 | 312.27 |
| 190 | gahs5c53 | god - 길 | https://catchmeme.com/memes/gahs5c53-god---%EA%B8%B8 | 256 | 뜻 120/150; 유래 33/80; 쓰임 29/40 | 없음 | 312.27 |
| 191 | 9ctd73f3 | 코리안특급 | https://catchmeme.com/memes/9ctd73f3-%EC%BD%94%EB%A6%AC%EC%95%88%ED%8A%B9%EA%B8%89 | 231 | 뜻 125/150; 유래 31/80; 쓰임 30/40 | 없음 | 312.27 |
| 192 | 6bgyw6gb | 몬주익의 영웅 | https://catchmeme.com/memes/6bgyw6gb-%EB%AA%AC%EC%A3%BC%EC%9D%B5%EC%9D%98-%EC%98%81%EC%9B%85 | 236 | 뜻 136/150; 유래 31/80; 쓰임 23/40 | 없음 | 312.27 |
| 193 | yqdxbwde | 몰래카메라 | https://catchmeme.com/memes/yqdxbwde-%EB%AA%B0%EB%9E%98%EC%B9%B4%EB%A9%94%EB%9D%BC | 234 | 뜻 125/150; 유래 43/80; 쓰임 22/40 | 없음 | 312.27 |
| 194 | uskrnffh | 나야나(프로듀스101) | https://catchmeme.com/memes/uskrnffh-%EB%82%98%EC%95%BC%EB%82%98(%ED%94%84%EB%A1%9C%EB%93%80%EC%8A%A4101) | 248 | 뜻 139/150; 유래 33/80; 쓰임 33/40 | 없음 | 312.27 |
| 195 | se4qd2ak | 캔 - 내 생에 봄날은... | https://catchmeme.com/memes/se4qd2ak-%EC%BA%94---%EB%82%B4-%EC%83%9D%EC%97%90-%EB%B4%84%EB%82%A0%EC%9D%80... | 229 | 뜻 111/150; 유래 38/80; 쓰임 30/40 | 없음 | 312.27 |
| 196 | rk3w632x | 중꺾마 | https://catchmeme.com/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88 | 267 | 뜻 147/150; 유래 38/80; 쓰임 25/40 | 없음 | 312.27 |
| 197 | vqmpgaba | 대~한민국 박수 응원 | https://catchmeme.com/memes/vqmpgaba-%EB%8C%80~%ED%95%9C%EB%AF%BC%EA%B5%AD-%EB%B0%95%EC%88%98-%EC%9D%91%EC%9B%90 | 213 | 뜻 96/150; 유래 42/80; 쓰임 28/40 | 없음 | 312.27 |
| 198 | uvdujpcy | 그리운 어머니 | https://catchmeme.com/memes/uvdujpcy-%EA%B7%B8%EB%A6%AC%EC%9A%B4-%EC%96%B4%EB%A8%B8%EB%8B%88 | 264 | 뜻 140/150; 유래 45/80; 쓰임 24/40 | 없음 | 312.27 |
| 199 | 7szbuhgt | god의 육아일기 | https://catchmeme.com/memes/7szbuhgt-god%EC%9D%98-%EC%9C%A1%EC%95%84%EC%9D%BC%EA%B8%B0 | 214 | 뜻 94/150; 유래 38/80; 쓰임 22/40 | 없음 | 312.27 |
| 200 | yp9aj4pw | 신화 - Wild Eyes 의자 퍼포먼스 | https://catchmeme.com/memes/yp9aj4pw-%EC%8B%A0%ED%99%94---Wild-Eyes-%EC%9D%98%EC%9E%90-%ED%8D%BC%ED%8F%AC%EB%A8%BC%EC%8A%A4 | 251 | 뜻 124/150; 유래 46/80; 쓰임 28/40 | 없음 | 312.27 |
| 201 | tmcdckvn | 슈퍼주니어 쏘리쏘리 | https://catchmeme.com/memes/tmcdckvn-%EC%8A%88%ED%8D%BC%EC%A3%BC%EB%8B%88%EC%96%B4-%EC%8F%98%EB%A6%AC%EC%8F%98%EB%A6%AC | 270 | 유래 35/80; 쓰임 31/40 | 없음 | 312.27 |
| 202 | 9sqg76n8 | 여러분(임재범, 나는가수다) | https://catchmeme.com/memes/9sqg76n8-%EC%97%AC%EB%9F%AC%EB%B6%84(%EC%9E%84%EC%9E%AC%EB%B2%94%2C-%EB%82%98%EB%8A%94%EA%B0%80%EC%88%98%EB%8B%A4) | 247 | 뜻 115/150; 유래 36/80; 쓰임 27/40 | 없음 | 312.27 |
| 203 | 8kdqbymh | 범 내려온다 챌린지 (이날치) | https://catchmeme.com/memes/8kdqbymh-%EB%B2%94%20%EB%82%B4%EB%A0%A4%EC%98%A8%EB%8B%A4%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%9D%B4%EB%82%A0%EC%B9%98) | 262 | 유래 60/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 310.00 |
| 204 | 4vncsqnc | 우즈(WOODZ) Drowning 커버 챌린지 | https://catchmeme.com/memes/4vncsqnc-%EC%9A%B0%EC%A6%88(WOODZ)-Drowning-%EC%BB%A4%EB%B2%84-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 319 | 쓰임 31/40; 예문 0/2 | 예문<2 | 310.00 |
| 205 | yzxswwzs | 트와이스 날 바라바라봐 챌린지 | https://catchmeme.com/memes/yzxswwzs-%ED%8A%B8%EC%99%80%EC%9D%B4%EC%8A%A4-%EB%82%A0-%EB%B0%94%EB%9D%BC%EB%B0%94%EB%9D%BC%EB%B4%90-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 356 | 쓰임 34/40; 예문 0/2 | 예문<2 | 310.00 |
| 206 | zqpjhnvs | 잔나비 주저하는 연인들을 위해 커버 챌린지 | https://catchmeme.com/memes/zqpjhnvs-%EC%9E%94%EB%82%98%EB%B9%84-%EC%A3%BC%EC%A0%80%ED%95%98%EB%8A%94-%EC%97%B0%EC%9D%B8%EB%93%A4%EC%9D%84-%EC%9C%84%ED%95%B4-%EC%BB%A4%EB%B2%84-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 273 | 유래 78/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 310.00 |
| 207 | wjhrdbej | BTS 버터(Butter) 챌린지 | https://catchmeme.com/memes/wjhrdbej-BTS-%EB%B2%84%ED%84%B0(Butter)-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 255 | 유래 71/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 310.00 |
| 208 | fjhcw2w7 | 귀멸의 칼날 무한열차편 한국 흥행 | https://catchmeme.com/memes/fjhcw2w7-%EA%B7%80%EB%A9%B8%EC%9D%98-%EC%B9%BC%EB%82%A0-%EB%AC%B4%ED%95%9C%EC%97%B4%EC%B0%A8%ED%8E%B8-%ED%95%9C%EA%B5%AD-%ED%9D%A5%ED%96%89 | 238 | 유래 30/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 310.00 |
| 209 | txhw84yg | 무한도전 댄스스포츠 특집 | https://catchmeme.com/memes/txhw84yg-%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84-%EB%8C%84%EC%8A%A4%EC%8A%A4%ED%8F%AC%EC%B8%A0-%ED%8A%B9%EC%A7%91 | 280 | 유래 31/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 310.00 |
| 210 | uvkw33ur | 바디프로필 열풍 | https://catchmeme.com/memes/uvkw33ur-%EB%B0%94%EB%94%94%ED%94%84%EB%A1%9C%ED%95%84-%EC%97%B4%ED%92%8D | 208 | 유래 32/80; 쓰임 19/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 310.00 |
| 211 | dqq2mw57 | 김동문-하태권 배드민턴 복식 금메달 | https://catchmeme.com/memes/dqq2mw57-%EA%B9%80%EB%8F%99%EB%AC%B8-%ED%95%98%ED%83%9C%EA%B6%8C-%EB%B0%B0%EB%93%9C%EB%AF%BC%ED%84%B4-%EB%B3%B5%EC%8B%9D-%EA%B8%88%EB%A9%94%EB%8B%AC | 270 | 유래 42/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 310.00 |
| 212 | g29fb9dn | 런닝맨 100회 신들의 전쟁 김종국 헤라클레스 | https://catchmeme.com/memes/g29fb9dn-%EB%9F%B0%EB%8B%9D%EB%A7%A8-100%ED%9A%8C-%EC%8B%A0%EB%93%A4%EC%9D%98-%EC%A0%84%EC%9F%81-%EA%B9%80%EC%A2%85%EA%B5%AD-%ED%97%A4%EB%9D%BC%ED%81%B4%EB%A0%88%EC%8A%A4 | 282 | 유래 46/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 310.00 |
| 213 | yjf4wc7t | 무한도전 극한알바 | https://catchmeme.com/memes/yjf4wc7t-%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84-%EA%B7%B9%ED%95%9C%EC%95%8C%EB%B0%94 | 251 | 유래 31/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 310.00 |
| 214 | yv2fk2un | 배달의 무도 | https://catchmeme.com/memes/yv2fk2un-%EB%B0%B0%EB%8B%AC%EC%9D%98-%EB%AC%B4%EB%8F%84 | 277 | 유래 44/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 310.00 |
| 215 | h6wskk4v | 친구의 친구를 사랑했네 | https://catchmeme.com/memes/h6wskk4v-%EC%B9%9C%EA%B5%AC%EC%9D%98-%EC%B9%9C%EA%B5%AC%EB%A5%BC-%EC%82%AC%EB%9E%91%ED%96%88%EB%84%A4 | 237 | 유래 31/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 310.00 |
| 216 | g76rc5fs | 에픽하이 Love Love Love 챌린지 | https://catchmeme.com/memes/g76rc5fs-%EC%97%90%ED%94%BD%ED%95%98%EC%9D%B4-Love-Love-Love-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 230 | 유래 35/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 310.00 |
| 217 | hedg9ts8 | 한도초과 챌린지 | https://catchmeme.com/memes/hedg9ts8-%ED%95%9C%EB%8F%84%EC%B4%88%EA%B3%BC-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 232 | 유래 37/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 310.00 |
| 218 | msgmqmd2 | 이태원클라쓰 내가치 명대사 | https://catchmeme.com/memes/msgmqmd2-%EC%9D%B4%ED%83%9C%EC%9B%90%ED%81%B4%EB%9D%BC%EC%93%B0-%EB%82%B4%EA%B0%80%EC%B9%98-%EB%AA%85%EB%8C%80%EC%82%AC | 224 | 유래 40/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 310.00 |
| 219 | xxaw8946 | 소녀시대 Forever 1 15주년 | https://catchmeme.com/memes/xxaw8946-%EC%86%8C%EB%85%80%EC%8B%9C%EB%8C%80-Forever-1-15%EC%A3%BC%EB%85%84 | 226 | 유래 47/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 310.00 |
| 220 | 3pr36rva | 뚜두뚜두 신드롬 | https://catchmeme.com/memes/3pr36rva-%EB%9A%9C%EB%91%90%EB%9A%9C%EB%91%90-%EC%8B%A0%EB%93%9C%EB%A1%AC | 237 | 유래 34/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 310.00 |
| 221 | frts2rns | TT 표정·손가락 챌린지 (트와이스) | https://catchmeme.com/memes/frts2rns-TT-%ED%91%9C%EC%A0%95%C2%B7%EC%86%90%EA%B0%80%EB%9D%BD-%EC%B1%8C%EB%A6%B0%EC%A7%80-(%ED%8A%B8%EC%99%80%EC%9D%B4%EC%8A%A4) | 228 | 유래 34/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 310.00 |
| 222 | gqv25muj | 나야 나(PICK ME) 신드롬 | https://catchmeme.com/memes/gqv25muj-%EB%82%98%EC%95%BC-%EB%82%98(PICK-ME)-%EC%8B%A0%EB%93%9C%EB%A1%AC | 243 | 유래 30/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 310.00 |
| 223 | mxd7cr4q | 1일1깡 챌린지 | https://catchmeme.com/memes/mxd7cr4q-1%EC%9D%BC1%EA%B9%A1-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 248 | 유래 39/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 310.00 |
| 224 | r5c8z67g | 다시 여기 바닷가 챌린지 | https://catchmeme.com/memes/r5c8z67g-%EB%8B%A4%EC%8B%9C-%EC%97%AC%EA%B8%B0-%EB%B0%94%EB%8B%B7%EA%B0%80-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 232 | 유래 43/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 310.00 |
| 225 | wuehr6zv | 누가 기침 소리를 내었는가 | https://catchmeme.com/memes/wuehr6zv-%EB%88%84%EA%B0%80-%EA%B8%B0%EC%B9%A8-%EC%86%8C%EB%A6%AC%EB%A5%BC-%EB%82%B4%EC%97%88%EB%8A%94%EA%B0%80 | 227 | 유래 39/80; 쓰임 33/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 310.00 |
| 226 | mfm9qqd7 | 흑당버블티 대란 | https://catchmeme.com/memes/mfm9qqd7-%ED%9D%91%EB%8B%B9%EB%B2%84%EB%B8%94%ED%8B%B0-%EB%8C%80%EB%9E%80 | 209 | 유래 34/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 310.00 |
| 227 | z6zarg9q | 두바이초콜릿 신드롬 | https://catchmeme.com/memes/z6zarg9q-%EB%91%90%EB%B0%94%EC%9D%B4%EC%B4%88%EC%BD%9C%EB%A6%BF-%EC%8B%A0%EB%93%9C%EB%A1%AC | 214 | 유래 36/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 310.00 |
| 228 | fhn6bcju | 원더걸스 Tell Me 꼭지점춤 | https://catchmeme.com/memes/fhn6bcju-%EC%9B%90%EB%8D%94%EA%B1%B8%EC%8A%A4-Tell-Me-%EA%BC%AD%EC%A7%80%EC%A0%90%EC%B6%A4 | 283 | 유래 41/80; 쓰임 38/40 | 없음 | 310.00 |
| 229 | pkw94me8 | 텔미 신드롬 | https://catchmeme.com/memes/pkw94me8-%ED%85%94%EB%AF%B8-%EC%8B%A0%EB%93%9C%EB%A1%AC | 257 | 뜻 130/150; 유래 52/80; 쓰임 28/40 | 없음 | 310.00 |
| 230 | rnxadw4b | 짜파구리 신드롬(윤후) | https://catchmeme.com/memes/rnxadw4b-%EC%A7%9C%ED%8C%8C%EA%B5%AC%EB%A6%AC-%EC%8B%A0%EB%93%9C%EB%A1%AC(%EC%9C%A4%ED%9B%84) | 212 | 뜻 108/150; 유래 32/80; 쓰임 27/40 | 없음 | 310.00 |
| 231 | 7x27yksp | 호박고구마 | https://catchmeme.com/memes/7x27yksp-%ED%98%B8%EB%B0%95%EA%B3%A0%EA%B5%AC%EB%A7%88 | 294 | 유래 38/80; 쓰임 26/40 | 없음 | 310.00 |
| 232 | 5pnbhqdj | Armageddon 챌린지 | https://catchmeme.com/memes/5pnbhqdj-Armageddon-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 213 | 유래 31/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 310.00 |
| 233 | 6dqfb248 | 큐피드 챌린지 | https://catchmeme.com/memes/6dqfb248-%ED%81%90%ED%94%BC%EB%93%9C-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 222 | 유래 44/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 310.00 |
| 234 | srucfb7w | 세븐틴 손오공(Super) 챌린지 | https://catchmeme.com/memes/srucfb7w-%EC%84%B8%EB%B8%90%ED%8B%B4-%EC%86%90%EC%98%A4%EA%B3%B5(Super)-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 210 | 유래 39/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 310.00 |
| 235 | qdcmh8eu | 무한도전 소년명수 | https://catchmeme.com/memes/qdcmh8eu-%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84-%EC%86%8C%EB%85%84%EB%AA%85%EC%88%98 | 231 | 유래 36/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 310.00 |
| 236 | xsk9gx3x | 달고나커피 챌린지 | https://catchmeme.com/memes/xsk9gx3x-%EB%8B%AC%EA%B3%A0%EB%82%98%EC%BB%A4%ED%94%BC-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 280 | 유래 39/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 310.00 |
| 237 | yn6sp2b6 | 원더걸스 Nobody 총알춤 | https://catchmeme.com/memes/yn6sp2b6-%EC%9B%90%EB%8D%94%EA%B1%B8%EC%8A%A4-Nobody-%EC%B4%9D%EC%95%8C%EC%B6%A4 | 268 | 유래 34/80; 쓰임 34/40 | 없음 | 310.00 |
| 238 | wkyfyry2 | 조째즈 모르시나요 | https://catchmeme.com/memes/wkyfyry2-%EC%A1%B0%EC%A7%B8%EC%A6%88-%EB%AA%A8%EB%A5%B4%EC%8B%9C%EB%82%98%EC%9A%94 | 301 | 쓰임 33/40; 예문 0/2 | 예문<2 | 309.50 |
| 239 | zm9cegzj | 걸 매스(Girl Math) | https://catchmeme.com/memes/zm9cegzj-%EA%B1%B8-%EB%A7%A4%EC%8A%A4(Girl-Math) | 223 | 유래 49/80; 쓰임 19/40; 예문 0/2 | 예문<2 | 309.50 |
| 240 | b2gj57d2 | 크로플 | https://catchmeme.com/memes/b2gj57d2-%ED%81%AC%EB%A1%9C%ED%94%8C | 284 | 쓰임 28/40; 예문 0/2 | 예문<2 | 309.50 |
| 241 | 6zfkg7jf | 진짜 사나이 여군특집 2기 | https://catchmeme.com/memes/6zfkg7jf-%EC%A7%84%EC%A7%9C-%EC%82%AC%EB%82%98%EC%9D%B4-%EC%97%AC%EA%B5%B0%ED%8A%B9%EC%A7%91-2%EA%B8%B0 | 257 | 유래 37/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 242 | ca7mr6u4 | 놀면 뭐하니 유르페우스 | https://catchmeme.com/memes/ca7mr6u4-%EB%86%80%EB%A9%B4-%EB%AD%90%ED%95%98%EB%8B%88-%EC%9C%A0%EB%A5%B4%ED%8E%98%EC%9A%B0%EC%8A%A4 | 282 | 유래 32/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 309.50 |
| 243 | 2t366863 | 성전 | https://catchmeme.com/memes/2t366863-%EC%84%B1%EC%A0%84 | 226 | 유래 38/80; 쓰임 27/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 309.50 |
| 244 | 4ae4pkpa | MSG 워너비 | https://catchmeme.com/memes/4ae4pkpa-MSG-%EC%9B%8C%EB%84%88%EB%B9%84 | 234 | 유래 25/80; 예문 0/2 | 예문<2 | 309.50 |
| 245 | b6xambed | 2018 오버워치 월드컵 3연속 우승 | https://catchmeme.com/memes/b6xambed-2018-%EC%98%A4%EB%B2%84%EC%9B%8C%EC%B9%98-%EC%9B%94%EB%93%9C%EC%BB%B5-3%EC%97%B0%EC%86%8D-%EC%9A%B0%EC%8A%B9 | 278 | 유래 34/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 309.50 |
| 246 | bvwf8cuc | 폭풍저그 | https://catchmeme.com/memes/bvwf8cuc-%ED%8F%AD%ED%92%8D%EC%A0%80%EA%B7%B8 | 221 | 유래 32/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 309.50 |
| 247 | pkx7cwn9 | 이승엽 은퇴투어 (2017) | https://catchmeme.com/memes/pkx7cwn9-%EC%9D%B4%EC%8A%B9%EC%97%BD-%EC%9D%80%ED%87%B4%ED%88%AC%EC%96%B4-(2017) | 286 | 유래 33/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 248 | qysc867v | 몰래 배럭 | https://catchmeme.com/memes/qysc867v-%EB%AA%B0%EB%9E%98-%EB%B0%B0%EB%9F%AD | 222 | 유래 35/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 309.50 |
| 249 | uz7ajy2f | 이상화-고다이라 나나 우정 | https://catchmeme.com/memes/uz7ajy2f-%EC%9D%B4%EC%83%81%ED%99%94-%EA%B3%A0%EB%8B%A4%EC%9D%B4%EB%9D%BC-%EB%82%98%EB%82%98-%EC%9A%B0%EC%A0%95 | 281 | 유래 34/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 250 | 825vr6ts | 한솔PCS 018 나는 열여덟살이다 | https://catchmeme.com/memes/825vr6ts-%ED%95%9C%EC%86%94PCS-018-%EB%82%98%EB%8A%94-%EC%97%B4%EC%97%AC%EB%8D%9F%EC%82%B4%EC%9D%B4%EB%8B%A4 | 235 | 유래 37/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 309.50 |
| 251 | 8uxwctr5 | LG 싸이언 롤리팝 | https://catchmeme.com/memes/8uxwctr5-LG-%EC%8B%B8%EC%9D%B4%EC%96%B8-%EB%A1%A4%EB%A6%AC%ED%8C%9D | 235 | 유래 38/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 309.50 |
| 252 | eyzphcew | 슈틸리케 매직 (2015 아시안컵) | https://catchmeme.com/memes/eyzphcew-%EC%8A%88%ED%8B%B8%EB%A6%AC%EC%BC%80-%EB%A7%A4%EC%A7%81-(2015-%EC%95%84%EC%8B%9C%EC%95%88%EC%BB%B5) | 278 | 유래 30/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 309.50 |
| 253 | fxp7dc8y | KIA타이거즈 남행열차 응원가 | https://catchmeme.com/memes/fxp7dc8y-KIA%ED%83%80%EC%9D%B4%EA%B1%B0%EC%A6%88-%EB%82%A8%ED%96%89%EC%97%B4%EC%B0%A8-%EC%9D%91%EC%9B%90%EA%B0%80 | 271 | 유래 33/80; 예문 0/2 | 예문<2 | 309.50 |
| 254 | gqdszbfz | 나는 행복합니다 (한화 이글스 행복송) | https://catchmeme.com/memes/gqdszbfz-%EB%82%98%EB%8A%94-%ED%96%89%EB%B3%B5%ED%95%A9%EB%8B%88%EB%8B%A4-(%ED%95%9C%ED%99%94-%EC%9D%B4%EA%B8%80%EC%8A%A4-%ED%96%89%EB%B3%B5%EC%86%A1) | 271 | 유래 38/80; 예문 0/2 | 예문<2 | 309.50 |
| 255 | kkk7mx6b | 이종범 바람의 아들 | https://catchmeme.com/memes/kkk7mx6b-%EC%9D%B4%EC%A2%85%EB%B2%94-%EB%B0%94%EB%9E%8C%EC%9D%98-%EC%95%84%EB%93%A4 | 233 | 유래 34/80; 예문 0/2 | 예문<2 | 309.50 |
| 256 | mk8x29m5 | 신칸센 대탈선슛 | https://catchmeme.com/memes/mk8x29m5-%EC%8B%A0%EC%B9%B8%EC%84%BC-%EB%8C%80%ED%83%88%EC%84%A0%EC%8A%9B | 268 | 유래 42/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 309.50 |
| 257 | n8k3v9q9 | 산수유 참 좋은데 | https://catchmeme.com/memes/n8k3v9q9-%EC%82%B0%EC%88%98%EC%9C%A0-%EC%B0%B8-%EC%A2%8B%EC%9D%80%EB%8D%B0 | 233 | 유래 30/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 309.50 |
| 258 | 4rtvhvea | 아냐 포저의 표정 | https://catchmeme.com/memes/4rtvhvea-%EC%95%84%EB%83%90-%ED%8F%AC%EC%A0%80%EC%9D%98-%ED%91%9C%EC%A0%95 | 222 | 유래 39/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 309.50 |
| 259 | 77cwv2g8 | 티니핑 맞히기 | https://catchmeme.com/memes/77cwv2g8-%ED%8B%B0%EB%8B%88%ED%95%91-%EB%A7%9E%ED%9E%88%EA%B8%B0 | 247 | 유래 35/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 309.50 |
| 260 | 92rv6nfp | 우리 엄마엄마가 밈 | https://catchmeme.com/memes/92rv6nfp-%EC%9A%B0%EB%A6%AC-%EC%97%84%EB%A7%88%EC%97%84%EB%A7%88%EA%B0%80-%EB%B0%88 | 223 | 유래 36/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 309.50 |
| 261 | bwftje7h | 케이팝 데몬헌터스 혼문 밈 | https://catchmeme.com/memes/bwftje7h-%EC%BC%80%EC%9D%B4%ED%8C%9D-%EB%8D%B0%EB%AA%AC%ED%97%8C%ED%84%B0%EC%8A%A4-%ED%98%BC%EB%AC%B8-%EB%B0%88 | 252 | 유래 41/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 309.50 |
| 262 | uft89ccb | 쿠키런: 킹덤 | https://catchmeme.com/memes/uft89ccb-%EC%BF%A0%ED%82%A4%EB%9F%B0%3A-%ED%82%B9%EB%8D%A4 | 232 | 유래 40/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 263 | 3zrfnhew | 차줌마 (차승원) | https://catchmeme.com/memes/3zrfnhew-%EC%B0%A8%EC%A4%8C%EB%A7%88-(%EC%B0%A8%EC%8A%B9%EC%9B%90) | 212 | 유래 31/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 264 | 4dffj9s6 | 조혜련의 태보 다이어트 | https://catchmeme.com/memes/4dffj9s6-%EC%A1%B0%ED%98%9C%EB%A0%A8%EC%9D%98-%ED%83%9C%EB%B3%B4-%EB%8B%A4%EC%9D%B4%EC%96%B4%ED%8A%B8 | 266 | 유래 39/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 265 | 68waque9 | 우리동네 음악대장 (복면가왕) | https://catchmeme.com/memes/68waque9-%EC%9A%B0%EB%A6%AC%EB%8F%99%EB%84%A4-%EC%9D%8C%EC%95%85%EB%8C%80%EC%9E%A5-(%EB%B3%B5%EB%A9%B4%EA%B0%80%EC%99%95) | 222 | 유래 37/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 309.50 |
| 266 | bg7hunak | 항아리 게임 | https://catchmeme.com/memes/bg7hunak-%ED%95%AD%EC%95%84%EB%A6%AC-%EA%B2%8C%EC%9E%84 | 288 | 유래 64/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 309.50 |
| 267 | d3v853k5 | 아마존 익스프레스 세레모니 | https://catchmeme.com/memes/d3v853k5-%EC%95%84%EB%A7%88%EC%A1%B4-%EC%9D%B5%EC%8A%A4%ED%94%84%EB%A0%88%EC%8A%A4-%EC%84%B8%EB%A0%88%EB%AA%A8%EB%8B%88 | 209 | 유래 37/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 309.50 |
| 268 | m636h8p8 | 곽철용 묻고 더블로 가 | https://catchmeme.com/memes/m636h8p8-%EA%B3%BD%EC%B2%A0%EC%9A%A9-%EB%AC%BB%EA%B3%A0-%EB%8D%94%EB%B8%94%EB%A1%9C-%EA%B0%80 | 219 | 유래 33/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 309.50 |
| 269 | q2hvyc6j | 찌리찌리(오뚝이 다트) | https://catchmeme.com/memes/q2hvyc6j-%EC%B0%8C%EB%A6%AC%EC%B0%8C%EB%A6%AC(%EC%98%A4%EB%9A%9D%EC%9D%B4-%EB%8B%A4%ED%8A%B8) | 249 | 유래 43/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 309.50 |
| 270 | repzdxn4 | 애정남 | https://catchmeme.com/memes/repzdxn4-%EC%95%A0%EC%A0%95%EB%82%A8 | 208 | 유래 30/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 309.50 |
| 271 | uujn5w5a | 버억 | https://catchmeme.com/memes/uujn5w5a-%EB%B2%84%EC%96%B5 | 237 | 유래 44/80; 쓰임 19/40; 예문 0/2 | 예문<2 | 309.50 |
| 272 | wgc93agj | 탁걸리 | https://catchmeme.com/memes/wgc93agj-%ED%83%81%EA%B1%B8%EB%A6%AC | 239 | 유래 39/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 309.50 |
| 273 | zp58qm98 | 천생연분 | https://catchmeme.com/memes/zp58qm98-%EC%B2%9C%EC%83%9D%EC%97%B0%EB%B6%84 | 355 | 뜻 81/150; 쓰임 22/40; 예문 0/2 | 예문<2 | 309.50 |
| 274 | 8pgbk4qc | S.E.S. '드림' | https://catchmeme.com/memes/8pgbk4qc-S.E.S.-%EB%93%9C%EB%A6%BC | 364 | 뜻 87/150; 쓰임 33/40; 예문 0/2 | 예문<2 | 309.50 |
| 275 | cmz3rw6v | 신화 '해결사' | https://catchmeme.com/memes/cmz3rw6v-%EC%8B%A0%ED%99%94-%ED%95%B4%EA%B2%B0%EC%82%AC | 374 | 뜻 108/150; 쓰임 28/40; 예문 0/2 | 예문<2 | 309.50 |
| 276 | pgzywbqp | god 촛불 하나 | https://catchmeme.com/memes/pgzywbqp-god-%EC%B4%9B%EB%B6%88-%ED%95%98%EB%82%98 | 383 | 뜻 130/150; 쓰임 32/40; 예문 0/2 | 예문<2 | 309.50 |
| 277 | jgrnwbj7 | 너나 잘하세요 | https://catchmeme.com/memes/jgrnwbj7-%EB%84%88%EB%82%98-%EC%9E%98%ED%95%98%EC%84%B8%EC%9A%94 | 237 | 뜻 134/150; 유래 36/80; 쓰임 24/40 | 없음 | 309.50 |
| 278 | fwrmfavf | 은초딩 | https://catchmeme.com/memes/fwrmfavf-%EC%9D%80%EC%B4%88%EB%94%A9 | 177 | 뜻 102/150; 유래 8/80; 쓰임 24/40 | 없음 | 309.50 |
| 279 | qusn97eb | 꿍따리 샤바라 | https://catchmeme.com/memes/qusn97eb-%EA%BF%8D%EB%94%B0%EB%A6%AC-%EC%83%A4%EB%B0%94%EB%9D%BC | 262 | 유래 35/80; 쓰임 30/40 | 없음 | 309.50 |
| 280 | ndq8vnu3 | 패밀리가 떴다 국민남매 | https://catchmeme.com/memes/ndq8vnu3-%ED%8C%A8%EB%B0%80%EB%A6%AC%EA%B0%80-%EB%96%B4%EB%8B%A4-%EA%B5%AD%EB%AF%BC%EB%82%A8%EB%A7%A4 | 246 | 뜻 144/150; 유래 34/80; 쓰임 18/40 | 없음 | 309.50 |
| 281 | hyjqgpqj | 와(이정현) | https://catchmeme.com/memes/hyjqgpqj-%EC%99%80(%EC%9D%B4%EC%A0%95%ED%98%84) | 256 | 뜻 136/150; 유래 45/80; 쓰임 24/40 | 없음 | 309.50 |
| 282 | w7bpjq9g | 랜덤플레이댄스 | https://catchmeme.com/memes/w7bpjq9g-%EB%9E%9C%EB%8D%A4%ED%94%8C%EB%A0%88%EC%9D%B4%EB%8C%84%EC%8A%A4 | 246 | 유래 59/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 309.50 |
| 283 | wuc9greq | 직렬5기통 춤(크레용팝) | https://catchmeme.com/memes/wuc9greq-%EC%A7%81%EB%A0%AC5%EA%B8%B0%ED%86%B5-%EC%B6%A4(%ED%81%AC%EB%A0%88%EC%9A%A9%ED%8C%9D) | 236 | 뜻 131/150; 유래 35/80; 쓰임 24/40 | 없음 | 309.50 |
| 284 | g2s5d2v6 | 브라운아이드걸스 하우컴 레트로댄스 | https://catchmeme.com/memes/g2s5d2v6-%EB%B8%8C%EB%9D%BC%EC%9A%B4%EC%95%84%EC%9D%B4%EB%93%9C%EA%B1%B8%EC%8A%A4-%ED%95%98%EC%9A%B0%EC%BB%B4-%EB%A0%88%ED%8A%B8%EB%A1%9C%EB%8C%84%EC%8A%A4 | 193 | 뜻 99/150; 유래 32/80; 쓰임 22/40 | 없음 | 309.50 |
| 285 | jg8k4xpm | 손담비 미쳤어 의자춤 | https://catchmeme.com/memes/jg8k4xpm-%EC%86%90%EB%8B%B4%EB%B9%84-%EB%AF%B8%EC%B3%A4%EC%96%B4-%EC%9D%98%EC%9E%90%EC%B6%A4 | 225 | 뜻 103/150; 유래 40/80; 쓰임 21/40 | 없음 | 309.50 |
| 286 | 39fyk7an | 애정남(애매한 것을 정해주는 남자) | https://catchmeme.com/memes/39fyk7an-%EC%95%A0%EC%A0%95%EB%82%A8(%EC%95%A0%EB%A7%A4%ED%95%9C-%EA%B2%83%EC%9D%84-%EC%A0%95%ED%95%B4%EC%A3%BC%EB%8A%94-%EB%82%A8%EC%9E%90) | 255 | 뜻 134/150; 유래 35/80; 쓰임 30/40 | 없음 | 309.50 |
| 287 | s7dzq8r7 | 미달이 | https://catchmeme.com/memes/s7dzq8r7-%EB%AF%B8%EB%8B%AC%EC%9D%B4 | 227 | 뜻 123/150; 유래 34/80; 쓰임 29/40 | 없음 | 309.50 |
| 288 | pvpsw5mr | 전국 handclap 자랑 | https://catchmeme.com/memes/pvpsw5mr-%EC%A0%84%EA%B5%AD-handclap-%EC%9E%90%EB%9E%91 | 197 | 뜻 88/150; 유래 37/80; 쓰임 17/40 | 없음 | 309.50 |
| 289 | 5fbbn43b | 니들이 게맛을 알아 | https://catchmeme.com/memes/5fbbn43b-%EB%8B%88%EB%93%A4%EC%9D%B4-%EA%B2%8C%EB%A7%9B%EC%9D%84-%EC%95%8C%EC%95%84 | 239 | 뜻 124/150; 유래 39/80; 쓰임 25/40 | 없음 | 309.50 |
| 290 | emqjug5b | 카라 프리티걸 | https://catchmeme.com/memes/emqjug5b-%EC%B9%B4%EB%9D%BC-%ED%94%84%EB%A6%AC%ED%8B%B0%EA%B1%B8 | 271 | 뜻 142/150; 유래 42/80; 쓰임 23/40 | 없음 | 309.50 |
| 291 | t3aupdfa | 금 모으기 운동 | https://catchmeme.com/memes/t3aupdfa-%EA%B8%88-%EB%AA%A8%EC%9C%BC%EA%B8%B0-%EC%9A%B4%EB%8F%99 | 243 | 유래 21/80; 쓰임 24/40 | 없음 | 309.50 |
| 292 | hr4pptwy | 마라탕후루 | https://catchmeme.com/memes/hr4pptwy-%EB%A7%88%EB%9D%BC%ED%83%95%ED%9B%84%EB%A3%A8 | 248 | 뜻 104/150; 유래 51/80; 쓰임 24/40 | 없음 | 309.50 |
| 293 | x4zwc4wk | 그래, 결심했어! | https://catchmeme.com/memes/x4zwc4wk-%EA%B7%B8%EB%9E%98%2C-%EA%B2%B0%EC%8B%AC%ED%96%88%EC%96%B4! | 259 | 뜻 138/150; 유래 40/80; 쓰임 23/40 | 없음 | 309.50 |
| 294 | 5fe4c7hs | 여기서 이러시면 안됩니다(생활의 발견) | https://catchmeme.com/memes/5fe4c7hs-%EC%97%AC%EA%B8%B0%EC%84%9C-%EC%9D%B4%EB%9F%AC%EC%8B%9C%EB%A9%B4-%EC%95%88%EB%90%A9%EB%8B%88%EB%8B%A4(%EC%83%9D%ED%99%9C%EC%9D%98-%EB%B0%9C%EA%B2%AC) | 195 | 뜻 82/150; 유래 44/80; 쓰임 23/40 | 없음 | 309.50 |
| 295 | z424r776 | 동방신기 - Hug | https://catchmeme.com/memes/z424r776-%EB%8F%99%EB%B0%A9%EC%8B%A0%EA%B8%B0---Hug | 252 | 뜻 124/150; 유래 43/80; 쓰임 29/40 | 없음 | 309.50 |
| 296 | qkfk4w2b | 꿈은 이루어진다 | https://catchmeme.com/memes/qkfk4w2b-%EA%BF%88%EC%9D%80-%EC%9D%B4%EB%A3%A8%EC%96%B4%EC%A7%84%EB%8B%A4 | 218 | 뜻 122/150; 유래 35/80; 쓰임 22/40 | 없음 | 309.50 |
| 297 | 6r7eyh9y | 난 알아요 | https://catchmeme.com/memes/6r7eyh9y-%EB%82%9C-%EC%95%8C%EC%95%84%EC%9A%94 | 356 | 유래 51/80; 쓰임 30/40 | 없음 | 309.50 |
| 298 | 76yfkzpc | 4강 신화 | https://catchmeme.com/memes/76yfkzpc-4%EA%B0%95-%EC%8B%A0%ED%99%94 | 234 | 뜻 125/150; 유래 38/80; 쓰임 20/40 | 없음 | 309.50 |
| 299 | bzm4w8vy | god - 어머님께 | https://catchmeme.com/memes/bzm4w8vy-god---%EC%96%B4%EB%A8%B8%EB%8B%98%EA%BB%98 | 267 | 뜻 139/150; 유래 44/80; 쓰임 24/40 | 없음 | 309.50 |
| 300 | 2w3depwe | 비 - 나쁜 남자 | https://catchmeme.com/memes/2w3depwe-%EB%B9%84---%EB%82%98%EC%81%9C-%EB%82%A8%EC%9E%90 | 205 | 뜻 115/150; 유래 30/80; 쓰임 20/40 | 없음 | 309.50 |
| 301 | rvur5fbp | 나락퀴즈쇼 | https://catchmeme.com/memes/rvur5fbp-%EB%82%98%EB%9D%BD%ED%80%B4%EC%A6%88%EC%87%BC | 243 | 유래 32/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 241.85 |
| 302 | gq2zdefh | 시그마보이 | https://catchmeme.com/memes/gq2zdefh-%EC%8B%9C%EA%B7%B8%EB%A7%88%EB%B3%B4%EC%9D%B4 | 343 | 쓰임 36/40; 예문 0/2 | 예문<2 | 238.20 |
| 303 | wqt7ap2e | 미룬이 사건 | https://catchmeme.com/memes/wqt7ap2e-%EB%AF%B8%EB%A3%AC%EC%9D%B4-%EC%82%AC%EA%B1%B4 | 240 | 유래 34/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 234.27 |
| 304 | mzhfgwh2 | 보이루 여성혐오 논란 | https://catchmeme.com/memes/mzhfgwh2-%EB%B3%B4%EC%9D%B4%EB%A3%A8-%EC%97%AC%EC%84%B1%ED%98%90%EC%98%A4-%EB%85%BC%EB%9E%80 | 233 | 유래 30/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 231.19 |
| 305 | 35jbkzz3 | 개그콘서트 옥동자 | https://catchmeme.com/memes/35jbkzz3-%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8-%EC%98%A5%EB%8F%99%EC%9E%90 | 350 | 뜻 80/150; 쓰임 21/40; 예문 0/2 | 예문<2 | 228.87 |
| 306 | qnpmy8rf | 후드에서 살아남기 | https://catchmeme.com/memes/qnpmy8rf-%ED%9B%84%EB%93%9C%EC%97%90%EC%84%9C-%EC%82%B4%EC%95%84%EB%82%A8%EA%B8%B0 | 233 | 유래 42/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 225.60 |
| 307 | 3vaayd2t | NMIXX 장르 스위칭 논란 | https://catchmeme.com/memes/3vaayd2t-NMIXX-%EC%9E%A5%EB%A5%B4-%EC%8A%A4%EC%9C%84%EC%B9%AD-%EB%85%BC%EB%9E%80 | 225 | 유래 40/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 223.86 |
| 308 | dwgcgmup | 페이스 테이핑 | https://catchmeme.com/memes/dwgcgmup-%ED%8E%98%EC%9D%B4%EC%8A%A4-%ED%85%8C%EC%9D%B4%ED%95%91 | 234 | 뜻 123/150; 유래 70/80; 예문 0/2 | 예문<2 | 222.21 |
| 309 | ukaacy54 | 로우도깅 플라이트(Rawdogging a Flight) | https://catchmeme.com/memes/ukaacy54-%EB%A1%9C%EC%9A%B0%EB%8F%84%EA%B9%85-%ED%94%8C%EB%9D%BC%EC%9D%B4%ED%8A%B8(Rawdogging-a-Flight) | 218 | 유래 39/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 220.59 |
| 310 | cg9uvyv5 | 파이어 누들 챌린지 (불닭볶음면 챌린지) | https://catchmeme.com/memes/cg9uvyv5-%ED%8C%8C%EC%9D%B4%EC%96%B4-%EB%88%84%EB%93%A4-%EC%B1%8C%EB%A6%B0%EC%A7%80-(%EB%B6%88%EB%8B%AD%EB%B3%B6%EC%9D%8C%EB%A9%B4-%EC%B1%8C%EB%A6%B0%EC%A7%80) | 247 | 유래 32/80; 예문 0/2 | 예문<2 | 216.44 |
| 311 | cnesmmzh | 리중딱 | https://catchmeme.com/memes/cnesmmzh-%EB%A6%AC%EC%A4%91%EB%94%B1 | 239 | 유래 46/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 215.94 |
| 312 | jycwhhwk | 작업 중이야 | https://catchmeme.com/memes/jycwhhwk-%EC%9E%91%EC%97%85-%EC%A4%91%EC%9D%B4%EC%95%BC | 363 | 뜻 118/150; 쓰임 33/40; 예문 0/2 | 예문<2 | 215.05 |
| 313 | f4hfy2ta | 마이야히 | https://catchmeme.com/memes/f4hfy2ta-%EB%A7%88%EC%9D%B4%EC%95%BC%ED%9E%88 | 247 | 유래 46/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 213.89 |
| 314 | tebxgauf | 관짝소년단 | https://catchmeme.com/memes/tebxgauf-%EA%B4%80%EC%A7%9D%EC%86%8C%EB%85%84%EB%8B%A8 | 250 | 유래 72/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 213.89 |
| 315 | vcwrvwrb | 핵불닭볶음면 챌린지 | https://catchmeme.com/memes/vcwrvwrb-%ED%95%B5%EB%B6%88%EB%8B%AD%EB%B3%B6%EC%9D%8C%EB%A9%B4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 236 | 유래 28/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 212.77 |
| 316 | q3q99uw4 | 스드메 | https://catchmeme.com/memes/q3q99uw4-%EC%8A%A4%EB%93%9C%EB%A9%94 | 210 | 유래 33/80; 쓰임 21/40; 예문 0/2 | 예문<2 | 212.27 |
| 317 | dqdg5gfe | 치킨조키 밈 | https://catchmeme.com/memes/dqdg5gfe-%EC%B9%98%ED%82%A8%EC%A1%B0%ED%82%A4-%EB%B0%88 | 284 | 유래 34/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 212.27 |
| 318 | 2fdk75yd | 응 아니야 (철구) | https://catchmeme.com/memes/2fdk75yd-%EC%9D%91-%EC%95%84%EB%8B%88%EC%95%BC-(%EC%B2%A0%EA%B5%AC) | 227 | 유래 30/80; 쓰임 39/40; 예문 0/2 | 예문<2 | 212.27 |
| 319 | 5g42bsqk | 이 아이가 배가 부르다는 느낌을 알까요 | https://catchmeme.com/memes/5g42bsqk-%EC%9D%B4-%EC%95%84%EC%9D%B4%EA%B0%80-%EB%B0%B0%EA%B0%80-%EB%B6%80%EB%A5%B4%EB%8B%A4%EB%8A%94-%EB%8A%90%EB%82%8C%EC%9D%84-%EC%95%8C%EA%B9%8C%EC%9A%94 | 206 | 뜻 132/150; 유래 38/80; 쓰임 36/40; 예문 0/2 | 예문<2; 유래 추정(년경) | 212.27 |
| 320 | wwvqat4n | 화성인 바이러스 | https://catchmeme.com/memes/wwvqat4n-%ED%99%94%EC%84%B1%EC%9D%B8-%EB%B0%94%EC%9D%B4%EB%9F%AC%EC%8A%A4 | 358 | 뜻 95/150; 쓰임 27/40; 예문 0/2 | 예문<2 | 212.27 |
| 321 | 5hs3vgjc | 버피 챌린지 | https://catchmeme.com/memes/5hs3vgjc-%EB%B2%84%ED%94%BC-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 182 | 뜻 100/150; 유래 65/80; 쓰임 17/40; 예문 0/2 | 예문<2 | 210.00 |
| 322 | 9pfn5dqh | 나는 SOLO 영자·영수 커플 | https://catchmeme.com/memes/9pfn5dqh-%EB%82%98%EB%8A%94-SOLO-%EC%98%81%EC%9E%90%C2%B7%EC%98%81%EC%88%98-%EC%BB%A4%ED%94%8C | 223 | 유래 40/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 210.00 |
| 323 | wsqx3qcd | 뉴진스 Cookie 선정성 논란 | https://catchmeme.com/memes/wsqx3qcd-%EB%89%B4%EC%A7%84%EC%8A%A4-Cookie-%EC%84%A0%EC%A0%95%EC%84%B1-%EB%85%BC%EB%9E%80 | 226 | 유래 41/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 210.00 |
| 324 | bbv77z46 | KBO AI 직캠 트렌드 | https://catchmeme.com/memes/bbv77z46-KBO-AI-%EC%A7%81%EC%BA%A0-%ED%8A%B8%EB%A0%8C%EB%93%9C | 238 | 유래 34/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 210.00 |
| 325 | xh2f24uz | 홍명보 나가 | https://catchmeme.com/memes/xh2f24uz-%ED%99%8D%EB%AA%85%EB%B3%B4-%EB%82%98%EA%B0%80 | 234 | 유래 34/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 210.00 |
| 326 | 5fngfzd9 | 반칙왕 오노 | https://catchmeme.com/memes/5fngfzd9-%EB%B0%98%EC%B9%99%EC%99%95-%EC%98%A4%EB%85%B8 | 233 | 유래 44/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 210.00 |
| 327 | xxx7sxff | 키키 챌린지 | https://catchmeme.com/memes/xxx7sxff-%ED%82%A4%ED%82%A4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 247 | 유래 49/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 210.00 |
| 328 | 5shng3fd | 톰보이 챌린지 | https://catchmeme.com/memes/5shng3fd-%ED%86%B0%EB%B3%B4%EC%9D%B4-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 161 | 뜻 105/150; 유래 34/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 210.00 |
| 329 | s66254dp | 스티킹 아웃 유어 갸트 포 더 리즐러 | https://catchmeme.com/memes/s66254dp-%EC%8A%A4%ED%8B%B0%ED%82%B9-%EC%95%84%EC%9B%83-%EC%9C%A0%EC%96%B4-%EA%B0%B8%ED%8A%B8-%ED%8F%AC-%EB%8D%94-%EB%A6%AC%EC%A6%90%EB%9F%AC | 267 | 유래 68/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 209.50 |
| 330 | kecg9kfp | Boxxy | https://catchmeme.com/memes/kecg9kfp-boxxy | 188 | 유래 0/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 209.50 |
| 331 | nrjutpq7 | SNL 코리아 무신사 냄새 | https://catchmeme.com/memes/nrjutpq7-SNL-%EC%BD%94%EB%A6%AC%EC%95%84-%EB%AC%B4%EC%8B%A0%EC%82%AC-%EB%83%84%EC%83%88 | 239 | 유래 45/80; 예문 0/2 | 예문<2 | 209.50 |
| 332 | 9eabh3s5 | 봄날은 간다 라면 먹고 갈래 | https://catchmeme.com/memes/9eabh3s5-%EB%B4%84%EB%82%A0%EC%9D%80-%EA%B0%84%EB%8B%A4-%EB%9D%BC%EB%A9%B4-%EB%A8%B9%EA%B3%A0-%EA%B0%88%EB%9E%98 | 386 | 뜻 102/150; 쓰임 25/40; 예문 0/2 | 예문<2 | 209.50 |
| 333 | btcz2jk3 | 짝 애정촌 | https://catchmeme.com/memes/btcz2jk3-%EC%A7%9D-%EC%95%A0%EC%A0%95%EC%B4%8C | 284 | 유래 26/80; 쓰임 36/40; 예문 0/2 | 예문<2 | 209.50 |
| 334 | x5jvz8j6 | 빵꾸똥꾸 | https://catchmeme.com/memes/x5jvz8j6-%EB%B9%B5%EA%BE%B8%EB%98%A5%EA%BE%B8 | 248 | 뜻 142/150; 유래 17/80; 쓰임 18/40 | 없음 | 209.50 |
| 335 | ga4bnvf9 | 알페스 | https://catchmeme.com/memes/ga4bnvf9-%EC%95%8C%ED%8E%98%EC%8A%A4 | 170 | 뜻 115/150; 유래 33/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 128.26 |
| 336 | mahkwnk5 | 따봉 | https://catchmeme.com/memes/mahkwnk5-%EB%94%B0%EB%B4%89 | 250 | 유래 32/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 116.67 |
| 337 | ej2ktw68 | 트와이스 쯔위 청천백일만지홍기 사건 | https://catchmeme.com/memes/ej2ktw68-%ED%8A%B8%EC%99%80%EC%9D%B4%EC%8A%A4-%EC%AF%94%EC%9C%84-%EC%B2%AD%EC%B2%9C%EB%B0%B1%EC%9D%BC%EB%A7%8C%EC%A7%80%ED%99%8D%EA%B8%B0-%EC%82%AC%EA%B1%B4 | 260 | 유래 30/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 115.55 |
| 338 | wfxuttpw | 박태환 도핑 파문 | https://catchmeme.com/memes/wfxuttpw-%EB%B0%95%ED%83%9C%ED%99%98-%EB%8F%84%ED%95%91-%ED%8C%8C%EB%AC%B8 | 273 | 유래 25/80; 예문 0/2 | 예문<2 | 115.55 |
| 339 | 2dz5ezu4 | 여의도 텔레토비 | https://catchmeme.com/memes/2dz5ezu4-%EC%97%AC%EC%9D%98%EB%8F%84-%ED%85%94%EB%A0%88%ED%86%A0%EB%B9%84 | 227 | 유래 30/80; 쓰임 19/40; 예문 0/2 | 예문<2 | 115.05 |
| 340 | 34t7cbgg | FIFTY FIFTY 전속계약 분쟁 | https://catchmeme.com/memes/34t7cbgg-FIFTY-FIFTY-%EC%A0%84%EC%86%8D%EA%B3%84%EC%95%BD-%EB%B6%84%EC%9F%81 | 241 | 유래 30/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 112.77 |
| 341 | 2ne9pdqf | 임효준 강제추행 누명·중국귀화 사건 | https://catchmeme.com/memes/2ne9pdqf-%EC%9E%84%ED%9A%A8%EC%A4%80-%EA%B0%95%EC%A0%9C%EC%B6%94%ED%96%89-%EB%88%84%EB%AA%85%C2%B7%EC%A4%91%EA%B5%AD%EA%B7%80%ED%99%94-%EC%82%AC%EA%B1%B4 | 261 | 유래 30/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 112.77 |
| 342 | q89fqthc | 믹스나인 사태 | https://catchmeme.com/memes/q89fqthc-%EB%AF%B9%EC%8A%A4%EB%82%98%EC%9D%B8-%EC%82%AC%ED%83%9C | 208 | 유래 30/80; 쓰임 22/40; 예문 0/2 | 예문<2 | 110.00 |
| 343 | db3bd33n | 평창올림픽 팀추월 왕따 논란 | https://catchmeme.com/memes/db3bd33n-%ED%8F%89%EC%B0%BD%EC%98%AC%EB%A6%BC%ED%94%BD-%ED%8C%80%EC%B6%94%EC%9B%94-%EC%99%95%EB%94%B0-%EB%85%BC%EB%9E%80 | 324 | 유래 29/80; 예문 0/2 | 예문<2 | 110.00 |
| 344 | 4tnm2tbs | 원칩챌린지 | https://catchmeme.com/memes/4tnm2tbs-%EC%9B%90%EC%B9%A9%EC%B1%8C%EB%A6%B0%EC%A7%80 | 217 | 유래 37/80; 쓰임 20/40; 예문 0/2 | 예문<2 | 110.00 |
| 345 | admu9pnm | 응 니 애미 (김윤태) | https://catchmeme.com/memes/admu9pnm-%EC%9D%91-%EB%8B%88-%EC%95%A0%EB%AF%B8-(%EA%B9%80%EC%9C%A4%ED%83%9C) | 243 | 유래 33/80; 예문 0/2 | 예문<2 | 109.50 |
| 346 | eade3grc | 나는 꼼수다 | https://catchmeme.com/memes/eade3grc-%EB%82%98%EB%8A%94-%EA%BC%BC%EC%88%98%EB%8B%A4 | 269 | 유래 30/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 109.50 |
| 347 | hubv67ha | 나야나 (국민 프로듀서) | https://catchmeme.com/memes/hubv67ha-%EB%82%98%EC%95%BC%EB%82%98-(%EA%B5%AD%EB%AF%BC-%ED%94%84%EB%A1%9C%EB%93%80%EC%84%9C) | 231 | 유래 43/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 109.50 |
| 348 | v87wb8p7 | 강호동 '소나기' 코너 | https://catchmeme.com/memes/v87wb8p7-%EA%B0%95%ED%98%B8%EB%8F%99-%EC%86%8C%EB%82%98%EA%B8%B0-%EC%BD%94%EB%84%88 | 344 | 뜻 78/150; 쓰임 34/40; 예문 0/2 | 예문<2 | 87.61 |
| 349 | uap9wbj6 | 폭풍전야 | https://catchmeme.com/memes/uap9wbj6-%ED%8F%AD%ED%92%8D%EC%A0%84%EC%95%BC | 244 | 유래 34/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 72.46 |
| 350 | rg8vazet | SK-II 놓치지 않을거예요 | https://catchmeme.com/memes/rg8vazet-SK-II-%EB%86%93%EC%B9%98%EC%A7%80-%EC%95%8A%EC%9D%84%EA%B1%B0%EC%98%88%EC%9A%94 | 225 | 유래 30/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 69.89 |
| 351 | gyk8gmqk | 짤줍 | https://catchmeme.com/memes/gyk8gmqk-%EC%A7%A4%EC%A4%8D | 204 | 뜻 96/150; 쓰임 23/40; 예문 0/2 | 예문<2 | 67.58 |
| 352 | z3buhgaz | 포기하면 편해 | https://catchmeme.com/memes/z3buhgaz-%ED%8F%AC%EA%B8%B0%ED%95%98%EB%A9%B4-%ED%8E%B8%ED%95%B4 | 208 | 유래 31/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 67.11 |
| 353 | h945jvzh | 레알 수원 밈 | https://catchmeme.com/memes/h945jvzh-%EB%A0%88%EC%95%8C-%EC%88%98%EC%9B%90-%EB%B0%88 | 290 | 유래 41/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 63.60 |
| 354 | kvn6xxfn | 해병문학 | https://catchmeme.com/memes/kvn6xxfn-%ED%95%B4%EB%B3%91%EB%AC%B8%ED%95%99 | 217 | 뜻 141/150; 유래 33/80; 예문 0/2 | 예문<2 | 62.26 |
| 355 | ptkcvtmt | 스즈메의 문단속 문단속 밈 | https://catchmeme.com/memes/ptkcvtmt-%EC%8A%A4%EC%A6%88%EB%A9%94%EC%9D%98-%EB%AC%B8%EB%8B%A8%EC%86%8D-%EB%AC%B8%EB%8B%A8%EC%86%8D-%EB%B0%88 | 225 | 유래 33/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 61.36 |
| 356 | xf7bfsg8 | 사이월드 도토리 문화 | https://catchmeme.com/memes/xf7bfsg8-%EC%82%AC%EC%9D%B4%EC%9B%94%EB%93%9C-%EB%8F%84%ED%86%A0%EB%A6%AC-%EB%AC%B8%ED%99%94 | 395 | 뜻 114/150; 쓰임 23/40; 예문 0/2 | 예문<2 | 61.36 |
| 357 | m4mxkck2 | 나와 대등하거나 그 이상이야 | https://catchmeme.com/memes/m4mxkck2-%EB%82%98%EC%99%80-%EB%8C%80%EB%93%B1%ED%95%98%EA%B1%B0%EB%82%98-%EA%B7%B8-%EC%9D%B4%EC%83%81%EC%9D%B4%EC%95%BC | 229 | 유래 37/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 60.21 |
| 358 | 3t93h8ru | 개그콘서트 갸루상 | https://catchmeme.com/memes/3t93h8ru-%EA%B0%9C%EA%B7%B8%EC%BD%98%EC%84%9C%ED%8A%B8-%EA%B0%B8%EB%A3%A8%EC%83%81 | 292 | 유래 30/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 57.78 |
| 359 | ftx4r8r9 | 개벽이 | https://catchmeme.com/memes/ftx4r8r9-%EA%B0%9C%EB%B2%BD%EC%9D%B4 | 375 | 뜻 83/150; 쓰임 24/40; 예문 0/2 | 예문<2 | 54.67 |
| 360 | 42h6gkdj | 이치고 페이크 주인공 밈 (블리치) | https://catchmeme.com/memes/42h6gkdj-%EC%9D%B4%EC%B9%98%EA%B3%A0-%ED%8E%98%EC%9D%B4%ED%81%AC-%EC%A3%BC%EC%9D%B8%EA%B3%B5-%EB%B0%88-(%EB%B8%94%EB%A6%AC%EC%B9%98) | 212 | 유래 33/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 53.94 |
| 361 | kmtap8az | 4대 미드 | https://catchmeme.com/memes/kmtap8az-4%EB%8C%80-%EB%AF%B8%EB%93%9C | 312 | 유래 37/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 53.94 |
| 362 | 5f5rtgnt | 팬픽 | https://catchmeme.com/memes/5f5rtgnt-%ED%8C%AC%ED%94%BD | 222 | 유래 36/80; 쓰임 36/40; 예문 0/2 | 예문<2 | 53.05 |
| 363 | eyj9fbez | 무한도전 짝꿍 | https://catchmeme.com/memes/eyj9fbez-%EB%AC%B4%ED%95%9C%EB%8F%84%EC%A0%84-%EC%A7%9D%EA%BF%8D | 241 | 유래 30/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 52.77 |
| 364 | cmtvqeef | 1박2일 시즌2 김승우 김나댐 | https://catchmeme.com/memes/cmtvqeef-1%EB%B0%952%EC%9D%BC-%EC%8B%9C%EC%A6%8C2-%EA%B9%80%EC%8A%B9%EC%9A%B0-%EA%B9%80%EB%82%98%EB%8C%90 | 221 | 유래 37/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 52.77 |
| 365 | pt82kn86 | 꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다 (밈문학) | https://catchmeme.com/memes/pt82kn86-%EA%BD%81%EA%BD%81-%EC%96%BC%EC%96%B4%EB%B6%99%EC%9D%80-%ED%95%9C%EA%B0%95-%EC%9C%84%EB%A1%9C-%EA%B3%A0%EC%96%91%EC%9D%B4%EA%B0%80-%EA%B1%B8%EC%96%B4%EB%8B%A4%EB%8B%99%EB%8B%88%EB%8B%A4-(%EB%B0%88%EB%AC%B8%ED%95%99) | 226 | 유래 37/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 52.77 |
| 366 | z4s6jnbc | 킹근육골드몬 | https://catchmeme.com/memes/z4s6jnbc-%ED%82%B9%EA%B7%BC%EC%9C%A1%EA%B3%A8%EB%93%9C%EB%AA%AC | 254 | 유래 44/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 51.89 |
| 367 | vxmxbdp7 | 묻지마 다쳐 | https://catchmeme.com/memes/vxmxbdp7-%EB%AC%BB%EC%A7%80%EB%A7%88-%EB%8B%A4%EC%B3%90 | 352 | 뜻 96/150; 쓰임 28/40; 예문 0/2 | 예문<2 | 51.89 |
| 368 | ajvzf7pk | 과자 사꾸 | https://catchmeme.com/memes/ajvzf7pk-%EA%B3%BC%EC%9E%90-%EC%82%AC%EA%BE%B8 | 383 | 유래 74/80; 쓰임 0/40 | 없음 | 50.48 |
| 369 | 9d6chzwp | 오하운 | https://catchmeme.com/memes/9d6chzwp-%EC%98%A4%ED%95%98%EC%9A%B4 | 184 | 뜻 93/150; 유래 63/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 50.27 |
| 370 | b62auax7 | LG생활건강 라끄베르와 상의하세요 | https://catchmeme.com/memes/b62auax7-LG%EC%83%9D%ED%99%9C%EA%B1%B4%EA%B0%95-%EB%9D%BC%EB%81%84%EB%B2%A0%EB%A5%B4%EC%99%80-%EC%83%81%EC%9D%98%ED%95%98%EC%84%B8%EC%9A%94 | 221 | 유래 30/80; 쓰임 30/40; 예문 0/2 | 예문<2 | 50.27 |
| 371 | 4t3pg7tu | 마린블루스 | https://catchmeme.com/memes/4t3pg7tu-%EB%A7%88%EB%A6%B0%EB%B8%94%EB%A3%A8%EC%8A%A4 | 329 | 뜻 74/150; 쓰임 17/40; 예문 0/2 | 예문<2 | 50.27 |
| 372 | wc8266rp | 세이클럽 아바타 문화 | https://catchmeme.com/memes/wc8266rp-%EC%84%B8%EC%9D%B4%ED%81%B4%EB%9F%BD-%EC%95%84%EB%B0%94%ED%83%80-%EB%AC%B8%ED%99%94 | 373 | 뜻 112/150; 쓰임 27/40; 예문 0/2 | 예문<2 | 50.27 |
| 373 | wk7av6ap | 장승업 | https://catchmeme.com/memes/wk7av6ap-%EC%9E%A5%EC%8A%B9%EC%97%85 | 384 | 뜻 91/150; 쓰임 18/40; 예문 0/2 | 예문<2 | 50.27 |
| 374 | z5upus9a | 강풀 순정만화 | https://catchmeme.com/memes/z5upus9a-%EA%B0%95%ED%92%80-%EC%88%9C%EC%A0%95%EB%A7%8C%ED%99%94 | 345 | 뜻 80/150; 쓰임 23/40; 예문 0/2 | 예문<2 | 50.27 |
| 375 | 8jt2ut7r | 트위치 코리아 철수 | https://catchmeme.com/memes/8jt2ut7r-%ED%8A%B8%EC%9C%84%EC%B9%98%20%EC%BD%94%EB%A6%AC%EC%95%84%20%EC%B2%A0%EC%88%98 | 227 | 유래 30/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 50.00 |
| 376 | ux8vqp8u | 아우라 파밍 챌린지 | https://catchmeme.com/memes/ux8vqp8u-%EC%95%84%EC%9A%B0%EB%9D%BC-%ED%8C%8C%EB%B0%8D-%EC%B1%8C%EB%A6%B0%EC%A7%80 | 275 | 유래 51/80; 쓰임 35/40; 예문 0/2 | 예문<2 | 50.00 |
| 377 | pre96psn | 순당무 폄하 사건 | https://catchmeme.com/memes/pre96psn-%EC%88%9C%EB%8B%B9%EB%AC%B4-%ED%8F%84%ED%95%98-%EC%82%AC%EA%B1%B4 | 300 | 유래 40/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 50.00 |
| 378 | zmucuvzw | 1박2일 시즌3 데프콘 근심돼지 | https://catchmeme.com/memes/zmucuvzw-1%EB%B0%952%EC%9D%BC-%EC%8B%9C%EC%A6%8C3-%EB%8D%B0%ED%94%84%EC%BD%98-%EA%B7%BC%EC%8B%AC%EB%8F%BC%EC%A7%80 | 239 | 유래 31/80; 쓰임 31/40; 예문 0/2 | 예문<2 | 50.00 |
| 379 | h38c5yfp | 포켓몬빵 재출시 대란 | https://catchmeme.com/memes/h38c5yfp-%ED%8F%AC%EC%BC%93%EB%AA%AC%EB%B9%B5-%EC%9E%AC%EC%B6%9C%EC%8B%9C-%EB%8C%80%EB%9E%80 | 261 | 유래 38/80; 쓰임 25/40; 예문 0/2 | 예문<2 | 50.00 |
| 380 | pwm47mfk | 이상한 변호사 우영우 소덕동 팽나무 | https://catchmeme.com/memes/pwm47mfk-%EC%9D%B4%EC%83%81%ED%95%9C-%EB%B3%80%ED%98%B8%EC%82%AC-%EC%9A%B0%EC%98%81%EC%9A%B0-%EC%86%8C%EB%8D%95%EB%8F%99-%ED%8C%BD%EB%82%98%EB%AC%B4 | 256 | 유래 45/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 50.00 |
| 381 | he7bpfva | 껍질 미리 깐 달걀 | https://catchmeme.com/memes/he7bpfva-%EA%BB%8D%EC%A7%88-%EB%AF%B8%EB%A6%AC-%EA%B9%90-%EB%8B%AC%EA%B1%80 | 231 | 유래 38/80; 쓰임 28/40; 예문 0/2 | 예문<2 | 50.00 |
| 382 | bu9tkfkm | 순공시간 | https://catchmeme.com/memes/bu9tkfkm-%EC%88%9C%EA%B3%B5%EC%8B%9C%EA%B0%84 | 199 | 뜻 109/150; 유래 63/80; 쓰임 27/40; 예문 0/2 | 예문<2 | 47.50 |
| 383 | 8kkjgzhb | 빻다 | https://catchmeme.com/memes/8kkjgzhb-%EB%B9%BB%EB%8B%A4 | 229 | 유래 33/80; 쓰임 39/40; 예문 0/2 | 예문<2 | 47.50 |
| 384 | gz2bv5ue | 등가교환 (강철의 연금술사) | https://catchmeme.com/memes/gz2bv5ue-%EB%93%B1%EA%B0%80%EA%B5%90%ED%99%98-(%EA%B0%95%EC%B2%A0%EC%9D%98-%EC%97%B0%EA%B8%88%EC%88%A0%EC%82%AC) | 215 | 유래 31/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 47.50 |
| 385 | x8dbsxa7 | 우솝 내려 밈 | https://catchmeme.com/memes/x8dbsxa7-%EC%9A%B0%EC%86%9D-%EB%82%B4%EB%A0%A4-%EB%B0%88 | 214 | 유래 31/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 47.50 |
| 386 | eemvtnhu | 해태타이거즈 V9 신화 | https://catchmeme.com/memes/eemvtnhu-%ED%95%B4%ED%83%9C%ED%83%80%EC%9D%B4%EA%B1%B0%EC%A6%88-V9-%EC%8B%A0%ED%99%94 | 258 | 유래 34/80; 쓰임 33/40; 예문 0/2 | 예문<2 | 47.50 |
| 387 | 7nwv82kk | 이승우 코리안 메시 | https://catchmeme.com/memes/7nwv82kk-%EC%9D%B4%EC%8A%B9%EC%9A%B0-%EC%BD%94%EB%A6%AC%EC%95%88-%EB%A9%94%EC%8B%9C | 286 | 유래 39/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 47.50 |
| 388 | j5dbcg8g | 정몽규 나가 | https://catchmeme.com/memes/j5dbcg8g-%EC%A0%95%EB%AA%BD%EA%B7%9C-%EB%82%98%EA%B0%80 | 308 | 유래 40/80; 쓰임 34/40; 예문 0/2 | 예문<2 | 47.50 |
| 389 | nhawfv5q | 가불기 | https://catchmeme.com/memes/nhawfv5q-%EA%B0%80%EB%B6%88%EA%B8%B0 | 245 | 유래 41/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 47.50 |
| 390 | tdh57n5u | 엘라스틴 당신의 머리 엘라스틴에겐 피부입니다 | https://catchmeme.com/memes/tdh57n5u-%EC%97%98%EB%9D%BC%EC%8A%A4%ED%8B%B4-%EB%8B%B9%EC%8B%A0%EC%9D%98-%EB%A8%B8%EB%A6%AC-%EC%97%98%EB%9D%BC%EC%8A%A4%ED%8B%B4%EC%97%90%EA%B2%90-%ED%94%BC%EB%B6%80%EC%9E%85%EB%8B%88%EB%8B%A4 | 241 | 유래 30/80; 쓰임 23/40; 예문 0/2 | 예문<2 | 47.50 |
| 391 | y45pq3d3 | 2%부족할때 널 만나고부터 되는 일이 하나도 없어 | https://catchmeme.com/memes/y45pq3d3-2%25%EB%B6%80%EC%A1%B1%ED%95%A0%EB%95%8C-%EB%84%90-%EB%A7%8C%EB%82%98%EA%B3%A0%EB%B6%80%ED%84%B0-%EB%90%98%EB%8A%94-%EC%9D%BC%EC%9D%B4-%ED%95%98%EB%82%98%EB%8F%84-%EC%97%86%EC%96%B4 | 235 | 유래 36/80; 쓰임 26/40; 예문 0/2 | 예문<2 | 47.50 |
| 392 | 5buquhek | 전청조 I am 신뢰에요 밈 | https://catchmeme.com/memes/5buquhek-%EC%A0%84%EC%B2%AD%EC%A1%B0-I-am-%EC%8B%A0%EB%A2%B0%EC%97%90%EC%9A%94-%EB%B0%88 | 319 | 유래 37/80; 쓰임 38/40; 예문 0/2 | 예문<2 | 47.50 |
| 393 | cdkdz2tv | 럭키비키 | https://catchmeme.com/memes/cdkdz2tv-%EB%9F%AD%ED%82%A4%EB%B9%84%ED%82%A4 | 324 | 유래 24/80; 쓰임 24/40 | 없음 | 47.50 |
| 394 | f6dvsvvv | 설거지론 | https://catchmeme.com/memes/f6dvsvvv-%EC%84%A4%EA%B1%B0%EC%A7%80%EB%A1%A0 | 234 | 유래 30/80; 예문 0/2 | 예문<2 | 47.50 |
| 395 | xc2f7n5h | 알빠임? | https://catchmeme.com/memes/xc2f7n5h-%EC%95%8C%EB%B9%A0%EC%9E%84%3F | 248 | 유래 33/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 47.50 |
| 396 | dsbqshuc | 1도 없다 / 1도 모르겠다 | https://catchmeme.com/memes/dsbqshuc-1%EB%8F%84-%EC%97%86%EB%8B%A4-%2F-1%EB%8F%84-%EB%AA%A8%EB%A5%B4%EA%B2%A0%EB%8B%A4 | 213 | 유래 31/80; 쓰임 24/40; 예문 0/2 | 예문<2 | 47.50 |
| 397 | ecbj7248 | 곰표 밀맥주 | https://catchmeme.com/memes/ecbj7248-%EA%B3%B0%ED%91%9C-%EB%B0%80%EB%A7%A5%EC%A3%BC | 240 | 유래 30/80; 쓰임 32/40; 예문 0/2 | 예문<2 | 47.50 |
| 398 | ey989tqc | 슈뢰딩거의 철수 | https://catchmeme.com/memes/ey989tqc-%EC%8A%88%EB%A2%B0%EB%94%A9%EA%B1%B0%EC%9D%98-%EC%B2%A0%EC%88%98 | 225 | 유래 37/80; 쓰임 29/40; 예문 0/2 | 예문<2 | 47.50 |
| 399 | pkahgrks | 병맛만화(마음의소리) | https://catchmeme.com/memes/pkahgrks-%EB%B3%91%EB%A7%9B%EB%A7%8C%ED%99%94(%EB%A7%88%EC%9D%8C%EC%9D%98%EC%86%8C%EB%A6%AC) | 373 | 뜻 97/150; 쓰임 22/40; 예문 0/2 | 예문<2 | 47.50 |
| 400 | kt3mnpct | 리즈시절 | https://catchmeme.com/memes/kt3mnpct-%EB%A6%AC%EC%A6%88%EC%8B%9C%EC%A0%88 | 206 | 유래 37/80; 쓰임 18/40; 예문 0/2 | 예문<2 | 47.50 |
| 401 | rh5fk6a8 | 깜놀 | https://catchmeme.com/memes/rh5fk6a8-%EA%B9%9C%EB%86%80 | 180 | 뜻 99/150; 유래 23/80; 쓰임 15/40 | 없음 | 47.50 |
| 402 | gf66ref6 | 스불재 | https://catchmeme.com/memes/gf66ref6-%EC%8A%A4%EB%B6%88%EC%9E%AC | 352 | 유래 73/80; 쓰임 25/40 | 없음 | 47.50 |
| 403 | 8gk69mj9 | 소확행 | https://catchmeme.com/memes/8gk69mj9-%EC%86%8C%ED%99%95%ED%96%89 | 223 | 뜻 111/150; 유래 31/80; 쓰임 22/40 | 없음 | 47.50 |
| 404 | fjs5zj7p | 갑분싸 | https://catchmeme.com/memes/fjs5zj7p-%EA%B0%91%EB%B6%84%EC%8B%B8 | 221 | 뜻 131/150; 유래 18/80; 쓰임 18/40 | 없음 | 47.50 |
| 405 | nmqhha6m | 난 너를 사랑해 떼창 (붉은 노을) | https://catchmeme.com/memes/nmqhha6m-i-love-you-singalong-bigbang | 181 | 뜻 115/150; 유래 66/80; 쓰임 0/40; 예문 0/2 | 예문<2 | 45.28 |
| 406 | 8qauynnn | 3대 500 | https://catchmeme.com/memes/8qauynnn-3%EB%8C%80-500 | 266 | 쓰임 24/40; 예문 0/2 | 예문<2 | 43.05 |
| 407 | smbxrr4v | 칠가이(Chill Guy) 밈 | https://catchmeme.com/memes/smbxrr4v-%EC%B9%A0%EA%B0%80%EC%9D%B4(Chill-Guy)-%EB%B0%88 | 252 | 유래 55/80; 예문 0/2 | 예문<2 | 41.89 |
| 408 | 4f25qzwc | 대박 | https://catchmeme.com/memes/4f25qzwc-%EB%8C%80%EB%B0%95 | 340 | 유래 50/80 | 없음 | 40.55 |
| 409 | 87pakbhn | 직관 | https://catchmeme.com/memes/87pakbhn-%EC%A7%81%EA%B4%80 | 342 | 유래 54/80 | 없음 | 40.55 |
| 410 | bex8d97m | 현타 | https://catchmeme.com/memes/bex8d97m-%ED%98%84%ED%83%80 | 285 | 유래 47/80; 쓰임 35/40 | 없음 | 40.27 |
| 411 | zqef5hk5 | 묻고 더블로 가 | https://catchmeme.com/memes/zqef5hk5-%EB%AC%BB%EA%B3%A0%20%EB%8D%94%EB%B8%94%EB%A1%9C%20%EA%B0%80 | 316 | 유래 51/80; 쓰임 35/40 | 없음 | 40.27 |
| 412 | tvx96bzx | 아재개그 | https://catchmeme.com/memes/tvx96bzx-%EC%95%84%EC%9E%AC%EA%B0%9C%EA%B7%B8 | 317 | 유래 58/80; 쓰임 36/40 | 없음 | 40.27 |
| 413 | y7jzctmt | 최애 | https://catchmeme.com/memes/y7jzctmt-%EC%B5%9C%EC%95%A0 | 307 | 유래 49/80; 쓰임 31/40 | 없음 | 40.27 |
| 414 | 83wpksf4 | 레게노 | https://catchmeme.com/memes/83wpksf4-%EB%A0%88%EA%B2%8C%EB%85%B8 | 357 | 유래 56/80; 쓰임 27/40 | 없음 | 40.27 |
| 415 | x6ysg6rw | 엄친아 | https://catchmeme.com/memes/x6ysg6rw-%EC%97%84%EC%B9%9C%EC%95%84 | 327 | 유래 54/80; 쓰임 32/40 | 없음 | 40.27 |
| 416 | 5jysgx3d | 댕댕이 | https://catchmeme.com/memes/5jysgx3d-%EB%8C%95%EB%8C%95%EC%9D%B4 | 283 | 유래 52/80; 쓰임 13/40 | 없음 | 40.27 |
| 417 | xxfpe8tx | 인싸 | https://catchmeme.com/memes/xxfpe8tx-%EC%9D%B8%EC%8B%B8 | 284 | 유래 43/80; 쓰임 22/40 | 없음 | 40.27 |
| 418 | jearh7bj | 먹방 | https://catchmeme.com/memes/jearh7bj-%EB%A8%B9%EB%B0%A9 | 228 | 뜻 120/150; 유래 30/80; 쓰임 23/40 | 없음 | 40.00 |
| 419 | stm8qern | 눈치 | https://catchmeme.com/memes/stm8qern-%EB%88%88%EC%B9%98 | 353 | 유래 64/80 | 없음 | 39.39 |
| 420 | 9str3b7e | 덕질 | https://catchmeme.com/memes/9str3b7e-%EB%8D%95%EC%A7%88 | 327 | 유래 65/80; 쓰임 34/40 | 없음 | 37.77 |
| 421 | 63485cxm | 멍때리기 | https://catchmeme.com/memes/63485cxm-%EB%A9%8D%EB%95%8C%EB%A6%AC%EA%B8%B0 | 317 | 유래 54/80 | 없음 | 37.50 |
| 422 | 9r3fjkwr | 엄근진 | https://catchmeme.com/memes/9r3fjkwr-%EC%97%84%EA%B7%BC%EC%A7%84 | 313 | 유래 58/80 | 없음 | 37.50 |
| 423 | 9vt7669q | 할많하않 | https://catchmeme.com/memes/9vt7669q-%ED%95%A0%EB%A7%8E%ED%95%98%EC%95%8A | 314 | 유래 45/80; 쓰임 36/40 | 없음 | 37.50 |
| 424 | g29s3ssp | 꾸안꾸 | https://catchmeme.com/memes/g29s3ssp-%EA%BE%B8%EC%95%88%EA%BE%B8 | 307 | 유래 54/80; 쓰임 39/40 | 없음 | 37.50 |
| 425 | k32wguve | 뇌절 | https://catchmeme.com/memes/k32wguve-%EB%87%8C%EC%A0%88 | 355 | 유래 65/80 | 없음 | 37.50 |
| 426 | qqzf3wyy | 내돈내산 | https://catchmeme.com/memes/qqzf3wyy-%EB%82%B4%EB%8F%88%EB%82%B4%EC%82%B0 | 334 | 유래 60/80 | 유래 추정(년경) | 37.50 |
| 427 | ruayk4d9 | 애교 | https://catchmeme.com/memes/ruayk4d9-%EC%95%A0%EA%B5%90 | 327 | 유래 56/80 | 없음 | 37.50 |
| 428 | ef9b8468 | 띵곡 | https://catchmeme.com/memes/ef9b8468-%EB%9D%B5%EA%B3%A1 | 286 | 유래 52/80; 쓰임 25/40 | 없음 | 37.50 |
| 429 | x5ktuksv | 회사에 억울하게 갇혀있는 직장인들 퇴근시켜라 | https://catchmeme.com/memes/x5ktuksv-%ED%9A%8C%EC%82%AC%EC%97%90-%EC%96%B5%EC%9A%B8%ED%95%98%EA%B2%8C-%EA%B0%87%ED%98%80%EC%9E%88%EB%8A%94-%EC%A7%81%EC%9E%A5%EC%9D%B8%EB%93%A4-%ED%87%B4%EA%B7%BC%EC%8B%9C%EC%BC%9C%EB%9D%BC | 255 | 뜻 126/150; 예문 0/2 | 예문<2 | 37.50 |
| 430 | a7kdqran | 불금 | https://catchmeme.com/memes/a7kdqran-%EB%B6%88%EA%B8%88 | 279 | 유래 50/80; 쓰임 21/40 | 없음 | 37.50 |
| 431 | gwuhnv6x | 아보하 | https://catchmeme.com/memes/gwuhnv6x-%EC%95%84%EB%B3%B4%ED%95%98 | 280 | 유래 32/80; 쓰임 23/40 | 없음 | 37.50 |
| 432 | p9e26xkt | 손절 | https://catchmeme.com/memes/p9e26xkt-%EC%86%90%EC%A0%88 | 313 | 유래 58/80; 쓰임 24/40 | 없음 | 37.50 |
| 433 | 3cyttccx | 저메추 | https://catchmeme.com/memes/3cyttccx-%EC%A0%80%EB%A9%94%EC%B6%94 | 307 | 유래 50/80; 쓰임 30/40 | 없음 | 37.50 |
| 434 | 53wy474m | 얼죽아 | https://catchmeme.com/memes/53wy474m-%EC%96%BC%EC%A3%BD%EC%95%84 | 354 | 유래 57/80; 쓰임 31/40 | 없음 | 37.50 |
| 435 | 6hgbgvxs | 오히려 좋아 | https://catchmeme.com/memes/6hgbgvxs-%EC%98%A4%ED%9E%88%EB%A0%A4-%EC%A2%8B%EC%95%84 | 298 | 뜻 122/150; 쓰임 30/40 | 없음 | 37.50 |
| 436 | es5x279s | 갓생 | https://catchmeme.com/memes/es5x279s-%EA%B0%93%EC%83%9D | 285 | 뜻 129/150; 유래 66/80; 쓰임 26/40 | 없음 | 37.50 |
| 437 | fsyesj5y | 추구미 | https://catchmeme.com/memes/fsyesj5y-%EC%B6%94%EA%B5%AC%EB%AF%B8 | 322 | 유래 61/80; 쓰임 28/40 | 없음 | 37.50 |
| 438 | rbcr3kty | 오운완 | https://catchmeme.com/memes/rbcr3kty-%EC%98%A4%EC%9A%B4%EC%99%84 | 297 | 유래 52/80; 쓰임 21/40 | 없음 | 37.50 |
| 439 | rvrpe25e | 알잘딱깔센 | https://catchmeme.com/memes/rvrpe25e-%EC%95%8C%EC%9E%98%EB%94%B1%EA%B9%94%EC%84%BC | 254 | 뜻 133/150; 유래 36/80; 쓰임 24/40 | 없음 | 37.50 |
| 440 | sebuqw5g | 흑역사 | https://catchmeme.com/memes/sebuqw5g-%ED%9D%91%EC%97%AD%EC%82%AC | 304 | 유래 49/80; 쓰임 25/40 | 없음 | 37.50 |
| 441 | xdyc4wjw | 별다줄 | https://catchmeme.com/memes/xdyc4wjw-%EB%B3%84%EB%8B%A4%EC%A4%84 | 323 | 유래 53/80; 쓰임 24/40 | 없음 | 37.50 |
| 442 | gbywgftu | 혼밥 | https://catchmeme.com/memes/gbywgftu-%ED%98%BC%EB%B0%A5 | 286 | 유래 53/80; 쓰임 24/40 | 없음 | 37.50 |
| 443 | xgfn3js5 | 넘사벽 | https://catchmeme.com/memes/xgfn3js5-%EB%84%98%EC%82%AC%EB%B2%BD | 290 | 유래 60/80; 쓰임 20/40 | 없음 | 37.50 |
| 444 | x6umaq3m | 국룰 | https://catchmeme.com/memes/x6umaq3m-%EA%B5%AD%EB%A3%B0 | 318 | 유래 68/80; 쓰임 21/40 | 없음 | 37.50 |
| 445 | da4tvkk7 | 사바사 | https://catchmeme.com/memes/da4tvkk7-%EC%82%AC%EB%B0%94%EC%82%AC | 308 | 유래 70/80; 쓰임 19/40 | 없음 | 37.50 |
| 446 | u6mxpr58 | 막내 | https://catchmeme.com/memes/u6mxpr58-%EB%A7%89%EB%82%B4 | 321 | 유래 52/80 | 없음 | 35.00 |
| 447 | x85wgk74 | 파이팅 | https://catchmeme.com/memes/x85wgk74-%ED%8C%8C%EC%9D%B4%ED%8C%85 | 346 | 유래 59/80 | 없음 | 35.00 |
| 448 | j3n8rcxe | 헐 | https://catchmeme.com/memes/j3n8rcxe-%ED%97%90 | 298 | 유래 57/80; 쓰임 24/40 | 없음 | 35.00 |
| 449 | kqx2eyx2 | 폼 미쳤다 | https://catchmeme.com/memes/kqx2eyx2-%ED%8F%BC-%EB%AF%B8%EC%B3%A4%EB%8B%A4 | 302 | 유래 61/80; 쓰임 22/40 | 유래 무출처 | 30.00 |
| 450 | okk2020k | 억까 (억지 까기) | https://catchmeme.com/memes/okk2020k-eok-kka | 258 | 뜻 116/150; 유래 60/80; 쓰임 0/40; 예문 1/2; 비슷한 밈 0/2 | 유래 무출처; 예문<2 | 없음 |
| 451 | fmc2022k | 폼 미쳤다 | https://catchmeme.com/memes/fmc2022k-form-crazy | 304 | 뜻 105/150; 유래 54/80; 쓰임 0/40; 비슷한 밈 0/2 | 유래 무출처 | 없음 |
| 452 | nmd2022k | 너 뭐 돼? | https://catchmeme.com/memes/nmd2022k-ne-mwo-dwae | 305 | 뜻 90/150; 유래 67/80; 쓰임 0/40; 비슷한 밈 0/2 | 유래 무출처 | 없음 |
| 453 | oyj2021k | 오히려 좋아 | https://catchmeme.com/memes/oyj2021k-ohiryeo-joha | 305 | 뜻 98/150; 유래 63/80; 쓰임 0/40; 비슷한 밈 0/2 | 유래 무출처 | 없음 |
| 454 | mng2022k | 맑은 눈의 광인 (맑눈광) | https://catchmeme.com/memes/mng2022k-mal-noon-gwang | 349 | 뜻 121/150; 유래 73/80; 쓰임 0/40; 비슷한 밈 0/2 | 유래 무출처 | 없음 |

## 패딩 표시, 400자 이상

아래 60개는 비교 본문이 400자 이상이고 예문이 0개다. 얇은 454개에는 넣지 않는다. 가장 높은 trend_score는 파리의 연인 애기야 가자 (334.46)이다. 상위 9의 마지막인 김도영 니 땀시 살어야 밈(336.97)보다 낮아서, 예문 부족만으로 상위 10에 들어가지 않는다.

외부 출처가 없는 3개는 밈캐치가 기획한 문장이고 출처 URL이 자기 페이지다. `유래 무출처`를 같이 붙인다. `년경`이 있는 유래는 `유래 추정(년경)`을 붙인다.

| key | 제목 | URL | 본문 글자 | 예문 | 패딩 | trend_score |
| --- | --- | --- | --- | --- | --- | --- |
| vbm992y5 | 파리의 연인 애기야 가자 | https://catchmeme.com/memes/vbm992y5-%ED%8C%8C%EB%A6%AC%EC%9D%98-%EC%97%B0%EC%9D%B8-%EC%95%A0%EA%B8%B0%EC%95%BC-%EA%B0%80%EC%9E%90 | 406 | 0/2 | 예문<2 | 334.46 |
| xpad2ccw | 붉은악마 Be the Reds | https://catchmeme.com/memes/xpad2ccw-%EB%B6%89%EC%9D%80%EC%95%85%EB%A7%88-Be-the-Reds | 412 | 0/2 | 예문<2 | 331.47 |
| ks3zpsr3 | 터보 '회상' | https://catchmeme.com/memes/ks3zpsr3-%ED%84%B0%EB%B3%B4-%ED%9A%8C%EC%83%81 | 420 | 0/2 | 예문<2 | 326.14 |
| by5gkxee | 갈갈이 삼형제 | https://catchmeme.com/memes/by5gkxee-%EA%B0%88%EA%B0%88%EC%9D%B4-%EC%82%BC%ED%98%95%EC%A0%9C | 446 | 0/2 | 예문<2 | 323.36 |
| 872yt2wg | 대한민국 짝짝짝짝짝 | https://catchmeme.com/memes/872yt2wg-%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD-%EC%A7%9D%EC%A7%9D%EC%A7%9D%EC%A7%9D%EC%A7%9D | 419 | 0/2 | 예문<2 | 321.06 |
| qqu8andb | 이정현 '바꿔'·'와' | https://catchmeme.com/memes/qqu8andb-%EC%9D%B4%EC%A0%95%ED%98%84-%EB%B0%94%EA%BF%94%C2%B7%EC%99%80 | 433 | 0/2 | 예문<2 | 320.59 |
| k49enfdj | 황영조 마라톤 금메달 | https://catchmeme.com/memes/k49enfdj-%ED%99%A9%EC%98%81%EC%A1%B0-%EB%A7%88%EB%9D%BC%ED%86%A4-%EA%B8%88%EB%A9%94%EB%8B%AC | 423 | 0/2 | 예문<2 | 318.32 |
| yeyam8cm | PC통신 모뎀 접속음 | https://catchmeme.com/memes/yeyam8cm-PC%ED%86%B5%EC%8B%A0-%EB%AA%A8%EB%8E%80-%EC%A0%91%EC%86%8D%EC%9D%8C | 467 | 0/2 | 예문<2 | 318.29 |
| dj24zx6c | 빛나리 타잔송 | https://catchmeme.com/memes/dj24zx6c-%EB%B9%9B%EB%82%98%EB%A6%AC-%ED%83%80%EC%9E%94%EC%86%A1 | 403 | 0/2 | 예문<2 | 317.82 |
| amhqsvt2 | 박카스 '그날의 피로는 그날에' | https://catchmeme.com/memes/amhqsvt2-%EB%B0%95%EC%B9%B4%EC%8A%A4-%EA%B7%B8%EB%82%A0%EC%9D%98-%ED%94%BC%EB%A1%9C%EB%8A%94-%EA%B7%B8%EB%82%A0%EC%97%90 | 435 | 0/2 | 예문<2 | 316.67 |
| mzgvq8xt | H.O.T. 캔디 | https://catchmeme.com/memes/mzgvq8xt-H.O.T.-%EC%BA%94%EB%94%94 | 432 | 0/2 | 예문<2 | 316.67 |
| rmpwzmy7 | 젝스키스 '학원별곡' | https://catchmeme.com/memes/rmpwzmy7-%EC%A0%9D%EC%8A%A4%ED%82%A4%EC%8A%A4-%ED%95%99%EC%9B%90%EB%B3%84%EA%B3%A1 | 437 | 0/2 | 예문<2 | 315.94 |
| dwuam5k6 | 신화 'T.O.P' | https://catchmeme.com/memes/dwuam5k6-%EC%8B%A0%ED%99%94-T.O.P | 422 | 0/2 | 예문<2 | 315.05 |
| jcdupe54 | 바츠 해방전쟁 | https://catchmeme.com/memes/jcdupe54-%EB%B0%94%EC%B8%A0-%ED%95%B4%EB%B0%A9%EC%A0%84%EC%9F%81 | 439 | 0/2 | 예문<2 | 315.05 |
| sw48ahk5 | 찔러맨 | https://catchmeme.com/memes/sw48ahk5-%EC%B0%94%EB%9F%AC%EB%A7%A8 | 430 | 0/2 | 예문<2 | 315.05 |
| jkq83czt | DDR(댄스 댄스 레볼루션) 오락실 열풍 | https://catchmeme.com/memes/jkq83czt-DDR(%EB%8C%84%EC%8A%A4-%EB%8C%84%EC%8A%A4-%EB%A0%88%EB%B3%BC%EB%A3%A8%EC%85%98)-%EC%98%A4%EB%9D%BD%EC%8B%A4-%EC%97%B4%ED%92%8D | 416 | 0/2 | 예문<2 | 314.39 |
| rpbqu7a8 | 몸짱 아줌마 신드롬 | https://catchmeme.com/memes/rpbqu7a8-%EB%AA%B8%EC%A7%B1-%EC%95%84%EC%A4%8C%EB%A7%88-%EC%8B%A0%EB%93%9C%EB%A1%AC | 416 | 0/2 | 예문<2 | 314.39 |
| rf3dt6mp | 서태지와 아이들 컴백홈 현상 | https://catchmeme.com/memes/rf3dt6mp-%EC%84%9C%ED%83%9C%EC%A7%80%EC%99%80-%EC%95%84%EC%9D%B4%EB%93%A4-%EC%BB%B4%EB%B0%B1%ED%99%88-%ED%98%84%EC%83%81 | 457 | 0/2 | 예문<2 | 313.89 |
| wyu84dvf | 온게임넷 스타리그 출범 | https://catchmeme.com/memes/wyu84dvf-%EC%98%A8%EA%B2%8C%EC%9E%84%EB%84%B7-%EC%8A%A4%ED%83%80%EB%A6%AC%EA%B7%B8-%EC%B6%9C%EB%B2%94 | 435 | 0/2 | 예문<2 | 313.89 |
| 5wdk27m6 | 박세리 맨발의 투혼 | https://catchmeme.com/memes/5wdk27m6-%EB%B0%95%EC%84%B8%EB%A6%AC-%EB%A7%A8%EB%B0%9C%EC%9D%98-%ED%88%AC%ED%98%BC | 400 | 0/2 | 예문<2 | 312.27 |
| 7nhgn33j | 룰라 3!4! | https://catchmeme.com/memes/7nhgn33j-%EB%A3%B0%EB%9D%BC-3!4! | 419 | 0/2 | 예문<2 | 312.27 |
| 8e9dyfqp | 겟타맨 | https://catchmeme.com/memes/8e9dyfqp-%EA%B2%9F%ED%83%80%EB%A7%A8 | 427 | 0/2 | 예문<2 | 312.27 |
| 9gzfuejc | 기억의 습작 | https://catchmeme.com/memes/9gzfuejc-%EA%B8%B0%EC%96%B5%EC%9D%98-%EC%8A%B5%EC%9E%91 | 436 | 0/2 | 예문<2 | 312.27 |
| pg778k4u | 뿌까 캐릭터 | https://catchmeme.com/memes/pg778k4u-%EB%BF%8C%EA%B9%8C-%EC%BA%90%EB%A6%AD%ED%84%B0 | 435 | 0/2 | 예문<2 | 312.27 |
| 2eu27rzb | god 어머님께 | https://catchmeme.com/memes/2eu27rzb-god-%EC%96%B4%EB%A8%B8%EB%8B%98%EA%BB%98 | 411 | 0/2 | 예문<2 | 309.50 |
| 5ru454te | 얼마면 돼(가을동화) | https://catchmeme.com/memes/5ru454te-%EC%96%BC%EB%A7%88%EB%A9%B4-%EB%8F%BC(%EA%B0%80%EC%9D%84%EB%8F%99%ED%99%94) | 418 | 0/2 | 예문<2 | 309.50 |
| fzmt7ngh | 탑블레이드 팽이 붐 | https://catchmeme.com/memes/fzmt7ngh-%ED%83%91%EB%B8%94%EB%A0%88%EC%9D%B4%EB%93%9C-%ED%8C%BD%EC%9D%B4-%EB%B6%90 | 454 | 0/2 | 예문<2 | 309.50 |
| kv4mvmgp | 아기공룡 둘리: 얼음별 대모험 | https://catchmeme.com/memes/kv4mvmgp-%EC%95%84%EA%B8%B0%EA%B3%B5%EB%A3%A1-%EB%91%98%EB%A6%AC%3A-%EC%96%BC%EC%9D%8C%EB%B3%84-%EB%8C%80%EB%AA%A8%ED%97%98 | 410 | 0/2 | 예문<2 | 309.50 |
| mbaueeku | 신화 'Wild Eyes' 의자춤 | https://catchmeme.com/memes/mbaueeku-%EC%8B%A0%ED%99%94-Wild-Eyes-%EC%9D%98%EC%9E%90%EC%B6%A4 | 401 | 0/2 | 예문<2 | 309.50 |
| mchqdgs2 | 이경규 몰래카메라 | https://catchmeme.com/memes/mchqdgs2-%EC%9D%B4%EA%B2%BD%EA%B7%9C-%EB%AA%B0%EB%9E%98%EC%B9%B4%EB%A9%94%EB%9D%BC | 403 | 0/2 | 예문<2 | 309.50 |
| mtt9tt63 | 모래시계 나 지금 떨고 있니 | https://catchmeme.com/memes/mtt9tt63-%EB%AA%A8%EB%9E%98%EC%8B%9C%EA%B3%84-%EB%82%98-%EC%A7%80%EA%B8%88-%EB%96%A8%EA%B3%A0-%EC%9E%88%EB%8B%88 | 433 | 0/2 | 예문<2 | 309.50 |
| rc2d9rq9 | 신승훈 발라드 황제 | https://catchmeme.com/memes/rc2d9rq9-%EC%8B%A0%EC%8A%B9%ED%9B%88-%EB%B0%9C%EB%9D%BC%EB%93%9C-%ED%99%A9%EC%A0%9C | 423 | 0/2 | 예문<2 | 309.50 |
| s5tx6yzk | 종이접기 아저씨 김영만 | https://catchmeme.com/memes/s5tx6yzk-%EC%A2%85%EC%9D%B4%EC%A0%91%EA%B8%B0-%EC%95%84%EC%A0%80%EC%94%A8-%EA%B9%80%EC%98%81%EB%A7%8C | 448 | 0/2 | 예문<2 | 309.50 |
| uyx5ktd9 | 엄정화 '포이즌' | https://catchmeme.com/memes/uyx5ktd9-%EC%97%84%EC%A0%95%ED%99%94-%ED%8F%AC%EC%9D%B4%EC%A6%8C | 404 | 0/2 | 예문<2 | 309.50 |
| n4srdru6 | 아이러브스쿨 동창찾기 열풍 | https://catchmeme.com/memes/n4srdru6-%EC%95%84%EC%9D%B4%EB%9F%AC%EB%B8%8C%EC%8A%A4%EC%BF%A8-%EB%8F%99%EC%B0%BD%EC%B0%BE%EA%B8%B0-%EC%97%B4%ED%92%8D | 430 | 0/2 | 예문<2 | 92.54 |
| qptvgzyy | 방가방가·하이루 | https://catchmeme.com/memes/qptvgzyy-%EB%B0%A9%EA%B0%80%EB%B0%A9%EA%B0%80%C2%B7%ED%95%98%EC%9D%B4%EB%A3%A8 | 400 | 0/2 | 예문<2 | 80.78 |
| m9qmrhxz | 대장금 홍시 | https://catchmeme.com/memes/m9qmrhxz-%EB%8C%80%EC%9E%A5%EA%B8%88-%ED%99%8D%EC%8B%9C | 415 | 0/2 | 예문<2 | 71.77 |
| q7cjtg8h | 버디버디 메신저 | https://catchmeme.com/memes/q7cjtg8h-%EB%B2%84%EB%94%94%EB%B2%84%EB%94%94-%EB%A9%94%EC%8B%A0%EC%A0%80 | 460 | 0/2 | 예문<2 | 56.71 |
| evr2qu8t | 다마고치 | https://catchmeme.com/memes/evr2qu8t-%EB%8B%A4%EB%A7%88%EA%B3%A0%EC%B9%98 | 437 | 0/2 | 예문<2 | 56.44 |
| 2g7q4e2w | 사랑은 움직이는 거야 | https://catchmeme.com/memes/2g7q4e2w-%EC%82%AC%EB%9E%91%EC%9D%80-%EC%9B%80%EC%A7%81%EC%9D%B4%EB%8A%94-%EA%B1%B0%EC%95%BC | 423 | 0/2 | 예문<2; 유래 추정(년경) | 56.29 |
| 7kqc35wv | 국민학교→초등학교 개칭 | https://catchmeme.com/memes/7kqc35wv-%EA%B5%AD%EB%AF%BC%ED%95%99%EA%B5%90%E2%86%92%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90-%EA%B0%9C%EC%B9%AD | 506 | 0/2 | 예문<2 | 56.29 |
| qwme37gx | 러브하우스 | https://catchmeme.com/memes/qwme37gx-%EB%9F%AC%EB%B8%8C%ED%95%98%EC%9A%B0%EC%8A%A4 | 409 | 0/2 | 예문<2 | 55.28 |
| mt6pqan8 | 합성 필수요소 갤러리 | https://catchmeme.com/memes/mt6pqan8-%ED%95%A9%EC%84%B1-%ED%95%84%EC%88%98%EC%9A%94%EC%86%8C-%EA%B0%A4%EB%9F%AC%EB%A6%AC | 418 | 0/2 | 예문<2 | 54.67 |
| mx2p9d97 | Y2K 밀레니엄버그 | https://catchmeme.com/memes/mx2p9d97-Y2K-%EB%B0%80%EB%A0%88%EB%8B%88%EC%97%84%EB%B2%84%EA%B7%B8 | 458 | 0/2 | 예문<2 | 53.94 |
| ueucy5wp | 슬랙 마지막 5분의 동시 폭탄 | https://catchmeme.com/memes/ueucy5wp-%EC%8A%AC%EB%9E%99-%EB%A7%88%EC%A7%80%EB%A7%89-5%EB%B6%84%EC%9D%98-%EB%8F%99%EC%8B%9C-%ED%8F%AD%ED%83%84 | 402 | 0/2 | 예문<2; 유래 무출처 | 52.11 |
| au7za8te | 임요환 '테란의 황제' | https://catchmeme.com/memes/au7za8te-%EC%9E%84%EC%9A%94%ED%99%98-%ED%85%8C%EB%9E%80%EC%9D%98-%ED%99%A9%EC%A0%9C | 439 | 0/2 | 예문<2 | 51.89 |
| f2jjy62y | 노스트라다무스 지구멸망설 | https://catchmeme.com/memes/f2jjy62y-%EB%85%B8%EC%8A%A4%ED%8A%B8%EB%9D%BC%EB%8B%A4%EB%AC%B4%EC%8A%A4-%EC%A7%80%EA%B5%AC%EB%A9%B8%EB%A7%9D%EC%84%A4 | 436 | 0/2 | 예문<2 | 51.89 |
| ewwjd6g7 | ㅋㅋㅋ 표기 | https://catchmeme.com/memes/ewwjd6g7-%E3%85%8B%E3%85%8B%E3%85%8B-%ED%91%9C%EA%B8%B0 | 446 | 0/2 | 예문<2 | 50.27 |
| hmhac9nw | 유희왕 카드게임 유행 | https://catchmeme.com/memes/hmhac9nw-%EC%9C%A0%ED%9D%AC%EC%99%95-%EC%B9%B4%EB%93%9C%EA%B2%8C%EC%9E%84-%EC%9C%A0%ED%96%89 | 402 | 0/2 | 예문<2 | 50.27 |
| 3rqfnny8 | 바람의나라 | https://catchmeme.com/memes/3rqfnny8-%EB%B0%94%EB%9E%8C%EC%9D%98%EB%82%98%EB%9D%BC | 439 | 0/2 | 예문<2 | 47.50 |
| 5pzu8tzp | 검정고무신 애니메이션 | https://catchmeme.com/memes/5pzu8tzp-%EA%B2%80%EC%A0%95%EA%B3%A0%EB%AC%B4%EC%8B%A0-%EC%95%A0%EB%8B%88%EB%A9%94%EC%9D%B4%EC%85%98 | 456 | 0/2 | 예문<2 | 47.50 |
| 8eacrtkx | 펌프 잇업 | https://catchmeme.com/memes/8eacrtkx-%ED%8E%8C%ED%94%84-%EC%9E%87%EC%97%85 | 439 | 0/2 | 예문<2 | 47.50 |
| kr99nar8 | 네이버 지식인 | https://catchmeme.com/memes/kr99nar8-%EB%84%A4%EC%9D%B4%EB%B2%84-%EC%A7%80%EC%8B%9D%EC%9D%B8 | 428 | 0/2 | 예문<2 | 47.50 |
| n5s5eq5p | 스티커사진 | https://catchmeme.com/memes/n5s5eq5p-%EC%8A%A4%ED%8B%B0%EC%BB%A4%EC%82%AC%EC%A7%84 | 440 | 0/2 | 예문<2; 유래 추정(년경) | 47.50 |
| pnphbt7f | 시티폰 | https://catchmeme.com/memes/pnphbt7f-%EC%8B%9C%ED%8B%B0%ED%8F%B0 | 433 | 0/2 | 예문<2 | 47.50 |
| s2v2pzh9 | 포켓몬빵 띠부씰 | https://catchmeme.com/memes/s2v2pzh9-%ED%8F%AC%EC%BC%93%EB%AA%AC%EB%B9%B5-%EB%9D%A0%EB%B6%80%EC%94%B0 | 470 | 0/2 | 예문<2 | 47.50 |
| t6jrbnbd | 젝스키스 해체(2000) | https://catchmeme.com/memes/t6jrbnbd-%EC%A0%9D%EC%8A%A4%ED%82%A4%EC%8A%A4-%ED%95%B4%EC%B2%B4(2000) | 435 | 0/2 | 예문<2 | 47.50 |
| 3jetw9gv | 가족 단톡 Pix 송금 요청의 진짜 의미 | https://catchmeme.com/memes/3jetw9gv-%EA%B0%80%EC%A1%B1-%EB%8B%A8%ED%86%A1-pix-%EC%86%A1%EA%B8%88-%EC%9A%94%EC%B2%AD%EC%9D%98-%EC%A7%84%EC%A7%9C-%EC%9D%98%EB%AF%B8 | 462 | 0/2 | 예문<2; 유래 무출처 | 41.44 |
| jz3dnexj | 막차 10분 전 LINE 단체방의 기적 | https://catchmeme.com/memes/jz3dnexj-%EB%A7%89%EC%B0%A8-10%EB%B6%84-%EC%A0%84-line-%EB%8B%A8%EC%B2%B4%EB%B0%A9%EC%9D%98-%EA%B8%B0%EC%A0%81 | 490 | 0/2 | 예문<2; 유래 무출처 | 41.44 |
| nvmtccc6 | 프리챌 유료화 논란 | https://catchmeme.com/memes/nvmtccc6-%ED%94%84%EB%A6%AC%EC%B1%8C-%EC%9C%A0%EB%A3%8C%ED%99%94-%EB%85%BC%EB%9E%80 | 480 | 0/2 | 예문<2 | 40.00 |

### 중꺾마

`jkm2022k` https://catchmeme.com/memes/jkm2022k-jung-kkuk-ma 는 사이트맵에 없는 색인 가능 큐레이션 문서다. 비교 본문은 451자(뜻 131, 유래 68, 예문 3개 252)라 454개에 넣지 않았다. 예문은 3개다. 유래는 한 문장이고 쿠키뉴스 문대찬 기자를 적지만 페이지에 출처 URL이 없다. 패딩 표시는 `유래 무출처`다. 뜻 131/150, 유래 68/80, 쓰임 0/40, 비슷한 밈 0/2도 기준에 못 미친다. 라이브 trend_score는 없다.

`gnact78h`의 큐레이션 카드(`hidink-hungry`)는 저장소에 있다. 공개 페이지는 DB 행이 우선이라 사이트맵의 카탈로그 본문 226자를 쓴다. 큐레이션 카드 문장으로 다시 세지 않는다.

## 이번 목록에서 하지 않은 것

본문 초안, 출처 각주, SQL, 운영 데이터베이스 반영은 없다. 상위 10의 초안은 이 목록이 고정된 뒤에 쓴다.
