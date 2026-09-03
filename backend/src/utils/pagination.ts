export interface PaginationResult {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function getPagination(query: Record<string, unknown>): PaginationResult {
  const page = Math.max(parseInt(String(query.page ?? "1"), 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(String(query.pageSize ?? "20"), 10) || 20, 1), 100);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function getSearchString(query: Record<string, unknown>): string {
  return String(query.search ?? "").trim();
}

export function formatChallanNumber(num: number): string {
  return `CHL-${String(num).padStart(4, "0")}`;
}
