// Shared in-memory store with reactive subscriptions.
// All memory adapters share this single store instance.

type Listener<T> = (data: T[]) => void;

export class MemoryStore<T extends { id: string }> {
  private rows = new Map<string, T>();
  private listeners = new Set<Listener<T>>();

  private emit() {
    const all = Array.from(this.rows.values());
    this.listeners.forEach((l) => l(all));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    listener(Array.from(this.rows.values()));
    return () => this.listeners.delete(listener);
  }

  get(id: string): T | undefined {
    return this.rows.get(id);
  }

  list(filter?: (row: T) => boolean): T[] {
    const all = Array.from(this.rows.values());
    return filter ? all.filter(filter) : all;
  }

  set(id: string, row: T): void {
    this.rows.set(id, row);
    this.emit();
  }

  update(id: string, data: Partial<T>): void {
    const existing = this.rows.get(id);
    if (!existing) return;
    this.rows.set(id, { ...existing, ...data });
    this.emit();
  }

  delete(id: string): void {
    this.rows.delete(id);
    this.emit();
  }

  clear(): void {
    this.rows.clear();
    this.emit();
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeId(): string {
  return uid();
}

export function now(): string {
  return new Date().toISOString();
}
