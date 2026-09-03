---
name: "telegram-bot-group-debugging"
description: "Fix Telegram bot group failures: migrated-to-supergroup errors, dead inline buttons, stale group IDs, sessions running outdated instructions."
---

# Telegram Bot Group Debugging

Fix Telegram-bot group failures in OpenClaw: "group migrated to supergroup" send errors, inline buttons that die with "This action is no longer available", stale chat IDs after group upgrades, and agent sessions running outdated instructions.

## When to use
- A Telegram send fails with `group migrated to supergroup -100XXXX`.
- A user taps an inline button and gets "⌨️ This action is no longer available" and no `callback_data:` ever reaches the agent session.
- You need the current chat ID of a group the bot is in.
- Agent behavior does not match freshly edited AGENTS.md/workspace instructions.

## Steps

1. **Resolve migrated group IDs.** When Telegram rejects a chat with "group migrated to supergroup -100XXXX", that chat was upgraded: replace the old ID with the new `-100XXXX` ID everywhere it is referenced (channel config `channels.telegram.accounts.<account>.groups`, scripts, instruction files). To find current IDs the bot can see, list group sessions with `sessions_list` (`kinds: ["group"]`); each session key contains the real chat ID. Completion: the new ID appears in `openclaw channels logs` as the active `chatId` and in the session list.

2. **Unblock inline buttons.** If a button tap shows "This action is no longer available" and no callback handling appears in logs/session history, the group is gated by `requireMention: true` — callbacks are not mentions, so they are rejected before reaching the agent. Set `requireMention: false` (plus `allowFrom` with the operator's numeric Telegram user ID) for that group under the account's `groups` config. Verify in the running state only after the config reload (step 4).

3. **Reload stale session context.** Sessions that started before you edited workspace instructions keep the old text in context. Reset the affected session with the `sessions` tool (`action: "reset"`, its sessionKey) so the next message reloads the current AGENTS.md. Completion: the reset result shows `totalTokens: 0`.

4. **Apply and confirm config changes.** The gateway hot-reloads config changes but defers while gateway requests are active (`config change detected; evaluating reload ... deferring until N ... complete`). Confirm with `openclaw channels logs` showing `config hot reload applied`; `openclaw channels status --probe` reflects the new config only after that. If a button needs re-testing, wait for the reload to finish before asking the user.

5. **Send buttoned messages without shell quoting.** PowerShell mangles inline JSON passed to native commands (`--presentation must be valid JSON`). Invoke the CLI shell-free: `spawnSync(process.execPath, [OPENCLAW_CLI, 'message', 'send', '--channel', 'telegram', '--account', ACCOUNT, '--target', TARGET, '--message', TEXT, '--presentation', PRESENTATION_JSON, '--json'], { encoding: 'utf8' })` where `OPENCLAW_CLI` is `<npm-root>/openclaw/openclaw.mjs` (the package `bin` entry). Test with `--dry-run` first.

6. **Avoid duplicate replies.** When a message with buttons was already delivered (e.g. via an outbox script), the agent's final reply must be exactly `NO_REPLY`, or the chat receives a second plain-text copy of the same content. Do not rely on `NO_REPLY` alone: the LLM will often still emit a summary because the runtime's "produce the final user-visible answer" instruction wins. The robust pattern is delivering buttoned advisories from an isolated automation with `delivery: none` (or a script payload), so the agent's final text goes nowhere and the outbox send is the only visible message.

7. **Edit long automation messages via argv, not shell strings.** Passing a multi-line message to `openclaw automations edit <id> --message $msg` from PowerShell keeps only the first line (the stored message ends up ~50 chars). Write the message to a file, then apply with `spawnSync(process.execPath, [OPENCLAW_CLI, 'automations', 'edit', JOB_ID, '--message', FULL_MESSAGE], { encoding: 'utf8' })` (same `OPENCLAW_CLI` shell-free pattern as step 5). Verify persistence by parsing `openclaw automations get <id>` output: strip the UTF-8 BOM (`text.replace(/^\uFEFF/, '')`) before `JSON.parse`, then confirm the message length and expected markers.

8. **Convert scripted automations to prompt-based jobs when uniformity is required.** Read the complete existing script behavior, rewrite every source, state, duplicate, delivery, button, and manual-test rule into one agent-turn prompt, then update the existing job through the shell-free argv method in step 7. Preserve the schedule and verify the stored payload kind is `agentTurn`, the prompt contains the required workflow markers, and the old script payload is gone.

## Pitfalls
- Old chat IDs are not derivable from new ones; always read the new ID from the migration error or the session list.
- `openclaw channels resolve` only resolves usernames for DM lookups; it cannot resolve migrated group IDs.
- Group callbacks run in `callback-scope` mode, which skips the group allowlist but still passes `shouldSkipGroupMessage` — so the `requireMention` gate applies to callbacks too.
- On this Windows Node runtime, do not call `process.exit()` immediately after an awaited HTTP fetch in a bot automation script; let the module return naturally, or libuv can assert after valid output and report a non-zero exit.
