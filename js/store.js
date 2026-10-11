const PREFIX = 'bc:';

export const store = {
  load(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v ? { ...fallback, ...JSON.parse(v) } : fallback;
    } catch {
      return fallback;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage blocked: the app still works without remembering */
    }
  },
};
