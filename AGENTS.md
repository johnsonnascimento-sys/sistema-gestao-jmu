# AGENTS

This repository uses the agent policy defined in `AGENT_RULES`, `AI_BOOTLOADER.md`, `START_HERE_AGENTS.md`, and `agents.toml`.

Operational rule:
- Before any task that uses an agent or subagent, explicitly state which agent will be used, its role, and the model.
- After the task finishes, explicitly restate which agent or subagents were actually used and the result delivered.
- If more than one subagent is used, show the division by responsibility and the summary from each one.

Priority reading order:
1. `AI_BOOTLOADER.md`
2. `AGENT_RULES`
3. `START_HERE_AGENTS.md`
4. `agents.toml`
