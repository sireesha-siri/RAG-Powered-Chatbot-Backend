const axios = require('axios');
const logger = require('../utils/logger');

/**
 * EmbeddingService converts text to numerical vectors
 * Purpose: Transform human text into numbers that computers can compare
 * Example: "Apple stock rises" → [0.1, -0.5, 0.8, 0.2, ...] (512 numbers)
 */
class EmbeddingService {
  constructor() {
    this.jinaApiKey = process.env.JINA_API_KEY;
    this.baseUrl = 'https://api.jina.ai/v1/embeddings';
    this.model = 'jina-embeddings-v3';
  }

  /**
   * Convert text to embedding vector using Jina API
   * @param {string|Array} texts - Single text or array of texts
   * @returns {Array} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    // Ensure texts is an array FIRST - before try block
    const inputTexts = Array.isArray(texts) ? texts : [texts];
    
    try {
      // Validate input
      if (inputTexts.length === 0) {
        throw new Error('No texts provided for embedding');
      }

      // Clean and prepare texts
      const cleanedTexts = inputTexts.map(text => 
        this.cleanText(text).substring(0, 8000) // Limit text length
      );

      logger.info(`Generating embeddings for ${cleanedTexts.length} texts`);

      const response = await axios.post(this.baseUrl, {
        input: cleanedTexts,
        model: this.model
      }, {
        headers: {
          'Authorization': `Bearer ${this.jinaApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from Jina API');
      }

      const embeddings = response.data.data.map(item => ({
        embedding: item.embedding,
        text: cleanedTexts[item.index],
        dimensions: item.embedding.length
      }));

      logger.info(`Generated ${embeddings.length} embeddings`);
      return embeddings;

    } catch (error) {
      logger.error('Error generating embeddings:', error.message);
      
      // Fallback to dummy embeddings for development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using dummy embeddings for development');
        return this.generateDummyEmbeddings(inputTexts); // Now inputTexts is defined
      }
      
      throw error;
    }
  }

  /**
   * Generate single embedding for a query
   * @param {string} query - User query text
   * @returns {Array} Single embedding vector
   */
  async generateQueryEmbedding(query) {
    const embeddings = await this.generateEmbeddings([query]);
    return embeddings[0].embedding;
  }

  /**
   * Clean text before embedding
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\.,!?-]/g, '') // Remove special characters except basic punctuation
      .trim()
      .substring(0, 8000); // Limit length for API
  }

  /**
   * Calculate cosine similarity between two vectors
   * Purpose: Measure how similar two pieces of text are
   * Returns: Number between -1 and 1 (1 = identical, 0 = no similarity, -1 = opposite)
   */
  calculateCosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generate dummy embeddings for development/testing
   * @param {Array} texts - Array of texts
   * @returns {Array} Array of dummy embeddings
   */
  generateDummyEmbeddings(texts) {
    const inputTexts = Array.isArray(texts) ? texts : [texts];
    
    return inputTexts.map((text, index) => ({
      embedding: Array.from({length: 512}, () => Math.random() * 2 - 1), // Random numbers between -1 and 1
      text: this.cleanText(text),
      dimensions: 512
    }));
  }

  /**
   * Batch process large amounts of text
   * @param {Array} texts - Large array of texts
   * @param {number} batchSize - Number of texts per batch
   * @returns {Array} All embeddings
   */
  async batchGenerateEmbeddings(texts, batchSize = 10) {
    const allEmbeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
      
      try {
        const embeddings = await this.generateEmbeddings(batch);
        allEmbeddings.push(...embeddings);
        
        // Small delay to avoid rate limiting
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
        // Continue with next batch instead of failing completely
      }
    }
    
    return allEmbeddings;
  }

  /**
   * Validate embedding vector
   * @param {Array} embedding - Embedding vector
   * @returns {boolean} True if valid
   */
  validateEmbedding(embedding) {
    return Array.isArray(embedding) && 
           embedding.length > 0 && 
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  }
}

module.exports = EmbeddingService;