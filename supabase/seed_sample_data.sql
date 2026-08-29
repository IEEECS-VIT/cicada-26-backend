-- Manual seed script (NOT a migration - run it once in the Supabase SQL editor).
-- Seeds the rounds from sample_rounds.csv and the challenges from sample_challenges.csv.
-- Rounds are inserted idempotently (ON CONFLICT on order_number); round_id is resolved
-- from the rounds table via order_number, so no hardcoded UUIDs are needed.
-- Idempotent per challenge too (ON CONFLICT on order_number) - safe to re-run.

-- 1) Rounds (with their story fragments)
INSERT INTO public.rounds (name, order_number, story_fragment, is_active)
VALUES
  ('Round 1', 1, '{"title": "Recovered Mission Log", "header": "Day 102", "content": "Signal acquisition established. The relay has awakened - decrypt the handshake token to reclaim the uplink."}'::jsonb, true),
  ('Round 2', 2, '{"title": "Deep Space Relay", "header": "Day 103", "content": "The core reactor is cycling. Recover the boot sequence before the cooling system fails."}'::jsonb, true)
ON CONFLICT (order_number) DO NOTHING;

-- 2) Challenges (round_id resolved from rounds.order_number)
INSERT INTO public.challenges (order_number, name, story_context, assets, round_id, hints, answer_key, time_limit, is_active)
VALUES
  (
    1,
    'Archive 01: Signal Intrusion',
    'A rogue transmission has overwritten the station relay. Decrypt the handshake token to reclaim the uplink.',
    '[{"id": "asset-1-1", "type": "text", "content": "Handshake token: 0x4369636164613236", "name": "relay_handshake.txt"}, {"id": "asset-1-2", "type": "image", "url": "https://example.com/assets/beacon_spectrum.png", "name": "Beacon Spectrum", "caption": "Frequency distribution of the intrusion signal"}]'::jsonb,
    (SELECT id FROM public.rounds WHERE order_number = 1),
    '[{"id": "hint-1-1", "text": "The token is hex encoded text, decode it before submitting.", "is_visible": true}, {"id": "hint-1-2", "text": "Try converting 0x4369636164613236 to ASCII.", "is_visible": false}]'::jsonb,
    'CICADA26_START',
    1800,
    true
  ),
  (
    2,
    'Archive 02: Boot Sequence',
    'The core reactor is cycling. Recover the boot password embedded in the service manual before the cooling system fails.',
    '[{"id": "asset-2-1", "type": "pdf", "url": "https://example.com/assets/core_manual.pdf", "name": "Core Service Manual"}, {"id": "asset-2-2", "type": "file", "url": "https://example.com/assets/boot_cfg.ini", "name": "boot_cfg.ini", "content": "PASSKEY=SECTOR7-OVERRIDE"}]'::jsonb,
    (SELECT id FROM public.rounds WHERE order_number = 1),
    '[{"id": "hint-2-1", "text": "The boot configuration file contains the plaintext key.", "is_visible": true}]'::jsonb,
    'SECTOR7_OVERRIDE',
    2400,
    true
  ),
  (
    3,
    'Archive 03: Sector Telemetry',
    'Navigation arrays report a dead zone near Sector 7. Cross-reference the telemetry map with the audio log to recover the lost coordinates.',
    '[{"id": "asset-3-1", "type": "image", "url": "https://example.com/assets/sector7_map.png", "name": "Sector 7 Nav Map", "caption": "Anomaly glow visible at grid reference 7-4-1"}, {"id": "asset-3-2", "type": "audio", "url": "https://example.com/assets/research_audio.mp3", "name": "Research Audio Tape #3"}]'::jsonb,
    (SELECT id FROM public.rounds WHERE order_number = 1),
    '[{"id": "hint-3-1", "text": "The caption on the map hints at the answer.", "is_visible": true}, {"id": "hint-3-2", "text": "Coordinates are numeric, dash separated.", "is_visible": false}]'::jsonb,
    '7-4-1',
    1800,
    true
  ),
  (
    4,
    'Archive 04: Decrypted Transcript',
    'A corrupted research log has been recovered. Fix the parity errors in the payload to reveal the quarantine passphrase.',
    '[{"id": "asset-4-1", "type": "file", "url": "https://example.com/assets/crew_log_04.txt", "name": "crew_log_04_raw.txt"}, {"id": "asset-4-2", "type": "text", "content": "Parity byte for block 3 is 0x41.", "name": "parity_note.txt"}]'::jsonb,
    (SELECT id FROM public.rounds WHERE order_number = 1),
    '[{"id": "hint-4-1", "text": "0x41 in ASCII is the letter A.", "is_visible": true}, {"id": "hint-4-2", "text": "Combine the corrected blocks and read the first letters.", "is_visible": false}]'::jsonb,
    'CREW_RESEARCH_ALPHA',
    1200,
    true
  ),
  (
    5,
    'Archive 05: Core Payload Access',
    'The final telemetry database is behind a biometric lock. Reconstruct the access phrase from the surviving lab feed.',
    '[{"id": "asset-5-1", "type": "video", "url": "https://example.com/assets/lab_feed.mp4", "name": "Lab Camera Surveillance Feed"}, {"id": "asset-5-2", "type": "pdf", "url": "https://example.com/assets/access_protocol.pdf", "name": "Access Protocol v2.1"}]'::jsonb,
    (SELECT id FROM public.rounds WHERE order_number = 2),
    '[{"id": "hint-5-1", "text": "The access protocol document defines the phrase format.", "is_visible": true}]'::jsonb,
    'ORBITAL_CORE_PAYLOAD',
    3600,
    true
  ),
  (
    6,
    'Archive 06: Final Override',
    'The anomaly has reached the core. Enter the final override phrase to purge the station systems and end the transmission.',
    '[{"id": "asset-6-1", "type": "text", "content": "WARNING: Override phrase required to initiate purge.", "name": "override_terminal.txt"}]'::jsonb,
    (SELECT id FROM public.rounds WHERE order_number = 2),
    '[{"id": "hint-6-1", "text": "The phrase is a year-based call sign.", "is_visible": true}, {"id": "hint-6-2", "text": "Think of the event name.", "is_visible": false}]'::jsonb,
    'CICADA26_PURGE',
    1800,
    true
  )
ON CONFLICT (order_number) DO NOTHING;