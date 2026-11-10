import { unstable_cache } from "next/cache";

/**
 * 확인된 결측. unstable_cache는 resolve된 값만 저장하므로 이 오류는
 * Data Cache에 들어가지 않는다. null을 반환하면 24시간 404로 남는다.
 */
export class ConfirmedCatalogMiss extends Error {
  readonly code = "confirmed_catalog_miss";

  constructor() {
    super("confirmed_catalog_miss");
    this.name = "ConfirmedCatalogMiss";
  }
}

/**
 * 찾아낸 행만 Next Data Cache에 둔다. 값은 JSON으로 직렬화되는 평범한 객체여야 한다.
 * OpenNext의 R2 incremental cache도 같은 set 경로를 쓰고, throw는 그 전에 빠진다.
 * 태그는 public-meme-catalog 하나라 기존 revalidateTag가 R2 tag cache에서도 지운다.
 * 장애 재검증은 실패를 덮어쓰지 않고 직전 성공 값을 유지한다.
 * 렌더 밖(테스트)에서는 Data Cache가 없으므로 같은 읽기를 한 번 실행한다.
 */
export function cacheCatalogRead<Args extends unknown[], T>(
  read: (...args: Args) => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): (...args: Args) => Promise<T> {
  const cached = unstable_cache(read, keyParts, options);
  return async (...args) => {
    try {
      return await cached(...args);
    } catch (error) {
      if (error instanceof Error && error.message.includes("incrementalCache missing")) {
        return read(...args);
      }
      throw error;
    }
  };
}
