export type TransportKind = 'usb' | 'bluetooth' | 'demo';

/**
 * A byte stream to the tracker. USB OTG is implemented now; Bluetooth SPP can be
 * added later by providing another implementation of this interface.
 */
export interface Transport {
  readonly kind: TransportKind;
  readonly label: string;
  write(text: string): Promise<void>;
  /** Subscribe to received data. Returns an unsubscribe function. */
  onData(listener: (chunk: string) => void): () => void;
  /** Called once when the link goes down (unplugged, closed, error). */
  onClose(listener: (reason?: string) => void): () => void;
  close(): Promise<void>;
}

export class Emitter<T> {
  private listeners = new Set<(value: T) => void>();

  add(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(value: T) {
    this.listeners.forEach(l => l(value));
  }

  clear() {
    this.listeners.clear();
  }
}
