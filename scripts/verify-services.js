const {
  knownCodes,
  taxonomyMessage,
  validateTaxonomyMessage
} = require('../src/services/messageTaxonomy');
const {
  ServiceRegistry,
  createDefaultRegistry
} = require('../src/services/serviceRegistry');
const {
  TaskRunner,
  TASK_CLASSIFICATIONS,
  TASK_STATES
} = require('../src/services/taskRunner');

async function main() {
  verifyTaxonomy();
  await verifyTaskRunner();
  await verifyRegistry();
  console.log('services verified');
}

function verifyTaxonomy() {
  assert(knownCodes().includes('TASK_LOCKED'), 'taxonomy should include task lock code');
  assert(knownCodes().includes('HTTP_INVALID_JSON'), 'taxonomy should include invalid JSON code');
  const message = taxonomyMessage('partial_result', 'Fixture partial result', { source: 'verify' });
  assert(validateTaxonomyMessage(message), 'taxonomy message should validate');
  assert(message.code === 'PARTIAL_RESULT', 'taxonomy should normalize codes');
  assert(message.severity === 'info', 'partial result should be info severity');
}

async function verifyTaskRunner() {
  const runner = new TaskRunner({ historyLimit: 30 });

  const readOnly = await runner.runTask({
    type: 'summary.fixture',
    classification: TASK_CLASSIFICATIONS.READ_ONLY,
    scopeKey: 'same-scope'
  }, async ({ progress, warn }) => {
    progress({ stage: 'summary', message: 'building summary', current: 1, total: 2 });
    warn({ severity: 'info', code: 'PARTIAL_RESULT', message: 'fixture sample' });
    return { status: TASK_STATES.SUCCEEDED, data: { ok: true } };
  });
  assert(readOnly.status === TASK_STATES.SUCCEEDED, 'read-only task should succeed');
  assert(readOnly.progress.length === 1, 'progress event should be recorded');
  assert(readOnly.warnings[0].code === 'PARTIAL_RESULT', 'warning should be recorded');

  let releaseLocal;
  const firstLocal = runner.runTask({
    type: 'local.fixture',
    classification: TASK_CLASSIFICATIONS.LOCAL_MUTATION,
    scopeKey: 'artifact:1'
  }, () => new Promise((resolve) => {
    releaseLocal = () => resolve({ status: TASK_STATES.SUCCEEDED, data: { changed: 1 } });
  }));

  const lockedLocal = await runner.runTask({
    type: 'local.fixture',
    classification: TASK_CLASSIFICATIONS.LOCAL_MUTATION,
    scopeKey: 'artifact:1'
  }, async () => ({ status: TASK_STATES.SUCCEEDED }));
  assert(lockedLocal.status === TASK_STATES.FAILED, 'overlapping mutation task should fail');
  assert(lockedLocal.error.code === 'TASK_LOCKED', 'overlap should produce task lock error');

  releaseLocal();
  await firstLocal;

  let releaseExclusive;
  const exclusive = runner.runTask({
    type: 'exclusive.fixture',
    classification: TASK_CLASSIFICATIONS.EXCLUSIVE
  }, () => new Promise((resolve) => {
    releaseExclusive = () => resolve({ data: { ok: true } });
  }));

  const blocked = await runner.runTask({
    type: 'external.fixture',
    classification: TASK_CLASSIFICATIONS.EXTERNAL_IO,
    scopeKey: 'remote:1'
  }, async () => ({ data: { ok: true } }));
  assert(blocked.status === TASK_STATES.FAILED, 'exclusive task should block external IO');
  releaseExclusive();
  await exclusive;

  let releaseExternalMutation;
  const externalMutation = runner.runTask({
    type: 'external.mutation.fixture',
    classification: TASK_CLASSIFICATIONS.EXTERNAL_MUTATION,
    scopeKey: 'artifact:2'
  }, () => new Promise((resolve) => {
    releaseExternalMutation = () => resolve({ data: { changed: true } });
  }));

  const blockedLocalMutation = await runner.runTask({
    type: 'local.fixture',
    classification: TASK_CLASSIFICATIONS.LOCAL_MUTATION,
    scopeKey: 'artifact:2'
  }, async () => ({ data: { changed: true } }));
  assert(blockedLocalMutation.status === TASK_STATES.FAILED, 'external mutation should block local mutation on the same scope');
  releaseExternalMutation();
  await externalMutation;

  assert(runner.listTasks().length >= 4, 'task history should include recent tasks');
}

async function verifyRegistry() {
  const registry = createDefaultRegistry({
    taskRunner: new TaskRunner()
  });
  const commands = registry.listCommands();
  assert(commands.some((entry) => entry.command === 'seed.health'), 'default registry should include seed health');

  const health = await registry.invoke('seed.health', {}, { appName: 'Fixture App' });
  assert(health.ok === true, 'seed health should return ok');
  assert(health.app === 'Fixture App', 'seed health should use context app name');

  const readiness = await registry.invoke('seed.readiness', {}, { appName: 'Fixture App', appVersion: 'test' });
  assert(readiness.ok === true, 'seed readiness should return ok');
  assert(readiness.app.name === 'Fixture App', 'seed readiness should use context app name');
  assert(readiness.paths.project_root, 'seed readiness should include project root');
  assert(readiness.paths.temp_ready === true, 'seed readiness should confirm temp path readiness');

  const checksum = await registry.invoke('util.checksum', { value: { b: 2, a: 1 } });
  assert(typeof checksum.checksum === 'string' && checksum.checksum.length === 64, 'checksum command should return sha256');

  await assertRejects(
    () => registry.invoke('util.checksum', {}),
    'VALIDATION_FAILED',
    'checksum command should validate payload'
  );

  const taskWrapped = await registry.invoke('seed.health', {}, { asTask: true });
  assert(taskWrapped.status === TASK_STATES.SUCCEEDED, 'asTask registry call should return succeeded task');
  assert(taskWrapped.result.ok === true, 'asTask result should include command data');

  registry.register('fixture.partial', {
    classification: TASK_CLASSIFICATIONS.READ_ONLY,
    description: 'Return a partial task result',
    handler: () => ({ status: TASK_STATES.PARTIAL, data: { count: 1 } })
  });
  const partialTask = await registry.invoke('fixture.partial', {}, { asTask: true });
  assert(partialTask.status === TASK_STATES.PARTIAL, 'asTask registry call should preserve partial status');
  assert(partialTask.result.count === 1, 'partial task should preserve data payload');

  const custom = new ServiceRegistry();
  custom.register('fixture.echo', {
    description: 'Echo payload',
    handler: (payload) => payload
  });
  const echoed = await custom.invoke('fixture.echo', { ok: true });
  assert(echoed.ok === true, 'custom registry should invoke registered command');
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
