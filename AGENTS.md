# AGENTS

This repository uses the agent policy defined in `AGENT_RULES`, `AI_BOOTLOADER.md`, `START_HERE_AGENTS.md`, and `agents.toml`.

Operational rule:
- Before any task that uses an agent or subagent, explicitly state which agent will be used, its role, and the model.
- After the task finishes, explicitly restate which agent or subagents were actually used and the result delivered.
- If more than one subagent is used, show the division by responsibility and the summary from each one.
- The final response must also include the estimated token consumption for each agent or subagent used; if estimation is not possible from the available context and output, mark it as `estimado_indisponivel`.

Priority reading order:
1. `AI_BOOTLOADER.md`
2. `AGENT_RULES`
3. `START_HERE_AGENTS.md`
4. `agents.toml`
