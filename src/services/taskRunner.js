const { normalizeMessage, taxonomyMessage } = require('./messageTaxonomy');

const TASK_STATES = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PARTIAL: 'partial',
  CAPPED: 'capped'
});

const TASK_CLASSIFICATIONS = Object.freeze({
  READ_ONLY: 'read-only',
  LOCAL_MUTATION: 'local-mutation',
  EXTERNAL_IO: 'external-io',
  EXTERNAL_MUTATION: 'external-mutation',
  DESTRUCTIVE: 'destructive',
  EXCLUSIVE: 'exclusive'
});

class TaskRunner {
  constructor({ historyLimit = 100 } = {}) {
    this.historyLimit = historyLimit;
    this.tasks = new Map();
    this.activeLocks = new Map();
    this.abortControllers = new Map();
  }

  async runTask(definition, handler) {
    if (typeof handler !== 'function') {
      throw new Error('runTask requires a handler function');
    }

    const { task, lockKeys, locked } = this.prepareTask(definition);
    if (!locked) {
      return task;
    }

    return this.executeTask(task, lockKeys, handler);
  }

  runDetachedTask(definition, handler) {
    if (typeof handler !== 'function') {
      throw new Error('runDetachedTask requires a handler function');
    }

    const { task, lockKeys, locked } = this.prepareTask(definition);
    if (!locked) {
      return task;
    }

    setImmediate(() => {
      this.executeTask(task, lockKeys, handler).catch(() => {
        // executeTask records failure state; this catch prevents an unhandled rejection.
      });
    });

    return this.getTask(task.task_id);
  }

  prepareTask(definition = {}) {
    const task = this.createTask(definition);
    this.tasks.set(task.task_id, task);
    this.pruneHistory();

    const lockKeys = lockKeysFor(task);
    const conflict = lockConflictFor(lockKeys, this.activeLocks);
    if (conflict) {
      task.status = TASK_STATES.FAILED;
      task.finished_at = nowIso();
      task.error = {
        ...taxonomyMessage('TASK_LOCKED', `Task lock is already active for ${conflict}`, { source: 'task.runner' })
      };
      return { task, lockKeys: [], locked: false };
    }

    for (const lockKey of lockKeys) {
      this.activeLocks.set(lockKey, task.task_id);
    }

    const abortController = new AbortController();
    this.abortControllers.set(task.task_id, abortController);

    this.updateTask(task.task_id, {
      status: TASK_STATES.RUNNING,
      started_at: nowIso()
    });

    return { task: this.getTask(task.task_id), lockKeys, locked: true };
  }

  async executeTask(task, lockKeys, handler) {
    try {
      const abortController = this.abortControllers.get(task.task_id);
      const context = {
        task_id: task.task_id,
        signal: abortController?.signal || null,
        progress: (event) => this.addProgress(task.task_id, event),
        warn: (warning) => this.addWarning(task.task_id, warning)
      };
      const result = await handler(context);
      const finalStatus = normalizeFinalStatus(result?.status) || TASK_STATES.SUCCEEDED;
      this.updateTask(task.task_id, {
        status: finalStatus,
        result: result?.data !== undefined ? result.data : result,
        finished_at: nowIso()
      });
      return this.getTask(task.task_id);
    } catch (error) {
      if (isCancelledError(error)) {
        this.updateTask(task.task_id, {
          status: TASK_STATES.CANCELLED,
          error: {
            ...taxonomyMessage('TASK_CANCELLED', error.message || 'Task cancelled', { source: 'task.runner' })
          },
          finished_at: nowIso()
        });
        return this.getTask(task.task_id);
      }

      this.updateTask(task.task_id, {
        status: TASK_STATES.FAILED,
        error: {
          ...taxonomyMessage(error.code || 'TASK_FAILED', error.message, { source: 'task.runner' })
        },
        finished_at: nowIso()
      });
      return this.getTask(task.task_id);
    } finally {
      for (const lockKey of lockKeys) {
        if (this.activeLocks.get(lockKey) === task.task_id) {
          this.activeLocks.delete(lockKey);
        }
      }
      this.abortControllers.delete(task.task_id);
    }
  }

  createTask(definition = {}) {
    const classification = definition.classification || TASK_CLASSIFICATIONS.READ_ONLY;
    return {
      task_id: createTaskId(),
      type: definition.type || 'unknown',
      classification,
      scope_key: definition.scopeKey || null,
      lock_keys: Array.isArray(definition.lockKeys) ? definition.lockKeys.map(String) : null,
      status: TASK_STATES.QUEUED,
      queued_at: nowIso(),
      started_at: null,
      finished_at: null,
      cancel_requested_at: null,
      cancel_reason: null,
      progress: [],
      warnings: [],
      result: null,
      error: null
    };
  }

  addProgress(taskId, event = {}) {
    const task = this.requireTask(taskId);
    const progress = {
      at: nowIso(),
      stage: event.stage || 'progress',
      message: event.message || null,
      current: numberOrNull(event.current),
      total: numberOrNull(event.total)
    };
    task.progress.push(progress);
    return progress;
  }

  addWarning(taskId, warning = {}) {
    const task = this.requireTask(taskId);
    const entry = {
      at: nowIso(),
      ...normalizeMessage(warning, { code: 'TASK_WARNING', source: 'task.runner' })
    };
    task.warnings.push(entry);
    return entry;
  }

  updateTask(taskId, patch) {
    const task = this.requireTask(taskId);
    Object.assign(task, patch);
    return task;
  }

  getTask(taskId) {
    const task = this.tasks.get(taskId);
    return task ? clone(task) : null;
  }

  cancelTask(taskId, reason = 'Task cancelled') {
    const task = this.requireTask(taskId);
    if (![TASK_STATES.QUEUED, TASK_STATES.RUNNING].includes(task.status)) {
      return this.getTask(taskId);
    }
    task.cancel_requested_at = nowIso();
    task.cancel_reason = reason;
    const controller = this.abortControllers.get(taskId);
    if (controller && !controller.signal.aborted) {
      controller.abort(reason);
    }
    return this.getTask(taskId);
  }

  listTasks({ limit = 20 } = {}) {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.queued_at.localeCompare(a.queued_at))
      .slice(0, limit)
      .map(clone);
  }

  requireTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    return task;
  }

  pruneHistory() {
    if (this.tasks.size <= this.historyLimit) {
      return;
    }
    const tasks = Array.from(this.tasks.values())
      .sort((a, b) => a.queued_at.localeCompare(b.queued_at));
    for (const task of tasks.slice(0, this.tasks.size - this.historyLimit)) {
      if (task.status === TASK_STATES.RUNNING || task.status === TASK_STATES.QUEUED) {
        continue;
      }
      this.tasks.delete(task.task_id);
    }
  }
}

function lockKeysFor(task) {
  if (Array.isArray(task.lock_keys)) {
    return task.lock_keys;
  }
  if (task.classification === TASK_CLASSIFICATIONS.READ_ONLY) {
    return [];
  }
  if (task.classification === TASK_CLASSIFICATIONS.LOCAL_MUTATION) {
    return [`local:${task.scope_key || 'global'}`];
  }
  if (task.classification === TASK_CLASSIFICATIONS.EXTERNAL_IO) {
    return [`external:${task.scope_key || 'global'}`];
  }
  if (task.classification === TASK_CLASSIFICATIONS.EXTERNAL_MUTATION) {
    const scope = task.scope_key || 'global';
    return [`external:${scope}`, `local:${scope}`];
  }
  if (task.classification === TASK_CLASSIFICATIONS.DESTRUCTIVE || task.classification === TASK_CLASSIFICATIONS.EXCLUSIVE) {
    return ['exclusive:global'];
  }
  return task.scope_key ? [`${task.classification}:${task.scope_key}`] : [];
}

function lockConflictFor(lockKeys, activeLocks) {
  if (!lockKeys.length) {
    return null;
  }
  if (activeLocks.has('exclusive:global')) {
    return 'exclusive:global';
  }
  for (const lockKey of lockKeys) {
    if (activeLocks.has(lockKey)) {
      return lockKey;
    }
  }
  if (lockKeys.includes('exclusive:global') && activeLocks.size > 0) {
    return [...activeLocks.keys()].sort()[0];
  }
  return null;
}

function normalizeFinalStatus(status) {
  if (!status) {
    return null;
  }
  const value = String(status);
  if (!Object.values(TASK_STATES).includes(value)) {
    throw new Error(`Invalid task status: ${status}`);
  }
  return value;
}

function isCancelledError(error) {
  return error?.code === 'TASK_CANCELLED' ||
    error?.code === 'HTTP_CANCELLED' ||
    error?.name === 'AbortError';
}

function createTaskId() {
  return `task_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaultTaskRunner = new TaskRunner();

module.exports = {
  TaskRunner,
  TASK_STATES,
  TASK_CLASSIFICATIONS,
  lockKeysFor,
  lockConflictFor,
  defaultTaskRunner
};
