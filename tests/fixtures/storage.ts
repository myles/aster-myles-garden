// Stand-ins for localStorage, so storage code can be tested without a
// browser.

/** An in-memory stand-in for localStorage. */
export class MemoryStorage implements Storage {
  private _items = new Map<string, string>();

  get length(): number {
    return this._items.size;
  }

  clear(): void {
    this._items.clear();
  }

  getItem(key: string): string | null {
    return this._items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this._items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this._items.delete(key);
  }

  setItem(key: string, value: string): void {
    this._items.set(key, value);
  }
}

/** A storage that refuses every write, as a full or locked-down one does. */
export class FullStorage extends MemoryStorage {
  override setItem(): void {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  }
}
