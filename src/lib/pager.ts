/**
 * Page numbers for the board list.
 *
 * Callers compute the page count first, clamp the requested page against it,
 * then ask for the page links to show and the offset of the first item.
 * Pages are numbered from one.
 */

/** Number of pages; an empty list still has one page. */
export function totalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0 || totalItems <= 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

/** Keeps a requested page inside the list; anything unusable becomes page one. */
export function clampPage(page: number, pages: number): number {
  if (!Number.isInteger(page)) return 1;
  const last = Math.max(1, pages);
  if (page < 1) return 1;
  if (page > last) return last;
  return page;
}

/** Page links around the current page, kept inside the list. */
export function pageWindow(current: number, pages: number, width: number): number[] {
  if (pages <= 0 || width <= 0) {
    return [];
  }
  if (pages <= width) {
    return range(1, pages);
  }
  const centred = current - Math.floor((width - 1) / 2);
  const lastStart = pages - width + 1;
  const start = Math.min(Math.max(centred, 1), lastStart);
  return range(start, start + width - 1);
}

/** Offset of the first item on a page that has already been clamped. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Consecutive integers from `from` through `to`. */
function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n++) {
    out.push(n);
  }
  return out;
}
