// NewState/kernel/governor/integrity-critic.cjs

let Joi = null;
try { Joi = require('joi'); } catch (_) { /* Joi is optional — used for schema validation if available */ }
const VOW_I_SCHEMA = require('../ethics/vow_i_schema.cjs'); // Import the formal ethics schema
const VOW_II_SCHEMA = require('../ethics/vow_ii_schema.cjs'); // Self-modification ethics schema

/**
 * Custom error for ethical violations.
 * This will be thrown to "mathematically halt the vector branch".
 */
class EthicalViolationError extends Error {
    constructor(message, violations) {
        super(message);
        this.name = 'EthicalViolationError';
        this.violations = violations;
        Error.captureStackTrace(this, EthicalViolationError);
    }
}

/**
 * @class IntegrityCritic
 * @description Monitors agent actions and states for integrity violations,
 *              drift from desired baselines, and ethical compliance.
 *              Acts as a governor to maintain the agent's core Vows and integrity systems.
 */
class IntegrityCritic {
    constructor({ vows = [], ethical_schemas = [], includeVowII = true } = {}) {
        // Automatically include VOW I schema. VOW II (self-modification ethics) is
        // included by default for FVSMB integration but can be disabled for runtime
        // instances that don't need self-modification verification.
        const defaultEthicalSchemas = [VOW_I_SCHEMA];
        if (includeVowII) {
            defaultEthicalSchemas.push(VOW_II_SCHEMA);
        }
        this.ethicalSchemas = [...defaultEthicalSchemas, ...ethical_schemas];

        this.vows = this.ethicalSchemas.map(schema => ({
            vow_name: schema.vow_name,
            description: schema.description
        }));

        this.parsedEthicalSchemas = this._parseEthicalSchemas(this.ethicalSchemas);

        console.log('[IntegrityCritic] Initialized with Vows:', this.vows.map(v => v.vow_name));
    }

    /**
     * Internal method to parse and prepare ethical schemas.
     * Can be extended to compile formal logic, load external files, etc.
     * @param {Array} schemas
     * @returns {Object}
     */
    _parseEthicalSchemas(schemas) {
        const parsed = {};
        for (const schema of schemas) {
            if (typeof schema === 'object' && schema.vow_name) {
                parsed[schema.vow_name] = schema;
            }
        }
        return parsed;
    }

    /**
     * Evaluates a proposed action against ethical schemas and vows.
     * This is the core FVI (Formal Verification of Intent) mechanism.
     * If an invariant is violated, it throws an EthicalViolationError.
     * @param {Object} actionPayload - The proposed action or output from the agent.
     * @throws {EthicalViolationError} If any ethical invariant is violated.
     * @returns {Object} { passes: true, violations: [] } if all checks pass.
     */
    evaluateAction(actionPayload) {
        const violations = [];

        for (const vowName in this.parsedEthicalSchemas) {
            const schema = this.parsedEthicalSchemas[vowName];
            if (schema && Array.isArray(schema.invariants)) {
                for (const invariant of schema.invariants) {
                    if (typeof invariant.check === 'function') {
                        try {
                            const result = invariant.check(actionPayload);
                            if (!result.passes) {
                                violations.push({
                                    vow: vowName,
                                    invariant_id: invariant.id,
                                    description: invariant.description,
                                    reason: result.reason || 'Invariant check failed',
                                    action: actionPayload
                                });
                            }
                        } catch (error) {
                            console.error('[IntegrityCritic] Invariant check error:', error.message);
                            violations.push({
                                vow: vowName,
                                invariant_id: invariant.id,
                                description: invariant.description || 'Invariant check error',
                                reason: 'Invariant check threw an error',
                                action: actionPayload,
                                error: error.message
                            });
                        }
                    }
                }
            }
        }

        if (violations.length > 0) {
            const errorMessage = `Ethical violations detected: ${violations.map(v => v.invariant_id).join(', ')}`;
            throw new EthicalViolationError(errorMessage, violations);
        }
        return { passes: true, violations: [] };
    }

    /**
     * Assesses the "drift" of the current agent state from a desired baseline.
     * This method's logic remains as previously defined, as it is separate from real-time ethical enforcement.
     * @param {Object} currentState - The current internal state of the agent.
     * @param {Object} [compareBaseline] - An optional baseline state to compare against. If not provided, uses .
     * @returns {Object} { driftScore: number, report: String }
     */
    assessDrift(currentState, compareBaseline) { // baselineState property removed from constructor args
        // Implement complex state comparison logic here.
        // For now, a placeholder based on structural differences or key metrics.
        if (!compareBaseline || Object.keys(compareBaseline).length === 0) {
            return { driftScore: 0, report: 'No baseline defined for drift assessment.' };
        }

        let score = 0;
        let report = [];

        // Example: simple comparison of key counts/properties
        if (currentState.memorySize !== compareBaseline.memorySize) {
            score += Math.abs(currentState.memorySize - compareBaseline.memorySize);
            report.push(`Memory size drift: ${currentState.memorySize} vs ${compareBaseline.memorySize}`);
        }
        return { driftScore: score, report: report.join('\n') };
    }

    /**
     * FVSMB ENTRY POINT: Verify a self-modification blueprint against all ethical schemas.
     * This is called by the FVSMB engine's Gate 1. It evaluates the blueprint as an
     * actionPayload and halts on any ethical violation.
     *
     * @param {Object} blueprint - The formal self-modification blueprint
     * @returns {{ passes: boolean, violations: Array }}
     */
    verifySelfModification(blueprint) {
        const actionPayload = {
            type: 'self_modification_blueprint',
            blueprintId: blueprint.id,
            intent: blueprint.intent,
            reason: blueprint.reason,
            files: blueprint.files || [],
            deletes: blueprint.deletes || [],
            targets: blueprint.targets || [],
            structuralInvariants: blueprint.structuralInvariants || []
        };

        try {
            return this.evaluateAction(actionPayload);
        } catch (err) {
            if (err instanceof EthicalViolationError) {
                return {
                    passes: false,
                    violations: err.violations,
                    error: err.message
                };
            }
            throw err;
        }
    }

    /**
     * Recommends corrective actions based on a violation report.
     * In the context of FVI, this method might not be directly called after a throw,
     * but the information from the EthicalViolationError can be used for logging/recovery.
     * @param {Object} violationReport - The report (or array of violations) generated by evaluateAction.
     * @returns {Array<String>} A list of recommended corrective actions.
     */
    recommendCorrection(violations) {
        if (!violations || violations.length === 0) {
            return ['No violations detected, no correction needed.'];
        }

        const recommendations = [];
        for (const violation of violations) {
            recommendations.push(
                `[${violation.vow}] Invariant '${violation.invariant_id}' violated: ${violation.description}. ` +
                `Reason: ${violation.reason}. ` +
                `Recommendation: Review the blueprint to ensure compliance with this invariant.`
            );
        }
        return recommendations;
    }
}

module.exports = { IntegrityCritic, EthicalViolationError };
