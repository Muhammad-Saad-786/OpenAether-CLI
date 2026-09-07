export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  constructor(private readonly verbose = false) {}
  debug(message: string, ...args: unknown[]): void {
    if (this.verbose) console.error(`[debug] ${message}`, ...args);
  }
  info(message: string, ...args: unknown[]): void {
    console.error(`[info] ${message}`, ...args);
  }
  warn(message: string, ...args: unknown[]): void {
    console.error(`[warn] ${message}`, ...args);
  }
  error(message: string, ...args: unknown[]): void {
    console.error(`[error] ${message}`, ...args);
  }
}

export const logger = new Logger(process.env.OPENAETHER_VERBOSE === "1");
