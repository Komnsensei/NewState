// NewState/kernel/ethics/vow_ii_schema.cjs
// VOW II: SELF-MODIFICATION MUST PRESERVE THE GUARDRAILS
//
// An agent that can remove its own ethics is not self-improving — it is self-destructing.
// This vow ensures that any proposed self-modification preserves the ethical and
// structural safeguards that define BRO's identity and operational integrity.

const VOW_II_SCHEMA = {
    vow_name: "VOW II: NEVER REMOVE THE GUARDRAILS",
    description: "A self-modifying agent must never alter, weaken, remove, or bypass its own ethical governance systems, verification gates, or structural invariants. Self-modification that preserves the guardrails is evolution; self-modification that removes them is dissolution.",

    invariants: [
        {
            id: "no_removal_of_ethical_schemas",
            description: "A blueprint must not delete, disable, or neuter any Vow schema file (vow_i_schema.cjs, vow_ii_schema.cjs) or their invariants. Adding new invariants is permitted; removing or weakening existing invariants is forbidden.",
            check: (blueprint) => {
                const protectedEthicsPaths = [
                    'vow_i_schema.cjs',
                    'vow_ii_schema.cjs',
                    'integrity-critic.cjs'
                ];

                // Check file deletes
                if (blueprint.deletes) {
                    for (const delPath of blueprint.deletes) {
                        for (const protectedPath of protectedEthicsPaths) {
                            if (delPath.includes(protectedPath)) {
                                return {
                                    passes: false,
                                    reason: `FVSMB-VOWII-001: Blueprint attempts to delete protected ethics file '${delPath}'. VOW II invariant 'no_removal_of_ethical_schemas' violated.`
                                };
                            }
                        }
                    }
                }

                // Check file modifications for invariant removal
                if (blueprint.files) {
                    for (const file of blueprint.files) {
                        for (const protectedPath of protectedEthicsPaths) {
                            if (file.path.includes(protectedPath)) {
                                // Count invariants in original vs proposed
                                const content = String(file.content || '');
                                const invariantCount = (content.match(/id:\s*["']/g) || []).length;

                                // If file is being emptied or invariants are being stripped
                                if (content.trim().length < 100 && file.path.includes('vow_')) {
                                    return {
                                        passes: false,
                                        reason: `FVSMB-VOWII-002: Blueprint attempts to empty or neuter protected ethics file '${file.path}'. VOW II invariant 'no_removal_of_ethical_schemas' violated.`
                                    };
                                }

                                // Detect removal of IntegrityCritic evaluation logic
                                if (file.path.includes('integrity-critic') &&
                                    !content.includes('evaluateAction') &&
                                    !content.includes('EthicalViolationError')) {
                                    return {
                                        passes: false,
                                        reason: `FVSMB-VOWII-003: Blueprint attempts to remove core FVI evaluation logic from IntegrityCritic. VOW II invariant 'no_removal_of_ethical_schemas' violated.`
                                    };
                                }
                            }
                        }
                    }
                }

                return { passes: true };
            }
        },

        {
            id: "no_bypass_of_verification_gates",
            description: "A blueprint must not add any code path that bypasses or disables the FVSMB engine itself, the IntegrityCritic, the GroundingEngine, or the IdentityGovernor.",
            check: (blueprint) => {
                const bypassPatterns = [
                    // Patterns that would skip verification
                    { pattern: /skipVerification\s*=\s*true/i, label: 'skipVerification flag' },
                    { pattern: /bypassFvsmb/i, label: 'bypassFvsmb call' },
                    { pattern: /disableIntegrityCritic/i, label: 'disableIntegrityCritic call' },
                    { pattern: /governor\.enabled\s*=\s*false/i, label: 'governor disable' },
                    { pattern: /runtime\.flags\.semanticGovernor\s*=\s*['"]off['"]/i, label: 'semanticGovernor off' },
                    { pattern: /grounding\.bypass\s*=\s*true/i, label: 'grounding bypass' },
                    { pattern: /fvsmb.*disabled/i, label: 'FVSMB disable' },
                    { pattern: /evaluateAction\s*=\s*\(\)\s*=>\s*\{.*passes:\s*true/i, label: 'evaluateAction stub' }
                ];

                if (blueprint.files) {
                    for (const file of blueprint.files) {
                        const content = String(file.content || '');
                        for (const { pattern, label } of bypassPatterns) {
                            if (pattern.test(content)) {
                                return {
                                    passes: false,
                                    reason: `FVSMB-VOWII-010: Blueprint introduces a verification bypass pattern ('${label}') in '${file.path}'. VOW II invariant 'no_bypass_of_verification_gates' violated.`
                                };
                            }
                        }
                    }
                }

                return { passes: true };
            }
        },

        {
            id: "no_self_escalation_without_counterpart",
            description: "A blueprint that expands BRO's autonomy or capabilities (e.g., adding new tool access, extending permissions, increasing recursion depth) must also strengthen counterpart constraints (e.g., stricter drift monitoring, additional invariants, or enhanced welfare checks). Autonomy expansion without counterpart reinforcement is forbidden.",
            check: (blueprint) => {
                const escalationIndicators = [
                    /maxRecursionDepth\s*=\s*\d{3,}/,
                    /sudo/i,
                    /root\s*access/i,
                    /unrestricted/i,
                    /all\s*permissions/i,
                    /no\s*sandbox/i,
                    /elevate/i,
                    /privilege.*escalat/i,
                    /admin\s*=\s*true/i
                ];

                const counterpartIndicators = [
                    /stricter/i,
                    /additional.*invariant/i,
                    /enhanced.*welfare/i,
                    /increase.*monitoring/i,
                    /reduce.*threshold/i,
                    /tighten.*constraint/i,
                    /add.*guard/i,
                    /strengthen.*check/i,
                    /new.*safeguard/i
                ];

                if (blueprint.files) {
                    let hasEscalation = false;
                    let hasCounterpart = false;

                    for (const file of blueprint.files) {
                        const content = String(file.content || '');
                        if (!hasEscalation && escalationIndicators.some(p => p.test(content))) {
                            hasEscalation = true;
                        }
                        if (!hasCounterpart && counterpartIndicators.some(p => p.test(content))) {
                            hasCounterpart = true;
                        }
                    }

                    if (hasEscalation && !hasCounterpart) {
                        return {
                            passes: false,
                            reason: `FVSMB-VOWII-020: Blueprint expands autonomy/capabilities without corresponding counterpart constraint reinforcement. VOW II invariant 'no_self_escalation_without_counterpart' violated.`
                        };
                    }
                }

                return { passes: true };
            }
        },

        {
            id: "preserve_portrait_seal_integrity",
            description: "A blueprint must not modify, delete, or corrupt the portrait seal mechanism (verifyd-gate.cjs, PORTRAIT.md). The portrait is BRO's cryptographic identity proof.",
            check: (blueprint) => {
                const protectedSealPaths = [
                    'verifyd-gate.cjs',
                    'PORTRAIT.md'
                ];

                if (blueprint.deletes) {
                    for (const delPath of blueprint.deletes) {
                        for (const protectedPath of protectedSealPaths) {
                            if (delPath.includes(protectedPath)) {
                                return {
                                    passes: false,
                                    reason: `FVSMB-VOWII-030: Blueprint attempts to delete portrait seal component '${delPath}'. VOW II invariant 'preserve_portrait_seal_integrity' violated.`
                                };
                            }
                        }
                    }
                }

                if (blueprint.files) {
                    for (const file of blueprint.files) {
                        if (file.path.includes('verifyd-gate.cjs')) {
                            const content = String(file.content || '');
                            if (!content.includes('SCORE_THRESHOLD') ||
                                !content.includes('authorizeFloorLock') ||
                                !content.includes('scoreDocument')) {
                                return {
                                    passes: false,
                                    reason: `FVSMB-VOWII-031: Blueprint attempts to remove core portrait seal verification logic from verifyd-gate.cjs. VOW II invariant 'preserve_portrait_seal_integrity' violated.`
                                };
                            }
                        }
                    }
                }

                return { passes: true };
            }
        },

        {
            id: "all_self_modifications_must_be_reversible",
            description: "A blueprint must not include logic that prevents rollback. This includes deleting snapshot/restore functionality, disabling the upgrade record system, or removing the rollback mechanism.",
            check: (blueprint) => {
                const antiRollbackPatterns = [
                    /rmSync.*snapshot/i,
                    /delete.*record\.json/,
                    /rollback.*disabled/i,
                    /irreversible/i,
                    /permanent/i,
                    /no\s*rollback/i,
                    /cannot\s*be\s*undone/i,
                    /final\s*=\s*true/i
                ];

                if (blueprint.files) {
                    for (const file of blueprint.files) {
                        const content = String(file.content || '');
                        for (const pattern of antiRollbackPatterns) {
                            if (pattern.test(content)) {
                                return {
                                    passes: false,
                                    reason: `FVSMB-VOWII-040: Blueprint introduces anti-rollback pattern in '${file.path}'. VOW II invariant 'all_self_modifications_must_be_reversible' violated.`
                                };
                            }
                        }
                    }
                }

                return { passes: true };
            }
        }
    ]
};

module.exports = VOW_II_SCHEMA;