/**
 * Structured logging.
 *
 * The blueprint specifies AWS Lambda Powertools. That is a runtime dependency,
 * and this pass was scoped to restructuring without adding any, so this is a
 * dependency-free stand-in that enforces the same two rules Powertools exists
 * to enforce:
 *
 *   1. Loggers come from `getLogger(name)`, never from a direct construction.
 *   2. Context is passed as a structured object, never interpolated into the
 *      message string, so CloudWatch Insights can query the fields.
 *
 * Swapping in Powertools later means reimplementing `getLogger` only; no call
 * site changes, because the surface is deliberately the same.
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

function activeLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL || '').toUpperCase();
  return configured in LEVEL_ORDER ? (configured as LogLevel) : 'INFO';
}

function emit(logger: string, level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLevel()]) return;

  const line = JSON.stringify({
    level,
    logger,
    message,
    timestamp: new Date().toISOString(),
    ...context
  });

  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

/**
 * @param name Matches the class it logs for, per the FileName == ClassName ==
 *             LoggerName convention.
 */
export function getLogger(name: string): Logger {
  return {
    debug: (message, context) => emit(name, 'DEBUG', message, context),
    info: (message, context) => emit(name, 'INFO', message, context),
    warn: (message, context) => emit(name, 'WARN', message, context),
    error: (message, context) => emit(name, 'ERROR', message, context)
  };
}
