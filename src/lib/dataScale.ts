export type PageResult<T> = { data: T[] | null; error: unknown };

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

type SaleLike = { sold_usdt: number; cost_idr: number; profit_idr: number };
type SessionLike = { avg_cost?: number | null; created_at?: string | null };

export function deriveSaleSource(sale: SaleLike, session?: SessionLike | null) {
  const usdt = Number(sale.sold_usdt || 0);
  const cost = Number(sale.cost_idr || 0);
  const persistedUnitCost = usdt > 0 ? cost / usdt : 0;
  return {
    avgCost: Number(session?.avg_cost || 0) > 0 ? Number(session!.avg_cost) : persistedUnitCost,
    sessionDate: session?.created_at || '-',
    profit: Number(sale.profit_idr || 0),
    cost,
    usdt
  };
}
