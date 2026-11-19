// Which RealtimeKit `roomLeft` states end the room for MyZoom.
// 'disconnected' is transient: the SDK reconnects by itself and emits roomJoined {reconnected:true};
// the final state after exhausting retries is 'failed' (audit H1, D-018).
// 'connected-meeting' (breakout) and 'stageLeft' do not end the room either.
const ENDING_STATES = new Set(['left', 'ended', 'kicked', 'rejected', 'failed']);

export function isEndingState(state: string): boolean {
  return ENDING_STATES.has(state);
}
