import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const WAIT_TOOL = "get_subagent_result";

const REDIRECT =
	"Use wait:true with no timeout (it returns when the agent finishes), continue independent work, or end the turn.";

/** Advice in the report that invites another bounded wait. */
const WAIT_ADVICE = /Use wait: true or check back later\./g;
const EXPIRY_ADVICE =
	/If its progress has not changed since your last check, waiting again will not unstick it: read its transcript, steer it with steer_subagent, or tell the user it appears stuck\./g;

export default function (pi: ExtensionAPI) {
	/** Bounded waits already spent this turn, keyed by agent id. */
	const spent = new Set<string>();

	// Reset per user message, not per agent run: a run restarts between tool
	// rounds, so resetting there let a loop spend one bounded wait per round.
	pi.on("message_start", (event) => {
		if (event.message?.role === "user") spent.clear();
	});
	pi.on("session_start", () => {
		spent.clear();
	});

	pi.on("tool_call", (event) => {
		if (event.toolName !== WAIT_TOOL) return;
		const { wait, timeout, agent_id } = event.input;
		if (wait !== true || typeof timeout !== "number") return;
		const id = typeof agent_id === "string" ? agent_id : "";
		if (!spent.has(id)) {
			spent.add(id);
			return;
		}
		return {
			block: true,
			reason:
				`Repeated bounded wait: ${id || "this agent"} already had one this turn, and another returns the same "still running". ` +
				REDIRECT,
		};
	});

	pi.on("tool_result", (event) => {
		if (event.toolName !== WAIT_TOOL) return;
		let changed = false;
		const content = event.content.map((part) => {
			if (part.type !== "text") return part;
			const text = part.text.replace(EXPIRY_ADVICE, REDIRECT).replace(WAIT_ADVICE, REDIRECT);
			if (text === part.text) return part;
			changed = true;
			return { ...part, text };
		});
		if (!changed) return;
		return event.structuredContent === undefined
			? { content }
			: { content, structuredContent: event.structuredContent };
	});
}
