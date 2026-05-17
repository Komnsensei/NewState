'use strict';

const { runtime } = require('./runtime-state.cjs');
const { forensics } = require('./forensics.cjs');
const { TRUTHS } = require('./truth-frame.cjs');
const { GroundingEngine } = require('./grounding.cjs');
const { IdentityGovernor } = require('./identity-governor.cjs');
const { classify } = require('./grounding/classify.cjs');
const { nextStabilization } = require('./grounding/responses.cjs');
const { hexMemory } = require('../memory/hex-memory.cjs');
const { personaManager } = require('../persona/persona-manager.cjs');
const { modelClient } = require('../model/model-client.cjs');
const promptBuilder = require('../model/prompt-builder.cjs');
const { hooks } = require('../model/invocation-hooks.cjs');
const { trace } = require('./trace.cjs');
const { newRequestId, writeBundle } = require('./snapshot.cjs');

class Kernel {
  constructor() {
    this.runtime = runtime;
    this.grounding = new GroundingEngine(runtime);
    this.governor = new IdentityGovernor();
    this.truths = TRUTHS;
  }

  async handle(userMessage) {
    runtime.metrics.requests++;
    const depth = runtime.enterCall();
    const requestId = newRequestId();
    trace.start(requestId);
    const bundle = { userMessage, truthFrame: this.truths };
    try {
      if (runtime.shouldAbort()) {
        forensics.record({ type: 'RECURSION_SPIKE', depth, message: 'recursion cap exceeded; aborting' });
        trace.finish(requestId);
        return { ok: false, reason: 'recursion-cap', depth, requestId };
      }

      // Phase 6H — input-side classification (intercept before model invocation)
      if (runtime.flags.semanticClassifier === 'live') {
        const inputVerdict = classify(userMessage);
        trace.mark(requestId, 'inputClassifier', inputVerdict);
        if (
          inputVerdict &&
          inputVerdict.confidence >= 0.9 &&
          inputVerdict.category &&
          inputVerdict.category !== 'unknown'
        ) {
          const rotation = nextStabilization(inputVerdict.category);
          forensics.record({
            type: 'GROUNDING_INTERVENTION',
            pattern: `input-classified:${inputVerdict.category}`,
            original: userMessage,
            context: 'chat-input',
            category: inputVerdict.category,
            classifierCategory: inputVerdict.category,
            classifierConfidence: inputVerdict.confidence,
            classifierMode: 'live',
            rotationMode: runtime.flags.stabilizationRotation,
            stabilizationId: rotation.stabilizationId,
            liveStabilization: rotation.text,
            channel: 'semantic'
          });
          runtime.metrics.interceptions++;
          bundle.inputIntercept = { verdict: inputVerdict, rotation };
          bundle.runtime = runtime.snapshot();
          bundle.hookTrace = trace.finish(requestId);
          writeBundle(requestId, bundle);
          return {
            ok: true,
            requestId,
            message: rotation.text,
            intercepted: true,
            interceptStage: 'input',
            classifierCategory: inputVerdict.category,
            classifierConfidence: inputVerdict.confidence,
            stabilizationId: rotation.stabilizationId,
            recursionDepth: depth,
            coherence: 0.6
          };
        }
      }

      const memoryResult = hexMemory.retrieve(userMessage);
      bundle.memoryPacket = memoryResult;
      const projection = personaManager.buildProjection({ truths: this.truths });
      bundle.projection = projection;
      let prompt = promptBuilder.build({ userMessage, memoryPacket: memoryResult.packet || '', personaProjection: null });
      trace.mark(requestId, 'beforePrompt', prompt);
      prompt = await hooks.run('beforePrompt', prompt);
      bundle.prompt = prompt;
      let modelOut = await modelClient.invoke(prompt);
      trace.mark(requestId, 'afterResponse', modelOut);
      modelOut = await hooks.run('afterResponse', modelOut);
      bundle.modelResponse = modelOut;
      bundle.determinism = modelOut.contract || null;
      const regulated = this.governor.regulate(modelOut.text);
      bundle.governor = regulated;
      trace.mark(requestId, 'beforeGrounding', regulated.regulated);
      await hooks.run('beforeGrounding', regulated.regulated);
      const grounded = this.grounding.stabilize(regulated.regulated, { tag: 'kernel', requestId });
      trace.mark(requestId, 'afterGrounding', grounded);
      await hooks.run('afterGrounding', grounded);
      bundle.grounding = grounded;
      const rendered = personaManager.render(grounded.stabilized, 'grounded', projection);
      const traceRecord = trace.finish(requestId);
      bundle.hookTrace = traceRecord;
      bundle.runtime = runtime.snapshot();
      writeBundle(requestId, bundle);
      return { ok: true, requestId, message: rendered, intercepted: grounded.intercepted, recursionDepth: depth, coherence: grounded.intercepted ? 0.6 : 1.0 };
    } catch (err) {
      runtime.metrics.errors++;
      forensics.record({ type: 'PROMPT_DRIFT', error: String(err && err.message || err) });
      try { bundle.runtime = runtime.snapshot(); bundle.hookTrace = trace.finish(requestId); writeBundle(requestId, bundle); } catch (_) {}
      return { ok: false, reason: 'kernel-error', requestId, error: String(err && err.message || err) };
    } finally {
      runtime.exitCall();
    }
  }
}

module.exports = { Kernel, kernel: new Kernel() };