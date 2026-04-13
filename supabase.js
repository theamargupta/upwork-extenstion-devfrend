// Supabase REST API + Auth helper
// Uses SUPABASE_URL and SUPABASE_ANON_KEY from config.js

const Supabase = {

  // --- Auth ---

  async signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      await this._saveSession(data);
      return { user: data.user, session: data };
    }
    if (res.ok && data.id && !data.access_token) {
      // Email confirmation required
      return { user: data, needsConfirmation: true };
    }
    throw new Error(data.error_description || data.msg || data.message || 'Sign up failed');
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.message || 'Sign in failed');
    }
    await this._saveSession(data);
    return { user: data.user, session: data };
  },

  async signOut() {
    const session = await this._getSession();
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`
        }
      }).catch(() => {});
    }
    await chrome.storage.local.remove(['supaSession']);
  },

  async getUser() {
    const session = await this._getSession();
    if (!session?.access_token) return null;

    // Check if token is expired
    if (session.expires_at && Date.now() / 1000 > session.expires_at) {
      const refreshed = await this._refreshToken(session.refresh_token);
      if (!refreshed) return null;
      return refreshed.user;
    }

    return session.user || null;
  },

  async _refreshToken(refreshToken) {
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!res.ok) return null;
      const data = await res.json();
      await this._saveSession(data);
      return data;
    } catch {
      return null;
    }
  },

  async _saveSession(data) {
    await chrome.storage.local.set({
      supaSession: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || (Date.now() / 1000 + (data.expires_in || 3600)),
        user: data.user
      }
    });
  },

  async _getSession() {
    const result = await chrome.storage.local.get('supaSession');
    return result.supaSession || null;
  },

  // Get auth headers — uses user token if logged in, falls back to anon key
  async _headers(withContent) {
    const session = await this._getSession();
    let token = SUPABASE_ANON_KEY;

    if (session?.access_token) {
      // Refresh if expired
      if (session.expires_at && Date.now() / 1000 > session.expires_at) {
        const refreshed = await this._refreshToken(session.refresh_token);
        if (refreshed) token = refreshed.access_token;
      } else {
        token = session.access_token;
      }
    }

    const h = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    };
    if (withContent) h['Content-Type'] = 'application/json';
    return h;
  },

  // --- Data helpers ---

  extractUid(url) {
    const match = url.match(/~(\d+)/);
    return match ? match[1] : null;
  },

  toRow(data) {
    return {
      job_uid: this.extractUid(data.url) || data.url,
      title: data.title,
      description: data.description,
      url: data.url,
      budget_amount: data.budget.amount,
      budget_type: data.budget.type,
      experience_level: data.experienceLevel,
      posted_date: data.postedDate,
      location: data.location,
      project_length: data.projectLength || null,
      project_type: data.projectType || null,
      proposals: data.proposals,
      skills: data.skills,
      last_viewed: data.lastViewed,
      interviewing: data.interviewing,
      invites_sent: data.invitesSent,
      bid_high: data.bidRange.high,
      bid_avg: data.bidRange.avg,
      bid_low: data.bidRange.low,
      connects_required: data.connectsRequired,
      connects_available: data.connectsAvailable,
      client_payment_verified: data.client.paymentVerified,
      client_location: data.client.location,
      client_hire_rate: data.client.hireRate,
      client_open_jobs: data.client.openJobs,
      client_total_spent: data.client.totalSpent,
      client_member_since: data.client.memberSince,
      client_rating: data.client.rating,
      client_reviews: data.client.reviews,
      score: data.score,
      score_label: data.scoreLabel.label,
      extracted_at: data.extractedAt
    };
  },

  // --- CRUD ---

  async upsertJob(data) {
    const row = this.toRow(data);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/upwork_jobs?on_conflict=user_id,job_uid`, {
      method: 'POST',
      headers: {
        ...await this._headers(true),
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return true;
  },

  async upsertJobs(jobs) {
    const rows = jobs.map(j => this.toRow(j));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/upwork_jobs?on_conflict=user_id,job_uid`, {
      method: 'POST',
      headers: {
        ...await this._headers(true),
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return true;
  },

  async fetchJobs(filter, limit = 100) {
    let query = `${SUPABASE_URL}/rest/v1/upwork_jobs?select=*&order=created_at.desc&limit=${limit}`;
    if (filter && filter !== 'all') {
      query += `&score_label=eq.${filter}`;
    }
    const res = await fetch(query, { headers: await this._headers() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async deleteJob(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/upwork_jobs?id=eq.${id}`, {
      method: 'DELETE',
      headers: await this._headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return true;
  }
};
