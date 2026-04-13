// Upwork Job Extractor — Popup Script

(async () => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const loading = $('loading');
  const loadingText = $('loading-text');
  const error = $('error');
  const errorMsg = $('error-msg');
  const content = $('content');
  const scoreBadge = $('score-badge');
  const status = $('status');
  const batchPanel = $('batch-panel');
  const settingsPanel = $('settings-panel');

  let jobData = null;
  let batchData = [];
  let currentMode = 'single'; // 'single', 'batch', or 'settings'
  let supabaseReady = false;

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

  function formatClaude(data) {
    const lines = [];
    lines.push(`JOB: ${data.title}`);
    lines.push(`BUDGET: ${data.budget.amount} ${data.budget.type}`);
    lines.push(`LEVEL: ${data.experienceLevel}`);
    lines.push(`POSTED: ${data.postedDate}`);
    lines.push(`PROPOSALS: ${data.proposals}`);
    lines.push(`CLIENT: ${data.client.location} | Hire rate: ${data.client.hireRate} | Spent: ${data.client.totalSpent} | Payment: ${data.client.paymentVerified ? 'Verified' : 'Not Verified'} | Member since: ${data.client.memberSince}`);
    lines.push(`SCORE: ${data.score}/10 ${data.scoreLabel.label}`);
    lines.push(`SKILLS: ${data.skills.length ? data.skills.join(', ') : 'None listed'}`);
    lines.push(`DESCRIPTION: ${data.description || 'No description available'}`);
    return lines.join('\n');
  }

  function formatBatchMarkdown(jobs) {
    return jobs.map((j, i) => `---\n\n## Job ${i + 1}\n\n${formatMarkdown(j)}`).join('\n\n');
  }

  function formatBatchClaude(jobs) {
    return jobs.map((j, i) => `--- JOB ${i + 1} ---\n${formatClaude(j)}`).join('\n\n');
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

  // --- Render single job ---

  function render(data) {
    scoreBadge.innerHTML = `<span class="score-number">${data.score}/10</span> ${data.scoreLabel.label}`;
    scoreBadge.style.background = data.scoreLabel.color;
    scoreBadge.style.color = data.score >= 5 && data.score < 8 ? '#0F172A' : '#FFF';
    if (data.score >= 8) scoreBadge.style.color = '#FFF';
    if (data.score < 5) scoreBadge.style.color = '#FFF';
    scoreBadge.classList.add('visible');

    $('job-title').textContent = data.title || 'Unknown';
    $('budget').textContent = data.budget.amount;
    $('budget-type').textContent = data.budget.type;
    $('level').textContent = data.experienceLevel;
    $('posted').textContent = data.postedDate;
    $('location').textContent = data.location;
    $('proposals').textContent = data.proposals;
    $('project-length').textContent = data.projectLength || 'N/A';
    $('project-type').textContent = data.projectType || 'N/A';

    $('last-viewed').textContent = data.lastViewed;
    $('interviewing').textContent = data.interviewing;
    $('invites-sent').textContent = data.invitesSent;

    $('bid-high').textContent = data.bidRange.high;
    $('bid-avg').textContent = data.bidRange.avg;
    $('bid-low').textContent = data.bidRange.low;

    $('connects-required').textContent = data.connectsRequired;
    $('connects-available').textContent = data.connectsAvailable;

    const skillsContainer = $('skills');
    if (data.skills.length) {
      skillsContainer.innerHTML = data.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');
    } else {
      skillsContainer.innerHTML = '<span class="value">None listed</span>';
    }

    const paymentEl = $('client-payment');
    paymentEl.textContent = data.client.paymentVerified ? 'Verified' : 'Not Verified';
    paymentEl.className = 'value ' + (data.client.paymentVerified ? 'verified' : 'not-verified');
    $('client-location').textContent = data.client.location;
    $('client-hire-rate').textContent = data.client.hireRate;
    $('client-open-jobs').textContent = data.client.openJobs;
    $('client-total-spent').textContent = data.client.totalSpent;
    $('client-member-since').textContent = data.client.memberSince;
    $('client-rating').textContent = data.client.rating;
    $('client-reviews').textContent = data.client.reviews;

    $('description').textContent = data.description || 'No description available';

    status.textContent = `Extracted at ${new Date(data.extractedAt).toLocaleTimeString()}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showError(msg) {
    loading.classList.add('hidden');
    content.classList.add('hidden');
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
    try {
      await Supabase.upsertJobs(jobs);
      btn.textContent = 'Saved!';
      showToast(`${jobs.length} jobs saved to Supabase!`);
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
    } catch (err) {
      btn.textContent = 'Error';
      showToast('Save failed: ' + err.message);
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
    }
  }

  // --- Saved jobs ---

  let savedJobs = [];
  let savedFilter = 'all';

  function scoreColor(label) {
    if (label === 'APPLY') return '#22C55E';
    if (label === 'MAYBE') return '#EAB308';
    return '#EF4444';
  }

  async function loadSavedJobs(filter) {
    savedFilter = filter || 'all';

    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === savedFilter);
    });

    try {
      savedJobs = await Supabase.fetchJobs(savedFilter);

      $('saved-count').textContent = `${savedJobs.length} job${savedJobs.length !== 1 ? 's' : ''}`;

      if (!savedJobs.length) {
        $('saved-list').innerHTML = '';
        $('saved-empty').classList.remove('hidden');
        return;
      }

      $('saved-empty').classList.add('hidden');
      $('saved-list').innerHTML = savedJobs.map((job, i) => `
        <div class="saved-card" data-idx="${i}">
          <div class="saved-card-header">
            <span class="saved-card-score" style="background:${scoreColor(job.score_label)}20;color:${scoreColor(job.score_label)}">
              ${job.score}/10 ${job.score_label}
            </span>
            <span class="saved-card-title">${escapeHtml(job.title || 'Untitled')}</span>
          </div>
          <div class="saved-card-meta">
            <span>${job.budget_amount || '?'} ${job.budget_type || ''}</span>
            <span>${job.proposals || '?'} proposals</span>
            <span>${job.client_payment_verified ? 'Verified' : 'Not Verified'}</span>
            <span>${job.client_total_spent || 'No spend'}</span>
          </div>
          <div class="saved-card-date">Saved ${new Date(job.created_at).toLocaleDateString()} ${new Date(job.created_at).toLocaleTimeString()}</div>
        </div>
      `).join('');

      // Click handler for each card
      $('saved-list').querySelectorAll('.saved-card').forEach(card => {
        card.addEventListener('click', () => showSavedDetail(parseInt(card.dataset.idx)));
      });

    } catch (err) {
      $('saved-list').innerHTML = `<p class="supa-status error">Error: ${err.message}</p>`;
    }
  }

  function showSavedDetail(idx) {
    const job = savedJobs[idx];
    if (!job) return;

    $('saved-panel').classList.add('hidden');
    $('saved-detail').classList.remove('hidden');

    const skills = (job.skills || []).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('') || 'None';

    $('saved-detail-content').innerHTML = `
      <div class="detail-section">
        <div class="saved-card-header" style="margin-bottom:0">
          <span class="saved-card-score" style="background:${scoreColor(job.score_label)}20;color:${scoreColor(job.score_label)}">
            ${job.score}/10 ${job.score_label}
          </span>
        </div>
        <h2 class="title-value" style="margin-top:8px">${escapeHtml(job.title || 'Untitled')}</h2>
      </div>

      <div class="detail-section">
        <h3>Key Metrics</h3>
        <div class="detail-row"><span class="dl">Budget</span><span class="dv">${job.budget_amount || '?'} (${job.budget_type || '?'})</span></div>
        <div class="detail-row"><span class="dl">Level</span><span class="dv">${job.experience_level || '?'}</span></div>
        <div class="detail-row"><span class="dl">Posted</span><span class="dv">${job.posted_date || '?'}</span></div>
        <div class="detail-row"><span class="dl">Location</span><span class="dv">${job.location || '?'}</span></div>
        <div class="detail-row"><span class="dl">Proposals</span><span class="dv">${job.proposals || '?'}</span></div>
        <div class="detail-row"><span class="dl">Project</span><span class="dv">${[job.project_length, job.project_type].filter(Boolean).join(' / ') || 'N/A'}</span></div>
      </div>

      <div class="detail-section">
        <h3>Activity</h3>
        <div class="detail-row"><span class="dl">Last Viewed</span><span class="dv">${job.last_viewed || '?'}</span></div>
        <div class="detail-row"><span class="dl">Interviewing</span><span class="dv">${job.interviewing || '?'}</span></div>
        <div class="detail-row"><span class="dl">Invites Sent</span><span class="dv">${job.invites_sent || '?'}</span></div>
        <div class="detail-row"><span class="dl">Bid Range</span><span class="dv">${job.bid_high || '?'} / ${job.bid_avg || '?'} / ${job.bid_low || '?'}</span></div>
        <div class="detail-row"><span class="dl">Connects</span><span class="dv">${job.connects_required || '?'} req / ${job.connects_available || '?'} avail</span></div>
      </div>

      <div class="detail-section">
        <h3>Client</h3>
        <div class="detail-row"><span class="dl">Payment</span><span class="dv ${job.client_payment_verified ? 'verified' : 'not-verified'}">${job.client_payment_verified ? 'Verified' : 'Not Verified'}</span></div>
        <div class="detail-row"><span class="dl">Location</span><span class="dv">${job.client_location || '?'}</span></div>
        <div class="detail-row"><span class="dl">Hire Rate</span><span class="dv">${job.client_hire_rate || '?'}</span></div>
        <div class="detail-row"><span class="dl">Total Spent</span><span class="dv">${job.client_total_spent || '?'}</span></div>
        <div class="detail-row"><span class="dl">Open Jobs</span><span class="dv">${job.client_open_jobs || '?'}</span></div>
        <div class="detail-row"><span class="dl">Member Since</span><span class="dv">${job.client_member_since || '?'}</span></div>
        <div class="detail-row"><span class="dl">Rating</span><span class="dv">${job.client_rating || '?'} (${job.client_reviews || '?'} reviews)</span></div>
      </div>

      <div class="detail-section">
        <h3>Skills</h3>
        <div class="detail-skills">${skills}</div>
      </div>

      <div class="detail-section">
        <h3>Description</h3>
        <div class="detail-desc">${escapeHtml(job.description || 'No description')}</div>
      </div>

      <div class="detail-actions">
        <a href="${job.url || '#'}" target="_blank" class="btn btn-accent" style="text-align:center;text-decoration:none">Open on Upwork</a>
        <button class="btn btn-danger" id="saved-delete" data-id="${job.id}">Delete</button>
      </div>
    `;

    // Delete handler
    $('saved-delete').addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!confirm('Delete this job from Supabase?')) return;
      try {
        await Supabase.deleteJob(id);
        showToast('Deleted!');
        $('saved-detail').classList.add('hidden');
        $('saved-panel').classList.remove('hidden');
        loadSavedJobs(savedFilter);
      } catch (err) {
        showToast('Delete failed: ' + err.message);
      }
    });
  }

  // --- Tab switching ---

  function switchMode(mode) {
    currentMode = mode;
    $('tab-single').classList.toggle('active', mode === 'single');
    $('tab-batch').classList.toggle('active', mode === 'batch');
    $('tab-saved').classList.toggle('active', mode === 'saved');
    $('tab-settings').classList.toggle('active', mode === 'settings');

    loading.classList.add('hidden');
    error.classList.add('hidden');
    scoreBadge.classList.remove('visible');

    // Hide all panels
    content.classList.add('hidden');
    batchPanel.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    $('saved-panel').classList.add('hidden');
    $('saved-detail').classList.add('hidden');

    if (mode === 'single') {
      extract();
    } else if (mode === 'batch') {
      batchPanel.classList.remove('hidden');
      $('batch-results').classList.add('hidden');
      $('batch-progress').classList.add('hidden');
    } else if (mode === 'saved') {
      $('saved-panel').classList.remove('hidden');
      loadSavedJobs(savedFilter);
    } else if (mode === 'settings') {
      settingsPanel.classList.remove('hidden');
      loadSettings();
    }
  }

  // --- Single extract ---

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

  async function extract() {
    loading.classList.remove('hidden');
    loadingText.textContent = 'Extracting job data...';
    content.classList.add('hidden');
    error.classList.add('hidden');

    try {
      const tab = await getActiveTab();

      if (!tab || !tab.url || !tab.url.includes('upwork.com')) {
        showError('Please navigate to an Upwork job page first.');
        return;
      }

      await ensureContentScript(tab.id);

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJob' });

      if (!response || !response.success) {
        showError(response?.error || 'Failed to extract job data. Make sure you are on a job page.');
        return;
      }

      jobData = response.data;
      chrome.runtime.sendMessage({ action: 'saveJob', data: jobData });

      loading.classList.add('hidden');
      content.classList.remove('hidden');
      render(jobData);

    } catch (err) {
      showError('Could not connect to the page. Try refreshing the Upwork page and clicking again.');
    }
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

    setBatchRunning(true);
    $('batch-results').classList.add('hidden');
    $('batch-progress').classList.remove('hidden');
    $('progress-bar-fill').style.width = '0%';
    $('batch-status').textContent = 'Injecting script...';

    try {
      const tab = await getActiveTab();
      batchTabId = tab?.id;

      if (!tab || !tab.url || !tab.url.includes('upwork.com')) {
        showError('Please navigate to an Upwork Best Matches or Search page first.');
        setBatchRunning(false);
        return;
      }

      await ensureContentScript(tab.id);

      const progressListener = (msg) => {
        if (msg.action === 'batchProgress') {
          const pct = Math.round((msg.current / msg.total) * 100);
          $('progress-bar-fill').style.width = pct + '%';
          $('batch-status').textContent = `Extracting ${msg.current}/${msg.total}: ${msg.title || '...'}`;
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
        showError(response?.error || 'Batch extraction failed.');
        return;
      }

      const successJobs = response.results.filter(r => r.success).map(r => r.data);
      for (const job of successJobs) {
        chrome.runtime.sendMessage({ action: 'saveJob', data: job });
      }

      $('progress-bar-fill').style.width = '100%';
      $('batch-status').textContent = `Done! Extracted ${successJobs.length} of ${response.total} jobs.`;

      renderBatchResults(response.results);

    } catch (err) {
      showError('Batch extraction failed. Try refreshing the Upwork page.');
      setBatchRunning(false);
    }
  }

  async function stopBatch() {
    if (!batchTabId) return;
    try {
      await chrome.tabs.sendMessage(batchTabId, { action: 'batchStop' });
    } catch {}
    $('batch-status').textContent = 'Stopping...';
  }

  // --- Event listeners ---

  $('tab-single').addEventListener('click', () => switchMode('single'));
  $('tab-batch').addEventListener('click', () => switchMode('batch'));
  $('tab-saved').addEventListener('click', () => switchMode('saved'));
  $('tab-settings').addEventListener('click', () => switchMode('settings'));

  // Saved panel listeners
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => loadSavedJobs(btn.dataset.filter));
  });
  $('saved-refresh').addEventListener('click', () => loadSavedJobs(savedFilter));
  $('saved-copy-json').addEventListener('click', () => {
    if (!savedJobs.length) return showToast('No jobs to copy');
    copyToClipboard(JSON.stringify(savedJobs, null, 2));
  });
  $('saved-back').addEventListener('click', () => {
    $('saved-detail').classList.add('hidden');
    $('saved-panel').classList.remove('hidden');
  });

  $('copy-all').addEventListener('click', () => {
    if (jobData) copyToClipboard(formatMarkdown(jobData));
  });

  $('copy-claude').addEventListener('click', () => {
    if (jobData) copyToClipboard(formatClaude(jobData));
  });

  $('save-supabase').addEventListener('click', () => {
    if (jobData) saveJobToSupabase(jobData, $('save-supabase'));
  });

  $('batch-start').addEventListener('click', startBatch);
  $('batch-stop').addEventListener('click', stopBatch);

  $('batch-copy-all').addEventListener('click', () => {
    if (batchData.length) copyToClipboard(formatBatchMarkdown(batchData));
  });

  $('batch-copy-claude').addEventListener('click', () => {
    if (batchData.length) copyToClipboard(formatBatchClaude(batchData));
  });

  $('batch-save-supabase').addEventListener('click', () => {
    if (batchData.length) saveBatchToSupabase(batchData, $('batch-save-supabase'));
  });

  $('retry-btn').addEventListener('click', () => {
    if (currentMode === 'single') extract();
    else switchMode('batch');
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
  await checkAuth();
  extract();
})();
