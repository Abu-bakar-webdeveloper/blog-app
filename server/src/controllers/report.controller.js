import {
  createReport,
  getAllReports,
  updateReportStatus,
  getReportStats
} from '../services/report.service.js';

// Report a blog
export const createReportController = async (req, res) => {
  try {
    const { reason, description } = req.body;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false,
        error: 'Reason is required' 
      });
    }

    const report = await createReport(
      req.params.blogId,
      reason,
      description,
      req.user.id
    );
    
    res.status(201).json({
      success: true,
      message: 'Blog reported successfully',
      data: report,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get all reports (Admin only)
export const getAllReportsController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    
    const result = await getAllReports(page, limit, status);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Update report status (Admin only)
export const updateReportStatusController = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid status is required' 
      });
    }

    const report = await updateReportStatus(
      req.params.reportId,
      status
    );
    
    res.json({
      success: true,
      message: 'Report status updated successfully',
      data: report,
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
        error: error.message 
    });
  }
};

// Get report statistics (Admin only)
export const getReportStatsController = async (req, res) => {
  try {
    const stats = await getReportStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};