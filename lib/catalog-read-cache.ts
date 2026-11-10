import { unstable_cache } from "next/cache";

/**
 * 성공한 카탈로그 읽기만 Next Data Cache에 둔다.
 * unstable_cache는 콜백이 resolve한 값만 저장하고, throw는 set 전에 빠져나간다.
 * 장애 재검증도 실패를 덮어쓰지 않고 직전 성공 값을 유지한다.
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
