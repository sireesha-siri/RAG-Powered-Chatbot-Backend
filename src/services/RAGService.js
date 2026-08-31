const axios = require('axios');
const { QdrantClient } = require('@qdrant/js-client-rest');
const EmbeddingService = require('./EmbeddingService');
const logger = require('../utils/logger');

// Service for RAG (Retrieval + Generation)
// Flow: User Question → Find Similar Articles → AI Generates Answer
class RAGService {
  constructor() {
    this.embeddingService = new EmbeddingService();

    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    this.collectionName = 'news_articles';

    this.geminiApiKey = process.env.GEMINI_API_KEY;

    // Gemini model
    this.geminiBaseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
  }

  // Create Qdrant collection if it doesn’t exist
  async initialize() {
    try {
      const collections =
        await this.qdrantClient.getCollections();

      const collectionExists =
        collections.collections.some(
          col => col.name === this.collectionName
        );

      if (!collectionExists) {
        await this.qdrantClient.createCollection(
          this.collectionName,
          {
            vectors: {
              size: 1024,
              distance: 'Cosine'
            }
          }
        );

        logger.info(
          `Created Qdrant collection: ${this.collectionName}`
        );
      } else {
        logger.info(
          `Qdrant collection exists: ${this.collectionName}`
        );
      }
    } catch (error) {
      logger.error(
        'Error initializing RAG service:',
        error
      );

      throw error;
    }
  }

  // Store news articles in Qdrant with embeddings
  async storeArticles(articles) {
    try {
      logger.info(
        `Storing ${articles.length} articles in vector database`
      );

      const points = [];

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];

        const text = `${article.title || ''} ${
          article.description || ''
        } ${article.content || ''}`;

        const embeddings =
          await this.embeddingService.generateEmbeddings(
            [text]
          );

        const embedding = embeddings[0].embedding;

        points.push({
          id: i + 1,

          vector: embedding,

          payload: {
            title: article.title || '',
            description: article.description || '',
            content: article.content || '',
            url: article.link || '',
            publishDate:
              article.pubDate ||
              new Date().toISOString(),
            source: article.source || 'Unknown',
            category: article.category || 'General',
            createdAt:
              new Date().toISOString()
          }
        });

        logger.info(
          `Processed article ${i + 1}/${articles.length}: ${article.title?.substring(
            0,
            50
          )}...`
        );
      }

      await this.qdrantClient.upsert(
        this.collectionName,
        {
          wait: true,
          points
        }
      );

      logger.info(
        `Stored ${points.length} articles successfully`
      );

      return points.length;
    } catch (error) {
      logger.error(
        'Error storing articles:',
        error
      );

      throw error;
    }
  }

  // Search similar articles in Qdrant for a user query
  async retrieveRelevantPassages(query, k = 5) {
    try {
      logger.info(
        `Retrieving top-${k} passages for query: "${query}"`
      );

      const queryEmbedding =
        await this.embeddingService.generateQueryEmbedding(
          query
        );

      const searchResult =
        await this.qdrantClient.search(
          this.collectionName,
          {
            vector: queryEmbedding,
            limit: k,
            with_payload: true,
            score_threshold: 0.3
          }
        );

      return searchResult.map(result => ({
        title: result.payload.title,
        content: result.payload.content,
        description: result.payload.description,
        url: result.payload.url,
        source: result.payload.source,
        publishDate:
          result.payload.publishDate,
        similarity: result.score,

        relevantText:
          this.extractRelevantText(
            result.payload,
            query
          )
      }));
    } catch (error) {
      logger.error(
        'Error retrieving passages:',
        error
      );

      return [];
    }
  }

  // Generate an AI answer using Gemini
  // with automatic retry for temporary 503 errors
  async generateAnswer(query, context) {
    try {
      if (!context || context.length === 0) {
        return "I couldn't find any relevant news. Please try rephrasing your question.";
      }

      const contextText = context
        .map(
          (article, i) =>
            `Article ${i + 1}:
Title: ${article.title}
Content: ${
              article.relevantText ||
              article.description ||
              article.content.substring(0, 500)
            }
Source: ${article.source}
Date: ${article.publishDate}
---`
        )
        .join('\n');

      const prompt = `You are a helpful news assistant.

Use ONLY the provided articles to answer the user's question.

If the articles do not contain enough information to answer the question, clearly say that the available articles do not contain enough information.

Do not invent facts.

Context:
${contextText}

User Question:
${query}

Answer:`;

      // Maximum number of attempts
      const maxAttempts = 3;

      // Retry delays:
      // Attempt 1 → immediately
      // Attempt 2 → after 2 seconds
      // Attempt 3 → after 4 seconds
      const retryDelays = [
        2000,
        4000
      ];

      let response = null;

      for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
      ) {
        try {
          logger.info(
            `Sending request to Gemini (attempt ${attempt}/${maxAttempts})`
          );

          response = await axios.post(
            this.geminiBaseUrl,
            {
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],

              generationConfig: {
                maxOutputTokens: 1024
              }
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key':
                  this.geminiApiKey
              },

              timeout: 30000
            }
          );

          // If request succeeds, stop retrying
          break;
        } catch (error) {
          const status =
            error.response?.status;

          const errorData =
            error.response?.data;

          logger.error(
            `Gemini attempt ${attempt} failed:`,
            errorData || error.message
          );

          // Only retry temporary server errors
          if (
            status === 503 &&
            attempt < maxAttempts
          ) {
            const delay =
              retryDelays[attempt - 1];

            logger.warn(
              `Gemini is temporarily unavailable. Retrying in ${delay / 1000} seconds...`
            );

            await new Promise(resolve =>
              setTimeout(resolve, delay)
            );

            continue;
          }

          // For non-503 errors, stop immediately
          throw error;
        }
      }

      const answer =
        response?.data?.candidates?.[0]
          ?.content?.parts?.[0]?.text;

      return (
        answer ||
        'Sorry, I couldn’t generate a response.'
      );
    } catch (error) {
      logger.error(
        'Gemini Error:',
        error.response?.data ||
          error.message
      );

      // Fallback response using retrieved article
      if (
        context &&
        context.length > 0
      ) {
        return `Summary of most relevant article:

Title: ${context[0].title}

${
          context[0].description ||
          context[0].content.substring(0, 200)
        }...`;
      }

      return "I’m having trouble generating a response right now. Please try again later.";
    }
  }

  // Pick best matching sentence from article for context
  extractRelevantText(
    articlePayload,
    query
  ) {
    const {
      title,
      description,
      content
    } = articlePayload;

    const fullText =
      `${title} ${description} ${content}`;

    const queryWords = query
      .toLowerCase()
      .split(' ')
      .filter(
        word => word.length > 2
      );

    const sentences = fullText
      .split(/[.!?]+/)
      .filter(
        sentence =>
          sentence.length > 20
      );

    let bestSentence = '';
    let maxMatches = 0;

    for (
      const sentence of sentences
    ) {
      const matches =
        queryWords.filter(word =>
          sentence
            .toLowerCase()
            .includes(word)
        ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence =
          sentence.trim();
      }
    }

    return (
      bestSentence ||
      description ||
      content.substring(0, 300)
    );
  }

  // Get stats of the Qdrant collection
  async getCollectionStats() {
    try {
      const info =
        await this.qdrantClient.getCollection(
          this.collectionName
        );

      return {
        totalArticles:
          info.points_count,

        vectorDimensions:
          info.config.params.vectors.size,

        distance:
          info.config.params.vectors.distance,

        status: info.status
      };
    } catch (error) {
      logger.error(
        'Error getting stats:',
        error
      );

      return {
        error: error.message
      };
    }
  }

  // Search articles quickly by keywords
  async searchArticles(
    keywords,
    limit = 10
  ) {
    try {
      const queryEmbedding =
        await this.embeddingService.generateQueryEmbedding(
          keywords
        );

      const searchResult =
        await this.qdrantClient.search(
          this.collectionName,
          {
            vector: queryEmbedding,
            limit,
            with_payload: true
          }
        );

      return searchResult.map(r => ({
        id: r.id,
        title: r.payload.title,
        description:
          r.payload.description,
        url: r.payload.url,
        source: r.payload.source,
        publishDate:
          r.payload.publishDate,
        similarity: r.score
      }));
    } catch (error) {
      logger.error(
        'Error searching articles:',
        error
      );

      return [];
    }
  }

  // Delete all articles from Qdrant
  async clearAllArticles() {
    try {
      await this.qdrantClient.deleteCollection(
        this.collectionName
      );

      await this.initialize();

      logger.info(
        'Cleared all articles'
      );

      return true;
    } catch (error) {
      logger.error(
        'Error clearing articles:',
        error
      );

      throw error;
    }
  }

  // Check if Qdrant is connected
  async isConnected() {
    try {
      await this.qdrantClient.getCollections();

      return true;
    } catch {
      return false;
    }
  }

  // Service health check
  async healthCheck() {
    try {
      const isQdrantConnected =
        await this.isConnected();

      const stats =
        await this.getCollectionStats();

      return {
        status: 'healthy',

        qdrant:
          isQdrantConnected,

        articlesCount:
          stats.totalArticles || 0,

        lastChecked:
          new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',

        error: error.message,

        lastChecked:
          new Date().toISOString()
      };
    }
  }
}

module.exports = RAGService;