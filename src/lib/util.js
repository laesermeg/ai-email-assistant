/**
 * 배열을 "동시 실행 수 제한"을 두고 처리한다.
 * 한 번에 수십 개의 외부 요청을 던지면 느려지거나 차단당하므로 나눠서 보낸다.
 *
 * @param {Array<T>} items
 * @param {number} limit  동시에 진행할 최대 개수
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}  입력과 같은 순서
 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}
