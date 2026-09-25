/**
 * Page numbers for the board list.
 *
 * Pages are 1-based and offsets are 0-based. Callers compute the page count
 * first, clamp the requested page against it, then ask for the window of page
 * links and the offset of the first item.
 */

/** Number of pages. No items, or a non-positive page size, still gives one page. */
export function totalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0 || totalItems <= 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

/** Clamps a requested page into [1, pages]. NaN or a non-integer becomes page one. */
export function clampPage(page: number, pages: number): number {
  if (!Number.isInteger(page)) return 1;
  const last = Math.max(1, pages);
  if (page < 1) return 1;
  if (page > last) return last;
  return page;
}

/**
 * Up to `width` consecutive page numbers centred on `current`, pushed inward
 * at either end. With an even width, `current` sits left of the middle.
 * When there are no more pages than `width`, every page is listed.
 */
export function pageWindow(current: number, pages: number, width: number): number[] {
  if (pages <= 0 || width <= 0) return [];
  if (pages <= width) return range(1, pages);
  const centred = current - Math.floor((width - 1) / 2);
  const lastStart = pages - width + 1;
  const start = Math.min(Math.max(centred, 1), lastStart);
  return range(start, start + width - 1);
}

/** Zero-based offset of the first item on `page`, which is assumed already clamped. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Inclusive run of integers from `from` to `to`. */
function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n++) {
    out.push(n);
  }
  return out;
}
