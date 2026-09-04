/**
 * In-memory Stale-While-Revalidate Query Cache
 * Enables instantaneous tab transitions (0ms) and eliminates full-page reloads.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class AppCache {
  private cache = new Map<string, CacheEntry<any>>();
  private listeners = new Set<() => void>();

  /**
   * Retrieve cached data synchronously if available
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    return entry ? (entry.data as T) : undefined;
  }

  /**
   * Store data in cache with current timestamp
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Check if cache has non-expired data
   */
  has(key: string, ttlMs: number = 60000): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp <= ttlMs;
  }

  /**
   * Stale-While-Revalidate fetch wrapper.
   * If cached entry exists, returns cached data immediately.
   * Background revalidation updates the cache if expired.
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 30000,
    forceRefresh: boolean = false
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = this.cache.get(key);
    const isExpired = !cached || Date.now() - cached.timestamp > ttlMs;

    if (cached && !forceRefresh) {
      if (isExpired) {
        // Stale-while-revalidate in background
        fetcher()
          .then((fresh) => {
            this.set(key, fresh);
            this.notify();
          })
          .catch((err) => {
            console.warn(`Background revalidation note for ${key}:`, err);
          });
      }
      return { data: cached.data as T, fromCache: true };
    }

    const fresh = await fetcher();
    this.set(key, fresh);
    return { data: fresh, fromCache: false };
  }

  /**
   * Invalidate all or matching cache keys
   */
  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Cache listener error:', e);
      }
    });
  }
}

export const queryCache = new AppCache();
