class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    // delete jika kadaluarsa
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 300) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
}

module.exports = new MemoryCache();
