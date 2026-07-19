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

## Part 7 — Your lane, and the one hard rule

**What you own:** building features in **risk, progress, changes, subcontracts** — that's your
home turf and the bulk of the work. You can dip into other areas if a feature needs it — just
mention it in your PR so Bernard knows.

**Leave to Bernard:** the behind-the-scenes plumbing (`src/platform/*`), the deploy/hosting setup
(Vercel, Supabase, Firebase), and the project's config files. You won't normally need these.

**The one hard rule — the database structure.** We share one database, so:

- **You never change the database *structure* yourself** (new tables/columns, etc.).
- When a feature needs a new field or table, tell Bernard (a message or a GitHub Issue); he makes
  the change and tells you when it's ready. You can't accidentally break the shared database, and
  you never touch the migration tooling.

**You can merge your own work** once the automated checks pass — they're your safety net. If the
checks come back red, don't merge: fix it (Claude can help) or ask Bernard.

**Always stop and ask Bernard first** before anything that **deletes data**, **force-pushes**, or
touches the **live / production database**.

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

## Part 10 — Your home Windows laptop

You have **two** ways to work from your home Windows laptop. **Option 1 is recommended** — it
needs no setup at all.

### Option 1 — Just use Codespaces from home too (recommended, nothing to install)

Your home laptop has a browser, and that's all Codespaces needs. Go to
[github.com/OzGyptian/Mend](https://github.com/OzGyptian/Mend) → green **`< > Code`** →
**Codespaces**, and open the same Codespace you were already using (or create one). You're back
exactly where you left off — it's literally the same environment you use at work. Genuinely the
easiest option, even at home. If that's all you want, you're done — ignore Option 2.

### Option 2 — Install Mend directly on your Windows laptop (optional: faster, works offline)

This runs Mend on your own machine. It's more setup, and the one place you'll do a few
"technical" steps — take it slowly. Once Claude is installed (Step 3), you can hand the rest to it.

We use **WSL** — a built-in Windows feature that gives you a small Linux system, which is what the
developer tools expect. It sounds exotic, but it's just a normal Windows install.

**Step 1 — Install WSL (Linux for Windows)**

1. Click **Start**, type **PowerShell**, right-click **Windows PowerShell** → **Run as
   administrator**.
2. In the blue window, type this and press Enter:
   ```powershell
   wsl --install
   ```
3. Let it finish, and **restart your laptop** when it asks.
4. After the restart, an **Ubuntu** window opens and asks you to create a **username and
   password** (separate from your Windows login — pick something memorable; the password stays
   invisible as you type, which is normal).

✅ *You should see:* an Ubuntu window with a prompt ending in `$`. From now on, do everything in
this **Ubuntu** window (open it any time via Start → type "Ubuntu").

**Step 2 — Install the tools** (paste one block at a time; enter your Ubuntu password if asked)

```bash
sudo apt update && sudo apt install -y curl git
```
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```
Now **close the Ubuntu window and open a new one**, then:
```bash
nvm install 20
```
✅ *Check:* `node --version` → shows `v20.something`.

**Step 3 — Install Claude Code**

```bash
npm install -g @anthropic-ai/claude-code
```
Then start it and sign in when prompted (it opens a browser):
```bash
claude
```

**Step 4 — Let Claude set up the rest.** Inside Claude, just type in plain English:

> *"Log me in to GitHub, clone the OzGyptian/Mend repository into my home folder, and install its
> dependencies."*

Claude walks you through the GitHub login and runs the rest.

✅ *You should see:* a `Mend` folder in your home directory, with dependencies installed.

**Step 5 — Add your secret keys.** Ask Bernard to send you a `.env.local` file (secure share —
this is the one time you handle keys directly, because local isn't connected to the cloud
secrets). Then ask Claude *"help me put this .env.local file into the Mend folder"* and follow
along — or drag it in with File Explorer (your Linux files appear under
`\\wsl$\Ubuntu\home\<your-username>\Mend`).

**Step 6 — Run it.** Ask Claude *"start the app"* (or type `npm run dev` inside the Mend folder),
then open the `http://localhost:...` link it prints in your Windows browser.

✅ **You should see:** Mend running on your own laptop. 🎉

If any step snags, stop and send Bernard the exact message — and remember the **cloud path
(Option 1) is always there** as the easy fallback.

---

*Maintained in the repo as `GETTING_STARTED_TAREK.md`. If a step drifts out of date, fix it here.*
