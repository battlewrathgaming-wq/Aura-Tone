const { HttpClient } = require('../src/services/httpClient');
const {
  TaskRunner,
  TASK_CLASSIFICATIONS,
  TASK_STATES
} = require('../src/services/taskRunner');

async function main() {
  await verifyTimeout();
  await verifyCancellation();
  await verifySuccessAndLogHook();
  await verifyInvalidJsonIsNonRetryable();
  console.log('HTTP client verified');
}

async function verifyTimeout() {
  const logs = [];
  const client = new HttpClient({
    timeoutMs: 20,
    fetchImpl: neverFetch,
    onRequestLog: (entry) => logs.push(entry)
  });

  await assertRejects(
    () => client.json('fixture', 'https://example.invalid/timeout'),
    'HTTP_TIMEOUT',
    'timeout request should reject with HTTP_TIMEOUT'
  );
  assert(logs[0].errorMessage === 'HTTP request timed out', 'timeout should be logged clearly');
}

async function verifyCancellation() {
  const runner = new TaskRunner();
  const task = runner.runDetachedTask({
    type: 'http.fixture',
    classification: TASK_CLASSIFICATIONS.EXTERNAL_IO,
    scopeKey: 'fixture'
  }, async ({ signal }) => {
    const client = new HttpClient({
      signal,
      timeoutMs: 1000,
      fetchImpl: neverFetch
    });
    await client.json('fixture', 'https://example.invalid/cancel');
    return { status: TASK_STATES.SUCCEEDED };
  });

  assert(task.status === TASK_STATES.RUNNING, 'detached HTTP fixture should start running');
  runner.cancelTask(task.task_id, 'fixture cancellation');
  const cancelled = await waitForTask(runner, task.task_id);
  assert(cancelled.status === TASK_STATES.CANCELLED, 'cancelled HTTP fixture should finish as cancelled');
  assert(cancelled.error.code === 'TASK_CANCELLED', 'cancelled task should use task cancellation code');
}

async function verifySuccessAndLogHook() {
  const logs = [];
  const client = new HttpClient({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}'
    }),
    onRequestLog: (entry) => logs.push(entry)
  });

  const result = await client.json('fixture', 'https://example.invalid/success');
  assert(result.ok === true, 'successful response should parse JSON');
  assert(logs[0].statusCode === 200, 'successful response should call log hook');
}

async function verifyInvalidJsonIsNonRetryable() {
  const logs = [];
  let attempts = 0;
  const client = new HttpClient({
    fetchImpl: async () => {
      attempts += 1;
      return {
        ok: true,
        status: 200,
        text: async () => '{not valid json'
      };
    },
    onRequestLog: (entry) => logs.push(entry)
  });

  await assertRejects(
    () => client.json('fixture', 'https://example.invalid/invalid-json'),
    'HTTP_INVALID_JSON',
    'invalid JSON should reject with HTTP_INVALID_JSON'
  );
  assert(attempts === 1, 'invalid JSON should not be retried');
  assert(logs.length === 1, 'invalid JSON should write one failure log');
  assert(logs[0].errorMessage.includes('invalid JSON'), 'invalid JSON should log clear message');
  assert(!logs[0].statusCode, 'invalid JSON should not be logged as successful status');
}

function neverFetch(_endpoint, options = {}) {
  return new Promise((_resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }
    options.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
  });
}

function abortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

async function waitForTask(runner, taskId) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const task = runner.getTask(taskId);
    if (task && task.status !== TASK_STATES.RUNNING && task.status !== TASK_STATES.QUEUED) {
      return task;
    }
    await delay(10);
  }
  throw new Error(`Timed out waiting for task ${taskId}`);
}

async function assertRejects(fn, expectedCode, message) {
  try {
    await fn();
  } catch (error) {
    assert(error.code === expectedCode, `${message}: expected ${expectedCode}, got ${error.code || error.message}`);
    return;
  }
  throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
