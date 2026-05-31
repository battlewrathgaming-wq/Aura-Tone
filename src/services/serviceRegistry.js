const { checksumPayload } = require('../util/checksum');
const { APP_NAME } = require('../constants');
const { defaultTaskRunner, TASK_CLASSIFICATIONS } = require('./taskRunner');
const { taxonomyMessage } = require('./messageTaxonomy');
const { auraTempRoot, projectRoot } = require('../util/tempPaths');

class ServiceRegistry {
  constructor({ taskRunner = defaultTaskRunner } = {}) {
    this.commands = new Map();
    this.taskRunner = taskRunner;
  }

  register(command, definition) {
    if (!command || typeof command !== 'string') {
      throw new Error('Service command must be a non-empty string');
    }
    if (typeof definition?.handler !== 'function') {
      throw new Error(`Service command ${command} requires a handler`);
    }

    this.commands.set(command, {
      classification: definition.classification || TASK_CLASSIFICATIONS.READ_ONLY,
      description: definition.description || '',
      validate: definition.validate || null,
      handler: definition.handler
    });
    return this;
  }

  listCommands() {
    return Array.from(this.commands.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([command, definition]) => ({
        command,
        classification: definition.classification,
        description: definition.description
      }));
  }

  async invoke(command, payload = {}, context = {}) {
    const definition = this.commands.get(command);
    if (!definition) {
      const error = new Error(`Unknown service command: ${command}`);
      error.code = 'SERVICE_UNKNOWN_COMMAND';
      throw error;
    }

    const validation = validatePayload(definition, payload, context, command);
    if (!validation.valid) {
      throw validation.error;
    }

    if (context.asTask) {
      const taskDefinition = {
        type: command,
        classification: definition.classification,
        scopeKey: payload.scopeKey || command
      };
      const taskHandler = async (task) => {
        task.progress({ stage: 'start', message: `Running ${command}` });
        const data = await definition.handler(payload, { ...context, signal: task.signal, task });
        task.progress({ stage: 'finish', message: `Finished ${command}` });
        return normalizeServiceTaskResult(data);
      };
      if (context.detachedTask) {
        return this.taskRunner.runDetachedTask(taskDefinition, taskHandler);
      }
      return this.taskRunner.runTask(taskDefinition, taskHandler);
    }

    return definition.handler(payload, context);
  }
}

function createDefaultRegistry(options = {}) {
  const registry = new ServiceRegistry(options);
  registry
    .register('seed.health', {
      classification: TASK_CLASSIFICATIONS.READ_ONLY,
      description: 'Return seed runtime health and registered command count',
      handler: (_payload, context = {}) => ({
        ok: true,
        app: context.appName || APP_NAME,
        commands: registry.listCommands().length
      })
    })
    .register('seed.readiness', {
      classification: TASK_CLASSIFICATIONS.READ_ONLY,
      description: 'Return seed runtime readiness, path status, and diagnostics',
      handler: (_payload, context = {}) => buildSeedReadiness(registry, context)
    })
    .register('util.checksum', {
      classification: TASK_CLASSIFICATIONS.READ_ONLY,
      description: 'Return a stable checksum for a JSON-compatible payload',
      validate: (payload) => {
        if (!payload || typeof payload !== 'object' || !Object.hasOwn(payload, 'value')) {
          return 'util.checksum requires a value field';
        }
        return true;
      },
      handler: (payload) => ({
        checksum: checksumPayload(payload.value)
      })
    })
    .register('task.list', {
      classification: TASK_CLASSIFICATIONS.READ_ONLY,
      description: 'Return recent task history',
      handler: (payload) => registry.taskRunner.listTasks({ limit: payload?.limit || 20 })
    })
    .register('task.cancel', {
      classification: TASK_CLASSIFICATIONS.READ_ONLY,
      description: 'Request cancellation for a running task',
      handler: (payload) => registry.taskRunner.cancelTask(payload.task_id, payload.reason || 'User requested cancellation')
    });

  return registry;
}

function validatePayload(definition, payload, context, command) {
  if (typeof definition.validate !== 'function') {
    return { valid: true };
  }

  const result = definition.validate(payload, context);
  if (result === true || result === undefined || result === null) {
    return { valid: true };
  }

  const message = typeof result === 'string'
    ? result
    : result?.message || `Validation failed for ${command}`;
  const error = new Error(message);
  error.code = result?.code || 'VALIDATION_FAILED';
  error.taxonomy = taxonomyMessage(error.code, message, {
    source: 'service.registry',
    category: 'validation',
    severity: 'warning',
    actionable: true
  });
  return { valid: false, error };
}

function normalizeServiceTaskResult(result) {
  if (result && typeof result === 'object' && Object.hasOwn(result, 'status')) {
    return {
      status: result.status,
      data: Object.hasOwn(result, 'data') ? result.data : result
    };
  }
  return { status: 'succeeded', data: result };
}

function buildSeedReadiness(registry, context = {}) {
  const warnings = [];
  const root = projectRoot();
  let tempRoot = null;
  let tempReady = false;

  try {
    tempRoot = auraTempRoot();
    tempReady = true;
  } catch (error) {
    warnings.push(taxonomyMessage('RUNTIME_PATHS_INVALID', error.message, {
      source: 'seed.readiness'
    }));
  }

  return {
    ok: warnings.length === 0,
    app: {
      name: context.appName || APP_NAME,
      version: context.appVersion || null
    },
    paths: {
      project_root: root,
      temp_root: tempRoot,
      temp_ready: tempReady
    },
    services: {
      command_count: registry.listCommands().length
    },
    warnings
  };
}

function registerElectronServiceHandlers(ipcMain, registry, contextProvider = () => ({})) {
  if (!ipcMain?.handle) {
    throw new Error('registerElectronServiceHandlers requires ipcMain.handle');
  }
  if (!registry?.invoke || !registry?.listCommands) {
    throw new Error('registerElectronServiceHandlers requires a ServiceRegistry');
  }

  ipcMain.handle('aura:service:list', () => registry.listCommands());
  ipcMain.handle('aura:service:invoke', async (_event, request = {}) => registry.invoke(
    request.command,
    request.payload || {},
    {
      ...contextProvider(),
      asTask: request.asTask === true,
      detachedTask: request.detachedTask === true || request.background === true
    }
  ));
}

module.exports = {
  ServiceRegistry,
  createDefaultRegistry,
  registerElectronServiceHandlers,
  normalizeServiceTaskResult,
  validatePayload,
  buildSeedReadiness
};
