import { Emitter, Transport } from '../transport/types';
import {
  buildGetParam,
  buildSetParamCommands,
  formatCommand,
  parseParamResponse,
  ProtocolSettings,
} from './commands';

export interface LogEntry {
  dir: 'tx' | 'rx' | 'info';
  text: string;
  time: number;
}

interface Pending {
  onChunk(): void;
}

export class TimeoutError extends Error {
  constructor(cmd: string) {
    super(`No response to "${cmd}"`);
    this.name = 'TimeoutError';
  }
}

/**
 * Serialises commands over a transport: one command at a time, the response is
 * whatever arrives until the line goes quiet (idleMs) or timeoutMs elapses.
 */
export class CommandSession {
  readonly log = new Emitter<LogEntry>();
  private buffer = '';
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private unsubscribe: () => void;

  constructor(
    readonly transport: Transport,
    private getSettings: () => ProtocolSettings,
  ) {
    this.unsubscribe = transport.onData(chunk => {
      this.buffer += chunk;
      this.log.emit({ dir: 'rx', text: chunk, time: Date.now() });
      this.pending?.onChunk();
    });
  }

  /** Writes text as-is (terminal use); does not wait for a response. */
  async sendRaw(text: string): Promise<void> {
    this.log.emit({ dir: 'tx', text, time: Date.now() });
    await this.transport.write(text);
  }

  /** Sends a command formatted with the current settings and resolves with the response text. */
  command(cmd: string): Promise<string> {
    const run = () => this.execute(cmd);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  async readParams(
    ids: number[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<Record<number, string>> {
    const batch = Math.max(1, this.getSettings().readBatchSize);
    const values: Record<number, string> = {};
    for (let i = 0; i < ids.length; i += batch) {
      const chunk = ids.slice(i, i + batch);
      const response = await this.command(buildGetParam(chunk));
      Object.assign(values, pick(parseParamResponse(response), chunk));
      onProgress?.(Math.min(i + batch, ids.length), ids.length);
    }
    return values;
  }

  /** Writes values and returns what the device reported back as the new values. */
  async writeParams(
    values: Record<number, string>,
  ): Promise<Record<number, string>> {
    const confirmed: Record<number, string> = {};
    const commands = buildSetParamCommands(
      values,
      this.getSettings().maxCommandLength,
    );
    for (const cmd of commands) {
      const response = await this.command(cmd);
      Object.assign(confirmed, parseParamResponse(response));
    }
    return confirmed;
  }

  async dispose() {
    this.unsubscribe();
    this.log.clear();
    await this.transport.close();
  }

  private execute(cmd: string): Promise<string> {
    const settings = this.getSettings();
    this.buffer = '';
    return new Promise<string>((resolve, reject) => {
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error) => {
        clearTimeout(idleTimer);
        clearTimeout(totalTimer);
        this.pending = null;
        const text = this.buffer;
        this.buffer = '';
        if (error) {
          reject(error);
        } else {
          resolve(text);
        }
      };
      const totalTimer = setTimeout(() => {
        finish(this.buffer ? undefined : new TimeoutError(cmd));
      }, settings.timeoutMs);
      this.pending = {
        onChunk: () => {
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => finish(), settings.idleMs);
        },
      };
      this.sendRaw(formatCommand(cmd, settings)).catch(e => finish(e));
    });
  }
}

function pick(
  values: Record<number, string>,
  ids: number[],
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const id of ids) {
    if (id in values) {
      out[id] = values[id];
    }
  }
  return out;
}
