import { $ } from './utils.js';

let currentGroup = 'extract';
const currentSub = { tools: 'capture' };

const GROUP_SUBS = {
  extract: [],
  tools: ['capture']
};

export function getCurrentTabState() {
  return { currentGroup, currentSub };
}

export function hideAllPanels() {
  $('batch-panel').classList.add('hidden');
  $('settings-panel').classList.add('hidden');
  $('capture-panel').classList.add('hidden');
  $('loading').classList.add('hidden');
  $('error').classList.add('hidden');
  $('score-badge').classList.remove('visible');
}

export function switchTo(group, sub) {
  if (!GROUP_SUBS[group]) return;
  currentGroup = group;
  if (sub && GROUP_SUBS[group].includes(sub)) currentSub[group] = sub;
  const effectiveSub = GROUP_SUBS[group].length ? currentSub[group] : null;

  document.querySelectorAll('#top-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.group === group);
  });
  document.querySelectorAll('.subtabs').forEach(row => {
    row.classList.toggle('hidden', row.dataset.group !== group);
  });
  if (effectiveSub) {
    const row = document.querySelector(`.subtabs[data-group="${group}"]`);
    row?.querySelectorAll('.subtab').forEach(t => {
      t.classList.toggle('active', t.dataset.sub === effectiveSub);
    });
  }

  hideAllPanels();
  if (group === 'extract') {
    $('batch-panel').classList.remove('hidden');
    $('batch-results').classList.add('hidden');
    $('batch-progress').classList.add('hidden');
  } else if (group === 'tools' && effectiveSub === 'capture') {
    $('capture-panel').classList.remove('hidden');
  } else if (group === 'settings') {
    $('settings-panel').classList.remove('hidden');
  }
}
