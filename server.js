require('dotenv').config(); //Loads environment variables from a .env file into process.env.
//Keeps sensitive data (like API keys, ports) out of your code.

const express = require('express'); //Web framework to handle HTTP requests.
const cors = require('cors'); //Allows cross-origin requests (important for frontend-backend communication).
const http = require('http'); //Native Node module to create server.
const socketIo = require('socket.io'); //Enables real-time communication (like chat).
const { v4: uuidv4 } = require('uuid'); //Generates unique IDs (used for session or message IDs).

// Import our services
const SessionManager = require('./src/services/SessionManager'); //Manages chat sessions and messages.
const RAGService = require('./src/services/RAGService'); //Handles Retrieval-Augmented Generation (AI responses).
const EmbeddingService = require('./src/services/EmbeddingService'); //Likely deals with vector embeddings for semantic search.
const logger = require('./src/utils/logger'); //Custom logging utility for tracking events and errors.

const app = express(); //Express app instance.
const server = http.createServer(app); //HTTP server wrapping the Express app.
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
}); //Socket.IO instance for real-time features.

// Middleware
app.use(cors()); //Enables frontend to talk to backend from different domains.
app.use(express.json({ limit: '10mb' })); //Parses incoming JSON requests.
app.use(express.static('public')); //Serves static files (like HTML, CSS, JS).

// Initialize services
//Creates instances of your custom services to use throughout the application.
const sessionManager = new SessionManager();
const ragService = new RAGService();
const embeddingService = new EmbeddingService();

// Routes
//Keeps code organized by separating session and chat logic.
app.use('/api/sessions', require('./src/routes/sessions'));
app.use('/api/chat', require('./src/routes/chat'));

// Health check endpoint for frontend connection status
app.get('/api/health', async (req, res) => {
  try {
    // Check all service connections
    const redisConnected = sessionManager.isConnected();
    let ragConnected = false;
    
    try {
      // Test RAG service if it has a health check method
      if (typeof ragService.healthCheck === 'function') {
        ragConnected = await ragService.healthCheck();
      } else if (typeof ragService.isConnected === 'function') {
        ragConnected = ragService.isConnected();
      } else {
        ragConnected = true; // Assume healthy if no check method
      }
    } catch (error) {
      ragConnected = false;
    }

    const isHealthy = redisConnected && ragConnected;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'voosh-news-chatbot',
      services: {
        redis: redisConnected,
        rag: ragConnected,
        embedding: true // Assume embedding service is always available
      }
    });

    if (!isHealthy) {
      logger.warn('Health check failed', {
        redis: redisConnected,
        rag: ragConnected
      });
    }

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Legacy health check endpoint (keeping for backward compatibility)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      redis: sessionManager.isConnected(),
      rag: true // Simplified check
    }
  });
});

// Socket.io for real-time chat
//Listens for new client connections.
// Logs connection for tracking.

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Join a session room
  /*
    Groups users into rooms based on session ID.
    Benefit: Enables private conversations per session.
  */

  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`Client ${socket.id} joined session: ${sessionId}`);
  });

  // Handle chat messages
  socket.on('send_message', async (data) => {
    try {
      const { sessionId, message } = data;
      
      // Add user message to session
      await sessionManager.addMessage(sessionId, {
        type: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // Emit user message to session room
      io.to(sessionId).emit('user_message', {
        content: message,
        timestamp: new Date().toISOString()
      });

      // Get RAG response
      const context = await ragService.retrieveRelevantPassages(message);
      const response = await ragService.generateAnswer(message, context);

      // Add bot response to session
      await sessionManager.addMessage(sessionId, {
        type: 'bot',
        content: response,
        timestamp: new Date().toISOString()
      });

      // Emit bot response
      io.to(sessionId).emit('bot_message', {
        content: response,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Socket message error:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});