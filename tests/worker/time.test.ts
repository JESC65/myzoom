import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventWindow } from '../../src/worker/time.ts';
import { formatLima, formatLimaTime, formatLimaWindow } from '../../src/shared/time-format.ts';
import { OPENS_MS, CLOSES_MS } from './helpers.ts';

const MIN = 60_000;

describe('event window edges (section 14.1)', () => {
  it('one minute before opening: closed (before)', () => {
    assert.equal(eventWindow(OPENS_MS - MIN, OPENS_MS, CLOSES_MS).state, 'before');
  });
  it('at opening: open', () => {
    assert.equal(eventWindow(OPENS_MS, OPENS_MS, CLOSES_MS).state, 'open');
  });
  it('one minute before closing: open', () => {
    assert.equal(eventWindow(CLOSES_MS - MIN, OPENS_MS, CLOSES_MS).state, 'open');
  });
  it('at closing: closed (after)', () => {
    assert.equal(eventWindow(CLOSES_MS, OPENS_MS, CLOSES_MS).state, 'after');
  });
  it('unknown when dates are missing', () => {
    assert.equal(eventWindow(OPENS_MS, null, CLOSES_MS).state, 'unknown');
  });
});

describe('Lima formatting', () => {
  it('shows Lima time (UTC-5) regardless of the input offset', () => {
    assert.equal(formatLima('2026-11-21T13:00:00Z'), 'sábado 21 de noviembre a las 8:00 a. m. (hora de Lima)');
    assert.equal(formatLima('2026-11-21T08:00:00-05:00'), 'sábado 21 de noviembre a las 8:00 a. m. (hora de Lima)');
    assert.equal(formatLima('2026-11-22T06:00:00-05:00'), 'domingo 22 de noviembre a las 6:00 a. m. (hora de Lima)');
  });
  it('12-hour clock with noon and midnight', () => {
    assert.equal(formatLimaTime(new Date('2026-11-21T12:00:00-05:00')), '12:00 p. m.');
    assert.equal(formatLimaTime(new Date('2026-11-21T00:05:00-05:00')), '12:05 a. m.');
    assert.equal(formatLimaTime(new Date('2026-11-21T18:30:00-05:00')), '6:30 p. m.');
  });
  it('window line', () => {
    assert.equal(formatLimaWindow('2026-11-21T08:00:00-05:00', '2026-11-22T06:00:00-05:00'),
      'Del sábado 21 de noviembre, 8:00 a. m. al domingo 22, 6:00 a. m. (hora de Lima)');
  });
  it('invalid input gives empty text', () => {
    assert.equal(formatLima('no-es-fecha'), '');
  });
});
