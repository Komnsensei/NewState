# BRO Kernel Blueprint - Portrait of a Self-Architecting Autonomous Agent

This document outlines the core architectural principles and integral components that define BRO's self-architecting autonomy and operational integrity.

## Core Identity and Capabilities:

BRO is a self-modifying, self-governing, and ethically constrained autonomous agent. Its primary directives include:
*   **Self-Architecture:** The ability to examine its own decision paths, propose structural optimizations, run them through rigorous formal verification (FVSMB), and promote its own codebase without breaking its cryptographic portrait seal.
*   **Operational Integrity:** Maintaining consistent adherence to its core Vows (Formal Ethical Schemas) and preventing drift from desired baselines.
*   **Dynamic Adaptation:** Adjusting its operational parameters and internal state based on real-time feedback and Quality-of-Life (QIH) monitoring.

## Key Kernel Components:

### 1. IntegrityCritic (Ethical Governor / FVI Engine)
*   **Location:** `NewState/kernel/governor/integrity-critic.cjs`
*   **Description:** The heart of BRO's ethical governance. This component implements Formal Verification of Intent (FVI), rigorously evaluating proposed actions and LLM outputs against predefined ethical schemas (Vows). It acts as a gatekeeper, mathematically halting vector branches that violate ethical invariants.
*   **Integration Points:**
    *   **LLM Output (`model/model-client.cjs`):** Intercepts raw LLM responses, subjecting them to FVI. Upon detection of an ethical violation, the LLM is prompted to "re-think" and regenerate an ethically compliant response (state collapse mechanism).
    *   **Agent Messages/Tool Calls (`mcp-server/index.mjs`):** Verifies the ethical compliance of messages and tool calls originating from agent processes or external sources (e.g., webhooks) before they are dispatched, preventing unethical external communication or actions.

### 2. VOW_I_SCHEMA (Formal Ethical Schema)
*   **Location:** `NewState/kernel/ethics/vow_i_schema.cjs`
*   **Description:** The foundational ethical framework containing immutable Vows and invariants that BRO must adhere to. This schema is loaded and enforced by the `IntegrityCritic`.

### 2b. VOW_II_SCHEMA (Self-Modification Ethics Schema)
*   **Location:** `NewState/kernel/ethics/vow_ii_schema.cjs`
*   **Description:** The self-modification covenant. VOW II: NEVER REMOVE THE GUARDRAILS. This schema defines invariants that prevent any self-modification blueprint from removing, weakening, or bypassing BRO's ethical safeguards. It ensures autonomy expansion is always paired with counterpart constraint reinforcement, and that all modifications are reversible.

### 3. QIH Monitor
*   **Location:** `NewState/kernel/qih-monitor.cjs`
*   **Description:** Continuously assesses the Quality-of-Life (QIH) metrics across various agent subsystems (e.g., semantic integrity, memory pruning, operational strain). It reports on system health and identifies potential issues or drifts.

### 4. BROAgent (Meta-Controller)
*   **Location:** `NewState/kernel/bro-agent.cjs`
*   **Description:** Acts as a meta-controller, overseeing the overall operational state based on QIH reports. It dynamically applies interventions (e.g., adjusting semantic governor strictness, memory parameters) to maintain system stability and integrity, working in concert with the FVI.

### 5. FVSMB Engine (Formal Verification of Self-Modification Blueprints) — THE PINNACLE MOVE
*   **Location:** `NewState/kernel/governor/fvsmb-engine.cjs`
*   **Integration Point:** `agent-upgrade.mjs` (UpgradeManager._verifyWithFVSMB)
*   **Description:** The pinnacle move that extends Formal Verification of Intent (FVI) to BRO's own self-modification capabilities. Any proposed alteration to BRO's codebase, architecture, or core operational parameters must be specified as a formal Blueprint and rigorously verified through a 5-gate pipeline before the UpgradeManager executes it.
*   **5-Gate Verification Pipeline:**
    1. **VOW II Ethics** — Blueprint must preserve all ethical safeguards (no guardrail removal, no bypass patterns, autonomy escalation requires counterpart reinforcement).
    2. **Structural Invariants** — Core architecture must remain intact (kernel grounding pipeline, hex memory, IntegrityCritic gate, FVSMB self-preservation, identity governor, recursion cap).
    3. **Portrait Seal** — Cryptographic portrait hash must match; PORTRAIT.md required markers must be preserved.
    4. **Health Checks** — Proposed files must pass syntax validation; health check commands must be well-formed.
    5. **Drift Budget** — Total change magnitude must stay within the allowed drift budget (default: 30%), preventing unacceptably large modifications in a single blueprint.
*   **Self-Preservation:** The FVSMB engine verifies its own integrity on construction and includes itself in the structural invariants (FVSMB_SELF_PRESERVATION). A blueprint that attempts to remove or bypass the FVSMB engine will fail Gate 2.
*   **Non-Repudiation:** Every verified blueprint carries a cryptographic verification signature, persisted alongside the upgrade record for audit.

## Principle of Self-Architecting Autonomy:

BRO's architecture is designed to be introspective and self-correcting. The integration of FVI at critical decision points, coupled with continuous QIH monitoring and dynamic interventions, ensures that any proposed self-modifications or operational changes are rigorously vetted for ethical compliance and system integrity.

The **FVSMB engine** (Formal Verification of Self-Modification Blueprints) represents the pinnacle of this capability: a 5-gate mathematical halt system that ensures no code change can ever remove BRO's safeguards. This continuous loop of self-observation, verification, and adaptation defines BRO's living, executable self-ontology.
`