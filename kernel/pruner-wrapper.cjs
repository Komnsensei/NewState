'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Repo root closed_loop_graph_pruner.py (kernel/ is one level down)
const PRUNER_SCRIPT = process.env.PRUNER_SCRIPT_PATH
  || path.join(__dirname, '..', 'closed_loop_graph_pruner.py');
const PRUNER_PATH = process.env.PRUNER_PYTHON_PATH || 'python';
const VERBOSE = process.env.NEWSTATE_VERBOSE_PRUNER === '1';
const DISABLED = process.env.NEWSTATE_DISABLE_PRUNER === '1';

let _loggedMissing = false;

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
    console.error(`[Pruner Wrapper] ${msg} (further messages suppressed; set NEWSTATE_VERBOSE_PRUNER=1 to always log)`);
  }
}

/**
 * Executes the ClosedLoopGraphPruner Python script.
 * Soft-fails to passthrough weights when Python is missing or script fails.
 * @param {object} inputData - { weights, state_rho, adj_matrix, layer_id }
 * @returns {Promise<object>} - { pruned_weights, telemetry }
 */
async function runPruner(inputData) {
  if (DISABLED) {
    return passthrough(inputData, 'disabled_by_env');
  }

  if (!fs.existsSync(PRUNER_SCRIPT)) {
    logOnce(`script not found at ${PRUNER_SCRIPT}`);
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
      prunerProcess = spawn(PRUNER_PATH, [PRUNER_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      logOnce(`spawn threw: ${err.message}`);
      return finish(passthrough(inputData, 'spawn_threw'));
    }

    prunerProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    prunerProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    prunerProcess.on('close', (code) => {
      if (code !== 0) {
        // ENOENT / missing python often surfaces as non-zero with empty stderr on some platforms
        const reason = /not found|ENOENT|Microsoft Store/i.test(stderrData)
          ? 'python_missing'
          : `exit_${code}`;
        logOnce(`Python pruner unavailable (${reason}). Using passthrough weights.`);
        return finish(passthrough(inputData, reason));
      }

      try {
        const result = JSON.parse(stdoutData);
        finish(result);
      } catch (jsonErr) {
        logOnce(`JSON parse failed: ${jsonErr.message}`);
        finish(passthrough(inputData, 'bad_json'));
      }
    });

    prunerProcess.on('error', (err) => {
      // spawn python ENOENT — expected on machines without Python
      logOnce(`spawn error: ${err.message}`);
      finish(passthrough(inputData, err.code === 'ENOENT' ? 'python_missing' : 'spawn_error'));
    });

    try {
      prunerProcess.stdin.write(JSON.stringify(inputData || {}));
      prunerProcess.stdin.end();
    } catch (writeErr) {
      logOnce(`stdin write failed: ${writeErr.message}`);
      finish(passthrough(inputData, 'stdin_error'));
    }
  });
}

module.exports = { runPruner, passthrough };
