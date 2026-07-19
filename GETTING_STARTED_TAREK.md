# Getting Started on Mend — for Tarek

Welcome! This is your complete guide to building on Mend. The good news: **you do almost
everything in a web browser** — the same way on your **work laptop** and your **home laptop**.
There's nothing to install to get started, and it works identically in both places.

There's an optional "install everything on your home laptop" section at the very end, for later.
You don't need it to begin — skip it until you want it.

> **The one big idea:** your development environment lives *in the cloud*, and you reach it
> through a browser tab. So "work laptop vs home laptop" mostly doesn't matter — log in, and
> you're back exactly where you left off.

---

## Part 0 — What Bernard sets up for you (you don't handle any keys)

You need just **one** thing of your own: a **GitHub account** (free — make one at
[github.com](https://github.com) and tell Bernard your username).

Bernard does the rest on his side:
1. **Invites you** to the `OzGyptian/Mend` project on GitHub.
2. **Loads the app's secret keys** into the project's cloud settings, so when you open your
   environment the app "just works." **You never see or handle a key file** — this is safer for
   everyone.

When Bernard says both are done, continue.

---

## Part 1 — Accept your invitation

1. Check your email for a GitHub invite mentioning `OzGyptian/Mend`, click **Accept invitation**.
   (Or just visit [github.com/OzGyptian/Mend](https://github.com/OzGyptian/Mend) — if you can
   see the files, you're in.)

✅ *You should see:* the Mend project page with folders like `src`, not a "not found" page.

---

## Part 2 — Open your cloud workspace (this is where you'll work)

We use **GitHub Codespaces** — think of it as *a full computer running in your browser tab*.
It has everything pre-installed: the code, the tools, an editor, a terminal, and the app's
secret keys. Nothing is installed on your laptop.

1. Go to [github.com/OzGyptian/Mend](https://github.com/OzGyptian/Mend).
2. Click the green **`< > Code`** button → **Codespaces** tab → **Create codespace on main**.
3. A new browser tab opens and sets up your workspace. **The first time takes 2–3 minutes** —
   it's installing everything and loading the keys. Let it finish.

✅ *You should see:* a VS Code editor in your browser, and at the bottom a **Terminal** panel
that finishes with `Setup complete. Run 'npm run dev' to start the app.`

> This is the identical experience on your work laptop and home laptop — it's just a website.

---

## Part 3 — Run the app

In the Terminal panel at the bottom, type this and press Enter:

```bash
npm run dev
```

Wait a few seconds. A small pop-up appears saying a port is available — click **Open in
Browser** (or open the **Ports** tab and click the 🌐 globe icon next to the forwarded port).

✅ **You should see:** the Mend app open in a new tab. 🎉 You're running it.

- To **stop** it: click the Terminal and press `Ctrl + C`.
- If the app loads but you **can't log in or see any projects**, message Bernard — he needs to
  switch on your Mend account. One-line fix on his side.

---

## Part 4 — Build with Claude

You don't need to learn terminal commands — **Claude does them for you.** Two ways to use it,
pick whichever you like:

**A) Claude inside your Codespace (recommended).** In the Terminal panel, type:

```bash
claude
```

The first time it asks you to sign in (opens a browser login with your Anthropic account).
Then just describe what you want in plain English, e.g.:

- *"Start a new branch for adding a CSV export to the risk register, then build it."*
- *"Run the tests and tell me if anything broke."*
- *"I'm done — commit this and open a pull request."*

**B) Claude Code on the web** ([claude.ai/code](https://claude.ai/code)). Connect it to the
`OzGyptian/Mend` repo and give it a task; it works in its own cloud copy and opens a pull
request for you to review. Handy for quick things from any browser.

A few things to know:
- **The project has its own rulebook.** Because you're working *inside the Mend project*,
  Claude automatically follows Mend's coding standards — the same ones Bernard's Claude follows.
  Nothing to configure.
- **When Claude asks permission** to run something, it's fine to allow normal coding steps. If
  something mentions **deleting data**, **force-pushing**, or the **production database**, pause
  and check with Bernard.
- **Describe the goal, not the keystrokes.** You say *what*; Claude figures out *how*.

---

## Part 5 — The daily rhythm

Each time you sit down to work (Claude can do all of these for you — just ask):

```
1. Get the latest code      → "switch to main and pull the latest"
2. Start a branch for your   → "start a branch called feat/tarek-<short-description>"
   work                         (e.g. feat/tarek-risk-export)
3. Build it with Claude      → describe what you want
4. Check it                  → "run lint and the tests"
5. Send it up                → "push this branch"
6. Open a pull request (PR)  → "open a PR"   (this asks to bring your work into the project)
7. Merge when green          → once the automated checks pass, merge it — it goes live
```

**Two habits that matter most:**
- **Small and often.** Finish and merge a piece of work within a day or two — not a big batch
  after a week. Small merges are painless; big ones hurt.
- **Name branches `feat/tarek-...`** so everyone sees at a glance it's yours.

---

## Part 6 — Seeing your change running (before it's merged)

When you open a PR, **a private preview website is built automatically** and its link appears
right on the PR page. Click it to see *your* version of the app live — no setup needed. This is
great for showing Bernard something, or checking your change on your **work laptop** even when
you're only reviewing.

---

## Part 7 — The database rule (important — and it keeps things simple for you)

We share **one** database, so we've agreed a clean split that means you can't accidentally break it:

- **You build features** in your areas — **risk, progress, changes, subcontracts** — using the
  data structure that already exists. That's the large majority of the work.
- **You never change the database *structure* yourself** (new tables/columns, etc.).
- **When a feature needs a new field or table**, just tell Bernard (a message or a GitHub Issue).
  He makes the change and tells you when it's ready.

So: build freely; when you hit *"the database needs to store something new,"* that's your cue to
ping Bernard rather than doing it yourself.

---

## Part 8 — Work laptop vs home laptop

Because everything is in the browser, **there's essentially no difference**:

| | Work laptop (browser only) | Home laptop |
|---|---|---|
| Open your Codespace & code | ✅ | ✅ |
| Use Claude (in Codespace or claude.ai/code) | ✅ | ✅ |
| Run the app & tests | ✅ (in the Codespace) | ✅ |
| Review PRs, see preview links | ✅ | ✅ |

Your Codespace **persists** — close the tab at work, reopen it at home from the green **Code →
Codespaces** menu, and you're exactly where you left off. Only start a *new* Codespace when
you've finished a piece of work and want a clean slate.

> **One habit:** when you're done for a while, stop your Codespace (it also auto-sleeps after
> 30 minutes idle). It keeps our free monthly allowance healthy. Nothing to stress about.

---

## Part 9 — When you're stuck

- **A step didn't match / something errored?** Copy the exact message and send it to Bernard —
  the wording is what he needs.
- **A question about how Mend works, or what to build next?** Put it in a **GitHub Issue** (our
  shared to-do list) or raise it in a catch-up — not a private note only one of us can see.
- **Over-communicate early on.** It's far cheaper than untangling something later.

Welcome aboard. 🚀

---

## Appendix (optional, for later) — Full setup on your home laptop

You do **not** need this to work — Codespaces covers everything. But if one day you want the app
running directly on your home Windows laptop (faster, works offline), the cleanest path on
Windows is **WSL2** (a built-in Linux layer). It's more involved, so do it with Claude's help or
ask Bernard to pair on it. Rough shape:

1. Install **WSL2** (Microsoft's official 1-command install), then open the "Ubuntu" terminal.
2. Inside it, install **nvm**, then **Node 20**, and **git**.
3. `git clone https://github.com/OzGyptian/Mend.git` and `cd Mend`.
4. `nvm install` → `npm ci`.
5. Get a `.env.local` from Bernard (secure share) and place it in the folder.
6. `npm run dev` → open the printed `http://localhost:...` link.

If any of that snags, stop and ask — the cloud path is always there as the easy default.

---

*Maintained in the repo as `GETTING_STARTED_TAREK.md`. If a step drifts out of date, fix it here.*
