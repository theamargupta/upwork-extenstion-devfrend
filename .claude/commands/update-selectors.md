---
description: Update DOM selectors in content.js safely
---

Before changing any selector in `content.js`:
1. Ask the user for a snippet of the current Upwork HTML you are targeting.
2. Use `qs()` / selector-fallback pattern — add the new selector to the END of the fallback array, never remove an existing one unless the user confirms it's fully dead.
3. Test on BOTH the job detail page and the search/best-matches page.
4. Report which selectors fired and which fell back.
