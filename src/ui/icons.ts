const paths: Record<string, string> = {
  map: '<path d="m5 8 9-3 9 3 8-3v23l-8 3-9-3-9 3Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 5v23M23 8v23" stroke="currentColor" stroke-width="1.5"/><circle cx="19" cy="17" r="3" fill="#e5af67"/>',
  menu: '<path d="M8 12h20M8 19h20M8 26h13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',

  leaf: '<path d="M18 31C5 32 1 22 5 17c-2-8 6-10 10-6 5-8 13-5 13 2 9 2 7 13 1 15-3 4-7 4-11 3" fill="#79c5a1" stroke="#285c54" stroke-width="1.5"/><path d="M18 30C7 24 10 17 16 18c-1-7 8-8 10-2 6 6-1 12-8 14Z" fill="#c8edc4" stroke="#528e75"/><path d="m18 29 3-10m-3 6-4-3" fill="none" stroke="#528e75"/><path d="M28 2a6 6 0 1 0 6 8c-6 2-10-3-6-8Z" fill="#fff1ae" stroke="#ad924c"/>',
  bean: '<path d="M15 32V7m0 14C3 22 3 13 8 14c4 0 7 5 7 7m0-6c11 1 12-7 7-7-4 0-7 4-7 7" fill="#6895a0" stroke="#365d70" stroke-width="1.5"/><path d="M22 16c10 1 11 15 4 15-6 0-8-10-4-15Z" fill="#ae91d9" stroke="#65518d" stroke-width="1.5"/><g fill="#e9dcfa"><circle cx="24" cy="20" r="2"/><circle cx="26" cy="24" r="2"/><circle cx="26" cy="28" r="2"/></g><path d="m15 1 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z" fill="#ffe49b" stroke="#b18b50"/>',
  water: '<path d="M9 13h15v15H9zM9 16H4v8h5m15-8 6-5 3 4-9 8" fill="#79b5b1" stroke="#335e59" stroke-width="2"/><path d="M12 12V7h9v5" fill="none" stroke="#335e59" stroke-width="2"/><path d="m31 20-1 4m4-2-1 4" stroke="#85c9d1" stroke-width="2"/>',
  harvest: '<path d="m8 30 15-17" stroke="#8a6a44" stroke-width="5"/><path d="M17 16C30 22 36 6 22 3c5 7 0 10-5 13" fill="#d2d5be" stroke="#566850" stroke-width="1.5"/>',
  delivery: '<path d="m4 12 13-6 13 6v17L17 34 4 29z" fill="#c49859" stroke="#745b3b"/><path d="m4 12 13 6 13-6M17 18v16m-6-25 13 6v8" fill="none" stroke="#ead29a" stroke-width="2"/>',
  drop: '<path d="M18 3C13 11 7 17 7 23a11 11 0 0 0 22 0C29 17 23 11 18 3Z" fill="currentColor"/><path d="M12 23a6 6 0 0 0 5 6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>',
  coin: '<circle cx="18" cy="18" r="13" fill="#e9bf62" stroke="#9f7e3f" stroke-width="2"/><path d="M22 12h-7v12h7v-6h-4" fill="none" stroke="#8b6a35" stroke-width="2"/>',
  sound: '<path d="m5 14 7 0 9-8v24l-9-8H5z" fill="currentColor"/><path d="M26 11q9 7 0 14" fill="none" stroke="currentColor" stroke-width="2"/>',
  mute: '<path d="m5 14 7 0 9-8v24l-9-8H5z" fill="currentColor"/><path d="m25 13 7 10m0-10-7 10" fill="none" stroke="currentColor" stroke-width="2"/>',
  expand: '<path d="M13 6H6v7m17-7h7v7M6 23v7h7m10 0h7v-7" fill="none" stroke="currentColor" stroke-width="2"/>',
  pause: '<path d="M12 8v20m12-20v20" stroke="currentColor" stroke-width="4"/>',
  sun: '<circle cx="18" cy="18" r="7" fill="currentColor"/><path d="M18 1v5m0 24v5M1 18h5m24 0h5M6 6l4 4m16 16 4 4M6 30l4-4M26 10l4-4" stroke="currentColor" stroke-width="2"/>',
  sprout: '<path d="M18 31V15C4 18 4 4 4 4s14-1 14 11C18 4 32 6 32 6s0 13-14 11" fill="currentColor"/>',
};
export function icon(name: string, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 36 36" aria-hidden="true">${paths[name] ?? paths.sprout}</svg>`; }
