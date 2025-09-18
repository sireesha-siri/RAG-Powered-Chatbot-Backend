# RAG-Powered News Chatbot - Backend

A full-stack chatbot that answers questions about news using Retrieval-Augmented Generation (RAG) pipeline.

## 🎯 What This Does

- **Fetches News**: Gets articles from RSS feeds (Reuters, CNN, BBC, etc.)
- **Creates Embeddings**: Converts text to numbers using Jina AI
- **Stores in Vector DB**: Saves embeddings in Qdrant for fast similarity search
- **Smart Retrieval**: Finds relevant articles for user questions
- **AI Generation**: Uses Google Gemini to create intelligent answers
- **Session Management**: Tracks conversations using Redis
- **Real-time Chat**: WebSocket support for instant messaging

## 🏗️ Architecture

```
User Question → Find Similar Articles → AI Creates Answer
     ↓                    ↓                     ↓
Frontend ←→ Express API ←→ Vector DB ←→ Gemini API
     ↓                    ↓
WebSocket ←→ Redis (Sessions)
```

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Server** | Node.js + Express | REST API and WebSocket server |
| **Embeddings** | Jina AI API | Convert text to numerical vectors |
| **Vector DB** | Qdrant | Store and search article embeddings |
| **AI Generation** | Google Gemini | Generate intelligent responses |
| **Sessions** | Redis | Fast temporary storage for chat history |
| **Database** | MySQL (Optional) | Permanent storage for conversations |
| **Logging** | Winston | Application logging and monitoring |

## 📁 Project Structure

```
backend/
├── src/
│   ├── services/           # Business logic
│   │   ├── SessionManager.js      # Redis session handling
│   │   ├── RAGService.js          # Core RAG pipeline
│   │   ├── EmbeddingService.js    # Text to vectors conversion
│   │   └── NewsIngestionService.js # RSS feed processing
│   ├── routes/            # API endpoints
│   │   ├── chat.js              # Chat functionality
│   │   └── sessions.js          # Session management
│   └── utils/
│       └── logger.js            # Centralized logging
├── scripts/
│   └── ingestNews.js      # News ingestion script
├── logs/                  # Application logs
├── data/                  # Backup JSON files
├── server.js             # Main server file
├── package.json          # Dependencies
└── .env.example          # Environment variables template
```

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** (v16+ recommended)
- **Redis** (for sessions)
- **Qdrant** (vector database)
- **API Keys**:
  - [Google Gemini API](https://aistudio.google.com/apikey)
  - [Jina Embeddings API](https://jina.ai/embeddings)

### 2. Installation

```bash
# Clone repository
git clone <your-repo-url>
cd rag-chatbot-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Environment Setup

Edit `.env` file:

```bash
# Cloud Service URLs (REPLACE WITH YOUR ACTUAL URLs)
REDIS_URL=redis://default:your-password@redis-12345.c1.us-east1-2.gce.cloud.redislabs.com:12345
QDRANT_URL=https://your-cluster-id.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-api-key

# Your API Keys (KEEP YOUR EXISTING ONES)
GEMINI_API_KEY=your-existing-gemini-key
JINA_API_KEY=your-existing-jina-key

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 4. Start Dependencies

**Redis** (using Docker):
```bash
docker run -p 6379:6379 redis:alpine
```

**Qdrant** (using Docker):
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Ingest News Data

```bash
# Populate vector database with news articles
npm run ingest

# This will:
# 1. Fetch ~50 articles from RSS feeds
# 2. Generate embeddings using Jina API
# 3. Store in Qdrant vector database
# 4. Test the RAG pipeline
```

### 6. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

Server will start at `http://localhost:5000`

## 📊 API Endpoints

### Sessions
```http
POST   /api/sessions                 # Create new session
GET    /api/sessions/:id             # Get session info
GET    /api/sessions/:id/history     # Get chat history
DELETE /api/sessions/:id/history     # Clear chat history
DELETE /api/sessions/:id             # Delete session
```

### Chat
```http
POST   /api/chat/:sessionId          # Send message
POST   /api/chat/:sessionId/stream   # Streaming responses
GET    /api/chat/:sessionId/suggestions # Get suggested questions
POST   /api/chat/:sessionId/feedback # Submit feedback
```

### Health & Admin
```http
GET    /health                       # System health check
GET    /api/sessions                 # All sessions (admin)
POST   /api/sessions/cleanup         # Cleanup expired sessions
```

## 🔌 WebSocket Events

### Client → Server
```javascript
socket.emit('join_session', sessionId);
socket.emit('send_message', { sessionId, message });
```

### Server → Client
```javascript
socket.on('user_message', data);      // User message confirmation
socket.on('bot_message', data);       // Bot response
socket.on('error', error);            // Error handling
```

## 🧠 How RAG Works

### 1. News Ingestion
```javascript
// Fetch articles from RSS feeds
const articles = await newsService.getFreshArticles({
  maxArticles: 50,
  categories: ['technology', 'business', 'world']
});
```

### 2. Embedding Generation
```javascript
// Convert text to vectors
const embeddings = await embeddingService.generateEmbeddings([
  "Apple stock rises after iPhone sales surge"
]);
// Result: [0.1, -0.5, 0.8, 0.2, ...] (512 numbers)
```

### 3. Vector Storage
```javascript
// Store in Qdrant for similarity search
await qdrantClient.upsert('news_articles', {
  points: [{
    id: 1,
    vector: embedding,
    payload: { title, content, source, date }
  }]
});
```

### 4. Query Processing
```javascript
// Find similar articles
const relevant = await ragService.retrieveRelevantPassages(
  "What happened with Apple stock?", 5
);
```

### 5. Answer Generation
```javascript
// Generate intelligent response
const answer = await ragService.generateAnswer(query, relevant);
```

## 💾 Caching Strategy

### Redis Session Caching
- **TTL**: 1 hour (3600 seconds)
- **Storage**: Chat history, user preferences
- **Auto-cleanup**: Expired sessions automatically removed

```javascript
// Session stored as:
{
  "session:abc-123": {
    "messages": [...],
    "createdAt": "2024-01-01T00:00:00Z",
    "lastActivity": "2024-01-01T01:00:00Z"
  }
}
```

### Vector Database Caching
- **Persistent**: Article embeddings stored permanently
- **Indexing**: Optimized for similarity search
- **Batch Updates**: Refresh articles periodically

## 📈 Performance Optimization

### Embedding Batching
```javascript
// Process articles in batches to avoid API limits
const embeddings = await embeddingService.batchGenerateEmbeddings(
  articles, batchSize: 10
);
```

### Connection Pooling
- Redis connection reuse
- Qdrant client optimization
- HTTP keep-alive for external APIs

### Error Handling
- Graceful degradation when services are unavailable
- Retry logic for transient failures
- Fallback responses for AI generation failures

## 🔧 Development

### Running Tests
```bash
# Test RAG pipeline
node scripts/ingestNews.js --test

# Test individual components
node -e "
const RAGService = require('./src/services/RAGService');
const rag = new RAGService();
rag.healthCheck().then(console.log);
"
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

### Monitor Logs
```bash
# Watch logs in real-time
tail -f logs/combined.log

# Filter errors only
tail -f logs/error.log
```

## 🚀 Deployment

### Environment Variables (Production)
```bash
NODE_ENV=production
PORT=5000
GEMINI_API_KEY=your_production_key
JINA_API_KEY=your_production_key
REDIS_URL=redis://production-redis:6379
QDRANT_URL=http://production-qdrant:6333
ADMIN_KEY=your_admin_secret
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Hosting Options
- **Render.com**: Free tier available
- **Railway**: Easy deployment
- **Heroku**: Redis add-on available
- **DigitalOcean**: Full control

## 🔍 Monitoring

### Health Checks
```bash
curl http://localhost:5000/health
```

### Performance Metrics
- Response time monitoring
- Memory usage tracking
- Redis connection status
- Vector database query performance

## 🛡️ Security

### API Rate Limiting
- Implement rate limiting for chat endpoints
- Session-based throttling

### Data Privacy
- Chat history automatically expires (TTL)
- No permanent storage of user queries by default
- API keys secured in environment variables
- Admin endpoints protected with secret keys

### Input Validation
```javascript
// Message length limits
if (message.length > 1000) {
  return res.status(400).json({ error: 'Message too long' });
}

// Content filtering
const cleanMessage = message.trim().replace(/[<>]/g, '');
```

## 🧪 Testing

### Manual Testing
```bash
# Test session creation
curl -X POST http://localhost:5000/api/sessions

# Test chat
curl -X POST http://localhost:5000/api/chat/your-session-id \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the latest news?"}'

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c ws://localhost:5000
```

### Integration Tests
```javascript
// Test RAG pipeline end-to-end
const testQuery = "What's happening with technology stocks?";
const results = await ragService.retrieveRelevantPassages(testQuery);
const answer = await ragService.generateAnswer(testQuery, results);
console.log('Answer:', answer);
```

## 📚 Understanding Each Component

### SessionManager.js
**Purpose**: Handle user sessions like browser cookies but on server
```javascript
// Like localStorage but shared across devices
await sessionManager.createSession();     // Create new chat
await sessionManager.addMessage(id, msg); // Save message
await sessionManager.getHistory(id);      // Load old messages
```

### EmbeddingService.js
**Purpose**: Convert human text into computer-readable numbers
```javascript
// "Apple stock rises" → [0.1, -0.5, 0.8, 0.2, ...]
const embedding = await embeddingService.generateEmbeddings("Apple stock rises");
```

### RAGService.js
**Purpose**: The brain - finds relevant articles and creates smart answers
```javascript
// 1. Find similar articles
const relevant = await ragService.retrieveRelevantPassages("Apple stock?");
// 2. Create intelligent answer
const answer = await ragService.generateAnswer("Apple stock?", relevant);
```

### NewsIngestionService.js
**Purpose**: Fetch and clean news articles from the internet
```javascript
// Gets articles from RSS feeds like a news reader app
const articles = await newsService.ingestFromRSSFeeds();
```

## 🔄 Data Flow Example

1. **User asks**: "What's the latest in AI?"
2. **System converts** question to numbers: `[0.2, 0.7, -0.1, ...]`
3. **Vector DB finds** similar articles about AI
4. **Gemini AI** reads those articles and creates answer
5. **Response sent** to user with sources
6. **Redis saves** the conversation

## 🐛 Common Issues & Solutions

### "Session not found"
```javascript
// Create session first
const response = await fetch('/api/sessions', { method: 'POST' });
const { sessionId } = await response.json();
```

### "No articles found"
```bash
# Run ingestion script
npm run ingest
```

### "Redis connection failed"
```bash
# Start Redis
docker run -p 6379:6379 redis:alpine

# Or install locally
brew install redis  # macOS
sudo apt install redis-server  # Ubuntu
```

### "Qdrant not accessible"
```bash
# Start Qdrant
docker run -p 6333:6333 qdrant/qdrant
```

### "API key errors"
- Check `.env` file has correct keys
- Verify API keys are valid and have credits
- Make sure no spaces in environment variables

## 📊 System Requirements

### Minimum
- **RAM**: 512MB
- **CPU**: 1 core
- **Storage**: 1GB
- **Network**: Stable internet for APIs

### Recommended
- **RAM**: 2GB+
- **CPU**: 2+ cores
- **Storage**: 5GB+ (for logs and data)
- **Network**: High bandwidth for embeddings

## 🔮 Future Enhancements

### Features to Add
- [ ] Multi-language support
- [ ] Image analysis for news articles
- [ ] Conversation summarization
- [ ] User preference learning
- [ ] Advanced analytics dashboard
- [ ] Real-time news updates
- [ ] Custom news sources
- [ ] Export chat history

### Performance Improvements
- [ ] Caching for embeddings
- [ ] Background article updates
- [ ] Load balancing for multiple instances
- [ ] Database connection pooling
- [ ] Response streaming optimization

## 📞 Support

### Debug Information
```bash
# Check logs
tail -f logs/combined.log

# Test components
node -e "require('./src/services/RAGService').healthCheck()"

# Verify environment
node -e "console.log(process.env.GEMINI_API_KEY ? 'API key loaded' : 'Missing API key')"
```

### Getting Help
1. Check logs in `logs/` directory
2. Verify all environment variables are set
3. Ensure Redis and Qdrant are running
4. Test API keys independently
5. Run ingestion script to populate data

## 🎓 Learning Resources

### RAG Concepts
- [What is RAG?](https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/)
- [Vector Databases Explained](https://www.pinecone.io/learn/vector-database/)
- [Embedding Models Guide](https://huggingface.co/blog/getting-started-with-embeddings)

### Technologies Used
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Jina Embeddings](https://jina.ai/embeddings/)
- [Google Gemini API](https://ai.google.dev/docs)
- [Redis Documentation](https://redis.io/docs/)

---

## 🏃‍♂️ Quick Commands Summary

```bash
# Setup
npm install
cp .env.example .env
# Edit .env with your API keys

# Start services
docker run -p 6379:6379 redis:alpine     # Redis
docker run -p 6333:6333 qdrant/qdrant    # Qdrant

# Populate with news
npm run ingest

# Start server
npm run dev

# Test
curl http://localhost:5000/health
```

Your backend is now ready! The system will:
- ✅ Fetch news articles automatically
- ✅ Convert them to searchable embeddings
- ✅ Store in vector database
- ✅ Handle user sessions
- ✅ Provide intelligent responses
- ✅ Support real-time chat

Next step: Connect your frontend to these APIs! 🚀

