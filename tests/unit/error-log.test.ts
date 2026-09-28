import { describe, expect, it } from 'vitest';
import { describeError } from '@/lib/error-log';

describe('describeError', () => {
  it('extracts message and stack from Error instances', () => {
    const err = new Error('test error');
    const result = describeError(err);
    expect(result.message).toBe('test error');
    expect(result.stack).toContain('Error: test error');
  });

  it('uses error name when message is empty', () => {
    const err = new Error();
    err.name = 'CustomError';
    const result = describeError(err);
    expect(result.message).toBe('CustomError');
  });

  it('returns the string as-is for string inputs', () => {
    const result = describeError('string error');
    expect(result.message).toBe('string error');
    expect(result.stack).toBeNull();
  });

  it('stringifies plain objects to JSON', () => {
    const result = describeError({ error: 'test', code: 123 });
    expect(result.message).toBe(JSON.stringify({ error: 'test', code: 123 }));
    expect(result.stack).toBeNull();
  });

  it('handles undefined by converting to string', () => {
    const result = describeError(undefined);
    expect(result.message).toBe('undefined');
    expect(result.stack).toBeNull();
  });

  it('handles functions by converting to string', () => {
    const result = describeError(() => {});
    expect(result.message).toBe('() => {}');
    expect(result.stack).toBeNull();
  });

  it('handles Symbols by converting to string', () => {
    const result = describeError(Symbol('test'));
    expect(result.message).toBe('Symbol(test)');
    expect(result.stack).toBeNull();
  });

  it('handles circular objects by falling back to String', () => {
    const obj = { name: 'circular', self: null as unknown };
    obj.self = obj;
    const result = describeError(obj);
    // String() will produce something like [object Object]
    expect(typeof result.message).toBe('string');
    expect(result.stack).toBeNull();
  });

  it('handles numbers', () => {
    const result = describeError(42);
    expect(result.message).toBe('42');
    expect(result.stack).toBeNull();
  });

  it('handles booleans', () => {
    const result = describeError(true);
    expect(result.message).toBe('true');
    expect(result.stack).toBeNull();
  });

  it('handles null', () => {
    const result = describeError(null);
    expect(result.message).toBe('null');
    expect(result.stack).toBeNull();
  });

  it('handles arrays', () => {
    const result = describeError([1, 2, 3]);
    expect(result.message).toBe('[1,2,3]');
    expect(result.stack).toBeNull();
  });

  it('always returns a string message', () => {
    const testCases = [
      undefined,
      null,
      true,
      42,
      'string',
      () => {},
      Symbol('x'),
      { obj: 'test' },
      [1, 2, 3],
      new Error('test'),
    ];

    for (const testCase of testCases) {
      const result = describeError(testCase);
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
