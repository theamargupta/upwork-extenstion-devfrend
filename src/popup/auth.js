import { $, showToast } from './utils.js';

let supabaseReady = false;
let authMode = 'login';

function supabase() {
  if (globalThis.Supabase) return globalThis.Supabase;
  if (typeof Supabase !== 'undefined') return Supabase;
  throw new Error('Supabase helper is not loaded');
}

export function isSupabaseReady() {
  return supabaseReady;
}

export async function checkAuth() {
  const user = await supabase().getUser();
  supabaseReady = !!user;
  document.querySelectorAll('.btn-supabase').forEach(btn => {
    btn.classList.toggle('hidden', !supabaseReady);
  });
  $('auth-form').classList.toggle('hidden', supabaseReady);
  $('auth-profile').classList.toggle('hidden', !supabaseReady);
  if (user) {
    $('profile-email').textContent = user.email;
    $('profile-meta').textContent = `Signed in since ${new Date(user.created_at).toLocaleDateString()}`;
  }
  return user;
}

export function setAuthMode(mode) {
  authMode = mode;
  $('auth-tab-login').classList.toggle('active', mode === 'login');
  $('auth-tab-signup').classList.toggle('active', mode === 'signup');
  $('auth-submit').textContent = mode === 'login' ? 'Sign In' : 'Sign Up';
  $('auth-status').textContent = '';
}

export async function handleAuth() {
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
      const result = await supabase().signUp(email, password);
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
      await supabase().signIn(email, password);
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

export async function handleLogout() {
  await supabase().signOut();
  await checkAuth();
  showToast('Signed out');
  $('auth-email').value = '';
  $('auth-password').value = '';
}

export function getSupabaseClient() {
  return supabase();
}
