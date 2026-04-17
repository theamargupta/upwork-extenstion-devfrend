---
description: Safely modify the scoring algorithm
---

The scoring lives in `content.js` lines ~403-450. Rules:
- Keep the base score at 5/10.
- Keep additive-only changes — do not introduce multiplicative combos without running a batch test.
- If changing a threshold, add a short comment with the rationale.
- Update `CLAUDE.md` scoring section to match.
