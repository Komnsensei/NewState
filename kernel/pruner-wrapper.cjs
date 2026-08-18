'use strict';

const { spawn } = require('child_process');
const path = require('path');

const PRUNER_SCRIPT = path.join(__dirname, '..', '..', 'closed_loop_graph_pruner.py');
const PRUNER_PATH = process.env.PRUNER_PYTHON_PATH || 'python'; // Allow configurable python path

/**
 * Executes the ClosedLoopGraphPruner Python script.
 * @param {object} inputData - Object containing weights, state_rho, and adj_matrix.
 * @returns {Promise<object>} - A promise that resolves with the pruned weights and telemetry.
 */
async function runPruner(inputData) {
  return new Promise((resolve, reject) => {
    const prunerProcess = spawn(PRUNER_PATH, [PRUNER_SCRIPT]);

    let stdoutData = '';
    let stderrData = '';

    prunerProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    prunerProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    prunerProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Pruner Wrapper] Python script exited with code ${code}. Stderr: ${stderrData}`);
        return reject(new Error(`Pruner script failed: ${stderrData || 'Unknown error'}`));
      }

      try {
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (jsonErr) {
        console.error(`[Pruner Wrapper] Failed to parse JSON from Python stdout. Stderr: ${stderrData}. Stdout: ${stdoutData}`);
        reject(new Error(`Failed to parse pruner output: ${jsonErr.message}`));
      }
    });

    prunerProcess.on('error', (err) => {
      console.error(`[Pruner Wrapper] Failed to start Python script: ${err.message}`);
      reject(new Error(`Failed to start pruner process: ${err.message}`));
    });

    // Send input data to the Python script's stdin
    prunerProcess.stdin.write(JSON.stringify(inputData));
    prunerProcess.stdin.end();
  });
}

module.exports = { runPruner };
