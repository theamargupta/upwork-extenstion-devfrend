import { getActiveTab } from '../popup/utils.js';
import { readPage } from './read-page.js';
import { click } from './click.js';
import { fill } from './fill.js';
import { queryDom } from './query-dom.js';
import { screenshot } from './screenshot.js';
import { navigate } from './navigate.js';
import { applyToJob } from './apply-to-job.js';
import { selectHighlights } from './select-highlights.js';

export async function executeCommand(cmd) {
  const { type, args = {} } = cmd;
  const tab = await getActiveTab();
  if (!tab) throw new Error('no active tab');

  if (type === 'read_page') return readPage(tab, args);
  if (type === 'click') return click(tab, args);
  if (type === 'fill') return fill(tab, args);
  if (type === 'navigate') return navigate(tab, args);
  if (type === 'screenshot') return screenshot(tab, args);
  if (type === 'query_dom') return queryDom(tab, args);
  if (type === 'apply_to_job') return applyToJob(tab, args);
  if (type === 'select_highlights') return selectHighlights(tab, args);

  throw new Error(`unknown command type: ${type}`);
}
