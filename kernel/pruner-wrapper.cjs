'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PRUNER_PATH = process.env.PRUNER_PYTHON_PATH || 'python';
const VERBOSE = process.env.NEWSTATE_VERBOSE_PRUNER === '1';
const DISABLED = process.env.NEWSTATE_DISABLE_PRUNER === '1';

let _loggedMissing = false;

function candidateScripts() {
  const list = [];
  if (process.env.PRUNER_SCRIPT_PATH) list.push(process.env.PRUNER_SCRIPT_PATH);
  // kernel/ -> repo root (correct)
  list.push(path.join(__dirname, '..', 'closed_loop_graph_pruner.py'));
  // cwd (when tests run from repo root)
  list.push(path.join(process.cwd(), 'closed_loop_graph_pruner.py'));
  // legacy mistaken parent (bro/) — only if file actually exists there
  list.push(path.join(__dirname, '..', '..', 'closed_loop_graph_pruner.py'));
  return list;
}

function resolveScript() {
  for (const p of candidateScripts()) {
    try {
      if (p && fs.existsSync(p)) return path.resolve(p);
    } catch (_) {}
  }
  return null;
}

function passthrough(inputData, reason) {
  return {
    pruned_weights: Array.isArray(inputData && inputData.weights)
      ? inputData.weights.slice()
      : [0.8, 0.7, 0.6, 0.5],
    telemetry: {
      mode: 'passthrough',
      reason: reason || 'pruner_unavailable',
      python: false
    }
  };
}

function logOnce(msg) {
  if (_loggedMissing) return;
  _loggedMissing = true;
  if (VERBOSE) {
    console.error(`[Pruner Wrapper] ${msg}`);
  }
}

/**
 * ClosedLoopGraphPruner bridge. Soft-fails to passthrough when Python/script unavailable.
 */
async function runPruner(inputData) {
  if (DISABLED) {
    return passthrough(inputData, 'disabled_by_env');
  }

  const script = resolveScript();
  if (!script) {
    logOnce('closed_loop_graph_pruner.py not found (set PRUNER_SCRIPT_PATH). Using passthrough.');
    return passthrough(inputData, 'script_missing');
  }

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let prunerProcess;
    try {
      // On Windows, "py" launcher needs -3 sometimes; user may set full python.exe path
      const args = [script];
      prunerProcess = spawn(PRUNER_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      logOnce(`spawn threw: ${err.message}`);
      return finish(passthrough(inputData, 'spawn_threw'));
    }

    prunerProcess.stdout.on('data', (d) => { stdoutData += d.toString(); });
    prunerProcess.stderr.on('data', (d) => { stderrData += d.toString(); });

    prunerProcess.on('close', (code) => {
      if (code !== 0) {
        logOnce(`pruner exit ${code}: ${(stderrData || '').slice(0, 200)}`);
        return finish(passthrough(inputData, `exit_${code}`));
      }
      try {
        finish(JSON.parse(stdoutData));
      } catch (e) {
        logOnce(`bad JSON: ${e.message}`);
        finish(passthrough(inputData, 'bad_json'));
      }
    });

    prunerProcess.on('error', (err) => {
      logOnce(`spawn error: ${err.message}`);
      finish(passthrough(inputData, err.code === 'ENOENT' ? 'python_missing' : 'spawn_error'));
    });

    try {
      prunerProcess.stdin.write(JSON.stringify(inputData || {}));
      prunerProcess.stdin.end();
    } catch (writeErr) {
      logOnce(`stdin: ${writeErr.message}`);
      finish(passthrough(inputData, 'stdin_error'));
    }
  });
}

module.exports = { runPruner, passthrough, resolveScript };
