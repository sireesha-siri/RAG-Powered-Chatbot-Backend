const express = require('express');
const router = express.Router();
const SessionManager = require('../services/SessionManager');
const logger = require('../utils/logger');

// Initialize session manager
const sessionManager = new SessionManager();

/**
 * POST /api/sessions
 * Create a new chat session
 * Purpose: Start a new conversation - like opening a new chat window
 */
router.post('/', async (req, res) => {
  try {
    logger.info('Creating new session');
    
    const sessionId = await sessionManager.createSession();
    
    res.status(201).json({
      success: true,
      sessionId: sessionId,
      message: 'New session created successfully',
      createdAt: new Date().toISOString()
    });

    logger.info(`Created new session: ${sessionId}`);

  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get session information and metadata
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionData = await sessionManager.getSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    // Return session info without full message history
    res.json({
      success: true,
      session: {
        id: sessionData.id,
        createdAt: sessionData.createdAt,
        lastActivity: sessionData.lastActivity,
        messageCount: sessionData.messages.length
      }
    });

  } catch (error) {
    logger.error('Error getting session:', error);
    res.status(500).json({
      error: 'Failed to retrieve session'
    });
  }
});

/**
 * GET /api/sessions/:sessionId/history
 * Get complete chat history for a session
 * Purpose: Load previous messages when user reopens chat
 */
router.get('/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit, offset } = req.query;

    logger.info(`Getting history for session: ${sessionId}`);

    const history = await sessionManager.getSessionHistory(sessionId);
    
    if (!history) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    // Apply pagination if requested
    let paginatedHistory = history;
    if (limit) {
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset) || 0;
      paginatedHistory = history.slice(offsetNum, offsetNum + limitNum);
    }

    // Filter out internal messages like feedback
    const userFacingHistory = paginatedHistory.filter(msg => 
      msg.type === 'user' || msg.type === 'bot'
    );

    res.json({
      success: true,
      sessionId: sessionId,
      history: userFacingHistory,
      totalMessages: history.length,
      hasMore: limit ? (parseInt(offset) || 0) + parseInt(limit) < history.length : false
    });

    logger.info(`Retrieved ${userFacingHistory.length} messages for session ${sessionId}`);

  } catch (error) {
    logger.error('Error getting session history:', error);
    res.status(500).json({
      error: 'Failed to retrieve chat history',
      sessionId: req.params.sessionId
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId/history
 * Clear all messages from session (reset chat)
 * Purpose: "Clear Chat" button functionality
 */
router.delete('/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`Clearing history for session: ${sessionId}`);

    const result = await sessionManager.clearSession(sessionId);
    
    if (!result) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    res.json({
      success: true,
      message: 'Chat history cleared successfully',
      sessionId: sessionId,
      clearedAt: new Date().toISOString()
    });

    logger.info(`Cleared history for session: ${sessionId}`);

  } catch (error) {
    logger.error('Error clearing session history:', error);
    res.status(500).json({
      error: 'Failed to clear chat history',
      sessionId: req.params.sessionId
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete entire session permanently
 * Purpose: Complete session cleanup
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`Deleting session: ${sessionId}`);

    const result = await sessionManager.deleteSession(sessionId);
    
    if (!result) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully',
      sessionId: sessionId,
      deletedAt: new Date().toISOString()
    });

    logger.info(`Deleted session: ${sessionId}`);

  } catch (error) {
    logger.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      sessionId: req.params.sessionId
    });
  }
});

/**
 * GET /api/sessions
 * Get all active sessions (admin endpoint)
 */
router.get('/', async (req, res) => {
  try {
    // Only allow in development or with admin key
    if (process.env.NODE_ENV === 'production' && 
        req.headers['admin-key'] !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const sessions = await sessionManager.getActiveSessions();
    
    res.json({
      success: true,
      sessions: sessions,
      totalSessions: sessions.length,
      timestamp: new Date().toISOString()
    });

    logger.info(`Retrieved ${sessions.length} active sessions`);

  } catch (error) {
    logger.error('Error getting all sessions:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/extend
 * Extend session TTL (Time To Live)
 * Purpose: Keep active sessions alive longer
 */
router.post('/:sessionId/extend', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { hours = 1 } = req.body;

    const sessionExists = await sessionManager.getSession(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    // Extend TTL by adding a dummy message (this refreshes the TTL)
    await sessionManager.addMessage(sessionId, {
      type: 'system',
      content: 'Session extended',
      timestamp: new Date().toISOString(),
      internal: true
    });

    res.json({
      success: true,
      message: `Session extended by ${hours} hour(s)`,
      sessionId: sessionId,
      extendedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error extending session:', error);
    res.status(500).json({
      error: 'Failed to extend session'
    });
  }
});

/**
 * GET /api/sessions/:sessionId/export
 * Export session history as JSON
 * Purpose: Allow users to download their chat history
 */
router.get('/:sessionId/export', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionData = await sessionManager.getSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    // Clean up data for export
    const exportData = {
      sessionId: sessionData.id,
      createdAt: sessionData.createdAt,
      exportedAt: new Date().toISOString(),
      messageCount: sessionData.messages.length,
      messages: sessionData.messages
        .filter(msg => msg.type === 'user' || msg.type === 'bot')
        .map(msg => ({
          type: msg.type,
          content: msg.content,
          timestamp: msg.timestamp,
          sources: msg.sources || undefined
        }))
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chat-history-${sessionId}.json"`);
    
    res.json(exportData);

    logger.info(`Exported session ${sessionId} with ${exportData.messageCount} messages`);

  } catch (error) {
    logger.error('Error exporting session:', error);
    res.status(500).json({
      error: 'Failed to export session'
    });
  }
});

/**
 * POST /api/sessions/cleanup
 * Clean up expired sessions (admin endpoint)
 */
router.post('/cleanup', async (req, res) => {
  try {
    // Admin access check
    if (process.env.NODE_ENV === 'production' && 
        req.headers['admin-key'] !== process.env.ADMIN_KEY) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const cleanedCount = await sessionManager.cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired sessions`,
      cleanedCount: cleanedCount,
      timestamp: new Date().toISOString()
    });

    logger.info(`Cleaned up ${cleanedCount} expired sessions`);

  } catch (error) {
    logger.error('Error cleaning up sessions:', error);
    res.status(500).json({
      error: 'Failed to cleanup sessions'
    });
  }
});

/**
 * Error handling middleware for session routes
 */
router.use((error, req, res, next) => {
  logger.error('Session route error:', error);
  
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: 'Session service temporarily unavailable',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
  });
});

module.exports = router;