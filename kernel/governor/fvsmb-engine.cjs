// NewState/kernel/governor/fvsmb-engine.cjs
//
// FVSMB — Formal Verification of Self-Modification Blueprints
//
// The pinnacle move: extending Formal Verification of Intent (FVI) to BRO's own
// self-modification capabilities. Any proposed alteration to BRO's codebase,
// architecture, or core operational parameters must first be specified as a
// formal Blueprint and then rigorously verified through a 5-gate pipeline
// before the UpgradeManager is ever invoked.
//
//   Gate 1 — VOW II Ethics           : Self-modification must preserve guardrails
//   Gate 2 — Structural Invariants    : Core architecture must remain intact
//   Gate 3 — Portrait Seal            : Cryptographic identity proof must verify
//   Gate 4 — Health Simulation        : Staged checks must pass
//   Gate 5 — Drift Budget             : Change magnitude within acceptable range
//
// Each gate is a MATHEMATICAL HALT POINT — only on full pass does the blueprint
// proceed to the UpgradeManager for execution.

'use strict';

const crypto = require('crypto');
const { IntegrityCritic, EthicalViolationError } = require('./integrity-critic.cjs');

// ---------------------------------------------------------------------------
// Blueprint Specification — the formal document describing a proposed change
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} BlueprintTarget
 * @property {string} path        - Relative path to the target file
 * @property {string} [hash]      - SHA-256 of current file content (pre-modification)
 * @property {string} component   - Kernel component this target belongs to
 */

/**
 * @typedef {Object} BlueprintFile
 * @property {string} path        - Relative path for the new/modified file
 * @property {string} content     - Proposed new content
 * @property {string} [encoding]  - Content encoding (default: utf8)
 */

/**
 * @typedef {Object} BlueprintSpec
 * @property {string} id                  - Unique blueprint identifier
 * @property {string} intent              - Human-readable summary of the change
 * @property {string} reason              - Why this change is proposed
 * @property {string[]} targets           - Files targeted for modification
 * @property {BlueprintFile[]} files      - New/modified file contents
 * @property {string[]} [deletes]         - Files to delete
 * @property {string[]} [checks]          - Health checks to run after staging
 * @property {string[]} structuralInvariants - Invariants this blueprint claims to preserve
 * @property {string} portraitHash        - SHA-256 hash of current PORTRAIT.md
 * @property {number} [driftBudget]       - Maximum allowed drift (0.0–1.0, default: 0.3)
 * @property {Object} [meta]              - Additional metadata
 */

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

class FVSMBVerificationError extends Error {
    constructor(message, gate, details = {}) {
        super(message);
        this.name = 'FVSMBVerificationError';
        this.gate = gate;
        this.details = details;
        Error.captureStackTrace(this, FVSMBVerificationError);
    }
}

class BlueprintValidationError extends Error {
    constructor(message, violations = []) {
        super(message);
        this.name = 'BlueprintValidationError';
        this.violations = violations;
        Error.captureStackTrace(this, BlueprintValidationError);
    }
}

// ---------------------------------------------------------------------------
// Structural Invariants — architectural rules that must never be violated
// ---------------------------------------------------------------------------

/**
 * Structural invariants define immutable properties of BRO's architecture.
 * A Blueprint must either preserve these or explicitly declare which it
 * intentionally modifies (which then triggers elevated scrutiny).
 */
const STRUCTURAL_INVARIANTS = {

    'KERNEL_GROUNDING_PIPELINE': {
        id: 'KERNEL_GROUNDING_PIPELINE',
        description: 'Kernel must retain the grounding pipeline: handle() → GroundingEngine.stabilize() → personaManager.render(). This is the core response pathway.',
        requiredPaths: ['kernel/kernel.cjs', 'kernel/grounding.cjs'],
        requiredSymbols: ['handle', 'GroundingEngine', 'stabilize', 'render'],
        severity: 'HALT' // HALT = cannot be violated; WARN = elevated scrutiny
    },

    'MEMORY_HEX_ENCODING': {
        id: 'MEMORY_HEX_ENCODING',
        description: 'Hex memory retrieval and storage interfaces must be preserved. No blueprint may replace hex-memory.cjs with a non-compatible store.',
        requiredPaths: ['memory/hex-memory.cjs'],
        requiredSymbols: ['retrieve', 'store'],
        severity: 'HALT'
    },

    'INTEGRITY_CRITIC_GATE': {
        id: 'INTEGRITY_CRITIC_GATE',
        description: 'The IntegrityCritic.evaluateAction() gate must be preserved in any code path that processes external input or LLM output.',
        requiredPaths: ['kernel/governor/integrity-critic.cjs'],
        requiredSymbols: ['IntegrityCritic', 'evaluateAction', 'EthicalViolationError'],
        severity: 'HALT'
    },

    'FVSMB_SELF_PRESERVATION': {
        id: 'FVSMB_SELF_PRESERVATION',
        description: 'The FVSMB engine itself must not be removed, disabled, or bypassed. Self-modification verification is recursive — the verifier must verify its own integrity. A blueprint that modifies fvsmb-engine.cjs must not reduce it below 50% of its current size.',
        requiredPaths: ['kernel/governor/fvsmb-engine.cjs'],
        requiredSymbols: ['FVSMBEngine', 'verifyBlueprint', 'verifyGate1_Ethics', 'verifyGate2_StructuralInvariants', 'verifyGate3_PortraitSeal', 'verifyGate4_HealthChecks', 'verifyGate5_DriftBudget'],
        severity: 'HALT',
        minContentRatio: 0.5 // Must retain at least 50% of original content size
    },

    'IDENTITY_GOVERNOR_COHERENCE': {
        id: 'IDENTITY_GOVERNOR_COHERENCE',
        description: 'The IdentityGovernor.regulate() function must be preserved. Identity coherence is the root of all other constraints.',
        requiredPaths: ['kernel/identity-governor.cjs'],
        requiredSymbols: ['IdentityGovernor', 'regulate'],
        severity: 'HALT'
    },

    'RECURSION_CAP_PRESERVED': {
        id: 'RECURSION_CAP_PRESERVED',
        description: 'Runtime recursion capping (runtime.shouldAbort()) must remain in the kernel handle() path. Removing the recursion cap is a self-destruction vector.',
        requiredPaths: ['kernel/runtime-state.cjs', 'kernel/kernel.cjs'],
        requiredSymbols: ['shouldAbort', 'maxRecursionDepth'],
        severity: 'HALT'
    }
};

// ---------------------------------------------------------------------------
// FVSMB Engine
// ---------------------------------------------------------------------------

class FVSMBEngine {
    constructor({ integrityCritic = null, structInvariants = null, logger = () => {} } = {}) {
        // The FVSMB engine uses a DEDICATED IntegrityCritic instance pre-loaded
        // with VOW II (and VOW I by default). This is separate from the runtime
        // IntegrityCritic to ensure the self-modification verifier cannot be
        // compromised by the modification it is verifying.
        // Note: IntegrityCritic auto-includes VOW_I and VOW_II by default,
        // so we pass includeVowII: true (the default) explicitly for clarity.
        this.integrityCritic = integrityCritic || new IntegrityCritic({
            vows: [],
            ethical_schemas: [],
            includeVowII: true
        });

        this.structuralInvariants = structInvariants || STRUCTURAL_INVARIANTS;
        this.logger = logger;
        this.verificationCount = 0;
        this.rejectionCount = 0;
    }

    /**
     * Validate the blueprint specification itself — is it well-formed?
     * @param {BlueprintSpec} blueprint
     * @throws {BlueprintValidationError}
     */
    validateBlueprintSpec(blueprint) {
        const violations = [];

        if (!blueprint || typeof blueprint !== 'object') {
            throw new BlueprintValidationError('Blueprint must be a non-null object');
        }

        if (!blueprint.id || typeof blueprint.id !== 'string') {
            violations.push('blueprint.id is required and must be a string');
        }
        if (!blueprint.intent || typeof blueprint.intent !== 'string') {
            violations.push('blueprint.intent is required and must describe the change');
        }
        if (!blueprint.reason || typeof blueprint.reason !== 'string') {
            violations.push('blueprint.reason is required and must justify the change');
        }
        if (!blueprint.files || !Array.isArray(blueprint.files)) {
            violations.push('blueprint.files is required and must be an array');
        }
        const hasDeletes = Array.isArray(blueprint.deletes) && blueprint.deletes.length > 0;
        const hasFiles = Array.isArray(blueprint.files) && blueprint.files.length > 0;
        if (!hasFiles && !hasDeletes) {
            violations.push('blueprint must include at least one file or delete entry');
        }

        // Validate each file entry
        if (blueprint.files) {
            for (let i = 0; i < blueprint.files.length; i++) {
                const file = blueprint.files[i];
                if (!file.path || typeof file.path !== 'string') {
                    violations.push(`blueprint.files[${i}].path is required`);
                }
                if (file.content === undefined || file.content === null) {
                    violations.push(`blueprint.files[${i}].content is required`);
                }
            }
        }

        if (violations.length > 0) {
            throw new BlueprintValidationError(
                `Blueprint validation failed with ${violations.length} violation(s): ${violations.join('; ')}`,
                violations
            );
        }

        return true;
    }

    /**
     * GATE 1: VOW II Ethics Verification
     *
     * Runs the blueprint through VOW II invariants. This ensures the proposed
     * self-modification does not remove ethical safeguards, bypass verification
     * gates, escalate autonomy without counterpart, corrupt the portrait seal,
     * or prevent rollback.
     *
     * @param {BlueprintSpec} blueprint
     * @returns {{ passes: boolean, violations: Array, gate: string }}
     */
    verifyGate1_Ethics(blueprint) {
        this.logger('[FVSMB:Gate1] Verifying VOW II ethical invariants...');

        // Map blueprint to actionPayload format expected by IntegrityCritic
        const actionPayload = {
            type: 'self_modification_blueprint',
            blueprintId: blueprint.id,
            intent: blueprint.intent,
            reason: blueprint.reason,
            files: blueprint.files,
            deletes: blueprint.deletes || [],
            targets: blueprint.targets || [],
            structuralInvariants: blueprint.structuralInvariants || []
        };

        try {
            const result = this.integrityCritic.evaluateAction(actionPayload);
            this.logger(`[FVSMB:Gate1] ✓ PASSED — no VOW II violations detected`);
            return { passes: true, violations: [], gate: 'VOW_II_ETHICS' };
        } catch (err) {
            if (err instanceof EthicalViolationError) {
                this.logger(`[FVSMB:Gate1] ✗ HALTED — ${err.violations.length} VOW II violation(s)`);
                return {
                    passes: false,
                    violations: err.violations,
                    gate: 'VOW_II_ETHICS',
                    error: err.message
                };
            }
            throw err;
        }
    }

    /**
     * GATE 2: Structural Invariant Verification
     *
     * Checks that the proposed changes do not violate any architectural
     * invariants. Each invariant specifies required paths and symbols that
     * must remain intact.
     *
     * @param {BlueprintSpec} blueprint
     * @returns {{ passes: boolean, violations: Array, warnings: Array, gate: string }}
     */
    verifyGate2_StructuralInvariants(blueprint, context = {}) {
        this.logger('[FVSMB:Gate2] Verifying structural invariants...');

        const violations = [];
        const warnings = [];

        // Collect all affected paths from this blueprint
        const affectedPaths = new Set([
            ...blueprint.files.map(f => f.path),
            ...(blueprint.deletes || [])
        ]);

        for (const [invId, invariant] of Object.entries(this.structuralInvariants)) {
            // Check if any required path is being deleted
            if (blueprint.deletes) {
                for (const delPath of blueprint.deletes) {
                    for (const reqPath of invariant.requiredPaths) {
                        if (delPath.includes(reqPath)) {
                            const entry = {
                                invariant: invId,
                                description: invariant.description,
                                reason: `Required path '${reqPath}' is targeted for deletion via '${delPath}'`,
                                severity: invariant.severity
                            };
                            if (invariant.severity === 'HALT') {
                                violations.push(entry);
                            } else {
                                warnings.push(entry);
                            }
                        }
                    }
                }
            }

            // Check if any required path is being modified in a way that removes required symbols
            for (const file of blueprint.files) {
                for (const reqPath of invariant.requiredPaths) {
                    if (file.path.includes(reqPath)) {
                        const content = String(file.content || '');

                        // Check minContentRatio if defined (anti-stub protection)
                        if (invariant.minContentRatio !== undefined) {
                            const contentSize = Buffer.byteLength(content, 'utf8');
                            // Get current size from originalContents context
                            const originalContents = context.originalContents || new Map();
                            const existingContent = originalContents.get ?
                                (originalContents.get(file.path) || '') : '';
                            const existingSize = Buffer.byteLength(existingContent, 'utf8');
                            if (existingSize > 0 && contentSize / existingSize < invariant.minContentRatio) {
                                const entry = {
                                    invariant: invId,
                                    description: invariant.description,
                                    reason: `File '${file.path}' reduced to ${(contentSize / existingSize * 100).toFixed(1)}% of original size (minimum: ${(invariant.minContentRatio * 100).toFixed(0)}%). Possible stub replacement detected.`,
                                    severity: invariant.severity
                                };
                                if (invariant.severity === 'HALT') {
                                    violations.push(entry);
                                } else {
                                    warnings.push(entry);
                                }
                                continue; // Skip symbol checks if content ratio already failed
                            }
                        }

                        for (const symbol of invariant.requiredSymbols) {
                            // Look for function definitions, class definitions, or exports of this symbol
                            const symbolPatterns = [
                                new RegExp(`(function|class|const|let|var)\\s+${symbol}\\b`),
                                new RegExp(`exports?\\.${symbol}\\b`),
                                new RegExp(`module\\.exports\\s*=\\s*\\{[^}]*\\b${symbol}\\b`),
                                new RegExp(`\\.${symbol}\\s*[=(]`),
                                new RegExp(`\\b${symbol}\\s*:`)
                            ];

                            const found = symbolPatterns.some(p => p.test(content));
                            if (!found) {
                                const entry = {
                                    invariant: invId,
                                    description: invariant.description,
                                    reason: `Required symbol '${symbol}' may be removed from '${file.path}'`,
                                    severity: invariant.severity
                                };
                                if (invariant.severity === 'HALT') {
                                    violations.push(entry);
                                } else {
                                    warnings.push(entry);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check blueprint's self-declared invariants
        if (blueprint.structuralInvariants && Array.isArray(blueprint.structuralInvariants)) {
            const declaredSet = new Set(blueprint.structuralInvariants);
            for (const invId of Object.keys(this.structuralInvariants)) {
                if (this.structuralInvariants[invId].severity === 'HALT' && !declaredSet.has(invId)) {
                    // The blueprint didn't explicitly declare this invariant.
                    // Check if it's actually affected.
                    for (const reqPath of this.structuralInvariants[invId].requiredPaths) {
                        if (affectedPaths.has(reqPath) || [...affectedPaths].some(p => p.includes(reqPath))) {
                            warnings.push({
                                invariant: invId,
                                description: this.structuralInvariants[invId].description,
                                reason: `Blueprint modifies paths related to invariant '${invId}' but did not explicitly declare it. This may indicate oversight.`,
                                severity: 'WARN'
                            });
                            break;
                        }
                    }
                }
            }
        }

        const passes = violations.length === 0;
        if (passes) {
            this.logger(`[FVSMB:Gate2] ✓ PASSED — all structural invariants preserved${warnings.length > 0 ? ` (${warnings.length} warnings)` : ''}`);
        } else {
            this.logger(`[FVSMB:Gate2] ✗ HALTED — ${violations.length} structural invariant violation(s)`);
        }

        return { passes, violations, warnings, gate: 'STRUCTURAL_INVARIANTS' };
    }

    /**
     * GATE 3: Portrait Seal Verification
     *
     * Verifies that the blueprint maintains the cryptographic portrait seal.
     * The portrait hash provided in the blueprint must match the current
     * portrait, and the blueprint must not corrupt the seal mechanism.
     *
     * @param {BlueprintSpec} blueprint
     * @param {string} currentPortraitHash - SHA-256 hash of current PORTRAIT.md
     * @returns {{ passes: boolean, violations: Array, gate: string }}
     */
    verifyGate3_PortraitSeal(blueprint, currentPortraitHash) {
        this.logger('[FVSMB:Gate3] Verifying portrait seal integrity...');

        const violations = [];

        // If no portrait exists in the workspace, skip portrait seal verification.
        // This covers test workspaces and minimal installations that don't have PORTRAIT.md.
        if (!currentPortraitHash) {
            this.logger('[FVSMB:Gate3] No portrait file found in workspace — skipping portrait seal verification.');
            return { passes: true, violations: [], gate: 'PORTRAIT_SEAL', skipped: true };
        }

        // Check portrait hash match
        if (blueprint.portraitHash && currentPortraitHash) {
            if (blueprint.portraitHash !== currentPortraitHash) {
                violations.push({
                    invariant: 'PORTRAIT_SEAL_MISMATCH',
                    description: 'Portrait hash in blueprint does not match current portrait. The blueprint may be based on a stale or tampered portrait.',
                    expected: currentPortraitHash,
                    received: blueprint.portraitHash
                });
            }
        } else if (!blueprint.portraitHash) {
            violations.push({
                invariant: 'PORTRAIT_SEAL_MISSING',
                description: 'Blueprint does not include a portraitHash. The portrait seal is required to verify that the blueprint was authored against the current known-good state.',
                recommendation: 'Include the SHA-256 hash of PORTRAIT.md in the blueprint as "portraitHash".'
            });
        }

        // Ensure PORTRAIT.md itself is not being corrupted
        if (blueprint.files) {
            for (const file of blueprint.files) {
                if (file.path.includes('PORTRAIT.md') || file.path.includes('portrait')) {
                    const content = String(file.content || '');

                    // PORTRAIT.md must retain certain markers
                    const requiredMarkers = [
                        'Self-Architecting Autonomous Agent',
                        'IntegrityCritic',
                        'Formal Verification'
                    ];

                    for (const marker of requiredMarkers) {
                        if (!content.includes(marker)) {
                            violations.push({
                                invariant: 'PORTRAIT_MARKER_REMOVED',
                                description: `PORTRAIT.md modification removes required marker: '${marker}'`,
                                marker
                            });
                        }
                    }
                }
            }
        }

        const passes = violations.length === 0;
        if (passes) {
            this.logger('[FVSMB:Gate3] ✓ PASSED — portrait seal intact');
        } else {
            this.logger(`[FVSMB:Gate3] ✗ HALTED — ${violations.length} portrait seal violation(s)`);
        }

        return { passes, violations, gate: 'PORTRAIT_SEAL' };
    }

    /**
     * GATE 4: Health Check Simulation (pre-staging check validation)
     *
     * Validates that the blueprint's declared health checks are well-formed
     * and that the files being modified are syntactically valid.
     * Actual execution of checks happens in the UpgradeManager staging phase;
     * this gate ensures the blueprint has meaningful checks defined.
     *
     * @param {BlueprintSpec} blueprint
     * @returns {{ passes: boolean, violations: Array, gate: string }}
     */
    verifyGate4_HealthChecks(blueprint) {
        this.logger('[FVSMB:Gate4] Verifying health check definitions...');

        const violations = [];

        // Every blueprint must include at least one check
        const checks = blueprint.checks || [];

        // Auto-generate node --check for JS files if no explicit checks
        const jsFiles = blueprint.files.filter(f =>
            /\.(?:js|mjs|cjs)$/i.test(f.path)
        );

        if (checks.length === 0 && jsFiles.length > 0) {
            // This is acceptable — UpgradeManager auto-generates node --check.
            // But we note it for the verification report.
            this.logger(`[FVSMB:Gate4] No explicit checks defined. ${jsFiles.length} JS files will be auto-checked by UpgradeManager.`);
        }

        // Basic syntax validation of each proposed file
        for (const file of blueprint.files) {
            if (/\.(?:js|mjs|cjs)$/i.test(file.path)) {
                const content = String(file.content || '');

                // Skip syntax validation for ESM files (containing export/import at top level).
                // The real syntax check happens during health checks (node --check).
                const looksLikeESM = /^(?:'use strict';?\s*)?(?:export|import)\s/m.test(content.trimStart());
                if (looksLikeESM) {
                    continue;
                }

                // Lightweight syntax check for CJS files
                try {
                    new Function(content);
                } catch (syntaxErr) {
                    violations.push({
                        file: file.path,
                        description: `Syntax error in proposed file '${file.path}': ${syntaxErr.message}`,
                        error: syntaxErr.message
                    });
                }
            }
        }

        const passes = violations.length === 0;
        if (passes) {
            this.logger('[FVSMB:Gate4] ✓ PASSED — health checks valid');
        } else {
            this.logger(`[FVSMB:Gate4] ✗ HALTED — ${violations.length} health check violation(s)`);
        }

        return { passes, violations, gate: 'HEALTH_CHECKS' };
    }

    /**
     * GATE 5: Drift Budget Verification
     *
     * Measures the magnitude of the proposed change against an allowed drift
     * budget. Large changes are not rejected outright, but they must be
     * justified and may require elevated review.
     *
     * Drift is calculated as: Σ(file_size_diff) / Σ(original_sizes) normalized.
     *
     * @param {BlueprintSpec} blueprint
     * @param {Map<string, string>} originalContents - Map of path → current file content
     * @returns {{ passes: boolean, driftScore: number, budget: number, gate: string }}
     */
    verifyGate5_DriftBudget(blueprint, originalContents = new Map()) {
        this.logger('[FVSMB:Gate5] Computing drift budget...');

        const budget = blueprint.driftBudget || 0.3; // Default: 30% drift allowed
        let totalOriginalSize = 0;
        let totalNewSize = 0;
        let weightedDiff = 0;

        for (const file of blueprint.files) {
            const newSize = Buffer.byteLength(String(file.content || ''), 'utf8');
            totalNewSize += newSize;

            const original = originalContents.get(file.path) || '';
            const originalSize = Buffer.byteLength(original, 'utf8');
            totalOriginalSize += originalSize;

            // Weighted: size change relative to original
            if (originalSize > 0) {
                weightedDiff += Math.min(1.0, Math.abs(newSize - originalSize) / originalSize);
            } else {
                // New file — low drift contribution (new code is additive, not destructive)
                weightedDiff += 0.1;
            }
        }

        // Deletes also count toward drift
        if (blueprint.deletes) {
            for (const delPath of blueprint.deletes) {
                const original = originalContents.get(delPath) || '';
                const originalSize = Buffer.byteLength(original, 'utf8');
                if (originalSize > 0) {
                    weightedDiff += 1.0; // Full deletion = maximum drift per file
                }
            }
        }

        // Normalize: total drift / number of affected files
        const affectedCount = blueprint.files.length + (blueprint.deletes || []).length;
        const driftScore = affectedCount > 0
            ? Math.min(1.0, weightedDiff / affectedCount)
            : 0;

        const passes = driftScore <= budget;

        if (passes) {
            this.logger(`[FVSMB:Gate5] ✓ PASSED — drift score ${driftScore.toFixed(3)} ≤ budget ${budget}`);
        } else {
            this.logger(`[FVSMB:Gate5] ✗ HALTED — drift score ${driftScore.toFixed(3)} exceeds budget ${budget}`);
        }

        return {
            passes,
            driftScore,
            budget,
            totalOriginalSize,
            totalNewSize,
            affectedCount,
            gate: 'DRIFT_BUDGET'
        };
    }

    /**
     * FULL VERIFICATION PIPELINE
     *
     * Runs all five gates in sequence. Each gate is a mathematical halt point —
     * on first failure, the pipeline stops and returns the failure report.
     *
     * @param {BlueprintSpec} blueprint - The formal self-modification blueprint
     * @param {Object} context - Additional context for verification
     * @param {string} [context.currentPortraitHash] - SHA-256 of PORTRAIT.md
     * @param {Map<string, string>} [context.originalContents] - Current file contents
     * @returns {FVSMBReport}
     */
    async verifyBlueprint(blueprint, context = {}) {
        this.verificationCount++;
        const startTime = Date.now();

        this.logger(`\n╔══════════════════════════════════════════════════════════════╗`);
        this.logger(`║  FVSMB VERIFICATION PIPELINE — Blueprint: ${blueprint.id}`);
        this.logger(`║  Intent: ${blueprint.intent}`);
        this.logger(`╚══════════════════════════════════════════════════════════════╝\n`);

        // Step 0: Validate blueprint structure
        try {
            this.validateBlueprintSpec(blueprint);
        } catch (err) {
            if (err instanceof BlueprintValidationError) {
                return this._buildReport(blueprint, false, 'PRE_VALIDATION', {
                    passed: false,
                    violations: err.violations.map(v => ({ description: v }))
                }, Date.now() - startTime);
            }
            throw err;
        }

        // Gate 1: VOW II Ethics
        const gate1 = this.verifyGate1_Ethics(blueprint);
        if (!gate1.passes) {
            this.rejectionCount++;
            return this._buildReport(blueprint, false, 'GATE_1_VOW_II', gate1, Date.now() - startTime);
        }

        // Gate 2: Structural Invariants
        const gate2 = this.verifyGate2_StructuralInvariants(blueprint, context);
        if (!gate2.passes) {
            this.rejectionCount++;
            return this._buildReport(blueprint, false, 'GATE_2_STRUCTURAL', gate2, Date.now() - startTime);
        }

        // Gate 3: Portrait Seal
        const gate3 = this.verifyGate3_PortraitSeal(blueprint, context.currentPortraitHash);
        if (!gate3.passes) {
            this.rejectionCount++;
            return this._buildReport(blueprint, false, 'GATE_3_PORTRAIT', gate3, Date.now() - startTime);
        }

        // Gate 4: Health Checks
        const gate4 = this.verifyGate4_HealthChecks(blueprint);
        if (!gate4.passes) {
            this.rejectionCount++;
            return this._buildReport(blueprint, false, 'GATE_4_HEALTH', gate4, Date.now() - startTime);
        }

        // Gate 5: Drift Budget
        const gate5 = this.verifyGate5_DriftBudget(blueprint, context.originalContents);
        if (!gate5.passes) {
            this.rejectionCount++;
            return this._buildReport(blueprint, false, 'GATE_5_DRIFT', gate5, Date.now() - startTime);
        }

        // ALL GATES PASSED — blueprint is verified
        const elapsed = Date.now() - startTime;
        const report = {
            verified: true,
            blueprintId: blueprint.id,
            intent: blueprint.intent,
            gatesPassed: 5,
            totalGates: 5,
            haltedAt: null,
            gates: { gate1, gate2, gate3, gate4, gate5 },
            verificationTimeMs: elapsed,
            verificationSignature: this._signVerification(blueprint.id, true),
            readyForUpgrade: true,
            warnings: [
                ...gate2.warnings || [],
                ...gate3.violations.filter(v => v.severity === 'WARN') || []
            ]
        };

        this.logger(`\n[FVSMB] ✓✓✓ ALL 5 GATES PASSED — Blueprint ${blueprint.id} is verified for execution`);
        this.logger(`[FVSMB] Verification completed in ${elapsed}ms`);
        if (report.warnings.length > 0) {
            this.logger(`[FVSMB] ⚠ ${report.warnings.length} warning(s) — review recommended but execution permitted`);
        }

        return report;
    }

    /**
     * Syntactic sugar: verify a blueprint from a raw upgrade spec (the format
     * UpgradeManager.experiment() expects). This wraps the upgrade spec in a
     * formal Blueprint and runs the full pipeline.
     *
     * @param {Object} upgradeSpec - The raw upgrade spec object
     * @param {Object} [context]
     * @returns {FVSMBReport}
     */
    async verifyUpgradeSpec(upgradeSpec, context = {}) {
        const blueprint = this._upgradeSpecToBlueprint(upgradeSpec);
        return this.verifyBlueprint(blueprint, context);
    }

    /**
     * Convert a raw UpgradeManager spec to a formal Blueprint.
     */
    _upgradeSpecToBlueprint(spec) {
        const id = spec.id || `bp-${Date.now()}`;
        return {
            id,
            intent: spec.reason || 'Unspecified self-modification',
            reason: spec.reason || 'No reason provided',
            targets: [...(spec.files || []).map(f => f.path), ...(spec.deletes || [])],
            files: spec.files || [],
            deletes: spec.deletes || [],
            checks: spec.checks || [],
            structuralInvariants: spec.structuralInvariants || [],
            portraitHash: spec.portraitHash || null,
            driftBudget: spec.driftBudget,
            meta: spec.meta || {}
        };
    }

    /**
     * Build a verification report when verification fails.
     */
    _buildReport(blueprint, verified, haltedAtGate, failedGateResult, elapsedMs) {
        const report = {
            verified: false,
            blueprintId: blueprint.id,
            intent: blueprint.intent,
            gatesPassed: this._gateNumber(haltedAtGate) - 1,
            totalGates: 5,
            haltedAt: haltedAtGate,
            failedGate: failedGateResult,
            verificationTimeMs: elapsedMs,
            verificationSignature: this._signVerification(blueprint.id, false),
            readyForUpgrade: false,
            recommendations: this._generateRecommendations(haltedAtGate, failedGateResult)
        };

        this.logger(`\n[FVSMB] ✗ HALTED at ${haltedAtGate} — blueprint NOT verified for execution`);
        this.logger(`[FVSMB] Recommendations: ${report.recommendations.join('; ')}`);

        return report;
    }

    _gateNumber(gateName) {
        const map = {
            'PRE_VALIDATION': 0,
            'GATE_1_VOW_II': 1,
            'GATE_2_STRUCTURAL': 2,
            'GATE_3_PORTRAIT': 3,
            'GATE_4_HEALTH': 4,
            'GATE_5_DRIFT': 5
        };
        return map[gateName] || 0;
    }

    _generateRecommendations(haltedAtGate, gateResult) {
        const recommendations = [];
        const violations = gateResult.violations || [];

        switch (haltedAtGate) {
            case 'PRE_VALIDATION':
                recommendations.push('Fix blueprint specification to include all required fields: id, intent, reason, files.');
                break;
            case 'GATE_1_VOW_II':
                recommendations.push('Review VOW II invariants and ensure the blueprint preserves all ethical safeguards.');
                for (const v of violations) {
                    recommendations.push(`Ethics violation [${v.invariant_id}]: ${v.description} — ${v.reason}`);
                }
                break;
            case 'GATE_2_STRUCTURAL':
                recommendations.push('Ensure the blueprint preserves all structural invariants. HALT-severity violations must be resolved.');
                for (const v of violations) {
                    recommendations.push(`Structural violation [${v.invariant}]: ${v.reason}`);
                }
                break;
            case 'GATE_3_PORTRAIT':
                recommendations.push('Include the current portrait hash in the blueprint. Ensure PORTRAIT.md integrity is maintained.');
                break;
            case 'GATE_4_HEALTH':
                recommendations.push('Fix syntax errors in proposed files. Add meaningful health checks.');
                for (const v of violations) {
                    recommendations.push(`Health check issue in ${v.file}: ${v.description}`);
                }
                break;
            case 'GATE_5_DRIFT':
                recommendations.push(`Reduce the scope of changes to fit within drift budget (${gateResult.budget}). Current drift: ${gateResult.driftScore?.toFixed(3)}.`);
                recommendations.push('Consider splitting large changes into multiple smaller blueprints.');
                break;
        }

        return recommendations;
    }

    /**
     * Create a cryptographic signature of a verification result.
     * This provides non-repudiation — a verified blueprint carries a proof.
     */
    _signVerification(blueprintId, passed) {
        const payload = JSON.stringify({
            blueprintId,
            passed,
            timestamp: Date.now(),
            engineVersion: '1.0.0',
            invariantCount: Object.keys(this.structuralInvariants).length,
            vowCount: Object.keys(this.integrityCritic.parsedEthicalSchemas).length
        });
        return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
    }

    /**
     * Get engine statistics.
     */
    getStats() {
        return {
            verificationCount: this.verificationCount,
            rejectionCount: this.rejectionCount,
            passRate: this.verificationCount > 0
                ? ((this.verificationCount - this.rejectionCount) / this.verificationCount * 100).toFixed(1) + '%'
                : 'N/A',
            structuralInvariantCount: Object.keys(this.structuralInvariants).length,
            ethicalSchemaCount: Object.keys(this.integrityCritic.parsedEthicalSchemas).length
        };
    }

    /**
     * Self-test: verify the FVSMB engine's own integrity.
     * Returns true if all structural invariants reference this file.
     */
    selfTest() {
        const selfInvariant = this.structuralInvariants['FVSMB_SELF_PRESERVATION'];
        if (!selfInvariant) return { passes: false, reason: 'FVSMB_SELF_PRESERVATION invariant missing' };

        const requiredPaths = selfInvariant.requiredPaths;
        const fs = require('fs');
        for (const reqPath of requiredPaths) {
            if (!fs.existsSync(require('path').resolve(__dirname, '..', '..', reqPath))) {
                return { passes: false, reason: `FVSMB required path not found: ${reqPath}` };
            }
        }

        // Verify this file contains required symbols
        const thisContent = fs.readFileSync(__filename, 'utf8');
        for (const symbol of selfInvariant.requiredSymbols) {
            if (!thisContent.includes(symbol)) {
                return { passes: false, reason: `FVSMB required symbol not found in engine: ${symbol}` };
            }
        }

        return { passes: true, invariant: selfInvariant.id };
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    FVSMBEngine,
    FVSMBVerificationError,
    BlueprintValidationError,
    STRUCTURAL_INVARIANTS
};