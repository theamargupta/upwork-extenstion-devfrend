# Claude CLI Bridge

Tiny local HTTP server that forwards prompts from the extension to your `claude` CLI.

## Run

```
node bridge/server.js
```

Keep the terminal open while using the extension.

## Endpoints

- `GET  /health` — sanity check
- `POST /shortlist` — body `{ "prompt": "..." }` → runs `claude -p "<prompt>"` → `{ "reply": "...", "ms": 1234 }`

## Env

- `CLAUDE_BIN` — override path if `claude` isn't on PATH (default: `claude`)

## Port

`8787`. Change in `server.js` if taken.
