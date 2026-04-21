export async function navigate(tab, args = {}) {
  const { url } = args;
  if (!url) throw new Error('navigate: missing url');
  await chrome.tabs.update(tab.id, { url });
  return { navigated: true, url };
}
