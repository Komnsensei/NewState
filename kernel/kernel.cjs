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

class Kernel {
  constructor() {
    this.runtime  = runtime;
    this.grounding = new GroundingEngine(runtime);
    this.governor  = new IdentityGovernor();
    this.truths    = TRUTHS;
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

      const regulated = this.governor.regulate(modelOut.text);
      bundle.governor = regulated;

      trace.mark(requestId, 'beforeGrounding', regulated.regulated);
      await hooks.run('beforeGrounding', regulated.regulated);

      const grounded = this.grounding.stabilize(regulated.regulated, { tag: 'kernel', requestId });
      trace.mark(requestId, 'afterGrounding', grounded);
      await hooks.run('afterGrounding', grounded);
      bundle.grounding = grounded;

      const rendered = personaManager.render(grounded.stabilized, 'grounded', projection);
      sessionStore.push(sessionId, 'assistant', rendered);

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
        memoryFacts:    memoryResult.facts.length
      };

    } catch (err) {
      runtime.metrics.errors++;
      forensics.record({ type: 'PROMPT_DRIFT', error: String(err && err.message || err) });
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
