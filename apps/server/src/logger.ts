export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMetadata = Record<string, unknown>;

export type Logger = {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
};

function writeLog(level: LogLevel, message: string, metadata?: LogMetadata) {
  const payload = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  if (level === "debug") {
    console.debug(payload);
    return;
  }

  console.info(payload);
}

export const logger: Logger = {
  debug: (message, metadata) => writeLog("debug", message, metadata),
  info: (message, metadata) => writeLog("info", message, metadata),
  warn: (message, metadata) => writeLog("warn", message, metadata),
  error: (message, metadata) => writeLog("error", message, metadata),
};
