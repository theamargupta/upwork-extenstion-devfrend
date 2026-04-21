export const BRIDGE_BASE = 'http://localhost:8787';
export const BRIDGE_URL = `${BRIDGE_BASE}/shortlist`;
export const BRIDGE_POLL_MS = 2000;
export const BRIDGE_HEALTH_TIMEOUT_MS = 1500;
export const BRIDGE_HEALTH_INTERVAL_MS = 3000;

export const CONTENT_SCRIPT_FILES = [
  'src/shared/selectors.js',
  'src/content/dom-helpers.js',
  'src/content/extractors.js',
  'src/content/scoring.js',
  'src/content/batch-extractor.js',
  'src/content/content.js'
];
