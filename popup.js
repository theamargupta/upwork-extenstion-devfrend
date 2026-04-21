// Job Extractor — Popup Script

(async () => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const loading = $('loading');
  const error = $('error');
  const errorMsg = $('error-msg');
  const scoreBadge = $('score-badge');
  const batchPanel = $('batch-panel');
  const settingsPanel = $('settings-panel');

  let batchData = [];
  let currentGroup = 'extract';
  const currentSub = { tools: 'capture' };
  let supabaseReady = false;
  let captureData = null;

  // Data-driven tab registry — add new Tools sub-tabs here and in HTML.
  const GROUP_SUBS = {
    extract: [],
    tools: ['capture']
  };

  // --- Toast ---

  function showToast(msg) {
    const toast = $('toast');
    toast.textContent = msg || 'Copied!';
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 1500);
  }

  // --- Copy helpers ---

  function formatMarkdown(data) {
    const lines = [];
    lines.push(`# ${data.title}`);
    lines.push('');
    lines.push(`**URL:** ${data.url}`);
    lines.push(`**Score:** ${data.score}/10 — ${data.scoreLabel.label}`);
    lines.push('');
    lines.push('## Key Metrics');
    lines.push(`- **Budget:** ${data.budget.amount} (${data.budget.type})`);
    lines.push(`- **Experience Level:** ${data.experienceLevel}`);
    lines.push(`- **Posted:** ${data.postedDate}`);
    lines.push(`- **Location:** ${data.location}`);
    lines.push(`- **Proposals:** ${data.proposals}`);
    lines.push(`- **Project Length:** ${data.projectLength || 'N/A'}`);
    lines.push(`- **Project Type:** ${data.projectType || 'N/A'}`);
    lines.push('');
    lines.push('## Activity');
    lines.push(`- **Last Viewed:** ${data.lastViewed}`);
    lines.push(`- **Interviewing:** ${data.interviewing}`);
    lines.push(`- **Invites Sent:** ${data.invitesSent}`);
    lines.push('');
    lines.push('## Bid Range');
    lines.push(`- **High:** ${data.bidRange.high} | **Avg:** ${data.bidRange.avg} | **Low:** ${data.bidRange.low}`);
    lines.push('');
    lines.push('## Connects');
    lines.push(`- **Required:** ${data.connectsRequired}`);
    lines.push(`- **Available:** ${data.connectsAvailable}`);
    lines.push('');
    lines.push('## Skills');
    lines.push(data.skills.length ? data.skills.map(s => `\`${s}\``).join(', ') : 'None listed');
    lines.push('');
    lines.push('## Client Info');
    lines.push(`- **Payment:** ${data.client.paymentVerified ? 'Verified' : 'Not Verified'}`);
    lines.push(`- **Location:** ${data.client.location}`);
    lines.push(`- **Hire Rate:** ${data.client.hireRate}`);
    lines.push(`- **Open Jobs:** ${data.client.openJobs}`);
    lines.push(`- **Total Spent:** ${data.client.totalSpent}`);
    lines.push(`- **Member Since:** ${data.client.memberSince}`);
    lines.push(`- **Rating:** ${data.client.rating}`);
    lines.push(`- **Reviews:** ${data.client.reviews}`);
    lines.push('');
    lines.push('## Description');
    lines.push(data.description || 'No description available');
    return lines.join('\n');
  }

  const COUNTRY_SHORT = {
    'United States': 'US', 'United Kingdom': 'UK', 'Canada': 'CA', 'Australia': 'AU',
    'Germany': 'DE', 'France': 'FR', 'Netherlands': 'NL', 'Ireland': 'IE',
    'New Zealand': 'NZ', 'Switzerland': 'CH', 'Sweden': 'SE', 'Norway': 'NO',
    'Denmark': 'DK', 'Finland': 'FI', 'Israel': 'IL', 'Japan': 'JP',
    'Singapore': 'SG', 'Hong Kong': 'HK', 'South Korea': 'KR',
    'United Arab Emirates': 'UAE', 'Saudi Arabia': 'SA',
    'India': 'IN', 'Pakistan': 'PK', 'Bangladesh': 'BD', 'Philippines': 'PH',
    'Indonesia': 'ID', 'Vietnam': 'VN', 'Thailand': 'TH', 'Malaysia': 'MY',
    'Brazil': 'BR', 'Mexico': 'MX', 'Argentina': 'AR',
    'Spain': 'ES', 'Italy': 'IT', 'Portugal': 'PT', 'Poland': 'PL',
    'Ukraine': 'UA', 'Russia': 'RU', 'Turkey': 'TR', 'Egypt': 'EG',
    'South Africa': 'ZA', 'Nigeria': 'NG', 'Kenya': 'KE'
  };

  function formatAmount(s) {
    const n = parseFloat(String(s).replace(/[$,]/g, ''));
    if (!isFinite(n)) return String(s);
    if (n >= 1000) {
      const k = n / 1000;
      return '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
    }
    return '$' + (Number.isInteger(n) ? n : n.toFixed(2).replace(/\.00$/, ''));
  }

  function compactBudget(b) {
    if (!b || !b.amount || b.amount === 'Not specified') return 'unspecified';
    const isHourly = b.type === 'Hourly';
    const tail = isHourly ? '/hr' : ' fixed';
    const matches = b.amount.match(/\$[\d,]+(?:\.\d+)?/g);
    if (!matches || !matches.length) return `${b.amount}${tail}`;
    if (matches.length >= 2) {
      return `${formatAmount(matches[0])}-${formatAmount(matches[1]).replace('$', '')}${tail}`;
    }
    return `${formatAmount(matches[0])}${tail}`;
  }

  function compactCountry(location) {
    if (!location || location === 'Not specified') return '?';
    if (/worldwide/i.test(location)) return 'WW';
    const parts = location.split(',').map(s => s.trim());
    const last = parts[parts.length - 1];
    return COUNTRY_SHORT[last] || last;
  }

  function compactClient(c) {
    const bits = [];
    if (c.totalSpent && c.totalSpent !== 'Not specified') bits.push(`${c.totalSpent} spent`);
    if (c.hireRate && c.hireRate !== 'Not specified') {
      const pct = parseInt(c.hireRate, 10) || 0;
      const flag = pct > 0 && pct < 30 ? ' ⚠️' : '';
      bits.push(`${c.hireRate} hire${flag}`);
    }
    if (c.reviews && c.reviews !== 'Not specified' && c.reviews !== '0') {
      bits.push(`${c.reviews} reviews`);
    }
    if (c.paymentVerified === false) bits.push('⚠️ not verified');
    return bits.join(', ');
  }

  function compactUrl(url) {
    if (!url) return '?';
    const m = url.match(/~(\w+)/);
    return m ? `~${m[1]}` : url.split('?')[0];
  }

  function shortenAsk(desc) {
    if (!desc) return 'No description';
    const cleaned = desc.replace(/\s+/g, ' ').trim();
    const firstSentence = cleaned.match(/^[^.!?\n]{20,220}[.!?]/);
    let snippet = firstSentence ? firstSentence[0] : cleaned;
    if (snippet.length > 220) snippet = snippet.slice(0, 217) + '...';
    return snippet.trim();
  }

  function formatCompact(data, index) {
    const prefix = typeof index === 'number' ? `[${index + 1}] ` : '';
    const title = (data.title || 'Untitled').replace(/\s+/g, ' ').trim();
    const score = `${data.score}/10 ${data.scoreLabel.label}`;
    const stack = (data.skills && data.skills.length) ? data.skills.join(', ') : 'not listed';

    return [
      `${prefix}${title} | ${score}`,
      `${compactBudget(data.budget)} | ${compactCountry(data.client?.location)} | ${compactClient(data.client || {})}`,
      shortenAsk(data.description),
      `Stack: ${stack}`,
      compactUrl(data.url)
    ].join('\n');
  }

  function formatBatchMarkdown(jobs) {
    return jobs.map((j, i) => `---\n\n## Job ${i + 1}\n\n${formatMarkdown(j)}`).join('\n\n');
  }

  function formatBatchCompact(jobs) {
    const now = new Date().toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
    const header = `Batch of ${jobs.length} jobs pulled at ${now}`;
    return `${header}\n\n` + jobs.map((j, i) => formatCompact(j, i)).join('\n\n');
  }

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

  async function loadUserContext() {
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

  async function saveUserContext(value) {
    userContextCache = value || '';
    await chrome.storage.local.set({ userContext: userContextCache });
    const s = $('user-context-status');
    if (s) {
      s.textContent = 'Saved.';
      setTimeout(() => { s.textContent = ''; }, 1200);
    }
  }

  function contextBlock() {
    const ctx = (userContextCache || '').trim();
    return ctx ? `## My context (use this to filter)\n\n${ctx}\n\n---\n\n` : '';
  }

  function wrapAsShortlistPrompt(compactText, jobCount) {
    return `# Job Shortlist

${contextBlock()}I've extracted ${jobCount} Upwork job${jobCount === 1 ? '' : 's'} via my Chrome extension. Each row is:

- Line 1: \`[N] Title | score/10 LABEL\`
- Line 2: \`budget | country | client signal\` (⚠️ = red flag: low hire rate or unverified payment)
- Line 3: one-line ask (first sentence of the description)
- Line 4: \`Stack: <skills>\`
- Line 5: \`~<UID>\` (Upwork job id)

Rank them best-to-worst given my profile. For each, give one-line reasoning. Call out red flags explicitly.

---

${compactText}`;
  }

  // --- Copied-UID tracking (auto-skip in batch mode) ---

  function uidFromUrl(url) {
    const m = (url || '').match(/~(\w+)/);
    return m ? m[1] : null;
  }

  async function markJobCopied(urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    const uids = list.map(uidFromUrl).filter(Boolean);
    if (!uids.length) return;
    const { copiedJobUids = [] } = await chrome.storage.local.get('copiedJobUids');
    const merged = Array.from(new Set([...copiedJobUids, ...uids]));
    await chrome.storage.local.set({ copiedJobUids: merged });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied!');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied!');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showError(msg) {
    loading.classList.add('hidden');
    batchPanel.classList.add('hidden');
    error.classList.remove('hidden');
    errorMsg.textContent = msg;
  }

  // --- Render batch results ---

  function renderBatchResults(results) {
    const successJobs = results.filter(r => r.success).map(r => r.data);
    batchData = successJobs;

    // Sort by score descending
    successJobs.sort((a, b) => b.score - a.score);

    const applyCount = successJobs.filter(j => j.score >= 8).length;
    const maybeCount = successJobs.filter(j => j.score >= 5 && j.score < 8).length;
    const skipCount = successJobs.filter(j => j.score < 5).length;

    $('batch-summary').innerHTML = `
      <div class="summary-stat">
        <span class="label">Total</span>
        <span class="value">${successJobs.length}</span>
      </div>
      <div class="summary-stat">
        <span class="label" style="color:#22C55E">Apply</span>
        <span class="value" style="color:#22C55E">${applyCount}</span>
      </div>
      <div class="summary-stat">
        <span class="label" style="color:#EAB308">Maybe</span>
        <span class="value" style="color:#EAB308">${maybeCount}</span>
      </div>
      <div class="summary-stat">
        <span class="label" style="color:#EF4444">Skip</span>
        <span class="value" style="color:#EF4444">${skipCount}</span>
      </div>
    `;

    const listHtml = successJobs.map(job => {
      const sl = job.scoreLabel;
      return `
        <div class="batch-item">
          <span class="batch-item-score" style="background:${sl.color};color:${job.score >= 5 && job.score < 8 ? '#0F172A' : '#FFF'}">
            ${job.score}/10
          </span>
          <div class="batch-item-info">
            <div class="batch-item-title">${escapeHtml(job.title || 'Unknown')}</div>
            <div class="batch-item-meta">
              ${job.budget.amount} ${job.budget.type} &middot; ${job.proposals} proposals &middot; ${job.client.paymentVerified ? 'Verified' : 'Not Verified'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    $('batch-list').innerHTML = listHtml;
    $('batch-results').classList.remove('hidden');
    $('batch-progress').classList.add('hidden');
    $('batch-start').disabled = false;
    $('batch-start').textContent = 'Start';

    // Auto-fire Pick Best as soon as results are in — no need to wait for a click.
    if (batchData.length) {
      setTimeout(() => $('batch-ask-claude').click(), 300);
    }
  }

  // --- Auth & Supabase helpers ---

  async function checkAuth() {
    const user = await Supabase.getUser();
    supabaseReady = !!user;

    // Show/hide save buttons
    document.querySelectorAll('.btn-supabase').forEach(btn => {
      btn.classList.toggle('hidden', !supabaseReady);
    });

    // Toggle auth form vs profile
    $('auth-form').classList.toggle('hidden', supabaseReady);
    $('auth-profile').classList.toggle('hidden', !supabaseReady);

    if (user) {
      $('profile-email').textContent = user.email;
      $('profile-meta').textContent = `Signed in since ${new Date(user.created_at).toLocaleDateString()}`;
    }

    return user;
  }

  let authMode = 'login'; // 'login' or 'signup'

  function setAuthMode(mode) {
    authMode = mode;
    $('auth-tab-login').classList.toggle('active', mode === 'login');
    $('auth-tab-signup').classList.toggle('active', mode === 'signup');
    $('auth-submit').textContent = mode === 'login' ? 'Sign In' : 'Sign Up';
    $('auth-status').textContent = '';
  }

  async function handleAuth() {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    const statusEl = $('auth-status');

    if (!email || !password) {
      statusEl.textContent = 'Email and password are required.';
      statusEl.className = 'supa-status error';
      return;
    }
    if (password.length < 6) {
      statusEl.textContent = 'Password must be at least 6 characters.';
      statusEl.className = 'supa-status error';
      return;
    }

    $('auth-submit').disabled = true;
    statusEl.textContent = authMode === 'login' ? 'Signing in...' : 'Creating account...';
    statusEl.className = 'supa-status';

    try {
      if (authMode === 'signup') {
        const result = await Supabase.signUp(email, password);
        if (result.needsConfirmation) {
          statusEl.textContent = 'Check your email to confirm your account, then sign in.';
          statusEl.className = 'supa-status success';
          setAuthMode('login');
        } else {
          statusEl.textContent = 'Account created!';
          statusEl.className = 'supa-status success';
          await checkAuth();
        }
      } else {
        await Supabase.signIn(email, password);
        statusEl.textContent = '';
        await checkAuth();
        showToast('Signed in!');
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'supa-status error';
    }
    $('auth-submit').disabled = false;
  }

  async function handleLogout() {
    await Supabase.signOut();
    await checkAuth();
    showToast('Signed out');
    $('auth-email').value = '';
    $('auth-password').value = '';
  }

  async function saveJobToSupabase(data, btn) {
    if (!supabaseReady) return;
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await Supabase.upsertJob(data);
      btn.textContent = 'Saved!';
      showToast('Saved to Supabase!');
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
    } catch (err) {
      btn.textContent = 'Error';
      showToast('Save failed: ' + err.message);
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
    }
  }

  async function saveBatchToSupabase(jobs, btn) {
    if (!supabaseReady || !jobs.length) return;
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    audit('supabase:save:start', { count: jobs.length });
    try {
      await Supabase.upsertJobs(jobs);
      audit('supabase:save:done', { count: jobs.length });
      btn.textContent = 'Saved!';
      showToast(`${jobs.length} jobs saved to Supabase!`);
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
    } catch (err) {
      audit('supabase:save:error', { error: err?.message || String(err) });
      btn.textContent = 'Error';
      showToast('Save failed: ' + err.message);
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
    }
  }

  // --- Tab switching (two-level: group -> sub) ---

  function hideAllPanels() {
    batchPanel.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    $('capture-panel').classList.add('hidden');
    loading.classList.add('hidden');
    error.classList.add('hidden');
    scoreBadge.classList.remove('visible');
  }

  function switchTo(group, sub) {
    if (!GROUP_SUBS[group]) return;
    currentGroup = group;
    if (sub && GROUP_SUBS[group].includes(sub)) {
      currentSub[group] = sub;
    }
    const effectiveSub = GROUP_SUBS[group].length ? currentSub[group] : null;

    // Top tabs
    document.querySelectorAll('#top-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.group === group);
    });

    // Sub-tab rows: only show the current group's row
    document.querySelectorAll('.subtabs').forEach(row => {
      row.classList.toggle('hidden', row.dataset.group !== group);
    });

    // Active sub-tab
    if (effectiveSub) {
      const row = document.querySelector(`.subtabs[data-group="${group}"]`);
      row?.querySelectorAll('.subtab').forEach(t => {
        t.classList.toggle('active', t.dataset.sub === effectiveSub);
      });
    }

    hideAllPanels();

    if (group === 'extract') {
      batchPanel.classList.remove('hidden');
      $('batch-results').classList.add('hidden');
      $('batch-progress').classList.add('hidden');
    } else if (group === 'tools') {
      if (effectiveSub === 'capture') {
        $('capture-panel').classList.remove('hidden');
      }
    } else if (group === 'settings') {
      settingsPanel.classList.remove('hidden');
    }
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function ensureContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch {
      // Already injected
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // --- Batch extract ---

  let batchTabId = null;

  function setBatchRunning(running) {
    $('batch-start').classList.toggle('hidden', running);
    $('batch-stop').classList.toggle('hidden', !running);
    $('batch-count').disabled = running;
  }

  async function startBatch() {
    const count = parseInt($('batch-count').value) || 10;
    audit('batch:start', { count });

    setBatchRunning(true);
    $('batch-results').classList.add('hidden');
    $('batch-progress').classList.remove('hidden');
    $('progress-bar-fill').style.width = '0%';
    $('batch-status').textContent = 'Injecting script...';

    try {
      const tab = await getActiveTab();
      batchTabId = tab?.id;

      if (!tab || !tab.url || !tab.url.includes('upwork.com')) {
        audit('batch:wrongPage', { url: tab?.url });
        showError('Please navigate to an Upwork Best Matches, Most Recent, or Search page first.');
        setBatchRunning(false);
        return;
      }

      await ensureContentScript(tab.id);

      const progressListener = (msg) => {
        if (msg.action === 'batchProgress') {
          const pct = Math.round((msg.current / msg.total) * 100);
          $('progress-bar-fill').style.width = pct + '%';
          $('batch-status').textContent = `Extracting ${msg.current}/${msg.total}: ${msg.title || '...'}`;
          if (msg.current === 1 || msg.current === msg.total || msg.current % 5 === 0) {
            audit('batch:progress', { current: msg.current, total: msg.total, title: msg.title });
          }
        }
      };
      chrome.runtime.onMessage.addListener(progressListener);

      $('batch-status').textContent = `Starting batch extraction of ${count} jobs...`;

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'batchExtract',
        count
      });

      chrome.runtime.onMessage.removeListener(progressListener);
      setBatchRunning(false);

      if (!response || !response.success) {
        audit('batch:failed', { error: response?.error });
        showError(response?.error || 'Batch extraction failed.');
        return;
      }

      const successJobs = response.results.filter(r => r.success).map(r => r.data);

      $('progress-bar-fill').style.width = '100%';
      $('batch-status').textContent = `Done! Extracted ${successJobs.length} of ${response.total} jobs.`;
      audit('batch:done', { extracted: successJobs.length, total: response.total });

      renderBatchResults(response.results);

    } catch (err) {
      audit('batch:exception', { error: err?.message || String(err) });
      showError('Batch extraction failed. Try refreshing the Upwork page.');
      setBatchRunning(false);
    }
  }

  async function stopBatch() {
    audit('batch:stopRequested');
    if (!batchTabId) return;
    try {
      await chrome.tabs.sendMessage(batchTabId, { action: 'batchStop' });
    } catch {}
    $('batch-status').textContent = 'Stopping...';
  }

  // --- Capture (Tools > Capture) ---

  function updateCaptureCharCount() {
    const t = $('capture-text').value;
    $('capture-char-count').textContent = `${t.length.toLocaleString()} chars`;
  }

  function buildCaptureMarkdown() {
    const title = $('capture-title').value.trim();
    const url = $('capture-url').value.trim();
    const text = $('capture-text').value;
    return `# ${title}\n\nURL: ${url}\n\n${text}`;
  }

  async function extractPageInfo(tabId, clean) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (clean) => {
        const hideSelectors = [
          'nav', 'footer', 'header', 'aside',
          '[role="navigation"]', '[role="contentinfo"]', '[role="banner"]',
          '[aria-label*="footer" i]', '[aria-label*="navigation" i]',
          '[class*="footer" i]', '[id*="footer" i]',
          '[data-test*="footer" i]', '[data-qa*="footer" i]',
          '.site-footer', '.page-footer', '.site-header', '.page-header',
          'script', 'style', 'noscript'
        ].join(',');

        let style = null;
        if (clean) {
          style = document.createElement('style');
          style.textContent = `${hideSelectors}{display:none !important}`;
          document.head.appendChild(style);
          void document.body.offsetHeight;
        }

        const dialog = document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"], [role="dialog"]:not([aria-hidden="true"]), .air3-modal, .air3-slider[role="dialog"]'
        );
        const dialogVisible = !!(dialog && dialog.offsetParent !== null);

        const clean2 = (s) => (s || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

        let dialogText = '';
        let pageText = '';

        if (dialogVisible) {
          dialogText = clean2(dialog.innerText);
          // Temporarily hide the dialog so body.innerText yields the page behind.
          const prevCss = dialog.style.cssText;
          dialog.style.setProperty('display', 'none', 'important');
          void document.body.offsetHeight;
          pageText = clean2(document.body.innerText);
          dialog.style.cssText = prevCss;
        } else {
          pageText = clean2(document.body.innerText);
        }

        // Combine: page behind first, then dialog (if any).
        let text = pageText;
        if (dialogText) {
          text = text
            ? `${text}\n\n--- OPEN MODAL / DIALOG ---\n\n${dialogText}`
            : dialogText;
        }

        if (style) style.remove();

        return {
          text,
          title: document.title || '',
          url: location.href,
          pageTextLen: pageText.length,
          dialogTextLen: dialogText.length,
          dialogDetected: !!dialog,
          dialogVisible,
          dialogTag: dialog?.tagName || null,
          dialogRole: dialog?.getAttribute?.('role') || null
        };
      },
      args: [clean]
    });
    return {
      frameCount: results.length,
      result: results[0]?.result || null,
      firstFrameError: results[0]?.error || null
    };
  }

  function renderDebug(obj) {
    $('capture-debug').textContent = JSON.stringify(obj, null, 2);
  }

  async function runCapture() {
    audit('tools:capture:start');
    const btn = $('capture-btn');
    const statusEl = $('capture-status');
    btn.disabled = true;
    btn.textContent = 'Capturing...';
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Attaching debugger (yellow bar is expected)...';
    $('capture-result').classList.add('hidden');

    const debug = { startedAt: new Date().toISOString() };

    try {
      const tab = await getActiveTab();
      debug.tab = tab ? { id: tab.id, url: tab.url, title: tab.title, status: tab.status } : null;
      if (!tab) throw new Error('No active tab');

      statusEl.textContent = 'Capturing screenshot + text...';
      const clean = $('capture-clean').checked;
      debug.clean = clean;

      const [extractResult, shotResp] = await Promise.all([
        extractPageInfo(tab.id, clean).catch(e => ({ error: e.message, stack: e.stack })),
        chrome.runtime.sendMessage({ action: 'captureFullPage', tabId: tab.id })
      ]);

      debug.extract = extractResult;
      debug.screenshot = shotResp
        ? { success: shotResp.success, error: shotResp.error, dataUrlLen: shotResp.dataUrl?.length || 0 }
        : null;

      if (!shotResp || !shotResp.success) {
        throw new Error(shotResp?.error || 'Screenshot failed');
      }

      const info = extractResult?.result || null;
      captureData = {
        dataUrl: shotResp.dataUrl,
        text: info?.text || '',
        title: info?.title || tab.title || '',
        url: info?.url || tab.url || ''
      };

      $('capture-image').src = captureData.dataUrl;
      $('capture-image').classList.remove('expanded');
      $('capture-title').value = captureData.title;
      $('capture-url').value = captureData.url;
      $('capture-text').value = captureData.text;
      updateCaptureCharCount();

      $('capture-result').classList.remove('hidden');

      if (!captureData.text) {
        statusEl.textContent = 'Screenshot ok, but no text extracted. Open Debug info below and share.';
      } else if (info?.dialogVisible) {
        statusEl.textContent = `Done — page ${info.pageTextLen.toLocaleString()} + modal ${info.dialogTextLen.toLocaleString()} chars.`;
      } else {
        statusEl.textContent = `Done — ${captureData.text.length.toLocaleString()} chars. Edit if needed, then copy.`;
      }

      debug.captureData = {
        textLen: captureData.text.length,
        title: captureData.title,
        url: captureData.url
      };
      debug.finishedAt = new Date().toISOString();
      renderDebug(debug);
    } catch (err) {
      debug.error = { message: err.message, stack: err.stack };
      renderDebug(debug);
      $('capture-result').classList.remove('hidden'); // reveal debug section on error too
      statusEl.textContent = 'Error: ' + (err.message || err);
      showToast('Capture failed');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Capture Current Page';
    }
  }

  async function copyCaptureBoth() {
    if (!captureData) return;
    const markdown = buildCaptureMarkdown();
    try {
      const blob = await (await fetch(captureData.dataUrl)).blob();
      const item = new ClipboardItem({
        'image/png': blob,
        'text/plain': new Blob([markdown], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      showToast('Copied image + text!');
    } catch {
      await navigator.clipboard.writeText(markdown);
      showToast('Image copy failed — text copied');
    }
  }

  async function copyCaptureText() {
    if (!captureData) return;
    await copyToClipboard(buildCaptureMarkdown());
  }

  // --- Event listeners ---

  // Two-level tab delegation (top + sub)
  document.querySelectorAll('#top-tabs .tab').forEach(t => {
    t.addEventListener('click', () => switchTo(t.dataset.group));
  });
  document.querySelectorAll('.subtabs').forEach(row => {
    row.querySelectorAll('.subtab').forEach(t => {
      t.addEventListener('click', () => switchTo(row.dataset.group, t.dataset.sub));
    });
  });

  $('batch-start').addEventListener('click', startBatch);
  $('batch-stop').addEventListener('click', stopBatch);

  // --- Ask Claude (local bridge) ---

  const BRIDGE_BASE = 'http://localhost:8787';
  const BRIDGE_URL = BRIDGE_BASE + '/shortlist';
  let lastClaudeReply = '';
  let lastPickedJob = null;

  // --- Bridge health gate: disable Start until localhost:8787 is reachable ---

  let bridgeOnline = null;
  let bridgeHealthTimer = null;

  async function checkBridgeHealth() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(BRIDGE_BASE + '/health', { signal: ctrl.signal });
      clearTimeout(t);
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, error: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) };
    }
  }

  async function refreshBridgeStatus() {
    const res = await checkBridgeHealth();
    const banner = $('bridge-banner');
    const detail = $('bridge-banner-detail');
    if (res.ok) {
      if (bridgeOnline !== true) {
        audit('bridge:health:up');
        bridgeOnline = true;
      }
      banner.classList.add('hidden');
    } else {
      if (bridgeOnline !== false) {
        audit('bridge:health:down', { error: res.error || `status ${res.status}` });
        bridgeOnline = false;
      }
      banner.classList.remove('hidden');
      detail.textContent = res.error ? `(${res.error})` : res.status ? `(status ${res.status})` : '';
    }
    refreshStartGate();
  }

  function refreshStartGate() {
    const startBtn = $('batch-start');
    const listenBanner = $('listen-banner');
    const listenOn = !!listenTimer;
    const bridgeOk = bridgeOnline === true;

    if (!listenOn) listenBanner.classList.remove('hidden');
    else listenBanner.classList.add('hidden');

    if (bridgeOk && listenOn) {
      startBtn.disabled = false;
      startBtn.title = '';
    } else {
      startBtn.disabled = true;
      if (!bridgeOk) startBtn.title = 'Bridge offline — run `node bridge/server.js`';
      else startBtn.title = 'Listen is off — turn it on to receive bridge commands';
    }
  }

  // --- Listen mode: poll bridge for commands, execute on active tab ---

  let listenTimer = null;
  const POLL_MS = 2000;

  async function executeCommand(cmd) {
    const { type, args = {} } = cmd;
    const tab = await getActiveTab();
    if (!tab) throw new Error('no active tab');

    if (type === 'read_page') {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (maxChars) => ({
          title: document.title || '',
          url: location.href,
          text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, maxChars)
        }),
        args: [args.maxChars || 500]
      });
      return results[0]?.result || null;
    }

    if (type === 'click') {
      const { selector, textMatch = null, index = 0 } = args;
      if (!selector) throw new Error('click: missing selector');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel, tmatch, idx) => {
          const all = Array.from(document.querySelectorAll(sel));
          let pool = all;
          if (tmatch) {
            const re = new RegExp(tmatch, 'i');
            pool = all.filter(el => re.test((el.innerText || el.textContent || '').trim()));
          }
          const el = pool[idx];
          if (!el) return { clicked: false, reason: 'selector not found', totalMatched: all.length, textMatched: pool.length };
          el.click();
          return { clicked: true, tag: el.tagName, text: (el.innerText || el.textContent || '').trim().slice(0, 80) };
        },
        args: [selector, textMatch, index]
      });
      return results[0]?.result || null;
    }

    if (type === 'fill') {
      const { selector, text } = args;
      if (!selector || text == null) throw new Error('fill: need selector + text');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel, value) => {
          const el = document.querySelector(sel);
          if (!el) return { filled: false, reason: 'selector not found' };
          const tag = el.tagName.toLowerCase();
          if (tag === 'textarea' || tag === 'input') {
            const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set;
            setter.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = value;
          }
          return { filled: true, tag };
        },
        args: [selector, text]
      });
      return results[0]?.result || null;
    }

    if (type === 'navigate') {
      const { url } = args;
      if (!url) throw new Error('navigate: missing url');
      await chrome.tabs.update(tab.id, { url });
      return { navigated: true, url };
    }

    if (type === 'screenshot') {
      const shot = await chrome.runtime.sendMessage({ action: 'captureFullPage', tabId: tab.id });
      if (!shot?.success) throw new Error(shot?.error || 'screenshot failed');
      return { dataUrl: shot.dataUrl, url: tab.url, title: tab.title };
    }

    if (type === 'query_dom') {
      // args: { selector, attrs?, limit?, textLen?, textMatch? (regex string, case-insensitive), index? }
      const { selector, attrs = ['href', 'id', 'class', 'aria-label', 'data-test'], limit = 20, textLen = 120, textMatch = null, index = null } = args;
      if (!selector) throw new Error('query_dom: missing selector');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel, attrList, lim, tlen, tmatch, idx) => {
          const re = tmatch ? new RegExp(tmatch, 'i') : null;
          const all = Array.from(document.querySelectorAll(sel));
          let filtered = all;
          if (re) filtered = all.filter(el => re.test((el.innerText || el.textContent || '').trim()));
          const chosen = idx != null ? [filtered[idx]].filter(Boolean) : filtered.slice(0, lim);
          const out = [];
          for (const el of chosen) {
            const r = el.getBoundingClientRect();
            const row = {
              tag: el.tagName.toLowerCase(),
              text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, tlen),
              visible: r.width > 0 && r.height > 0,
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
            };
            for (const a of attrList) {
              const v = el.getAttribute(a);
              if (v != null) row[a] = v;
            }
            out.push(row);
          }
          return { total: all.length, filtered: filtered.length, returned: out.length, items: out };
        },
        args: [selector, attrs, limit, textLen, textMatch, index]
      });
      return results[0]?.result || null;
    }

    throw new Error(`unknown command type: ${type}`);
  }

  async function pollCommands() {
    try {
      const r = await fetch(BRIDGE_BASE + '/command');
      if (!r.ok) return;
      const data = await r.json();
      if (!data.id) return;
      const statusEl = $('listen-status');
      statusEl.textContent = `Running #${data.id} (${data.type})...`;
      audit('bridge:command:received', { id: data.id, type: data.type });
      let payload;
      try {
        const result = await executeCommand(data);
        payload = { id: data.id, ok: true, result };
        statusEl.textContent = `#${data.id} ${data.type}: done.`;
        audit('bridge:command:done', { id: data.id, type: data.type });
      } catch (err) {
        payload = { id: data.id, ok: false, error: err.message || String(err) };
        statusEl.textContent = `#${data.id} ${data.type}: ${err.message}`;
        audit('bridge:command:error', { id: data.id, type: data.type, error: err.message });
      }
      await fetch(BRIDGE_BASE + '/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      // Bridge down or network blip — leave status, next tick retries
      $('listen-status').textContent = `Poll error: ${err.message}`;
    }
  }

  function setListen(on) {
    audit('listen:toggle', { on });
    if (on) {
      if (!listenTimer) {
        listenTimer = setInterval(pollCommands, POLL_MS);
        $('listen-status').textContent = 'Listening...';
      }
    } else {
      if (listenTimer) { clearInterval(listenTimer); listenTimer = null; }
      $('listen-status').textContent = 'Off';
    }
    refreshStartGate();
  }

  async function askClaudeBridge(prompt) {
    const start = Date.now();
    audit('bridge:askClaude:start', { promptChars: prompt.length });
    try {
      const r = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await r.json().catch(() => ({ error: 'bad json from bridge' }));
      if (!r.ok) {
        audit('bridge:askClaude:error', { status: r.status, error: data.error, ms: Date.now() - start });
        throw new Error(data.error || `bridge error ${r.status}`);
      }
      audit('bridge:askClaude:done', { ms: Date.now() - start, replyChars: (data.reply || '').length });
      return data;
    } catch (e) {
      audit('bridge:askClaude:exception', { error: e.message || String(e), ms: Date.now() - start });
      throw e;
    }
  }

  function wrapAsPickBestPrompt(fullMarkdown, jobCount) {
    return `# Pick the best Upwork job to apply to

${contextBlock()}I've extracted ${jobCount} Upwork job${jobCount === 1 ? '' : 's'} with full detail (budget, client history, description, skills, activity). Everything you need is below — no need to ask me for more info.

**Your task:**
1. Pick **ONE** single best job to apply to right now, given my profile and filter rules above.
2. Start your reply with exactly: \`BEST: [N]\` (N = the job number).
3. Then 2-3 lines of reasoning (why this one beats the others, what's the risk).
4. Then a **cover-letter hook** — 3-4 sentences I can paste/edit. Open with the client's specific need (not "I'm Amar"), name the concrete MCP/agent angle from my stack that fits, and end with one question that proves I read the brief.

Do **not** list or discuss the rejected jobs — only the winner. Reply in casual Hinglish as per my profile.

---

${fullMarkdown}`;
  }

  $('batch-ask-claude').addEventListener('click', async () => {
    if (!batchData.length) return showToast('Run a batch first');
    audit('pickBest:start', { batchCount: batchData.length });
    const btn = $('batch-ask-claude');
    const block = $('claude-reply-block');
    const statusEl = $('claude-reply-status');
    const pre = $('claude-reply');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Asking...';
    block.classList.remove('hidden');
    statusEl.textContent = 'Sending full batch detail to local Claude CLI bridge (localhost:8787)...';
    pre.textContent = '';
    $('claude-reply-open').classList.add('hidden');
    $('claude-reply-autoapply').classList.add('hidden');
    lastPickedJob = null;
    try {
      const prompt = wrapAsPickBestPrompt(formatBatchMarkdown(batchData), batchData.length);
      const { reply, ms } = await askClaudeBridge(prompt);
      lastClaudeReply = reply;
      pre.textContent = reply;
      const pick = reply.match(/BEST\s*:\s*\[?\s*(\d+)\s*\]?/i);
      const openBtn = $('claude-reply-open');
      const autoBtn = $('claude-reply-autoapply');
      if (pick) {
        const idx = parseInt(pick[1], 10) - 1;
        lastPickedJob = batchData[idx] || null;
        audit('pickBest:picked', { index: idx + 1, jobUrl: lastPickedJob?.url, jobTitle: lastPickedJob?.title });
        if (lastPickedJob?.url) {
          openBtn.classList.remove('hidden');
          openBtn.textContent = `Open Job ${pick[1]}`;
          autoBtn.classList.remove('hidden');
          autoBtn.textContent = `Auto-Apply #${pick[1]}`;
        } else {
          openBtn.classList.add('hidden');
          autoBtn.classList.add('hidden');
        }
        statusEl.textContent = `Done in ${(ms / 1000).toFixed(1)}s. Claude picked job [${pick[1]}].`;
      } else {
        lastPickedJob = null;
        openBtn.classList.add('hidden');
        autoBtn.classList.add('hidden');
        statusEl.textContent = `Done in ${(ms / 1000).toFixed(1)}s. (No BEST: [N] line parsed — see reply.)`;
      }
      markJobCopied(batchData.map(j => j.url));
    } catch (err) {
      statusEl.textContent = 'Bridge error: ' + err.message + '. Is `node bridge/server.js` running?';
      showToast('Bridge error');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  $('claude-reply-copy').addEventListener('click', () => {
    if (!lastClaudeReply) return showToast('No reply yet');
    copyToClipboard(lastClaudeReply);
  });

  $('claude-reply-open').addEventListener('click', () => {
    if (!lastPickedJob?.url) return showToast('No picked job URL');
    chrome.tabs.create({ url: lastPickedJob.url });
  });

  // --- Auto-Apply orchestrator ---

  function wrapAsCoverLetterPrompt(job) {
    // Prefer full structured markdown (from Pick-Best context) when the job has a score,
    // otherwise fall back to raw page text scraped from the /apply page.
    const details = job?.score != null ? formatMarkdown(job) : (job?.pageText ? `# ${job.title || 'Upwork job'}\n**URL:** ${job.url || ''}\n\n${job.pageText}` : `# ${job?.title || 'Upwork job'}\n**URL:** ${job?.url || ''}`);
    return `${contextBlock()}You are writing an Upwork cover letter for me (profile above).

Job details:
${details}

Write a cover letter:
- 4-5 sentences max
- Open with the concrete stack/need fit (NOT "I'm Amar")
- Name one shipped product of mine that maps to their need (sathi.devfrend.com, mcp.devfrend.com, ai.chat.devfrend.com, devfrend.com, amargupta.tech)
- End with ONE sharp question that proves I read the brief
- Professional English (this goes to the client, NOT Hinglish)
- No preamble, no markdown headings, no signature, just the letter body

Reply with ONLY the letter text. Nothing else.`;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const APPLY_BTN_SELECTOR = 'button[data-cy="submit-proposal-button"], a[data-cy="submit-proposal-button"], button[aria-label="Apply now"]';
  const DRAWER_SELECTOR = '[role="dialog"], .air3-modal, .air3-slider';
  const COVER_TEXTAREA_SELECTOR = '[role="dialog"] textarea[aria-labelledby="cover_letter_label"], textarea[aria-labelledby="cover_letter_label"], [role="dialog"] textarea, .air3-modal textarea, .air3-slider textarea, textarea.air3-textarea';

  async function pollForSelector(selector, { timeoutMs = 10000, intervalMs = 500 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await executeCommand({
        type: 'query_dom',
        args: { selector, limit: 1, textLen: 20 }
      });
      if (res?.items?.length) return res;
      await sleep(intervalMs);
    }
    return null;
  }

  function extractJobUid(url) {
    const m = (url || '').match(/~(\w+)/);
    return m ? m[1] : null;
  }

  // --- Global app audit log: every step flows through audit() ---

  const APP_SESSION_T0 = Date.now();
  const auditTrail = [];
  let lastAppScreenshot = null;

  function audit(step, data = {}) {
    const entry = { t: Date.now() - APP_SESSION_T0, step, ...data };
    auditTrail.push(entry);
    // Cap the log to avoid unbounded growth
    if (auditTrail.length > 500) auditTrail.splice(0, auditTrail.length - 500);
    // If the panel is open, keep its JSON fresh
    const block = $('app-debug-panel');
    if (block && !block.classList.contains('hidden')) renderAppDebug();
    return entry;
  }

  async function captureAppScreenshot() {
    try {
      const tab = await getActiveTab();
      if (!tab) return { error: 'no active tab' };
      const shot = await chrome.runtime.sendMessage({ action: 'captureFullPage', tabId: tab.id });
      if (shot?.success) {
        lastAppScreenshot = { dataUrl: shot.dataUrl, url: tab.url, title: tab.title, ts: new Date().toISOString() };
        return { ok: true };
      }
      return { error: shot?.error || 'screenshot failed' };
    } catch (e) { return { error: e.message || String(e) }; }
  }

  async function captureAppSnapshot() {
    try {
      const snap = await executeCommand({ type: 'read_page', args: { maxChars: 1500 } });
      audit('appDebug:snapshot', { url: snap?.url, title: snap?.title, textPreview: (snap?.text || '').slice(0, 240) });
    } catch (e) { audit('appDebug:snapshotError', { error: e.message || String(e) }); }
  }

  function buildAppDebugArtifact() {
    return {
      ts: new Date().toISOString(),
      sessionMs: Date.now() - APP_SESSION_T0,
      entries: auditTrail.length,
      screenshot: lastAppScreenshot ? { url: lastAppScreenshot.url, title: lastAppScreenshot.title, ts: lastAppScreenshot.ts } : null,
      trail: auditTrail
    };
  }

  function renderAppDebug() {
    const block = $('app-debug-panel');
    const img = $('app-debug-image');
    const pre = $('app-debug');
    const status = $('app-debug-status');
    if (!block) return;
    block.classList.remove('hidden');
    if (lastAppScreenshot?.dataUrl) {
      img.src = lastAppScreenshot.dataUrl;
      img.style.display = '';
    } else {
      img.style.display = 'none';
    }
    const artifact = buildAppDebugArtifact();
    status.textContent = `Session ${(artifact.sessionMs / 1000).toFixed(1)}s · ${artifact.entries} steps${lastAppScreenshot ? ' · screenshot attached' : ''}`;
    pre.textContent = JSON.stringify(artifact, null, 2);
  }

  // Backwards-compat alias for runAutoApply's existing call sites
  async function captureDebugArtifact(trace, err, job) {
    audit('autoApply:finalize', { error: err?.message || null, jobUrl: job?.url });
    await captureAppScreenshot();
    await captureAppSnapshot();
    return buildAppDebugArtifact();
  }

  function renderAutoApplyDebug() {
    renderAppDebug();
  }

  const STEP_ORDER = ['navigate', 'apply', 'cover', 'rate', 'highlight', 'certificate'];
  const stepIndex = (s) => Math.max(0, STEP_ORDER.indexOf(s));
  const shouldRun = (step, from) => stepIndex(step) >= stepIndex(from);

  async function runAutoApply(job, { from = 'navigate' } = {}) {
    const statusEl = $('claude-reply-status');
    const btn = $('claude-reply-autoapply');
    btn.disabled = true;
    const origText = btn.textContent;
    const t0 = Date.now();
    audit('autoApply:start', { jobUrl: job?.url, jobTitle: job?.title, from });
    const logStep = (name, data = {}) => audit(`autoApply:${name}`, data);
    const runCmd = async (label, cmd) => {
      const start = Date.now();
      try {
        const result = await executeCommand(cmd);
        audit(`autoApply:${label}`, { cmd, ms: Date.now() - start, result });
        return result;
      } catch (e) {
        audit(`autoApply:${label}`, { cmd, ms: Date.now() - start, error: e.message || String(e) });
        throw e;
      }
    };

    try {
      // Step 1: navigate to the job
      if (shouldRun('navigate', from)) {
        btn.textContent = '1/7 navigating...';
        statusEl.textContent = 'Navigating to job page...';
        await runCmd('navigate:jobUrl', { type: 'navigate', args: { url: job.url } });
        const applyFound = await pollForSelector(APPLY_BTN_SELECTOR, { timeoutMs: 10000 });
        logStep('pollForSelector:applyBtn', { found: !!applyFound, items: applyFound?.items?.length || 0 });
        if (!applyFound) throw new Error('Apply button not found (selector drift?)');
      } else {
        audit('autoApply:skip', { step: 'navigate' });
      }

      // Step 2: click Apply Now, then wait for drawer OR URL change
      if (shouldRun('apply', from)) {
        btn.textContent = '2/7 clicking Apply...';
        statusEl.textContent = 'Clicking Apply, waiting for drawer or /apply/ page...';
        const urlBefore = await runCmd('readPage:preApply', { type: 'read_page', args: { maxChars: 1 } });
        await runCmd('click:applyBtn', { type: 'click', args: { selector: APPLY_BTN_SELECTOR } });

        // Poll until drawer appears OR URL changed to /apply/
        const surfaceDeadline = Date.now() + 10000;
        let surface = null;
        while (Date.now() < surfaceDeadline) {
          const drawer = await executeCommand({
            type: 'query_dom',
            args: { selector: DRAWER_SELECTOR, limit: 1, textLen: 20 }
          });
          if (drawer?.items?.length) { surface = 'drawer'; break; }
          const now = await executeCommand({ type: 'read_page', args: { maxChars: 1 } });
          if (now?.url && now.url !== urlBefore?.url && /\/apply\/?/.test(now.url)) {
            surface = 'page'; break;
          }
          await sleep(500);
        }
        logStep('surfaceDetect', { surface, elapsedMs: Date.now() - t0 });
        if (!surface) {
          statusEl.textContent = 'No drawer / no URL change after Apply click. Will try fallback navigate...';
        } else {
          statusEl.textContent = `Apply surface: ${surface}. Looking for cover-letter textarea...`;
        }
      } else {
        audit('autoApply:skip', { step: 'apply' });
      }

      // Step 3 + 4: cover letter draft + fill
      if (shouldRun('cover', from)) {
        btn.textContent = '3/7 drafting...';
        const coverPromise = askClaudeBridge(wrapAsCoverLetterPrompt(job));

        // Poll for textarea on current surface
        let textareaHit = await pollForSelector(COVER_TEXTAREA_SELECTOR, { timeoutMs: 10000 });
        logStep('pollForSelector:coverTextarea', { found: !!textareaHit });

        // Fallback: navigate directly to /nx/proposals/job/<uid>/apply/
        if (!textareaHit) {
          const uid = extractJobUid(job.url);
          if (!uid) throw new Error('Cover-letter textarea not found and could not extract job UID for fallback');
          const applyUrl = `https://www.upwork.com/nx/proposals/job/~${uid}/apply/`;
          statusEl.textContent = `Fallback: navigating to ${applyUrl}`;
          await runCmd('navigate:fallbackApplyUrl', { type: 'navigate', args: { url: applyUrl } });
          textareaHit = await pollForSelector(COVER_TEXTAREA_SELECTOR, { timeoutMs: 10000 });
          logStep('pollForSelector:coverTextareaFallback', { found: !!textareaHit });
          if (!textareaHit) throw new Error('Cover-letter textarea not found even after fallback navigate');
        }

        const snap = await runCmd('readPage:preFill', { type: 'read_page', args: { maxChars: 500 } });
        statusEl.textContent = `On: ${snap?.url?.slice(0, 80) || '?'} — filling...`;

        btn.textContent = '4/7 filling...';
        const { reply: coverLetter } = await coverPromise;
        logStep('coverLetter:received', { len: coverLetter?.length || 0 });
        if (!coverLetter?.trim()) throw new Error('Empty cover letter from Claude');

        await runCmd('fill:coverLetter', {
          type: 'fill',
          args: { selector: COVER_TEXTAREA_SELECTOR, text: coverLetter.trim() }
        });
      } else {
        audit('autoApply:skip', { step: 'cover' });
      }

      // Step 5: set rate-increase frequency to "Never"
      if (shouldRun('rate', from)) {
        btn.textContent = '5/7 rate increase...';
        statusEl.textContent = 'Opening rate-increase dropdown...';
        const RATE_TOGGLE_SELECTOR = '[aria-label="How often do you want a rate increase?"] [role="combobox"], [aria-label="How often do you want a rate increase?"] .air3-dropdown-toggle';
        const toggleHit = await pollForSelector(RATE_TOGGLE_SELECTOR, { timeoutMs: 5000 });
        logStep('pollForSelector:rateToggle', { found: !!toggleHit });
        if (!toggleHit) {
          statusEl.textContent = 'Rate-increase dropdown not found — skipping. Cover letter is filled, review manually.';
        } else {
          await runCmd('click:rateToggle', { type: 'click', args: { selector: RATE_TOGGLE_SELECTOR } });
          // Broadened to cover Upwork's air3 menu variants + native listbox patterns.
          const OPTION_SELECTOR = '#dropdown-menu li, [role="listbox"] li, .air3-menu-item, li.air3-menu-item, li[role="option"], [role="option"], .air3-dropdown-menu li';
          // Give the menu a beat to fully populate (Upwork renders options async).
          await sleep(400);
          const menuHit = await pollForSelector(OPTION_SELECTOR, { timeoutMs: 5000 });
          logStep('pollForSelector:rateOptions', { found: !!menuHit, count: menuHit?.items?.length || 0 });
          if (!menuHit) {
            statusEl.textContent = 'Rate-increase menu did not open — review manually.';
          } else {
            // Loose contains-match; any option whose visible text starts with "Never".
            const clickRes = await runCmd('click:rateNever', {
              type: 'click',
              args: { selector: OPTION_SELECTOR, textMatch: '^\\s*Never\\b' }
            });
            if (!clickRes?.clicked) {
              const dump = await executeCommand({
                type: 'query_dom',
                args: { selector: OPTION_SELECTOR, limit: 10, textLen: 120 }
              });
              audit('autoApply:rateOptionsDump', {
                totalMatched: clickRes?.totalMatched || 0,
                textMatched: clickRes?.textMatched || 0,
                items: dump?.items || []
              });
              statusEl.textContent = `"Never" option not found (${clickRes?.totalMatched || 0} options matched selector). See debug log for the actual texts.`;
            }
          }
        }
      } else {
        audit('autoApply:skip', { step: 'rate' });
      }

      // Shared helper: open modal, switch to tab, reset + pick N highlights, commit.
      async function pickHighlights(tab, wantCount, labelPrefix) {
        const cardSelector = tab === 'portfolio' ? '[data-test="portfolio"]' : '[data-test="certifications"]';
        const tabBtnSelector = `.air3-modal-highlights-editor button[role="tab"][aria-controls="${tab}"]`;
        const panelActiveSelector = `.air3-modal-highlights-editor #${tab}.is-active`;
        const selectBtnScope = `.air3-modal-highlights-editor #${tab} button[data-ev-label="profile_highlights_editor_btn_add"]`;
        const addBtnScope = '.air3-modal-highlights-editor button';

        // 1. Open the modal via the card on the /apply page (no-op if already open).
        statusEl.textContent = `Opening ${tab} picker...`;
        await runCmd(`click:${labelPrefix}Card`, { type: 'click', args: { selector: cardSelector } });
        // Wait for the editor modal to be present.
        const modalOpen = await pollForSelector('.air3-modal-highlights-editor[role="dialog"]', { timeoutMs: 4000 });
        logStep(`pollForSelector:${labelPrefix}ModalOpen`, { found: !!modalOpen });
        if (!modalOpen) {
          statusEl.textContent = `${tab} modal did not open — skipping.`;
          return { ok: false, reason: 'modal-not-open' };
        }

        // 2. Switch to the correct tab inside the modal.
        await sleep(300);
        await runCmd(`click:${labelPrefix}Tab`, { type: 'click', args: { selector: tabBtnSelector } });
        const panelActive = await pollForSelector(panelActiveSelector, { timeoutMs: 4000 });
        logStep(`pollForSelector:${labelPrefix}PanelActive`, { found: !!panelActive });
        if (!panelActive) {
          statusEl.textContent = `${tab} tab did not activate — skipping.`;
          return { ok: false, reason: 'panel-not-active' };
        }

        // 3. Reset: unselect any currently-"Selected" buttons in this panel.
        let unselected = 0;
        for (let safety = 0; safety < 8; safety++) {
          const res = await runCmd(`click:${labelPrefix}Unselect`, {
            type: 'click',
            args: { selector: selectBtnScope, textMatch: '^\\s*Selected\\s*$', index: 0 }
          });
          if (!res?.clicked) break;
          unselected++;
          await sleep(200);
        }
        audit(`autoApply:${labelPrefix}Unselected`, { count: unselected });

        // 4. Select N fresh highlights (index=0 each time — pool is re-queried by the click cmd).
        let selected = 0;
        for (let i = 0; i < wantCount; i++) {
          const res = await runCmd(`click:${labelPrefix}Select:${i + 1}`, {
            type: 'click',
            args: { selector: selectBtnScope, textMatch: '^\\s*Select highlight\\s*$', index: 0 }
          });
          if (!res?.clicked) break;
          selected++;
          await sleep(300);
        }
        audit(`autoApply:${labelPrefix}Selected`, { count: selected, wanted: wantCount });
        if (selected === 0) {
          statusEl.textContent = `No "Select highlight" buttons available in ${tab} — skipping commit.`;
          return { ok: false, reason: 'none-selectable' };
        }

        // 5. Commit: click "Add to highlights".
        await sleep(300);
        const strict = await runCmd(`click:${labelPrefix}Add`, {
          type: 'click',
          args: { selector: addBtnScope, textMatch: '^\\s*Add to highlights?\\s*$', index: 0 }
        });
        let commitClicked = strict?.clicked;
        if (!commitClicked) {
          const loose = await runCmd(`click:${labelPrefix}Add:loose`, {
            type: 'click',
            args: { selector: addBtnScope, textMatch: 'Add to highlights', index: 0 }
          });
          commitClicked = loose?.clicked;
        }
        if (!commitClicked) {
          statusEl.textContent = `${tab} "Add to highlights" button not found (selected ${selected}).`;
          return { ok: false, reason: 'add-btn-not-found', selected };
        }

        // Wait for modal to close so the next step starts from a clean state.
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const stillOpen = await executeCommand({
            type: 'query_dom',
            args: { selector: '.air3-modal-highlights-editor[role="dialog"]', limit: 1 }
          });
          if (!stillOpen?.items?.length) break;
          await sleep(200);
        }
        return { ok: true, selected };
      }

      // Step 6: portfolio highlights
      if (shouldRun('highlight', from)) {
        btn.textContent = '6/7 portfolio...';
        const res = await pickHighlights('portfolio', 2, 'portfolio');
        if (!res.ok) audit('autoApply:portfolioSkipped', res);
      } else {
        audit('autoApply:skip', { step: 'highlight' });
      }

      // Step 7: certificate highlights
      if (shouldRun('certificate', from)) {
        btn.textContent = '7/7 certificate...';
        const res = await pickHighlights('certifications', 2, 'certificate');
        if (!res.ok) audit('autoApply:certificateSkipped', res);
      } else {
        audit('autoApply:skip', { step: 'certificate' });
      }

      statusEl.textContent = 'Done — cover letter, rate, portfolio + certificate highlights set. Review and click Submit when ready.';
      showToast('Ready to submit — review first!');
      btn.textContent = 'Filled ✓';
      logStep('done', { totalMs: Date.now() - t0 });
    } catch (err) {
      statusEl.textContent = 'Auto-Apply failed: ' + err.message + ' — see debug below';
      showToast('Auto-Apply failed — debug captured');
      btn.textContent = origText;
      logStep('error', { message: err?.message || String(err), stack: err?.stack || null });
      try { await captureDebugArtifact(null, err, job); } catch (inner) { audit('autoApply:captureError', { error: inner.message || String(inner) }); }
      renderAppDebug();
      return;
    } finally {
      btn.disabled = false;
    }

    // Success path: always render audit log at the end
    try { await captureDebugArtifact(null, null, job); } catch (inner) { audit('autoApply:captureError', { error: inner.message || String(inner) }); }
    renderAppDebug();
  }

  $('claude-reply-autoapply').addEventListener('click', () => {
    if (!lastPickedJob?.url) return showToast('No picked job');
    const from = $('autoapply-from')?.value || 'navigate';
    runAutoApply(lastPickedJob, { from });
  });

  async function expandTruncations() {
    try {
      const tab = await getActiveTab();
      if (!tab) return { expanded: 0, total: 0 };
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const btns = Array.from(document.querySelectorAll(
            'button.air3-truncation-btn[aria-expanded="false"], button[aria-expanded="false"].air3-btn-link'
          ));
          let clicked = 0;
          for (const b of btns) {
            const label = (b.innerText || b.textContent || '').trim().toLowerCase();
            // Only click things that look like "more" / "show more" / "read more"
            if (/^(more|show more|read more|view more|…more|\.\.\.more)$/i.test(label)) {
              try { b.click(); clicked++; } catch {}
            }
          }
          return { clicked, total: btns.length };
        }
      });
      return results[0]?.result || { clicked: 0, total: 0 };
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }

  $('manual-autoapply').addEventListener('click', async () => {
    const from = $('manual-autoapply-from')?.value || 'cover';
    const statusEl = $('manual-autoapply-status');
    let job = lastPickedJob;
    if (!job) {
      const tab = await getActiveTab();
      if (!tab) { statusEl.textContent = 'No active tab.'; return showToast('No active tab'); }
      job = { url: tab.url, title: tab.title };
      if (from === 'cover' || from === 'apply' || from === 'navigate') {
        statusEl.textContent = 'Expanding truncated sections...';
        const exp = await expandTruncations();
        audit('manualAutoApply:expandTruncations', exp);
        if (exp.clicked > 0) {
          // Let the layout settle after expanding.
          await new Promise(r => setTimeout(r, 400));
        }
        statusEl.textContent = 'Reading page content for cover-letter context...';
        try {
          const snap = await executeCommand({ type: 'read_page', args: { maxChars: 16000 } });
          if (snap?.text) {
            job.pageText = snap.text;
            job.title = snap.title || job.title;
            job.url = snap.url || job.url;
            audit('manualAutoApply:pageTextCaptured', { chars: snap.text.length, url: snap.url, expanded: exp.clicked || 0 });
            statusEl.textContent = `Using page content (${snap.text.length.toLocaleString()} chars, expanded ${exp.clicked || 0} section(s)).`;
          }
        } catch (e) {
          statusEl.textContent = 'Could not read page — continuing with URL + title only.';
          audit('manualAutoApply:pageTextError', { error: e.message || String(e) });
        }
      }
    }
    audit('manualAutoApply:trigger', { from, usingPickedJob: !!lastPickedJob, hasPageText: !!job.pageText, pageTextChars: job.pageText?.length || 0, jobUrl: job.url });
    runAutoApply(job, { from });
  });

  // --- App debug panel listeners ---
  $('app-debug-btn').addEventListener('click', () => {
    const block = $('app-debug-panel');
    if (block.classList.contains('hidden')) {
      renderAppDebug();
    } else {
      block.classList.add('hidden');
    }
  });

  $('app-debug-close').addEventListener('click', () => {
    $('app-debug-panel').classList.add('hidden');
  });

  $('app-debug-clear').addEventListener('click', () => {
    auditTrail.length = 0;
    lastAppScreenshot = null;
    audit('appDebug:cleared');
    renderAppDebug();
  });

  $('app-debug-capture').addEventListener('click', async () => {
    const btn = $('app-debug-capture');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Capturing...';
    try {
      const shot = await captureAppScreenshot();
      if (shot.error) audit('appDebug:captureFailed', { error: shot.error });
      else audit('appDebug:captured', { url: lastAppScreenshot?.url });
      await captureAppSnapshot();
      renderAppDebug();
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  $('app-debug-copy').addEventListener('click', () => {
    const text = JSON.stringify(buildAppDebugArtifact(), null, 2);
    copyToClipboard(text);
  });

  $('app-debug-copy-all').addEventListener('click', async () => {
    const text = JSON.stringify(buildAppDebugArtifact(), null, 2);
    if (!lastAppScreenshot?.dataUrl) {
      await copyToClipboard(text);
      return;
    }
    try {
      const blob = await (await fetch(lastAppScreenshot.dataUrl)).blob();
      const item = new ClipboardItem({
        'image/png': blob,
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      showToast('Copied screenshot + debug!');
    } catch {
      await navigator.clipboard.writeText(text);
      showToast('Image copy failed — debug text copied');
    }
  });

  $('app-debug-image').addEventListener('click', () => {
    $('app-debug-image').classList.toggle('expanded');
  });

  $('listen-toggle').addEventListener('change', (e) => setListen(e.target.checked));

  $('batch-save-supabase').addEventListener('click', () => {
    if (batchData.length) saveBatchToSupabase(batchData, $('batch-save-supabase'));
  });

  $('retry-btn').addEventListener('click', () => switchTo(currentGroup, currentSub[currentGroup]));

  // Capture listeners
  $('capture-btn').addEventListener('click', runCapture);
  $('capture-copy-all').addEventListener('click', copyCaptureBoth);
  $('capture-copy-text').addEventListener('click', copyCaptureText);
  $('capture-text').addEventListener('input', updateCaptureCharCount);
  $('capture-image').addEventListener('click', () => {
    $('capture-image').classList.toggle('expanded');
  });
  $('capture-debug-copy').addEventListener('click', () => {
    copyToClipboard($('capture-debug').textContent || '(empty)');
  });
  $('reload-ext-btn').addEventListener('click', () => {
    showToast('Reloading extension...');
    setTimeout(() => chrome.runtime.reload(), 200);
  });

  // --- Auth listeners ---

  $('auth-tab-login').addEventListener('click', () => setAuthMode('login'));
  $('auth-tab-signup').addEventListener('click', () => setAuthMode('signup'));
  $('auth-submit').addEventListener('click', handleAuth);
  $('auth-logout').addEventListener('click', handleLogout);

  // Allow Enter key to submit auth form
  $('auth-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
  });


  // --- Init ---
  // Supabase disabled for now — skipping auth/session bootstrap.
  // await checkAuth();
  loadUserContext();
  switchTo('extract');
  audit('app:init', { ts: new Date().toISOString() });

  // Gate Start on bridge availability; poll every 3s so it flips back on as soon as the server is up.
  $('batch-start').disabled = true;
  $('batch-start').title = 'Checking bridge...';
  refreshBridgeStatus();
  bridgeHealthTimer = setInterval(refreshBridgeStatus, 3000);

  // Auto-enable Listen so the bridge can drive the side panel without a manual toggle.
  $('listen-toggle').checked = true;
  setListen(true);
})();
