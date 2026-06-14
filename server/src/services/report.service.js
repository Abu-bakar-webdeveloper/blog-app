import prisma from '../models/index.js';
import {
  CACHE_KEYS,
  CACHE_TTL,
  getCache,
  setCache,
  invalidateReportStats,
  invalidateReportsList,
} from '../utils/cache.js';

// Report a blog (user)
export const createReport = async (blogId, reason, description, userId) => {
  // Check if blog exists
  const blog = await prisma.blog.findUnique({
    where: { id: blogId }
  });

  if (!blog) {
    throw new Error('Blog not found');
  }

  // Check if user already reported this blog
  const existingReport = await prisma.report.findFirst({
    where: {
      blogId,
      reporterId: userId,
      status: 'PENDING'
    }
  });

  if (existingReport) {
    throw new Error('You have already reported this blog');
  }

  const report = await prisma.report.create({
    data: {
      reason,
      description,
      blogId,
      reporterId: userId,
    },
    include: {
      blog: {
        select: {
          id: true,
          title: true,
          slug: true,
        }
      },
      reporter: {
        select: {
          id: true,
          name: true,
          username: true,
        }
      }
    }
  });

  await Promise.all([
    invalidateReportStats(),
    invalidateReportsList(),
  ]);

  return report;
};

// Get all reports (admin only)
export const getAllReports = async (page = 1, limit = 10, status = null) => {
  const cacheKey = CACHE_KEYS.reportsList(page, limit, status);
  const cachedReports = await getCache(cacheKey);

  if (cachedReports) {
    return cachedReports;
  }

  const skip = (page - 1) * limit;
  
  const where = {};
  if (status) {
    where.status = status;
  }

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        blog: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
          }
        },
        reporter: {
          select: {
            id: true,
            name: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.report.count({ where })
  ]);

  const result = {
    reports,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };

  await setCache(cacheKey, result, CACHE_TTL.SHORT);

  return result;
};

// Update report status (admin only)
export const updateReportStatus = async (reportId, status) => {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status },
    include: {
      blog: {
        select: {
          id: true,
          title: true,
        }
      }
    }
  });

  await Promise.all([
    invalidateReportStats(),
    invalidateReportsList(),
  ]);

  return report;
};

// Get report statistics
export const getReportStats = async () => {
  const cacheKey = CACHE_KEYS.reportStats();
  const cachedStats = await getCache(cacheKey);

  if (cachedStats) {
    return cachedStats;
  }

  const [
    totalReports,
    pendingReports,
    reviewedReports,
    resolvedReports,
    dismissedReports,
    reportsByReason
  ] = await Promise.all([
    prisma.report.count(),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'REVIEWED' } }),
    prisma.report.count({ where: { status: 'RESOLVED' } }),
    prisma.report.count({ where: { status: 'DISMISSED' } }),
    prisma.report.groupBy({
      by: ['reason'],
      _count: { id: true }
    })
  ]);

  const stats = {
    totalReports,
    pendingReports,
    reviewedReports,
    resolvedReports,
    dismissedReports,
    reportsByReason,
  };

  await setCache(cacheKey, stats, CACHE_TTL.STATS);

  return stats;
};