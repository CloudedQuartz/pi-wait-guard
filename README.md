# pi-wait-guard

Blocks the bounded-wait loop on `get_subagent_result` and rewrites the advice that
teaches it.

## The behaviour

`get_subagent_result` accepts `wait: true` plus an optional `timeout`. With a timeout it
returns after that long with *"still running"*; with no timeout it returns when the agent
finishes. Repeating bounded waits can keep the parent busy without collecting a result.

## What this does

1. **Rejects the second bounded wait on the same agent in the same turn**, with a redirect:
   *"Use wait:true with no timeout (it returns when the agent finishes), continue
   independent work, or end the turn."* The first bounded wait is allowed — one status check
   is legitimate; it is the repeat that wastes the turn.
2. **Rewrites the report's own advice on the way to the model.** The package currently says
   *"Use wait: true or check back later."* and, on expiry, offers re-waiting as a remedy
   (*"read its transcript, steer it … or tell the user it appears stuck"*). Both are replaced
   with the same redirect, so the tool stops teaching the pattern the prompt forbids.

State is per turn (`before_agent_start` clears it), per agent id.

## Why an extension and not prompt text

The prompt rule decayed inside one turn: after the user asked for an unbounded wait, the next
turn used two unbounded waits and the turn after that went back to 30 s timeouts. The tool
response is read every time; the system prompt is read once.

## Install

- Package: add the checkout directory to `packages` in `~/.pi/agent/settings.json`.
  Pi discovers `extensions/wait-guard.ts` by convention.
- Loose: symlink `~/.pi/agent/extensions/wait-guard.ts` to that file instead. A loose extension cannot
  be excluded from child sessions via `subagents.json`.

## Verify before trusting

1. Launch a background agent.
2. Call `get_subagent_result` with `wait:true, timeout:30` twice on the same id: the second
   must be rejected with the redirect.
3. Confirm a call with `wait:true` and no timeout goes through.
4. Confirm the first result no longer contains "check back later".

## Upstream note

The durable fix is in `@gotgenes/pi-subagents`: make the tool's own advice say
"no timeout returns on completion", and drop the 30 s-style examples. This extension exists
because that package is an npm dependency.
