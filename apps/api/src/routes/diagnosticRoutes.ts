// apps/api/src/routes/diagnosticRoutes.ts
import express from 'express';
import { createDiagnosticHandler, runComprehensiveDiagnostics } from '../lib/dbDiagnostic';
import { diagnoseDbConnection } from '../lib/db';

const router = express.Router();

/**
 * @route   GET /api/diagnostics/db
 * @desc    Run full database diagnostics and return detailed report
 * @access  Admin
 */
router.get('/db', createDiagnosticHandler());

/**
 * @route   GET /api/diagnostics/db/quick
 * @desc    Run quick database connection test
 * @access  Admin
 */
router.get('/db/quick', async (req, res) => {
  try {
    const diagnostics = await diagnoseDbConnection();
    
    const status = 
      diagnostics.hostReachable && 
      diagnostics.credentialsValid && 
      diagnostics.sslConfigurationCorrect && 
      diagnostics.connectionPoolCreated && 
      diagnostics.sampleQueryExecutable 
        ? 'healthy' 
        : 'unhealthy';
        
    res.json({
      timestamp: new Date().toISOString(),
      status,
      diagnostics
    });
  } catch (error) {
    console.error('Quick diagnostic failed:', error);
    res.status(500).json({
      error: 'Quick diagnostic failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   POST /api/diagnostics/db/run
 * @desc    Run diagnostics and save full report to file
 * @access  Admin
 */
router.post('/db/run', async (req, res) => {
  try {
    const report = await runComprehensiveDiagnostics();
    res.json({
      success: true,
      message: 'Diagnostic report generated successfully',
      reportLength: report.length
    });
  } catch (error) {
    console.error('Error generating diagnostic report:', error);
    res.status(500).json({
      error: 'Failed to generate diagnostic report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 