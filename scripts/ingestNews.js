#!/usr/bin/env node

/**
 * News Ingestion Script
 * Purpose: Fetch news articles and store them in vector database
 * Usage: node scripts/ingestNews.js
 * Run this script to populate your RAG system with fresh news data
 */

require('dotenv').config();
const NewsIngestionService = require('../src/services/NewsIngestionService');
const RAGService = require('../src/services/RAGService');
const logger = require('../src/utils/logger');

async function runIngestion() {
  const startTime = Date.now();
  
  console.log('\n Starting News Ingestion Pipeline...\n');
  
  try {
    // Initialize services
    const newsService = new NewsIngestionService();
    const ragService = new RAGService();
    
    console.log(' nitializing RAG service...');
    await ragService.initialize();
    console.log('RAG service initialized\n');
    
    // Get current stats
    console.log('Checking current database status...');
    const currentStats = await ragService.getCollectionStats();
    console.log(`Current articles in database: ${currentStats.totalArticles || 0}\n`);
    
    // Ask user if they want to clear existing data
    if (currentStats.totalArticles > 0) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const shouldClear = await new Promise(resolve => {
        rl.question('Found existing articles. Clear them and start fresh? (y/N): ', answer => {
          resolve(answer.toLowerCase().startsWith('y'));
        });
      });
      
      rl.close();
      
      if (shouldClear) {
        console.log('Clearing existing articles...');
        await ragService.clearAllArticles();
        console.log('Database cleared\n');
      }
    }
    
    // Fetch fresh articles
    console.log('Fetching fresh news articles...');
    const articles = await newsService.ingestWithStrategy('exactly_fifty');
    
    console.log(`Successfully fetched ${articles.length} articles\n`);
    
    // Display sample articles
    console.log('Sample Articles:');
    articles.slice(0, 3).forEach((article, index) => {
      console.log(`   ${index + 1}. ${article.title}`);
      console.log(`      Source: ${article.source} | Date: ${article.pubDate}`);
      console.log(`      Length: ${article.content.length} characters\n`);
    });
    
    // Store articles in vector database
    console.log('Generating embeddings and storing in vector database...');
    console.log('This may take a few minutes...\n');
    
    const storedCount = await ragService.storeArticles(articles);
    
    console.log(`Successfully stored ${storedCount} articles with embeddings\n`);
    
    // Final stats
    console.log('Final verification...');
    const finalStats = await ragService.getCollectionStats();
    console.log(`Total articles in database: ${finalStats.totalArticles}`);
    console.log(`Vector dimensions: ${finalStats.vectorDimensions}`);
    console.log(`Distance metric: ${finalStats.distance}\n`);
    
    // Test the system
    console.log('Testing RAG system...');
    const testQuery = "What's happening in technology?";
    console.log(`Test query: "${testQuery}"`);
    
    const testResults = await ragService.retrieveRelevantPassages(testQuery, 3);
    console.log(`Found ${testResults.length} relevant passages\n`);
    
    if (testResults.length > 0) {
      console.log('Top relevant article:');
      console.log(`   Title: ${testResults[0].title}`);
      console.log(`   Source: ${testResults[0].source}`);
      console.log(`   Similarity: ${Math.round(testResults[0].similarity * 100)}%\n`);
      
      // Test full RAG pipeline
      console.log('Testing full RAG pipeline...');
      const answer = await ragService.generateAnswer(testQuery, testResults);
      console.log('AI Response:');
      console.log(`   ${answer.substring(0, 200)}...\n`);
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('Ingestion Pipeline Complete!');
    console.log(`Total time: ${duration} seconds`);
    console.log(`Articles processed: ${articles.length}`);
    console.log(`Articles stored: ${storedCount}`);
    console.log(`System ready for queries!\n`);
    
  } catch (error) {
    console.error('Ingestion failed:', error.message);
    logger.error('Ingestion script error:', error);
    process.exit(1);
  }
}

// Handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📰 News Ingestion Script
========================

Purpose: Fetch news articles and populate the RAG vector database

Usage:
  node scripts/ingestNews.js [options]

Options:
  --help, -h     Show this help message
  --test, -t     Run in test mode (fewer articles)
  --clear, -c    Clear existing data without asking
  --categories   Specify categories (comma-separated)

Examples:
  node scripts/ingestNews.js
  node scripts/ingestNews.js --test
  node scripts/ingestNews.js --categories=technology,business
  node scripts/ingestNews.js --clear

Environment Variables Required:
  GEMINI_API_KEY     - Google Gemini API key
  JINA_API_KEY       - Jina Embeddings API key
  QDRANT_URL         - Qdrant database URL
  REDIS_URL          - Redis database URL
    `);
    return;
  }
  
  // Check required environment variables
  const requiredEnvVars = ['GEMINI_API_KEY', 'JINA_API_KEY', 'QDRANT_URL'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:');
    missingEnvVars.forEach(envVar => {
      console.error(`   - ${envVar}`);
    });
    console.error('\nPlease check your .env file and try again.\n');
    process.exit(1);
  }
  
  await runIngestion();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n Ingestion interrupted by user');
  console.log('Goodbye!\n');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { runIngestion };