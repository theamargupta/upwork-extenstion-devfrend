import { showToast, audit, uidFromUrl } from './utils.js';
import { getSupabaseClient, isSupabaseReady } from './auth.js';

export async function markJobCopied(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  const uids = list.map(uidFromUrl).filter(Boolean);
  if (!uids.length) return;
  const { copiedJobUids = [] } = await chrome.storage.local.get('copiedJobUids');
  const merged = Array.from(new Set([...copiedJobUids, ...uids]));
  await chrome.storage.local.set({ copiedJobUids: merged });
}

export async function saveJobToSupabase(data, btn) {
  if (!isSupabaseReady()) return;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    await getSupabaseClient().upsertJob(data);
    btn.textContent = 'Saved!';
    showToast('Saved to Supabase!');
  } catch (err) {
    btn.textContent = 'Error';
    showToast('Save failed: ' + err.message);
  } finally {
    setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
  }
}

export async function saveBatchToSupabase(jobs, btn) {
  if (!isSupabaseReady() || !jobs.length) return;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';
  audit('supabase:save:start', { count: jobs.length });
  try {
    await getSupabaseClient().upsertJobs(jobs);
    audit('supabase:save:done', { count: jobs.length });
    btn.textContent = 'Saved!';
    showToast(`${jobs.length} jobs saved to Supabase!`);
  } catch (err) {
    audit('supabase:save:error', { error: err?.message || String(err) });
    btn.textContent = 'Error';
    showToast('Save failed: ' + err.message);
  } finally {
    setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2000);
  }
}
