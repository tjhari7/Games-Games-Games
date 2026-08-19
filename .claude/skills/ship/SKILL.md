---
name: ship
description: Commit the current work and push it to GitHub, and optionally deploy the live Netlify site. Use when the user types /ship, or says "commit this", "push to main", "commit and deploy", "put this live", or asks to save or publish their changes.
---

# Ship the current work

TJ is a designer and has said the commit/PR flow is over their head. Do the git
work, then report in plain language: what was saved, and whether the live site
changed. No git jargon, no PR suggestions — this is a solo project that commits
straight to `main`.

## Two separate things

Keep these distinct, because on this project they genuinely are:

1. **Saving to GitHub** — commit + push to `main`. Safe, reversible, always fine.
2. **Deploying to Netlify** — makes changes public at
   https://games-games-games.netlify.app

**The Netlify site has no GitHub repo connected, so pushing does NOT deploy.**
A deploy is a separate manual CLI run. Never say a change is live just because it
was pushed — that has caused real confusion before.

## Default behavior

Bare `/ship` = **commit and push only.** Stop there and say the live site is
unchanged, offering the deploy as a next step.

Deploy only when the user actually asks for it — "/ship deploy", "put it live",
"deploy to netlify". Before running a production deploy, confirm with the user in
one line, since it changes a public site.

## Saving to GitHub

1. `git status` and `git diff --stat` to see the scope.
2. Check what is being staged. This project has a history of stray files — build
   output, `deno.lock`, `.env`, backup JSON, unused asset folders. Do not commit
   secrets or build artifacts; flag anything questionable rather than sweeping it
   in with `git add -A`.
3. Commit with a message describing the **design change**, not the code
   mechanics — "Update card padding and bottom bar radius" beats "refactor CSS".
   Include the Co-Authored-By trailer.
4. `git push origin main`.

If the push is rejected because the remote moved ahead, pull and rebase, then say
plainly that someone else's changes were merged in first.

## Deploying to Netlify

Only after the user has asked, and confirmed:

```
netlify deploy --build --prod
```

The CLI is installed and already authenticated as tj.hari7@gmail.com, linked to
project `games-games-games` (id `f17cc3d9-2930-4363-862c-bfa6aedec0f9`). The
build runs `npm run build` → `dist/`, with the API served by the Netlify function
in `netlify/functions/api.js`.

After it finishes, confirm the live site actually works — the API needs
`DATABASE_URL` set in Netlify's environment variables, and a deploy that builds
fine can still show an empty app if Supabase is paused or that variable is
missing. Fetch the live URL and check games load before calling it done.

## Reporting back

Three or four lines, plain language:

- What was saved and how many files
- Whether it is live, or explicitly still local-only
- The live URL if it was deployed
- Anything left uncommitted on purpose, and why
