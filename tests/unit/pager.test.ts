import { describe, expect, it } from 'vitest';
import { clampPage, pageOffset, pageWindow, totalPages } from '@/lib/pager';

describe('totalPages', () => {
  it('totalPages is one when there are no items', () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it('totalPages on an exact multiple', () => {
    expect(totalPages(40, 20)).toBe(2);
  });

  it('totalPages with one item past a multiple', () => {
    expect(totalPages(41, 20)).toBe(3);
  });

  it('totalPages is one when the page size is zero', () => {
    expect(totalPages(41, 0)).toBe(1);
  });
});

describe('clampPage', () => {
  it('clampPage keeps a page that is in range', () => {
    expect(clampPage(3, 5)).toBe(3);
  });

  it('clampPage raises a page below one to one', () => {
    expect(clampPage(0, 5)).toBe(1);
  });

  it('clampPage lowers a page past the end to the last page', () => {
    expect(clampPage(6, 5)).toBe(5);
  });

  it('clampPage treats NaN as page one', () => {
    expect(clampPage(Number.NaN, 5)).toBe(1);
  });

  it('clampPage treats a fractional page as page one', () => {
    expect(clampPage(2.5, 5)).toBe(1);
  });

  it('clampPage returns page one when there are no pages', () => {
    expect(clampPage(3, 0)).toBe(1);
  });
});

describe('pageWindow', () => {
  it('pageWindow centres on the current page', () => {
    expect(pageWindow(10, 20, 5)).toEqual([8, 9, 10, 11, 12]);
  });

  it('pageWindow puts the current page left of the middle for an even width', () => {
    expect(pageWindow(10, 20, 4)).toEqual([9, 10, 11, 12]);
  });

  it('pageWindow shifts right at the left edge', () => {
    expect(pageWindow(2, 20, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('pageWindow shifts left at the right edge', () => {
    expect(pageWindow(19, 20, 5)).toEqual([16, 17, 18, 19, 20]);
  });

  it('pageWindow lists every page when there are fewer than width', () => {
    expect(pageWindow(2, 3, 5)).toEqual([1, 2, 3]);
  });
});

describe('pageOffset', () => {
  it('pageOffset of page one is zero', () => {
    expect(pageOffset(1, 20)).toBe(0);
  });

  it('pageOffset of page three', () => {
    expect(pageOffset(3, 20)).toBe(40);
  });
});
