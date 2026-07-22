import { createCronHandler } from "@/lib/affiliate/cron-handler";
import { runDailyAdpickSyncAll } from "@/lib/affiliate/sync.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 핫딜 + 쇼핑메이트 추천상품 두 피드를 한 번의 크론에서 순차 동기화
export const GET = createCronHandler(runDailyAdpickSyncAll);
