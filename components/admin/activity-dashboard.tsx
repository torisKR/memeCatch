import Link from "next/link";
import { activityHref, type ActivityFilters, type AdminActivity } from "@/lib/admin-activity";
import { memePathFrom } from "@/lib/labels";

const number = (value: number) => value.toLocaleString("ko-KR");
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23", timeZone: "Asia/Seoul",
}).format(new Date(value)) : "기록 없음";
const cell = "px-3 py-3 text-left align-top";
const input = "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm";
const link = "inline-flex min-h-11 items-center text-accent underline underline-offset-4";

export function ActivityDashboard({ data, filters, today, error }: {
  data: AdminActivity | null; filters: ActivityFilters; today: string; error: string | null;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-medium text-accent">관리자 전용 · 한국 시간 (KST)</p>
        <h1 className="mt-1 text-2xl font-bold">사용자 활동</h1>
        <p className="mt-2 text-sm text-muted">어떤 콘텐츠를 보고, 언제 방문하고, 누가 구독 중인지 확인하세요.</p>
      </header>

      <form key={JSON.stringify(filters)} action="/admin/activity" method="get" aria-label="활동 조회 조건" className="rounded-xl border border-border bg-surface p-4">
        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">시작일
            <input className={input} type="date" name="from" defaultValue={filters.from} max={today} required />
          </label>
          <label className="text-sm font-medium">종료일
            <input className={input} type="date" name="to" defaultValue={filters.to} max={today} required />
          </label>
          <label className="text-sm font-medium">사용자 ID (선택)
            <input className={input} name="userId" defaultValue={filters.userId} placeholder="목록에서 선택 또는 UUID 입력" autoComplete="off" />
          </label>
          <button className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white" type="submit">조회하기</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="subscribersOnly" value="1" defaultChecked={filters.subscribersOnly} className="h-4 w-4 accent-accent" />
            현재 Plus 구독자만
          </label>
          <Link href="/admin/activity" className={link}>조건 초기화</Link>
          <p className="text-muted">최대 31일 · 일별 날짜를 누르면 해당 날짜의 시간별 활동을 확인합니다.</p>
        </div>
      </form>

      {error && <p role="alert" className="rounded-xl border border-safety-red/40 bg-surface p-4 text-safety-red">{error}</p>}
      {data && !error && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <p>{data.range.from} ~ {data.range.to} · {filters.subscribersOnly ? "현재 구독자 활동" : "전체 활동"}
            {filters.userId && <span className="ml-2 break-all">· 선택 계정 {filters.userId}</span>}
          </p>
          <p>집계 시각 {dateTime(data.generatedAt)}</p>
        </div>
        <section aria-label="활동 요약" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "기록된 밈 조회", value: data.summary.views, unit: "회", note: "선택 기간 · 중복 제거된 조회 이벤트" },
            { label: "활성 로그인 사용자", value: data.summary.activeUsers, unit: "명", note: "선택 기간 · 활동 계정 중복 제거" },
            { label: "익명 방문 세션", value: data.summary.anonymousSessions, unit: "개", note: "선택 기간 · 사람 수와 다릅니다" },
            { label: "현재 Plus 구독자", value: data.summary.currentSubscribers, unit: "명", note: "전체 계정 · 기간·사용자 필터와 무관" },
          ].map((metric) => <div key={metric.label} className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-muted">{metric.label}</h2>
            <p className="mt-2 text-3xl font-bold tabular-nums">{number(metric.value)}<span className="ml-1 text-base font-normal text-muted">{metric.unit}</span></p>
            <p className="mt-2 text-xs text-muted">{metric.note}</p>
          </div>)}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <BucketTable title="일별 활동" id="daily-activity" rows={data.daily.map((row) => ({
            ...row, label: row.date, selected: row.date === filters.hourDate,
            href: activityHref(filters, { hourDate: row.date }, "hourly-activity"),
          }))} />
          <BucketTable title={`시간별 활동 · ${data.range.hourDate}`} id="hourly-activity" rows={data.hourly.map((row) => ({
            ...row, label: `${String(row.hour).padStart(2, "0")}:00–${String(row.hour).padStart(2, "0")}:59`,
          }))} />
        </div>

        <section id="activity-users" aria-labelledby="users-heading" className="scroll-mt-6 rounded-xl border border-border bg-surface">
          <div className="p-4">
            <h2 id="users-heading" className="text-lg font-bold">{filters.subscribersOnly ? "현재 구독 중인 사용자" : "사용자별 활동"} <span className="text-sm font-normal text-muted">{number(data.users.total)}명</span></h2>
            <p className="mt-1 text-sm text-muted">{filters.subscribersOnly ? "기간 내 활동이 없는 구독자도 표시됩니다." : "기간 내 활동한 로그인 계정입니다. 익명 세션은 특정 계정과 연결하지 않습니다."} 구독 상태는 현재 기준입니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">사용자별 현재 구독 상태와 선택 기간 활동</caption>
              <thead className="border-y border-border bg-surface-2 text-muted"><tr>
                {["사용자", "현재 구독", "밈 조회", "최근 활동 (KST)", "상세"].map((label) => <th scope="col" key={label} className={cell}>{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {data.users.items.map((user) => <tr key={user.id}>
                  <td className={cell}><span className="font-medium">{user.nickname || "닉네임 없음"}</span><span className="mt-1 block font-mono text-xs text-muted">{user.id.slice(0, 8)}</span></td>
                  <td className={cell}><span className={user.isPlus ? "font-semibold text-accent" : "text-muted"}>{user.isPlus ? "Plus 이용 중" : "무료"}</span>{user.isPlus && <span className="mt-1 block text-xs text-muted">만료 {dateTime(user.plusUntil)}</span>}</td>
                  <td className={`${cell} tabular-nums`}>{number(user.views)}회</td>
                  <td className={cell}>{dateTime(user.lastSeenAt)}</td>
                  <td className={cell}><div className="flex gap-4 whitespace-nowrap">
                    <Link className={link} href={activityHref(filters, { userId: user.id, usersPage: 1, viewsPage: 1 }, "activity-views")} aria-label={`${user.nickname || user.id.slice(0, 8)} 조회 내역`}>조회 내역</Link>
                    <Link className={link} href={`/admin/users/${user.id}`}>계정 관리</Link>
                  </div></td>
                </tr>)}
                {data.users.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">이 조건에 해당하는 사용자 기록이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination total={data.users.total} page={data.users.page} size={data.users.pageSize} field="usersPage" filters={filters} anchor="activity-users" label="사용자" />
        </section>

        <section id="activity-views" aria-labelledby="views-heading" className="scroll-mt-6 rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <h2 id="views-heading" className="text-lg font-bold">최근 조회 콘텐츠 <span className="text-sm font-normal text-muted">{number(data.views.total)}건</span></h2>
            {filters.userId && <Link className={link} href={activityHref(filters, { userId: "", usersPage: 1, viewsPage: 1 }, "activity-views")}>사용자 선택 해제</Link>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">선택 조건의 최신 밈 조회 이벤트</caption>
              <thead className="border-y border-border bg-surface-2 text-muted"><tr>
                {["조회 시각 (KST)", "사용자", "조회한 콘텐츠"].map((label) => <th scope="col" className={cell} key={label}>{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border">
                {data.views.items.map((view) => <tr key={view.id}>
                  <td className={`${cell} whitespace-nowrap tabular-nums`}>{dateTime(view.eventAt)}</td>
                  <td className={cell}>{view.userId ? <Link className={link} href={activityHref(filters, { userId: view.userId, usersPage: 1, viewsPage: 1 }, "activity-views")}>{view.nickname || `계정 ${view.userId.slice(0, 8)}`}</Link> : <span className="text-muted">익명 / 삭제된 계정</span>}</td>
                  <td className={cell}>{view.shortId && view.slug ? <Link className={link} href={memePathFrom(encodeURIComponent(view.shortId), view.slug)}>{view.title || "제목 없음"}</Link> : <span className="text-muted">삭제되었거나 연결되지 않은 콘텐츠</span>}</td>
                </tr>)}
                {data.views.items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">이 조건에 기록된 밈 조회가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination total={data.views.total} page={data.views.page} size={data.views.pageSize} field="viewsPage" filters={filters} anchor="activity-views" label="조회 내역" />
        </section>
      </>}
      <aside className="rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-muted" aria-label="집계 기준">
        기존 클라이언트 활동 이벤트 기준입니다. 밈 조회는 같은 세션·콘텐츠의 분 단위 중복이 제거되며, 차단된 추적이나 전송 실패는 포함되지 않습니다.
        활성 사용자는 조회 외 활동도 포함합니다. 익명 세션은 실제 사람 수가 아니며 로그인 계정 수와 합산하지 않습니다.
        삭제된 계정의 기록은 익명으로 남을 수 있습니다. 이메일·IP·검색어·세션 식별자는 표시하지 않습니다.
        Plus는 활성 상태이면서 이용 기간이 남은 계정만 포함하고, 같은 계정의 중복 구독은 한 명으로 집계합니다.
      </aside>
    </div>
  );
}

function BucketTable({ title, id, rows }: {
  title: string; id: string;
  rows: { label: string; views: number; activeUsers: number; anonymousSessions: number; href?: string; selected?: boolean }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.activeUsers));
  return <section aria-labelledby={`${id}-heading`} id={id} className="min-w-0 scroll-mt-6 rounded-xl border border-border bg-surface">
    <h2 id={`${id}-heading`} className="p-4 text-lg font-bold">{title}</h2>
    <div className="max-h-96 overflow-auto">
      <table className="w-full min-w-[380px] text-sm tabular-nums">
        <caption className="sr-only">{title} · 로그인 사용자와 익명 세션은 각각 중복 제거</caption>
        <thead className="sticky top-0 bg-surface-2 text-muted"><tr>{["한국 시간", "활성 계정 (명)", "익명 (세션)", "밈 조회 (회)"].map((label) => <th key={label} scope="col" className={`${cell} whitespace-nowrap`}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.label} className={row.selected ? "bg-accent-soft" : ""}>
          <th scope="row" className={`${cell} whitespace-nowrap font-normal`}>{row.href ? <Link className="text-accent underline underline-offset-4" aria-current={row.selected ? "date" : undefined} href={row.href}>{row.label}</Link> : row.label}</th>
          <td className={cell}>{number(row.activeUsers)}<div aria-hidden className="mt-1 h-1 rounded bg-accent-strong/70" style={{ width: `${row.activeUsers / max * 100}%` }} /></td>
          <td className={cell}>{number(row.anonymousSessions)}</td><td className={cell}>{number(row.views)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function Pagination({ total, page, size, field, filters, anchor, label }: {
  total: number; page: number; size: number; field: "usersPage" | "viewsPage";
  filters: ActivityFilters; anchor: string; label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav aria-label={`${label} 페이지`} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm">
    <span className="text-muted">{number(page)} / {number(pages)} 페이지 · {size}개씩</span>
    <div className="flex gap-5">
      {page > 1 && <Link className={link} href={activityHref(filters, { [field]: Math.min(page - 1, pages) }, anchor)} aria-label={`${label} 이전 페이지`}>이전</Link>}
      {page < pages && page < 10000 && <Link className={link} href={activityHref(filters, { [field]: page + 1 }, anchor)} aria-label={`${label} 다음 페이지`}>다음</Link>}
    </div>
  </nav>;
}
