import prisma from '../models/index.js';

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

  return await prisma.report.create({
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
};

// Get all reports (admin only)
export const getAllReports = async (page = 1, limit = 10, status = null) => {
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

  return {
    reports,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Update report status (admin only)
export const updateReportStatus = async (reportId, status) => {
  return await prisma.report.update({
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
};

// Get report statistics
export const getReportStats = async () => {
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

  return {
    totalReports,
    pendingReports,
    reviewedReports,
    resolvedReports,
    dismissedReports,
    reportsByReason
  };
};