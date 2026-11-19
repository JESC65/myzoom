import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isEndingState } from '../../src/client/roomState.ts';

describe('roomLeft states (audit H1)', () => {
  it('a transient disconnection does not take people out of the room', () => {
    assert.equal(isEndingState('disconnected'), false);
    assert.equal(isEndingState('connected-meeting'), false);
    assert.equal(isEndingState('stageLeft'), false);
  });
  it('final states show «Saliste de la reunión»', () => {
    for (const s of ['left', 'ended', 'kicked', 'rejected', 'failed']) assert.equal(isEndingState(s), true, s);
  });
});
