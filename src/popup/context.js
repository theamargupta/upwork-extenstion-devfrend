import { $ } from './utils.js';

let userContextCache = '';

const DEFAULT_USER_CONTEXT = `**Me:** Amar Gupta (b. 1998-12-16), Delhi/IST. AI-Powered Full Stack Developer & Consultant, 7 yrs exp, freelancing since early 2025. Available ~50 hrs/week.

**Rate:** $25–40/hr floor, catalog rate ~$45/hr. Skip low-ball fixed-price grind.

**Niche:** MCP Server development (primary). Also strong: React, Next.js, Vue, Node.js, TypeScript, Supabase, Claude API, MCP, RAG, LangChain.

**Upwork profile:** ~01940876c0e6a16bd0
**Portfolio:** amargupta.tech · agency: devfrend.com · products: sathi.devfrend.com, mcp.devfrend.com, ai.chat.devfrend.com · pricing: devfrend.com/mcp-development

**Filter rules for you (Claude):**
- Heavily favor MCP / Claude API / agent / RAG / LangChain jobs — these are the dream fits.
- Prefer US/UK/AU/EU clients with verified payment + real spend history.
- Flag low-hire-rate or unverified clients as risky even if budget looks good.
- Fixed-price <$500 is almost always skip unless it's a foot-in-door with a strong client.
- Hourly below $25/hr = skip.

**Communication:** reply to me in casual Hinglish.`;

export async function loadUserContext() {
  const { userContext } = await chrome.storage.local.get('userContext');
  if (userContext === undefined || userContext === '') {
    userContextCache = DEFAULT_USER_CONTEXT;
    await chrome.storage.local.set({ userContext: DEFAULT_USER_CONTEXT });
  } else {
    userContextCache = userContext;
  }
  const el = $('user-context');
  if (el) el.value = userContextCache;
}

export async function saveUserContext(value) {
  userContextCache = value || '';
  await chrome.storage.local.set({ userContext: userContextCache });
  const s = $('user-context-status');
  if (s) {
    s.textContent = 'Saved.';
    setTimeout(() => { s.textContent = ''; }, 1200);
  }
}

export function contextBlock() {
  const ctx = (userContextCache || '').trim();
  return ctx ? `## My context (use this to filter)\n\n${ctx}\n\n---\n\n` : '';
}
