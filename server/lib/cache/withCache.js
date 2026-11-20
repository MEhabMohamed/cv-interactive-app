import { cacheProvider } from './init.js';

export function withCache(ttl = 3600, userScoped = false) {
  return async (req, res, next) => {
    try {
      let key = `cv:${req.method}:${req.originalUrl}`;
      if (userScoped && req.user?.id) key = `${key}:${req.user.id}`;

      const cached = await cacheProvider.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(JSON.parse(cached));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheProvider.set(key, JSON.stringify(body), ttl).catch(() => {});
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };
      next();
    } catch {
      next();
    }
  };
}
