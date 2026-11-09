// Verify the production preview with the same real-input character playthrough.
process.env.GAME_URL ??= 'http://localhost:4173';
await import('./character-playtest.mjs');
