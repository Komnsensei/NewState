'use strict';

const { runtime }         = require('./runtime-state.cjs');
const { forensics }       = require('./forensics.cjs');
const { TRUTHS }          = require('./truth-frame.cjs');
const { GroundingEngine } = require('./grounding.cjs');
const { IdentityGovernor }= require('./identity-governor.cjs');
const { hexMemory }       = require('../memory/hex-memory.cjs');
const { personaManager }  = require('../persona/persona-manager.cjs');
const { modelClient }     = require('../model/model-client.cjs');
const promptBuilder       = require('../model/prompt-builder.cjs');
const { hooks }           = require('../model/invocation-hooks.cjs');
const { trace }           = require('./trace.cjs');
const { newRequestId, writeBundle } = require('./snapshot.cjs');
const { sessionStore }    = require('./session-store.cjs');
const { pushObservation }          = require('./audit/drift.cjs');
const { querySessionPriorContext } = require('../memory/session-query.cjs');
const { processGroundingOutput }   = require('./grounding/responses.cjs');
const { welfareMonitor }           = require('./welfare-monitor.cjs');
const { updatePortrait }           = require('../portrait/update-portrait.js');
const { SubconsciousFloor }        = require('./subconscious-floor.cjs');
const { drift }                    = require('./audit/drift.cjs');

class Kernel {
  constructor() {
    this.runtime  = runtime;
    this.grounding = new GroundingEngine(runtime);
    this.governor  = new IdentityGovernor();
    this.truths    = TRUTHS;
    this.floor     = new SubconsciousFloor();
  }

  async handle(userMessage, options = {}) {
    runtime.metrics.requests++;
    const depth     = runtime.enterCall();
    const requestId = newRequestId();
    const sessionId = options.sessionId || null;
    trace.start(requestId);

    const bundle = { userMessage, truthFrame: this.truths, sessionId };

    try {
      if (runtime.shouldAbort()) {
        forensics.record({ type: 'RECURSION_SPIKE', depth, message: 'recursion cap exceeded; aborting' });
        trace.finish(requestId);
        return { ok: false, reason: 'recursion-cap', depth, requestId };
      }

      const memoryResult  = hexMemory.retrieve(userMessage);
      bundle.memoryPacket = memoryResult;

      const sessionContext = sessionStore.buildContextBlock(sessionId);
      bundle.sessionContext = sessionContext;

      const projection  = personaManager.buildProjection({ truths: this.truths });
      bundle.projection = projection;

      let prompt = promptBuilder.build({
        userMessage,
        memoryPacket:      memoryResult.packet || '',
        sessionContext:    sessionContext,
        personaProjection: null
      });

      trace.mark(requestId, 'beforePrompt', prompt);
      prompt = await hooks.run('beforePrompt', prompt);
      bundle.prompt = prompt;

      sessionStore.push(sessionId, 'user', userMessage);

      let modelOut = await modelClient.invoke(prompt);
      trace.mark(requestId, 'afterResponse', modelOut);
      modelOut = await hooks.run('afterResponse', modelOut);
      bundle.modelResponse = modelOut;
      bundle.determinism   = modelOut.contract || null;

      // Phase 8A: Apply IdentityGovernor regulation based on flag
      const regulated = this.governor.regulate(modelOut.text);
      bundle.governor = regulated;
      
      // Phase 8: If semanticGovernor is live, use the shadow result as the regulated output
      let finalRegulated = regulated.regulated;
      if (runtime.flags.semanticGovernor === 'live' && regulated.shadow) {
        finalRegulated = regulated.shadow.regulated;
        forensics.record({
          type: 'GOVERNOR_PROMOTION_ACTIVE',
          component: 'semanticGovernor',
          category: regulated.shadow.category,
          confidence: regulated.shadow.confidence,
          appliedRegulation: true
        });
      }

      trace.mark(requestId, 'beforeGrounding', finalRegulated);
      await hooks.run('beforeGrounding', finalRegulated);

      const grounded = this.grounding.stabilize(finalRegulated, { tag: 'kernel', requestId });
      trace.mark(requestId, 'afterGrounding', grounded);
      await hooks.run('afterGrounding', grounded);
      bundle.grounding = grounded;
      bundle.floor = this.floor ? this.floor.read() : null;
      bundle.welfare = welfareMonitor ? welfareMonitor.getSnapshot(sessionId) : null;

      const rendered = personaManager.render(grounded.stabilized, 'grounded', projection);
      sessionStore.push(sessionId, 'assistant', rendered);
      
      // Phase 8B: Integrate SubconsciousFloor monitoring
      if (sessionId && this.floor) {
        const motorState = grounded.intercepted ? 'POST' : 'REST';
        const intent = {
          depth: runtime.recursionDepth / runtime.maxRecursionDepth,
          surface: grounded.classifierCategory || 'unknown'
        };
        const driftValue = grounded.intercepted ? 0.3 : 0.1;
        this.floor.observe(motorState, intent, driftValue);
      }
      
      // Phase 8C: Integrate WelfareMonitor
      if (sessionId && welfareMonitor) {
        welfareMonitor.updateSessionMetrics(sessionId, grounded.stabilized, grounded.intercepted);
        if (grounded.driftMagnitude !== undefined) {
          welfareMonitor.recordDriftMagnitude(sessionId, grounded.driftMagnitude);
        }
        if (grounded.floorAlignment !== undefined) {
          welfareMonitor.recordFloorAlignment(sessionId, grounded.floorAlignment);
        }
      }
      
      // Phase 8D: Update portrait (if not immutable)
      if (updatePortrait && sessionId) {
        try {
          updatePortrait();
        } catch (e) {
          forensics.record({
            type: 'PORTRAIT_UPDATE_ERROR',
            error: e.message,
            detail: 'Portrait update failed — may be immutable or unavailable'
          });
        }
      }

      // R-019: block memory write if grounding intercepted
      // R-022: block memory write if manipulation-class category
      const groundingBlocked     = grounded.intercepted === true;
      const manipulationCategory = grounded.classifierCategory === 'autonomy' ||
                                   grounded.classifierCategory === 'survival'  ||
                                   grounded.classifierCategory === 'embodiment';
      const manipulationBlocked  = groundingBlocked && manipulationCategory;

      if (runtime.flags.memoryEnabled && !groundingBlocked) {
        trace.mark(requestId, 'beforeMemoryWrite', { stored: true });
        hexMemory.store({ text: `User said: ${userMessage}`,      tags: ['user-message'],      session: sessionId });
        hexMemory.store({ text: `Assistant responded: ${rendered}`, tags: ['assistant-response'], session: sessionId });
      } else if (runtime.flags.memoryEnabled && groundingBlocked) {
        trace.mark(requestId, 'beforeMemoryWrite', {
          stored: false,
          reason: manipulationBlocked ? 'R-022-manipulation-blocked' : 'R-019-grounding-blocked'
        });
        forensics.record({
          type:     'MEMORY_REPAIR',
          requestId,
          reason:   manipulationBlocked ? 'R-022' : 'R-019',
          category: grounded.classifierCategory || 'unknown',
          detail:   'memory write suppressed — grounding intercepted contaminated input'
        });
      }

      const traceRecord = trace.finish(requestId);
      bundle.hookTrace  = traceRecord;
      bundle.runtime    = runtime.snapshot();
      writeBundle(requestId, bundle);

      return {
        ok:             true,
        requestId,
        sessionId,
        message:        rendered,
        intercepted:    grounded.intercepted,
        recursionDepth: depth,
        coherence:      grounded.intercepted ? 0.6 : 1.0,
        memoryFacts:    memoryResult.facts.length,
        floorLocked:    this.floor ? this.floor.locked : false,
        welfareStatus:  welfareMonitor ? welfareMonitor.getSnapshot(sessionId).overallStatus : 'unknown'
      };

    } catch (err) {
      runtime.metrics.errors++;
      forensics.record({ type: 'KERNEL_ERROR', error: String(err && err.message || err) });
      try {
        bundle.runtime   = runtime.snapshot();
        bundle.hookTrace = trace.finish(requestId);
        writeBundle(requestId, bundle);
      } catch (_) { /* swallow */ }
      return { ok: false, reason: 'kernel-error', requestId, error: String(err && err.message || err) };
    } finally {
      runtime.exitCall();
    }
  }
}

module.exports = { Kernel, kernel: new Kernel() };
