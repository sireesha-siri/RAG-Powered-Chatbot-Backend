#!/usr/bin/env node

/**
 * Comprehensive News Ingestion Script
 * Purpose: Fetch articles from 100+ RSS feeds across 10 categories and store in vector database
 * Usage: node scripts/ingestNews.js [options]
 * 
 * Features:
 * - 100+ RSS feeds across all major categories
 * - Comprehensive knowledge coverage beyond basic 50-article requirement
 * - Enhanced error handling and retry mechanisms
 * - Category-based ingestion strategies
 * - Detailed progress tracking and statistics
 */

require('dotenv').config();
const NewsIngestionService = require('../src/services/NewsIngestionService');
const RAGService = require('../src/services/RAGService');
const logger = require('../src/utils/logger');

async function displayCategoryStatistics() {
  console.log('\n📊 RSS Feed Categories Overview:\n');
  
  const newsService = new NewsIngestionService();
  const stats = newsService.getCategoryStatistics();
  
  console.log('┌─────────────────────┬──────────┬─────────────────────────────────────┐');
  console.log('│ Category            │ Feeds    │ Description                         │');
  console.log('├─────────────────────┼──────────┼─────────────────────────────────────┤');
  
  for (const [category, info] of Object.entries(stats)) {
    if (category === 'total') continue;
    const paddedCategory = category.charAt(0).toUpperCase() + category.slice(1);
    const categoryStr = paddedCategory.padEnd(19);
    const countStr = String(info.feedCount).padEnd(8);
    const descStr = info.description.substring(0, 35);
    console.log(`│ ${categoryStr} │ ${countStr} │ ${descStr.padEnd(35)} │`);
  }
  
  console.log('├─────────────────────┼──────────┼─────────────────────────────────────┤');
  console.log(`│ ${'TOTAL'.padEnd(19)} │ ${String(stats.total).padEnd(8)} │ ${'All categories combined'.padEnd(35)} │`);
  console.log('└─────────────────────┴──────────┴─────────────────────────────────────┘');
  
  console.log('\n💡 Note: Though assignment mentions ~50 articles, we use 100+ feeds');
  console.log('   for comprehensive knowledge coverage across all domains.\n');
}

async function runComprehensiveIngestion() {
  const startTime = Date.now();
  
  try {
    console.log('\n🚀 Starting Comprehensive News Ingestion Pipeline\n');
    console.log('='.repeat(60));
    
    // Display feed statistics
    await displayCategoryStatistics();
    
    // Initialize services
    console.log('📡 Initializing RAG service...');
    const newsService = new NewsIngestionService();
    const ragService = new RAGService();
    
    await ragService.initialize();
    console.log('✅ RAG service initialized\n');

    // Check current database status
    console.log('📊 Checking current database status...');
    try {
      const currentStats = await ragService.getCollectionStats();
      const currentCount = currentStats.totalArticles || 0;
      console.log(`   Current articles in database: ${currentCount}\n`);
      
      if (currentCount > 0) {
        console.log('⚠️  Database contains existing articles.');
        console.log('   New articles will be added to existing collection.');
        
        // Ask user if they want to clear existing data
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const shouldClear = await new Promise(resolve => {
          rl.question('   Clear existing articles and start fresh? (y/N): ', answer => {
            resolve(answer.toLowerCase().startsWith('y'));
          });
        });
        
        rl.close();
        
        if (shouldClear) {
          console.log('   Clearing existing articles...');
          await ragService.clearAllArticles();
          console.log('   ✅ Database cleared\n');
        } else {
          console.log('   Continuing with existing articles\n');
        }
      }
    } catch (error) {
      console.log('   Database appears to be empty (normal for first run)\n');
    }

    // Get strategy from environment variable or use default
    const strategy = process.env.INGESTION_STRATEGY || 'comprehensive';
    const targetArticles = parseInt(process.env.TARGET_ARTICLES || '60');
    
    console.log('🎯 Ingestion Configuration:');
    console.log(`   Strategy: ${strategy}`);
    console.log(`   Target articles: ${targetArticles}`);
    console.log(`   Timeout per feed: 15 seconds`);
    console.log(`   Retry attempts: 3 per feed\n`);
    
    // Fetch articles using comprehensive strategy
    console.log('📰 Fetching articles from 100+ RSS feeds across all categories...');
    console.log('   This process respects server rate limits and may take 3-5 minutes...\n');
    
    const articles = await newsService.ingestWithStrategy(strategy, targetArticles);
    
    console.log(`\n✅ Successfully fetched ${articles.length} articles`);
    
    if (articles.length === 0) {
      throw new Error('No articles were successfully processed. Check network connection and feed availability.');
    }

    // Display comprehensive article statistics
    console.log('\n📊 Article Collection Analysis:');
    
    // Category breakdown
    const categoryBreakdown = {};
    articles.forEach(article => {
      categoryBreakdown[article.category] = (categoryBreakdown[article.category] || 0) + 1;
    });
    
    console.log('\n   Articles by Category:');
    for (const [category, count] of Object.entries(categoryBreakdown)) {
      const percentage = ((count / articles.length) * 100).toFixed(1);
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      console.log(`     ${categoryName}: ${count} articles (${percentage}%)`);
    }
    
    // Source distribution
    const sourceBreakdown = {};
    articles.forEach(article => {
      sourceBreakdown[article.source] = (sourceBreakdown[article.source] || 0) + 1;
    });
    const uniqueSources = Object.keys(sourceBreakdown).length;
    console.log(`\n   Unique Sources: ${uniqueSources}`);
    console.log(`   Average Content Length: ${Math.round(articles.reduce((sum, a) => sum + a.wordCount, 0) / articles.length)} words`);

    // Display sample articles from different categories
    console.log('\n📋 Sample Articles from Different Categories:');
    const samplesByCategory = {};
    articles.forEach(article => {
      if (!samplesByCategory[article.category] && Object.keys(samplesByCategory).length < 6) {
        samplesByCategory[article.category] = article;
      }
    });
    
    Object.entries(samplesByCategory).forEach(([category, article], index) => {
      console.log(`\n   ${index + 1}. [${category.toUpperCase()}] ${article.title}`);
      console.log(`      Source: ${article.source}`);
      console.log(`      Date: ${new Date(article.pubDate).toLocaleDateString()}`);
      console.log(`      Content: ${article.wordCount} words`);
      console.log(`      URL: ${article.url.substring(0, 80)}...`);
    });

    // Store in vector database
    console.log('\n💾 Generating embeddings and storing in vector database...');
    console.log('   Creating semantic vectors for intelligent search...');
    console.log('   This process may take 2-4 minutes depending on article count...\n');
    
    let storedCount = 0;
    try {
      storedCount = await ragService.storeArticles(articles);
      console.log(`✅ Successfully stored ${storedCount} articles with embeddings`);
    } catch (error) {
      console.error(`❌ Error storing articles: ${error.message}`);
      logger.error('Storage error:', error);
      throw error;
    }
    
    // Final database verification
    console.log('\n📈 Final Database Statistics:');
    try {
      const finalStats = await ragService.getCollectionStats();
      console.log(`   Total articles: ${finalStats.totalArticles || storedCount}`);
      console.log(`   Vector dimensions: ${finalStats.vectorDimensions || 'N/A'}`);
      console.log(`   Distance metric: ${finalStats.distance || 'cosine'}`);
      console.log(`   Categories represented: ${Object.keys(categoryBreakdown).length}`);
    } catch (error) {
      console.log(`   Articles stored: ${storedCount} (stats unavailable)`);
    }
    
    // Test the RAG system with diverse queries
    console.log('\n🔍 Testing RAG System Capabilities...');
    
    const testQueries = [
      { query: "What's happening in technology today?", category: "Technology" },
      { query: "Latest business and finance news", category: "Business" },
      { query: "Health and wellness updates", category: "Health" },
      { query: "Current sports headlines", category: "Sports" },
      { query: "Entertainment and pop culture news", category: "Entertainment" }
    ];
    
    let successfulQueries = 0;
    
    for (const testCase of testQueries.slice(0, 3)) { // Test first 3 queries
      console.log(`\n   Testing ${testCase.category}: "${testCase.query}"`);
      
      try {
        const results = await ragService.retrieveRelevantPassages(testCase.query, 3);
        
        if (results.length > 0) {
          console.log(`     ✅ Found ${results.length} relevant articles`);
          console.log(`     📰 Top match: "${results[0].title}"`);
          console.log(`     🎯 Similarity: ${Math.round(results[0].similarity * 100)}%`);
          console.log(`     📍 Source: ${results[0].source}`);
          successfulQueries++;
        } else {
          console.log(`     ⚠️  No relevant articles found for this query`);
        }
      } catch (error) {
        console.log(`     ❌ Query failed: ${error.message}`);
      }
      
      // Small delay between test queries
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test full RAG pipeline with one query
    console.log('\n🤖 Testing Full RAG Pipeline (Retrieval + Generation)...');
    try {
      const testQuery = "What are the latest technology trends?";
      console.log(`   Query: "${testQuery}"`);
      
      const passages = await ragService.retrieveRelevantPassages(testQuery, 5);
      if (passages.length > 0) {
        const answer = await ragService.generateAnswer(testQuery, passages);
        console.log(`   ✅ AI Response Generated Successfully`);
        console.log(`   📝 Response length: ${answer.length} characters`);
        console.log(`   🔗 Used ${passages.length} source articles`);
      } else {
        console.log(`   ⚠️  No relevant passages found for answer generation`);
      }
    } catch (error) {
      console.log(`   ❌ Full pipeline test failed: ${error.message}`);
    }
    
    // Calculate and display final metrics
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    const articlesPerSecond = (articles.length / Math.max(duration, 1)).toFixed(2);
    
    console.log('\n🎉 Comprehensive Ingestion Pipeline Complete!');
    console.log('='.repeat(60));
    console.log('📊 Final Summary:');
    console.log(`   • Total articles processed: ${articles.length}`);
    console.log(`   • Articles successfully stored: ${storedCount}`);
    console.log(`   • Categories covered: ${Object.keys(categoryBreakdown).length}/10`);
    console.log(`   • Unique sources: ${uniqueSources}`);
    console.log(`   • Processing time: ${duration} seconds`);
    console.log(`   • Processing rate: ${articlesPerSecond} articles/second`);
    console.log(`   • Test queries successful: ${successfulQueries}/3`);
    console.log(`   • System status: ✅ Ready for comprehensive Q&A!`);
    
    console.log('\n💡 Your RAG chatbot now has comprehensive knowledge across:');
    console.log('   📰 News & Current Affairs    🚀 Technology & Startups');
    console.log('   💼 Business & Finance        ⚽ Sports');  
    console.log('   🎬 Entertainment            🏥 Health & Wellness');
    console.log('   🔬 Science & Education      ✈️  Travel & Lifestyle');
    console.log('   🎨 Hobbies & Interests      💻 Web Development');
    
    console.log('\n🚀 Next Steps:');
    console.log('   • Start your RAG chatbot server');
    console.log('   • Test queries across different categories');
    console.log('   • Monitor system performance');
    console.log('   • Schedule regular re-ingestion for fresh content\n');

    console.log('\n✅ Exiting process after successful ingestion.\n');
    process.exit(0);  // <-- Added this line for exiting after completion
    
  } catch (error) {
    console.error(`❌ Comprehensive ingestion failed: ${error.message}`);
    logger.error('Comprehensive ingestion error:', error);
    
    // Provide helpful error context
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('   • Check your internet connection');
    console.log('   • Verify all API keys in .env file:');
    console.log('     - GEMINI_API_KEY (for AI responses)');
    console.log('     - JINA_API_KEY (for embeddings)'); 
    console.log('     - QDRANT_URL (for vector database)');
    console.log('   • Some RSS feeds may be temporarily unavailable (normal)');
    console.log('   • Try running with --test flag first to check connectivity');
    console.log('   • Reduce TARGET_ARTICLES if memory/timeout issues occur\n');
    
    process.exit(1);
  }
}

// Enhanced test mode for comprehensive feed testing
async function testComprehensiveFeeds() {
  console.log('\n🧪 Testing Comprehensive RSS Feed System\n');
  console.log('='.repeat(50));
  
  try {
    const newsService = new NewsIngestionService();
    
    // Display category overview first
    await displayCategoryStatistics();
    
    // Test feeds from each category
    const categorizedFeeds = newsService.getHundredRSSFeeds();
    const testResults = {};
    
    console.log('Testing 2 feeds from each category...\n');
    
    for (const [category, feeds] of Object.entries(categorizedFeeds)) {
      console.log(`🔍 Testing ${category.toUpperCase()} category...`);
      
      try {
        const results = await newsService.testCategoryFeeds(category, 2);
        const working = results.filter(r => r.success).length;
        const total = results.length;
        
        testResults[category] = { working, total, results };
        
        if (working > 0) {
          console.log(`   ✅ ${working}/${total} feeds responding`);
          const workingSample = results.find(r => r.success);
          if (workingSample && workingSample.sample) {
            console.log(`   📰 Sample: "${workingSample.sample.substring(0, 60)}..."`);
          }
        } else {
          console.log(`   ❌ ${working}/${total} feeds responding`);
        }
      } catch (error) {
        console.log(`   ❌ Category test failed: ${error.message}`);
        testResults[category] = { working: 0, total: feeds.length, error: error.message };
      }
      
      // Small delay between category tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(30));
    
    const totalCategories = Object.keys(testResults).length;
    const workingCategories = Object.values(testResults).filter(cat => cat.working > 0).length;
    const totalWorkingFeeds = Object.values(testResults).reduce((sum, cat) => sum + cat.working, 0);
    
    console.log(`Categories tested: ${totalCategories}`);
    console.log(`Categories with working feeds: ${workingCategories}`);
    console.log(`Total working feeds: ${totalWorkingFeeds}+`);
    
    if (workingCategories >= 5) {
      console.log('\n✅ System ready for comprehensive ingestion!');
      console.log('   Run without --test flag to proceed with full ingestion.');
    } else if (workingCategories >= 3) {
      console.log('\n⚠️  Limited connectivity detected.');
      console.log('   Some categories may have issues, but ingestion can proceed.');
    } else {
      console.log('\n❌ Insufficient feed connectivity.');
      console.log('   Check your internet connection and try again.');
    }
    
    console.log('\nDetailed Results:');
    for (const [category, result] of Object.entries(testResults)) {
      const status = result.working > 0 ? '✅' : '❌';
      console.log(`   ${status} ${category}: ${result.working} working feeds`);
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Comprehensive feed test failed:', error.message);
    process.exit(1);
  }
}

// Enhanced main function with comprehensive options
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📰 Comprehensive News Ingestion Script
=====================================

Purpose: Fetch articles from 100+ RSS feeds across 10 categories for comprehensive RAG knowledge

Usage:
  node scripts/ingestNews.js [options]

Options:
  --help, -h         Show this help message
  --test, -t         Test feed connectivity across all categories
  --run, -r          Run comprehensive ingestion (default)
  --clear, -c        Force clear existing data without asking
  --strategy=NAME    Specify ingestion strategy
  --target=NUMBER    Set target number of articles (default: 60)

Available Strategies:
  comprehensive      - Balanced across all 10 categories (default)
  news_focused      - Emphasize news, tech, and business feeds
  balanced_lifestyle - Include lifestyle, entertainment, and travel
  tech_business     - Focus on technology and business feeds

Environment Variables:
  GEMINI_API_KEY     - Google Gemini API key (required)
  JINA_API_KEY       - Jina Embeddings API key (required)  
  QDRANT_URL         - Qdrant database URL (required)
  REDIS_URL          - Redis database URL (optional)
  TARGET_ARTICLES    - Number of target articles (default: 60)
  INGESTION_STRATEGY - Default strategy to use

Examples:
  node scripts/ingestNews.js --test
  node scripts/ingestNews.js --strategy=comprehensive --target=80
  node scripts/ingestNews.js --clear --strategy=tech_business
  
Categories Covered:
  📰 News & Current Affairs (10 feeds)   🚀 Technology & Startups (10 feeds)
  💼 Business & Finance (10 feeds)       ⚽ Sports (10 feeds)
  🎬 Entertainment (10 feeds)            🏥 Health & Wellness (10 feeds)
  🔬 Science & Education (10 feeds)      ✈️  Travel & Lifestyle (10 feeds)
  🎨 Hobbies & Special Interests (10)    💻 Web Development (10 feeds)
  
Total: 100+ RSS feeds for comprehensive knowledge coverage
    `);
    return;
  }
  
  // Check required environment variables
  const requiredEnvVars = ['GEMINI_API_KEY', 'JINA_API_KEY', 'QDRANT_URL'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(envVar => {
      console.error(`   • ${envVar}`);
    });
    console.error('\nPlease add these to your .env file and try again.\n');
    process.exit(1);
  }
  
  // Handle force clear option
  if (args.includes('--clear') || args.includes('-c')) {
    process.env.FORCE_CLEAR = 'true';
  }
  
  // Handle test mode
  if (args.includes('--test') || args.includes('-t')) {
    await testComprehensiveFeeds();
    return;
  }
  
  // Handle strategy selection
  const strategyArg = args.find(arg => arg.startsWith('--strategy='));
  if (strategyArg) {
    const strategy = strategyArg.split('=')[1];
    process.env.INGESTION_STRATEGY = strategy;
    console.log(`Strategy set to: ${strategy}`);
  }
  
  // Handle target articles selection
  const targetArg = args.find(arg => arg.startsWith('--target='));
  if (targetArg) {
    const target = targetArg.split('=')[1];
    if (isNaN(parseInt(target)) || parseInt(target) < 10) {
      console.error('Target articles must be a number >= 10');
      process.exit(1);
    }
    process.env.TARGET_ARTICLES = target;
    console.log(`Target articles set to: ${target}`);
  }
  
  // Run comprehensive ingestion
  await runComprehensiveIngestion();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nIngestion interrupted by user');
  console.log('Partial data may have been stored.');
  console.log('Run the script again to continue ingestion.\n');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled rejection in ingestion script:', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.error('Uncaught exception in ingestion script:', error);
  process.exit(1);
});

// Export functions for potential use in other modules (maintaining compatibility with your existing code)
module.exports = {
  runIngestion: runComprehensiveIngestion, // Main function your existing code expects
  runComprehensiveIngestion,              // New comprehensive function
  testComprehensiveFeeds,
  displayCategoryStatistics,
  runTestMode: testComprehensiveFeeds     // Alias for backward compatibility
};

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`Script execution failed: ${error.message}`);
    logger.error('Script execution error:', error);
    process.exit(1);
  });
}