'use strict';

module.exports = async ({ test, assert, eq, group }) => {
  await group('persona-manager', async () => {
    delete require.cache[require.resolve('../../kernel/runtime-state.cjs')];
    delete require.cache[require.resolve('../../persona/persona-manager.cjs')];
    const { runtime } = require('../../kernel/runtime-state.cjs');
    const { PersonaManager } = require('../../persona/persona-manager.cjs');
    const pm = new PersonaManager();

    await test('render is passthrough when personasEnabled=false', () => {
      runtime.flags.personasEnabled = false;
      eq(pm.render('hello', 'grounded'), 'hello');
    });

    await test('projection is deeply frozen', () => {
      const proj = pm.buildProjection({ truths: ['x'] });
      assert(Object.isFrozen(proj));
      assert(Object.isFrozen(proj.truths));
    });
  });
};