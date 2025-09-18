const express = require('express');
const router = express.Router();
const SessionManager = require('../services/SessionManager');
const RAGService = require('../services/RAGService');
const logger = require('../utils/logger');

// Initialize services
const sessionManager = new SessionManager();
const ragService = new RAGService();

/**
 * POST /api/chat/:sessionId
 * Send a message and get AI response
 * Purpose: Main chat endpoint for user-bot conversation
 */
router.post('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and cannot be empty'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        error: 'Message too long. Please limit to 1000 characters.'
      });
    }

    logger.info(`Processing chat message for session ${sessionId}: "${message.substring(0, 50)}..."`);

    // Check if session exists
    const sessionExists = await sessionManager.getSession(sessionId);
    if (!sessionExists) {
      return res.status(404).json({
        error: 'Session not found. Please create a new session.'
      });
    }

    // Add user message to session
    const userMessage = {
      type: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    };

    await sessionManager.addMessage(sessionId, userMessage);

    // Get relevant context from RAG system
    const relevantPassages = await ragService.retrieveRelevantPassages(message, 5);
    
    // Generate AI response
    const aiResponse = await ragService.generateAnswer(message, relevantPassages);

    // Add bot response to session
    const botMessage = {
      type: 'bot',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      sources: relevantPassages.map(passage => ({
        title: passage.title,
        source: passage.source,
        url: passage.url,
        similarity: Math.round(passage.similarity * 100) / 100
      }))
    };

    await sessionManager.addMessage(sessionId, botMessage);

    // Return response
    res.json({
      success: true,
      response: aiResponse,
      sources: botMessage.sources,
      sessionId: sessionId,
      timestamp: botMessage.timestamp
    });

    logger.info(`Successfully processed chat message for session ${sessionId}`);

  } catch (error) {
    logger.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'Failed to process your message. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/chat/:sessionId/stream
 * Stream AI response in real-time (for typing effect)
 */
router.post('/:sessionId/stream', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Validate session
    const sessionExists = await sessionManager.getSession(sessionId);
    if (!sessionExists) {
      res.write(`data: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      res.end();
      return;
    }

    // Add user message
    await sessionManager.addMessage(sessionId, {
      type: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString()
    });

    // Send user message confirmation
    res.write(`data: ${JSON.stringify({ 
      type: 'user_message_received', 
      content: message 
    })}\n\n`);

    // Get context and generate response
    const relevantPassages = await ragService.retrieveRelevantPassages(message, 5);
    const aiResponse = await ragService.generateAnswer(message, relevantPassages);

    // Simulate streaming by sending response word by word
    const words = aiResponse.split(' ');
    let currentResponse = '';

    for (let i = 0; i < words.length; i++) {
      currentResponse += (i > 0 ? ' ' : '') + words[i];
      
      res.write(`data: ${JSON.stringify({
        type: 'bot_message_chunk',
        content: currentResponse,
        isComplete: i === words.length - 1
      })}\n\n`);

      // Small delay to simulate typing
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send final message with sources
    res.write(`data: ${JSON.stringify({
      type: 'bot_message_complete',
      content: aiResponse,
      sources: relevantPassages.map(p => ({
        title: p.title,
        source: p.source,
        url: p.url
      }))
    })}\n\n`);

    // Save complete bot message to session
    await sessionManager.addMessage(sessionId, {
      type: 'bot',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      sources: relevantPassages
    });

    res.end();

  } catch (error) {
    logger.error('Error in stream endpoint:', error);
    res.write(`data: ${JSON.stringify({ 
      error: 'Failed to process your message' 
    })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/chat/:sessionId/suggestions
 * Get suggested questions based on current conversation
 */
router.get('/:sessionId/suggestions', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionHistory = await sessionManager.getSessionHistory(sessionId);
    
    // Generate contextual suggestions based on conversation
    let suggestions = [
      "What's the latest news?",
      "Tell me about recent technology developments",
      "What happened in the markets today?",
      "Any breaking news stories?"
    ];

    // Customize suggestions based on chat history
    if (sessionHistory.length > 0) {
      const recentTopics = sessionHistory
        .filter(msg => msg.type === 'user')
        .slice(-3)
        .map(msg => msg.content.toLowerCase());

      if (recentTopics.some(topic => topic.includes('stock') || topic.includes('market'))) {
        suggestions = [
          "What are the latest market trends?",
          "Tell me about stock market news",
          "Any economic updates?",
          "What's happening with major companies?"
        ];
      } else if (recentTopics.some(topic => topic.includes('tech') || topic.includes('ai'))) {
        suggestions = [
          "What's new in artificial intelligence?",
          "Tell me about recent tech innovations",
          "Any startup news?",
          "What are the latest tech trends?"
        ];
      }
    }

    res.json({
      suggestions: suggestions.slice(0, 4),
      sessionId: sessionId
    });

  } catch (error) {
    logger.error('Error getting suggestions:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      suggestions: ["What's the latest news?"]
    });
  }
});

/**
 * POST /api/chat/:sessionId/feedback
 * Submit feedback on bot response
 */
router.post('/:sessionId/feedback', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messageId, rating, comment } = req.body;

    // Store feedback (in a real app, you'd save this to database)
    logger.info(`Feedback for session ${sessionId}, message ${messageId}: ${rating}/5 - ${comment}`);

    // You could add feedback to the session history or separate feedback storage
    await sessionManager.addMessage(sessionId, {
      type: 'feedback',
      messageId: messageId,
      rating: rating,
      comment: comment,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    logger.error('Error submitting feedback:', error);
    res.status(500).json({
      error: 'Failed to submit feedback'
    });
  }
});

/**
 * GET /api/chat/health
 * Check chat service health
 */
router.get('/health', async (req, res) => {
  try {
    const ragHealth = await ragService.healthCheck();
    const redisConnected = sessionManager.isConnected();

    res.json({
      status: 'healthy',
      services: {
        rag: ragHealth,
        redis: redisConnected,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * Error handling middleware for chat routes
 */
router.use((error, req, res, next) => {
  logger.error('Chat route error:', error);
  
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: 'Chat service temporarily unavailable',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
  });
});

module.exports = router;