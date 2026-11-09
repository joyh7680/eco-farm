const paths: Record<string, string> = {
  leaf: '<path d="M7 25C-1 13 8 2 18 8c9-8 17 2 10 12-4 7-10 11-17 9" fill="#92b960" stroke="#285c45"/><path d="m11 28 8-16m-5 9-6-5m9 0 6-3" fill="none" stroke="#386b47"/>',
  bean: '<path d="M15 30V9m0 13C2 23 2 12 8 13c5 0 7 6 7 9m0-5c12 2 14-10 8-9-5 0-8 5-8 9" fill="#86aa59" stroke="#3e7048"/><path d="M20 18c7 2 7 10 2 10-4-1-4-6-2-10" fill="#dec775" stroke="#8f8c45"/><circle cx="15" cy="6" r="4" fill="#dca5af"/>',
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
