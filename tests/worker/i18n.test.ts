import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { es } from '../../src/client/i18n/es.ts';
// The plain ESM dictionary shipped inside the installed UI Kit (exports: "./dist/*").
import { defaultLanguage } from '@cloudflare/realtimekit-ui/dist/collection/lib/lang/default-language.js';

const REQUIRED_AREAS = [
  'leave', 'leave_confirmation', 'mic_on', 'mic_off', 'enable_mic', 'disable_mic', 'video_on', 'video_off', 'enable_video', 'disable_video',
  'participants', 'chat', 'chat.message_placeholder', 'chat.send_msg', 'settings', 'settings.microphone_input', 'settings.speaker_output',
  'pin', 'unpin', 'mute', 'kick', 'perm_denied', 'perm_denied.audio', 'perm_denied.video', 'network.reconnecting', 'network.lost',
  'network.restored', 'audio_playback', 'audio_playback.title', 'ended.left', 'setup_screen.your_name',
];

describe('es.ts (section 5.3)', () => {
  it('every translated key exists in defaultLanguage of the installed UI Kit', () => {
    const known = new Set(Object.keys(defaultLanguage));
    const unknown = Object.keys(es).filter((k) => !known.has(k));
    assert.deepEqual(unknown, []);
  });

  it('covers controls, participants, chat, settings, pin, mute, leave, permissions and connection', () => {
    const missing = REQUIRED_AREAS.filter((k) => !(k in es));
    assert.deepEqual(missing, []);
  });

  it('no empty translations and no leftover English for translated keys', () => {
    for (const [k, v] of Object.entries(es)) {
      assert.ok(typeof v === 'string' && v.trim().length > 0, k);
    }
    const sameAsEnglish = Object.entries(es).filter(([k, v]) => (defaultLanguage as Record<string, string>)[k] === v).map(([k]) => k);
    // Words that are identical in both languages are allowed.
    assert.deepEqual(sameAsEnglish.filter((k) => !['logo', 'audio', 'video', 'chat'].includes(k)), []);
  });
});
