import redis from "../config/redis.js";

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  STATS: 120,
};

export const CACHE_KEYS = {
  blogsList: (filters, page, limit) =>
    `blog:list:${JSON.stringify(filters)}:${page}:${limit}`,
  blogDetail: (idOrSlug) => `blog:detail:${idOrSlug}`,
  blogComments: (blogId, page, limit) =>
    `blog:comments:${blogId}:${page}:${limit}`,
  blogLikesCount: (blogId) => `blog:likes:count:${blogId}`,
  blogStats: () => "blog:stats",
  userProfile: (userId) => `user:profile:${userId}`,
  reportStats: () => "report:stats",
  reportsList: (page, limit, status) =>
    `report:list:${page}:${limit}:${status || "all"}`,
  usersList: (page, limit) => `user:list:${page}:${limit}`,
};

export const getCache = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

export const setCache = async (key, value, ttl = CACHE_TTL.SHORT) => {
  await redis.set(key, JSON.stringify(value), "EX", ttl);
};

export const deleteCache = async (key) => {
  await redis.del(key);
};

export const deleteCacheByPattern = async (pattern) => {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
};

export const invalidateBlogListCaches = () =>
  deleteCacheByPattern("blog:list:*");

export const invalidateBlogDetail = async (id, slug) => {
  await Promise.all([
    deleteCache(CACHE_KEYS.blogDetail(id)),
    slug ? deleteCache(CACHE_KEYS.blogDetail(slug)) : Promise.resolve(),
  ]);
};

export const invalidateBlogComments = (blogId) =>
  deleteCacheByPattern(`blog:comments:${blogId}:*`);

export const invalidateBlogLikesCount = (blogId) =>
  deleteCache(CACHE_KEYS.blogLikesCount(blogId));

export const invalidateBlogStats = () => deleteCache(CACHE_KEYS.blogStats());

export const invalidateUserProfile = (userId) =>
  deleteCache(CACHE_KEYS.userProfile(userId));

export const invalidateReportStats = () =>
  deleteCache(CACHE_KEYS.reportStats());

export const invalidateReportsList = () =>
  deleteCacheByPattern("report:list:*");

export const invalidateUsersList = () =>
  deleteCacheByPattern("user:list:*");

export const invalidateBlogCaches = async (blog) => {
  await Promise.all([
    invalidateBlogListCaches(),
    invalidateBlogDetail(blog.id, blog.slug),
    invalidateBlogComments(blog.id),
    invalidateBlogLikesCount(blog.id),
    invalidateBlogStats(),
    blog.authorId ? invalidateUserProfile(blog.authorId) : Promise.resolve(),
  ]);
};
