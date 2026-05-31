const { USER_AGENT } = require('../constants');

const RETRY_STATUSES = new Set([420, 429, 503]);
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 3;

class HttpClient {
  constructor({
    userAgent = USER_AGENT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal = null,
    fetchImpl = fetch,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    onRequestLog = null
  } = {}) {
    this.userAgent = userAgent;
    this.timeoutMs = timeoutMs;
    this.signal = signal;
    this.fetchImpl = fetchImpl;
    this.maxAttempts = maxAttempts;
    this.onRequestLog = onRequestLog;
  }

  async json(provider, endpoint, options = {}) {
    const method = options.method || 'GET';
    const started = Date.now();
    let retryCount = 0;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const requestSignal = combinedSignal([this.signal, options.signal], timeoutMs);
      try {
        const response = await this.fetchImpl(endpoint, {
          ...options,
          method,
          signal: requestSignal.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
            ...(options.headers || {})
          }
        });

        if (response.ok) {
          const text = await response.text();
          const data = parseJsonResponse(text, provider, endpoint);
          this.log({ provider, endpoint, method, statusCode: response.status, durationMs: Date.now() - started, retryCount });
          return data;
        }

        if (RETRY_STATUSES.has(response.status) && attempt < this.maxAttempts - 1) {
          retryCount += 1;
          await delay(retryDelay(response, attempt), requestSignal.signal);
          continue;
        }

        this.log({
          provider,
          endpoint,
          method,
          statusCode: response.status,
          durationMs: Date.now() - started,
          retryCount,
          rateLimited: response.status === 420 || response.status === 429,
          errorMessage: `${provider} ${response.status}`
        });
        throw new Error(`${provider} ${response.status} for ${endpoint}`);
      } catch (error) {
        const normalized = normalizeRequestError(error, requestSignal);
        if (normalized.nonRetryable) {
          this.log({
            provider,
            endpoint,
            method,
            durationMs: Date.now() - started,
            retryCount,
            errorMessage: normalized.error.message
          });
          throw normalized.error;
        }

        if (attempt < this.maxAttempts - 1) {
          retryCount += 1;
          await delay(1000 * (attempt + 1), requestSignal.signal);
          continue;
        }

        this.log({
          provider,
          endpoint,
          method,
          durationMs: Date.now() - started,
          retryCount,
          errorMessage: error.message
        });
        throw normalized.error;
      } finally {
        requestSignal.cleanup();
      }
    }

    throw new Error(`${provider} retry limit reached for ${endpoint}`);
  }

  log(entry) {
    if (typeof this.onRequestLog === 'function') {
      this.onRequestLog({
        requested_at: new Date().toISOString(),
        ...entry
      });
    }
  }
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  return Math.min(30000, 1500 * (attempt + 1) * (attempt + 1));
}

function delay(ms, signal = null) {
  if (signal?.aborted) {
    return Promise.reject(abortError('HTTP_CANCELLED', 'HTTP request cancelled'));
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(abortError('HTTP_CANCELLED', 'HTTP request cancelled'));
      }, { once: true });
    }
  });
}

function combinedSignal(signals, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  const validSignals = signals.filter(Boolean);

  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  const timeout = Number(timeoutMs) > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Number(timeoutMs))
    : null;

  const cleanup = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    for (const signal of validSignals) {
      signal.removeEventListener('abort', onAbort);
    }
  };

  controller.signal.addEventListener('abort', cleanup, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup
  };
}

function normalizeRequestError(error, requestSignal) {
  if (requestSignal.timedOut()) {
    return {
      nonRetryable: true,
      error: abortError('HTTP_TIMEOUT', 'HTTP request timed out')
    };
  }
  if (error?.name === 'AbortError' || error?.code === 'HTTP_CANCELLED') {
    return {
      nonRetryable: true,
      error: abortError('HTTP_CANCELLED', 'HTTP request cancelled')
    };
  }
  if (error?.nonRetryable) {
    return {
      nonRetryable: true,
      error
    };
  }
  return {
    nonRetryable: false,
    error
  };
}

function parseJsonResponse(text, provider, endpoint) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    const wrapped = new Error(`${provider} returned invalid JSON for ${endpoint}`);
    wrapped.code = 'HTTP_INVALID_JSON';
    wrapped.name = 'SyntaxError';
    wrapped.cause = error;
    wrapped.nonRetryable = true;
    return throwError(wrapped);
  }
}

function throwError(error) {
  throw error;
}

function abortError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.name = code === 'HTTP_TIMEOUT' ? 'TimeoutError' : 'AbortError';
  return error;
}

module.exports = {
  HttpClient,
  DEFAULT_TIMEOUT_MS
};
