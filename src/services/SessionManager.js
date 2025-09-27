const redis = require('redis'); 

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * SessionManager handles chat sessions using Redis
 * Purpose: Store chat history temporarily for fast access
 * Like: Frontend localStorage but on server-side for all users
 */
class SessionManager {
  constructor() {
    // Initialize Redis client and connect immediately
    this.client = null;
    this.connect();
  }

  // Connect to Redis database
  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  // Create new chat session
  async createSession() {
    try {
      const sessionId = uuidv4(); // Generate unique ID like: "abc123-def456-ghi789"
      const sessionData = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        messages: [],
        lastActivity: new Date().toISOString()
      };

      // Store session with TTL (Time To Live) - auto-delete after 1 hour
      const TTL = parseInt(process.env.SESSION_TTL) || 3600; // 3600 seconds = 1 hour
      await this.client.setEx(
        `session:${sessionId}`, 
        TTL, 
        JSON.stringify(sessionData)
      );

      logger.info(`Created new session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  // Add message to session (user or bot message)
  async addMessage(sessionId, message) {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        // Create new session if it doesn't exist instead of throwing error
        logger.warn(`Session ${sessionId} not found, creating new session`);
        await this.createSessionWithId(sessionId);
        const newSessionData = await this.getSession(sessionId);
        if (!newSessionData) {
          throw new Error('Failed to create session');
        }
        sessionData = newSessionData;
      }

      // Add new message to history
      sessionData.messages.push({
        ...message,
        id: uuidv4(),
        timestamp: message.timestamp || new Date().toISOString()
      });

      // Keep only last 50 messages to prevent memory issues
      const maxMessages = parseInt(process.env.MAX_CHAT_HISTORY) || 50;
      if (sessionData.messages.length > maxMessages) {
        sessionData.messages = sessionData.messages.slice(-maxMessages);
      }

      // Update last activity
      sessionData.lastActivity = new Date().toISOString();

      // Save back to Redis with extended TTL
      const TTL = parseInt(process.env.SESSION_TTL) || 3600;
      await this.client.setEx(
        `session:${sessionId}`, 
        TTL, 
        JSON.stringify(sessionData)
      );

      logger.info(`Added message to session ${sessionId}: ${message.type}`);
      return sessionData.messages[sessionData.messages.length - 1];
    } catch (error) {
      logger.error('Error adding message:', error);
      throw error;
    }
  }

  // Create session with specific ID (helper method)
  async createSessionWithId(sessionId) {
    try {
      const sessionData = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        messages: [],
        lastActivity: new Date().toISOString()
      };

      const TTL = parseInt(process.env.SESSION_TTL) || 3600;
      await this.client.setEx(
        `session:${sessionId}`, 
        TTL, 
        JSON.stringify(sessionData)
      );

      logger.info(`Created session with ID: ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('Error creating session with ID:', error);
      throw error;
    }
  }

  // Get session data including all chat history
  async getSession(sessionId) {
    try {
      const data = await this.client.get(`session:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null; // Return null instead of throwing error
    }
  }

  // Get only chat messages for a session
  async getSessionHistory(sessionId) {
    try {
      const sessionData = await this.getSession(sessionId);
      if (!sessionData) {
        // Create empty session if it doesn't exist
        await this.createSessionWithId(sessionId);
        return [];
      }
      return sessionData.messages || [];
    } catch (error) {
      logger.error('Error getting session history:', error);
      return []; // Return empty array instead of throwing error
    }
  }

  // Clear all messages from a session (reset chat)
  async clearSession(sessionId) {
    try {
      let sessionData = await this.getSession(sessionId);
      
      if (!sessionData) {
        // Create new session if it doesn't exist
        logger.warn(`Session ${sessionId} not found for clearing, creating new session`);
        await this.createSessionWithId(sessionId);
        sessionData = await this.getSession(sessionId);
        
        if (!sessionData) {
          throw new Error('Failed to create session for clearing');
        }
      }

      // Reset messages but keep session info
      sessionData.messages = [];
      sessionData.lastActivity = new Date().toISOString();

      const TTL = parseInt(process.env.SESSION_TTL) || 3600;
      await this.client.setEx(
        `session:${sessionId}`, 
        TTL, 
        JSON.stringify(sessionData)
      );

      logger.info(`Cleared session: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error clearing session:', error);
      throw error;
    }
  }

  // Delete session completely
  async deleteSession(sessionId) {
    try {
      const exists = await this.client.exists(`session:${sessionId}`);
      if (!exists) {
        logger.warn(`Session ${sessionId} does not exist for deletion`);
        return false;
      }

      await this.client.del(`session:${sessionId}`);
      logger.info(`Deleted session: ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting session:', error);
      throw error;
    }
  }

  // Check if Redis is connected
  isConnected() {
    return this.client && this.client.isReady;
  }

  // Check if session exists
  async sessionExists(sessionId) {
    try {
      const exists = await this.client.exists(`session:${sessionId}`);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking session existence:', error);
      return false;
    }
  }

  // Get all active sessions (for admin purposes)
  async getActiveSessions() {
    try {
      const keys = await this.client.keys('session:*');
      const sessions = [];
      
      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const sessionData = JSON.parse(data);
          sessions.push({
            id: sessionData.id,
            createdAt: sessionData.createdAt,
            lastActivity: sessionData.lastActivity,
            messageCount: sessionData.messages.length
          });
        }
      }
      
      return sessions;
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      throw error;
    }
  }

  // Cleanup expired sessions (run periodically)
  async cleanupExpiredSessions() {
    try {
      const keys = await this.client.keys('session:*');
      let cleanedCount = 0;
      
      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        if (ttl === -1) { // No TTL set, session might be stuck
          await this.client.del(key);
          cleanedCount++;
        }
      }
      
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up sessions:', error);
      throw error;
    }
  }

  // Graceful disconnect
  async disconnect() {
    try {
      if (this.client) {
        await this.client.disconnect();
        logger.info('Disconnected from Redis');
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }
}

module.exports = SessionManager;