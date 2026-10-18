/** Shared paged Supabase fetches so ERP pickers are not silently capped at 250. */

export const ERP_PAGE_SIZE = 1000;

type PageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

/**
 * Walks `.range()` pages until a short page is returned.
 * Use for vehicle / customer pickers where a hard `.limit(250)` under-counts stock.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>,
  pageSize = ERP_PAGE_SIZE
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const chunk = (data || []) as T[];
    all.push(...chunk);
    if (chunk.length < pageSize) return { data: all, error: null };
    from += pageSize;
  }
}
