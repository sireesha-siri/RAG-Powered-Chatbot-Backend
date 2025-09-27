const axios = require('axios');
const { QdrantClient } = require('@qdrant/js-client-rest');
const EmbeddingService = require('./EmbeddingService');
const logger = require('../utils/logger');

/**
 * RAGService combines Retrieval + AI Generation
 * Purpose: Find relevant news articles and generate smart answers
 * Flow: User Question → Find Similar Articles → AI Creates Answer
 */
class RAGService {
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.collectionName = 'news_articles';
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  }

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
            distance: 'Cosine'
          }
        });
        logger.info(`Created Qdrant collection: ${this.collectionName}`);
      } else {
        logger.info(`Qdrant collection exists: ${this.collectionName}`);
      }
    } catch (error) {
      logger.error('Error initializing RAG service:', error);
      throw error;
    }
  }

  async storeArticles(articles) {
    try {
      logger.info(`Storing ${articles.length} articles in vector database`);
      
      const points = [];
      
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const textForEmbedding = `${article.title || ''} ${article.description || ''} ${article.content || ''}`;
        const embeddings = await this.embeddingService.generateEmbeddings([textForEmbedding]);
        const embedding = embeddings[0].embedding;

        points.push({
          id: i + 1,
          vector: embedding,
          payload: {
            title: article.title || '',
            description: article.description || '',
            content: article.content || '',
            url: article.link || '',
            publishDate: article.pubDate || new Date().toISOString(),
            source: article.source || 'Unknown',
            category: article.category || 'General',
            createdAt: new Date().toISOString()
          }
        });

        logger.info(`Processed article ${i + 1}/${articles.length}: ${article.title?.substring(0, 50)}...`);
      }

      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: points
      });

      logger.info(`Successfully stored ${points.length} articles in vector database`);
      return points.length;
    } catch (error) {
      logger.error('Error storing articles:', error);
      throw error;
    }
  }

  async retrieveRelevantPassages(query, k = 5) {
    try {
      logger.info(`Retrieving top-${k} passages for query: "${query}"`);
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit: k,
        with_payload: true,
        score_threshold: 0.3
      });

      const relevantPassages = searchResult.map(result => ({
        title: result.payload.title,
        content: result.payload.content,
        description: result.payload.description,
        url: result.payload.url,
        source: result.payload.source,
        publishDate: result.payload.publishDate,
        similarity: result.score,
        relevantText: this.extractRelevantText(result.payload, query)
      }));

      logger.info(`Found ${relevantPassages.length} relevant passages`);
      return relevantPassages;
    } catch (error) {
      logger.error('Error retrieving passages:', error);
      return [];
    }
  }

  async generateAnswer(query, context) {
    try {
      if (!context || context.length === 0) {
        return "I couldn't find any relevant news articles to answer your question. Could you please try rephrasing your question?";
      }

      const contextText = context.map((article, index) => 
        `Article ${index + 1}:
Title: ${article.title}
Content: ${article.relevantText || article.description || article.content.substring(0, 500)}
Source: ${article.source}
Date: ${article.publishDate}
---`
      ).join('\n');

      const prompt = `You are a helpful news assistant. Based on the following news articles, answer the user's question accurately and concisely.

Context (News Articles):
${contextText}

User Question: ${query}

Instructions:
1. Answer based only on the provided articles
2. Be concise but informative
3. Mention relevant sources when possible
4. If the articles don't contain enough information, say so
5. Keep the response under 300 words

Answer:`;

      logger.info('Generating answer with Gemini API');

      const response = await axios.post(
        `${this.geminiBaseUrl}?key=${this.geminiApiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response from Gemini API');
      }

      const answer = response.data.candidates[0].content.parts[0].text;
      logger.info('Successfully generated answer');
      
      return answer;
    } catch (error) {
      logger.error('Error generating answer:', error);

      if (context.length > 0) {
        return `Here are the key points from the most relevant article about "${query}":\n\nTitle: ${context[0].title}\nSummary: ${context[0].description || context[0].content.substring(0, 200)}...`;
      }

      return "I apologize, but I'm having trouble generating a response right now. Please try again later.";
    }
  }

  extractRelevantText(articlePayload, query) {
    const { title, description, content } = articlePayload;
    const fullText = `${title} ${description} ${content}`;
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const sentences = fullText.split(/[.!?]+/).filter(sentence => sentence.length > 20);

    let bestSentence = '';
    let maxMatches = 0;

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matches = queryWords.filter(word => lowerSentence.includes(word)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence.trim();
      }
    }

    return bestSentence || description || content.substring(0, 300);
  }

  async getCollectionStats() {
    try {
      const info = await this.qdrantClient.getCollection(this.collectionName);
      return {
        totalArticles: info.points_count,
        vectorDimensions: info.config.params.vectors.size,
        distance: info.config.params.vectors.distance,
        status: info.status
      };
    } catch (error) {
      logger.error('Error getting collection stats:', error);
      return { error: error.message };
    }
  }

  async searchArticles(keywords, limit = 10) {
    try {
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(keywords);
      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true
      });

      return searchResult.map(result => ({
        id: result.id,
        title: result.payload.title,
        description: result.payload.description,
        url: result.payload.url,
        source: result.payload.source,
        publishDate: result.payload.publishDate,
        similarity: result.score
      }));
    } catch (error) {
      logger.error('Error searching articles:', error);
      return [];
    }
  }

  async clearAllArticles() {
    try {
      await this.qdrantClient.deleteCollection(this.collectionName);
      await this.initialize();
      logger.info('Cleared all articles from vector database');
      return true;
    } catch (error) {
      logger.error('Error clearing articles:', error);
      throw error;
    }
  }

  async isConnected() {
    try {
      await this.qdrantClient.getCollections();
      return true;
    } catch (error) {
      return false;
    }
  }

  async healthCheck() {
    try {
      const isQdrantConnected = await this.isConnected();
      const stats = await this.getCollectionStats();
      
      return {
        status: 'healthy',
        qdrant: isQdrantConnected,
        articlesCount: stats.totalArticles || 0,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }
}

module.exports = RAGService;
