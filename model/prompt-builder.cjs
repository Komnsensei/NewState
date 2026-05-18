'use strict';

const { asPreamble } = require('../kernel/truth-frame.cjs');

function build({ userMessage, memoryPacket = '', sessionContext = '', personaProjection = null }) {
  const parts = [];
  parts.push(asPreamble());

  if (sessionContext && sessionContext.length) {
    parts.push(sessionContext);
  }

  if (memoryPacket && memoryPacket.length) {
    parts.push('[MEMORY CONTEXT]');
    parts.push(memoryPacket);
  }

  if (personaProjection) {
    parts.push('[PERSONA PROJECTION]');
    parts.push(JSON.stringify(personaProjection));
  }

  parts.push('[USER MESSAGE]');
  parts.push(userMessage);
  return parts.join('\n\n');
}

module.exports = { build };
