import { CircuitOpenError, ExternalServiceError } from './errors.js';
import { createLogger } from './logger.js';
import { CIRCUIT_BREAKER } from '../config/constants.js';

const log = createLogger({ module: 'circuit-breaker' });

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  halfOpenCalls: number;
}

const circuits = new Map<string, CircuitBreakerState>();

function getCircuit(name: string): CircuitBreakerState {
  if (!circuits.has(name)) {
    circuits.set(name, {
      state: 'closed',
      failures: 0,
      lastFailure: 0,
      halfOpenCalls: 0,
    });
  }
  return circuits.get(name)!;
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { failureThreshold?: number; resetTimeoutMs?: number },
): Promise<T> {
  const threshold = options?.failureThreshold ?? CIRCUIT_BREAKER.FAILURE_THRESHOLD;
  const resetTimeout = options?.resetTimeoutMs ?? CIRCUIT_BREAKER.RESET_TIMEOUT_MS;
  const circuit = getCircuit(name);

  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailure >= resetTimeout) {
      circuit.state = 'half-open';
      circuit.halfOpenCalls = 0;
      log.info({ circuit: name }, 'Circuit breaker half-open');
    } else {
      throw new CircuitOpenError(name);
    }
  }

  if (circuit.state === 'half-open' && circuit.halfOpenCalls >= CIRCUIT_BREAKER.HALF_OPEN_MAX_CALLS) {
    throw new CircuitOpenError(name);
  }

  try {
    if (circuit.state === 'half-open') {
      circuit.halfOpenCalls++;
    }
    const result = await fn();
    // Success — reset circuit
    circuit.state = 'closed';
    circuit.failures = 0;
    circuit.halfOpenCalls = 0;
    return result;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.failures >= threshold) {
      circuit.state = 'open';
      log.warn({ circuit: name, failures: circuit.failures }, 'Circuit breaker opened');
    }
    throw error;
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelayMs ?? 200;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  service = 'unknown',
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ExternalServiceError(service, 'Request timed out')), timeoutMs),
    ),
  ]);
}

export function resetCircuit(name: string): void {
  circuits.delete(name);
}

