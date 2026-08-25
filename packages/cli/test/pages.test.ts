import { describe, it, expect } from 'vitest';
import { parsePageSpec } from '../src/pages.js';

describe('parsePageSpec', () => {
  it('parses a single page', () => {
    expect(parsePageSpec('3', '--pages')).toEqual([3]);
  });

  it('parses a comma separated list', () => {
    expect(parsePageSpec('1,3,5', '--pages')).toEqual([1, 3, 5]);
  });

  it('expands an ascending range', () => {
    expect(parsePageSpec('5-7', '--pages')).toEqual([5, 6, 7]);
  });

  it('expands a descending range in the order written', () => {
    expect(parsePageSpec('7-5', '--pages')).toEqual([7, 6, 5]);
  });

  it('mixes single pages and ranges', () => {
    expect(parsePageSpec('1,3,5-7', '--pages')).toEqual([1, 3, 5, 6, 7]);
  });

  it('keeps the order the pages are written in', () => {
    expect(parsePageSpec('4,1,3', '--pages')).toEqual([4, 1, 3]);
  });

  it('keeps repeats rather than collapsing them', () => {
    expect(parsePageSpec('2,2,5', '--pages')).toEqual([2, 2, 5]);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parsePageSpec(' 1 , 3 - 4 ', '--pages')).toEqual([1, 3, 4]);
  });

  it('treats a single page range as that page', () => {
    expect(parsePageSpec('4-4', '--pages')).toEqual([4]);
  });

  it('names the flag when the spec is empty', () => {
    expect(() => parsePageSpec('', '--pages')).toThrow(
      /--pages requires at least one page number/
    );
  });

  it('rejects a blank entry from a trailing comma', () => {
    expect(() => parsePageSpec('1,', '--pages')).toThrow(/empty page entry/);
  });

  it('rejects a non-numeric page', () => {
    expect(() => parsePageSpec('1,x', '--pages')).toThrow(/not a page number/);
  });

  it('rejects a fractional page', () => {
    expect(() => parsePageSpec('1.5', '--pages')).toThrow(/not a page number/);
  });

  it('rejects page zero', () => {
    expect(() => parsePageSpec('0', '--pages')).toThrow(/1-based/);
  });

  it('rejects a negative page', () => {
    expect(() => parsePageSpec('-2', '--pages')).toThrow(/not a page number/);
  });

  it('rejects a malformed range', () => {
    expect(() => parsePageSpec('1-2-3', '--pages')).toThrow(/not a page range/);
  });

  it('reports the flag name it was given', () => {
    expect(() => parsePageSpec('nope', '--order')).toThrow(/--order/);
  });
});
