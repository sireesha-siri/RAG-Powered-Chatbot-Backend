const axios = require('axios');
const { QdrantClient } = require('@qdrant/js-client-rest');
const EmbeddingService = require('./EmbeddingService');
const logger = require('../utils/logger');

// Service for RAG (Retrieval + Generation)
// Flow:
// User Question
//      ↓
// Generate Query Embedding
//      ↓
// Search Similar Articles in Qdrant
//      ↓
// Send Retrieved Context to Gemini
//      ↓
// Generate Final Answer

class RAGService {
  constructor() {
    this.embeddingService = new EmbeddingService();

    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    this.collectionName = 'news_articles';

    this.geminiApiKey = process.env.GEMINI_API_KEY;

    // Stable Gemini model
    this.geminiBaseUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
  }

  // ============================================================
  // INITIALIZE QDRANT
  // ============================================================

  async initialize() {
    try {
      const collections = await this.qdrantClient.getCollections();

      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );

      if (!collectionExists) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 1024,
            distance: 'Cosine',
          },
        });

        logger.info(
          `Created Qdrant collection: ${this.collectionName}`
        );
      } else {
        logger.info(
          `Qdrant collection exists: ${this.collectionName}`
        );
      }
    } catch (error) {
      logger.error('Error initializing RAG service:', error);
      throw error;
    }
  }

  // ============================================================
  // STORE ARTICLES
  // ============================================================

  async storeArticles(articles) {
    try {
      logger.info(
        `Storing ${articles.length} articles in vector database`
      );

      const points = [];

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];

        const text = `
          ${article.title || ''}
          ${article.description || ''}
          ${article.content || ''}
        `.trim();

        const embeddings =
          await this.embeddingService.generateEmbeddings([text]);

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
              article.pubDate || new Date().toISOString(),
            source: article.source || 'Unknown',
            category: article.category || 'General',
            createdAt: new Date().toISOString(),
          },
        });

        logger.info(
          `Processed article ${i + 1}/${articles.length}: ${
            article.title?.substring(0, 50) || ''
          }...`
        );
      }

      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points,
      });

      logger.info(
        `Stored ${points.length} articles successfully`
      );

      return points.length;
    } catch (error) {
      logger.error('Error storing articles:', error);
      throw error;
    }
  }

  // ============================================================
  // RETRIEVE RELEVANT ARTICLES
  // ============================================================

  async retrieveRelevantPassages(query, k = 5) {
    try {
      logger.info(
        `Retrieving top-${k} passages for query: "${query}"`
      );

      const queryEmbedding =
        await this.embeddingService.generateQueryEmbedding(query);

      const searchResult = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: queryEmbedding,
          limit: k,
          with_payload: true,
          score_threshold: 0.3,
        }
      );

      logger.info(
        `Retrieved ${searchResult.length} relevant articles`
      );

      return searchResult.map(result => ({
        title: result.payload.title,
        content: result.payload.content,
        description: result.payload.description,
        url: result.payload.url,
        source: result.payload.source,
        publishDate: result.payload.publishDate,
        similarity: result.score,

        relevantText: this.extractRelevantText(
          result.payload,
          query
        ),
      }));
    } catch (error) {
      logger.error(
        'Error retrieving passages:',
        error
      );

      return [];
    }
  }

  // ============================================================
  // GENERATE ANSWER USING GEMINI
  // ============================================================

  async generateAnswer(query, context) {
    try {
      if (!context || context.length === 0) {
        return "I couldn't find any relevant news. Please try rephrasing your question.";
      }

      const contextText = context
        .map(
          (article, i) =>
            `Article ${i + 1}:
Title: ${article.title || 'Unknown'}
Content: ${
              article.relevantText ||
              article.description ||
              (article.content
                ? article.content.substring(0, 500)
                : '')
            }
Source: ${article.source || 'Unknown'}
Date: ${article.publishDate || 'Unknown'}
URL: ${article.url || ''}
---`
        )
        .join('\n');

      const prompt = `You are a helpful news assistant.

IMPORTANT RULES:
1. Answer the user's question using ONLY the provided articles.
2. Do not invent information.
3. If the articles do not contain enough information, say that the available articles do not provide enough information.
4. Keep the answer concise and useful.
5. Mention relevant details from the sources when possible.

Context:
${contextText}

User Question:
${query}

Answer:`;

      logger.info(
        `Sending request to Gemini using gemini-3.6-flash`
      );

      // Retry a few times for temporary 503/429 errors.
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          logger.info(
            `Sending request to Gemini (attempt ${attempt}/${maxAttempts})`
          );

          const response = await axios.post(
            `${this.geminiBaseUrl}?key=${this.geminiApiKey}`,
            {
              contents: [
                {
                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],

              generationConfig: {
                maxOutputTokens: 512,
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },

              // Give Gemini more than the old 30 seconds.
              timeout: 55000,
            }
          );

          const answer =
            response.data?.candidates?.[0]?.content?.parts?.[0]
              ?.text;

          if (answer) {
            logger.info(
              'Gemini generated answer successfully'
            );

            return answer;
          }

          logger.warn(
            'Gemini returned no answer text'
          );
        } catch (error) {
          const status = error.response?.status;

          logger.error(
            `Gemini request failed on attempt ${attempt}`,
            {
              status,
              message:
                error.response?.data?.error?.message ||
                error.message,
            }
          );

          // Retry only temporary errors.
          const shouldRetry =
            status === 429 ||
            status === 500 ||
            status === 502 ||
            status === 503 ||
            status === 504;

          if (!shouldRetry || attempt === maxAttempts) {
            throw error;
          }

          // Wait before retrying.
          const delay = attempt * 2000;

          logger.info(
            `Retrying Gemini request in ${delay}ms...`
          );

          await new Promise(resolve =>
            setTimeout(resolve, delay)
          );
        }
      }

      throw new Error(
        'Gemini did not return a valid answer'
      );
    } catch (error) {
      logger.error('Gemini Error:', {
        status: error.response?.status,
        message:
          error.response?.data?.error?.message ||
          error.message,
      });

      // Graceful fallback.
      if (context && context.length > 0) {
        const firstArticle = context[0];

        return `Summary of most relevant article:

Title: ${firstArticle.title || 'Unknown'}

${
          firstArticle.description ||
          firstArticle.content?.substring(0, 300) ||
          'No summary available.'
        }...`;
      }

      return "I'm having trouble generating a response right now. Please try again later.";
    }
  }

  // ============================================================
  // EXTRACT RELEVANT TEXT
  // ============================================================

  extractRelevantText(articlePayload, query) {
    const {
      title = '',
      description = '',
      content = '',
    } = articlePayload;

    const fullText =
      `${title} ${description} ${content}`.trim();

    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);

    const sentences = fullText
      .split(/[.!?]+/)
      .filter(sentence => sentence.trim().length > 20);

    let bestSentence = '';
    let maxMatches = 0;

    for (const sentence of sentences) {
      const lowerSentence =
        sentence.toLowerCase();

      const matches = queryWords.filter(word =>
        lowerSentence.includes(word)
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence.trim();
      }
    }

    return (
      bestSentence ||
      description ||
      content.substring(0, 300)
    );
  }

  // ============================================================
  // COLLECTION STATS
  // ============================================================

  async getCollectionStats() {
    try {
      const info =
        await this.qdrantClient.getCollection(
          this.collectionName
        );

      return {
        totalArticles: info.points_count,
        vectorDimensions:
          info.config.params.vectors.size,
        distance:
          info.config.params.vectors.distance,
        status: info.status,
      };
    } catch (error) {
      logger.error(
        'Error getting stats:',
        error
      );

      return {
        error: error.message,
      };
    }
  }

  // ============================================================
  // SEARCH ARTICLES
  // ============================================================

  async searchArticles(keywords, limit = 10) {
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
            with_payload: true,
          }
        );

      return searchResult.map(r => ({
        id: r.id,
        title: r.payload.title,
        description: r.payload.description,
        url: r.payload.url,
        source: r.payload.source,
        publishDate: r.payload.publishDate,
        similarity: r.score,
      }));
    } catch (error) {
      logger.error(
        'Error searching articles:',
        error
      );

      return [];
    }
  }

  // ============================================================
  // CLEAR ALL ARTICLES
  // ============================================================

  async clearAllArticles() {
    try {
      await this.qdrantClient.deleteCollection(
        this.collectionName
      );

      await this.initialize();

      logger.info('Cleared all articles');

      return true;
    } catch (error) {
      logger.error(
        'Error clearing articles:',
        error
      );

      throw error;
    }
  }

  // ============================================================
  // QDRANT CONNECTION CHECK
  // ============================================================

  async isConnected() {
    try {
      await this.qdrantClient.getCollections();

      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  async healthCheck() {
    try {
      const isQdrantConnected =
        await this.isConnected();

      const stats =
        await this.getCollectionStats();

      return {
        status: 'healthy',
        qdrant: isQdrantConnected,
        articlesCount:
          stats.totalArticles || 0,
        lastChecked:
          new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastChecked:
          new Date().toISOString(),
      };
    }
  }
}

module.exports = RAGService;