export class RedisCacheProvider {
  constructor(client) {
    this.client = client;
  }

  async get(key) {
    return this.client.get(key);
  }

  async set(key, value, ttlSeconds) {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async getJson(key) {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setJson(key, value, ttlSeconds) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key) {
    return this.client.del(key);
  }

  async trySet(key, value, ttlSeconds) {
    const res = ttlSeconds
      ? await this.client.set(key, value, 'EX', ttlSeconds, 'NX')
      : await this.client.set(key, value, 'NX');
    return res === 'OK';
  }

  async exists(key) {
    return (await this.client.exists(key)) === 1;
  }

  async incr(key) {
    return this.client.incr(key);
  }

  async expire(key, ttlSeconds) {
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key) {
    return this.client.ttl(key);
  }

  async hsetWithTtl(key, fields, ttlSeconds) {
    const tx = this.client.multi().hset(key, fields);
    if (ttlSeconds) tx.expire(key, ttlSeconds);
    await tx.exec();
  }
}
