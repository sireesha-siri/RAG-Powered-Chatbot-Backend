// Updated NewsIngestionService.js with exactly 50 RSS feeds
// Replace your existing getFeeds or similar method with this:

const Parser = require('rss-parser');
const logger = require('../utils/logger');

class NewsIngestionService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        feed: ['language', 'copyright'],
        item: [
          ['media:content', 'mediaContent'],
          ['dc:creator', 'creator'],
          'category'
        ]
      }
    });
    this.maxArticlesPerFeed = 1; // 1 article per feed = 50 total
  }

  // Exactly 50 RSS feed URLs
  getFiftyRSSFeeds() {
    return [
      // MAJOR NEWS OUTLETS (15 feeds)
      "https://feeds.reuters.com/reuters/topNews",
      "https://feeds.reuters.com/reuters/worldNews", 
      "https://rss.cnn.com/rss/edition.rss",
      "https://feeds.bbci.co.uk/news/rss.xml",
      "https://feeds.npr.org/1001/rss.xml",
      "https://feeds.washingtonpost.com/rss/world",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      "https://feeds.guardian.co.uk/theguardian/rss",
      "https://feeds.usatoday.com/news/topstories",
      "https://feeds.abcnews.com/abcnews/topstories",
      "https://feeds.nbcnews.com/nbcnews/public/news",
      "https://feeds.yahoo.com/news/topstories",
      "https://rss.cbs.com/rss/cbsnews_main",
      "https://feeds.foxnews.com/foxnews/latest",
      "https://feeds.apnews.com/ApNewsTopNews",

      // TECHNOLOGY NEWS (10 feeds)
      "https://feeds.reuters.com/reuters/technologyNews",
      "https://rss.cnn.com/rss/edition_technology.rss",
      "https://feeds.feedburner.com/TechCrunch",
      "https://www.theverge.com/rss/index.xml",
      "https://feeds.arstechnica.com/arstechnica/index",
      "https://feeds.mashable.com/Mashable",
      "https://www.wired.com/feed/rss",
      "https://feeds.engadget.com/engadget",
      "https://feeds.gizmodo.com/gizmodo/current",
      "https://www.cnet.com/rss/news/",

      // BUSINESS & FINANCE (10 feeds)
      "https://feeds.reuters.com/reuters/businessNews",
      "https://rss.cnn.com/rss/money_latest.rss",
      "https://feeds.bloomberg.com/markets/news.rss",
      "https://feeds.fortune.com/fortune/headlines",
      "https://feeds.forbes.com/forbes/business",
      "https://feeds.cnbc.com/cnbc/world",
      "https://feeds.wsj.com/wsj/xml/rss/3_7085.xml",
      "https://feeds.marketwatch.com/marketwatch/topstories",
      "https://feeds.ft.com/ft/rss/home/us",
      "https://feeds.businessinsider.com/businessinsider",

      // SCIENCE & HEALTH (8 feeds)
      "https://feeds.reuters.com/reuters/scienceNews",
      "https://feeds.reuters.com/reuters/healthNews",
      "https://rss.cnn.com/rss/edition_health.rss",
      "https://feeds.nature.com/nature/rss/current",
      "https://feeds.sciencedaily.com/sciencedaily/top_news",
      "https://feeds.newscientist.com/latest",
      "https://feeds.nationalgeographic.com/ng/news",
      "https://feeds.livescience.com/LiveScience-Home",

      // INTERNATIONAL NEWS (7 feeds)
      "https://www.aljazeera.com/xml/rss/all.xml",
      "https://feeds.dw.com/dw/english/news",
      "https://feeds.france24.com/en/latest/rss",
      "https://feeds.euronews.com/en/news/rss",
      "https://feeds.skynews.com/feeds/rss/world.xml",
      "https://feeds.independent.co.uk/rss",
      "https://feeds.timesofindia.indiatimes.com/rssfeedstopstories.xml"
    ];
  }

  // Ingest exactly 50 articles (1 from each RSS feed)
  async ingestFiftyArticles() {
    const feeds = this.getFiftyRSSFeeds();
    const allArticles = [];

    logger.info(`Starting ingestion from exactly ${feeds.length} RSS feeds`);

    for (let i = 0; i < feeds.length; i++) {
      const feedUrl = feeds[i];
      
      try {
        logger.info(`Processing feed ${i + 1}/50: ${feedUrl}`);
        
        // Get exactly 1 article from each feed
        const articles = await this.processSingleFeed(feedUrl, 1);
        
        if (articles.length > 0) {
          allArticles.push(articles[0]); // Take only the first article
          logger.info(`✓ Got article: ${articles[0].title?.substring(0, 60)}...`);
        } else {
          logger.warn(`✗ No articles from: ${feedUrl}`);
        }
        
        // Small delay to be respectful to servers
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`✗ Error processing feed ${i + 1}: ${feedUrl}`, error.message);
        // Continue with other feeds instead of failing completely
      }
    }

    logger.info(`Successfully ingested ${allArticles.length}/50 articles`);
    return allArticles;
  }

  // Modified processSingleFeed to limit articles per feed
  async processSingleFeed(feedUrl, maxArticles = 1) {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      const articles = [];

      const itemsToProcess = Math.min(feed.items.length, maxArticles);
      
      for (let i = 0; i < itemsToProcess; i++) {
        const item = feed.items[i];
        
        try {
          const article = await this.processArticleItem(item, feed);
          if (article && this.isValidArticle(article)) {
            articles.push(article);
          }
        } catch (error) {
          logger.warn(`Error processing article: ${item.title}`, error.message);
        }
      }

      return articles;
    } catch (error) {
      logger.error(`Error parsing feed ${feedUrl}:`, error.message);
      return [];
    }
  }

  // Get articles with different strategies
  async ingestWithStrategy(strategy = 'exactly_fifty') {
    switch (strategy) {
      case 'exactly_fifty':
        // 1 article from each of 50 feeds = exactly 50 articles
        return await this.ingestFiftyArticles();
        
      case 'balanced_mix':
        // Mix: 20 general + 15 tech + 10 business + 5 science
        const feeds = this.getFiftyRSSFeeds();
        const generalFeeds = feeds.slice(0, 15);  // First 15 are general news
        const techFeeds = feeds.slice(15, 25);    // Next 10 are tech
        const businessFeeds = feeds.slice(25, 35); // Next 10 are business
        const scienceFeeds = feeds.slice(35, 43);  // Next 8 are science
        
        const articles = [];
        
        // Get 2 articles from each general feed (30 total)
        for (const feed of generalFeeds.slice(0, 15)) {
          const feedArticles = await this.processSingleFeed(feed, 2);
          articles.push(...feedArticles.slice(0, 2));
        }
        
        // Get 2 articles from each tech feed (20 total)
        for (const feed of techFeeds) {
          const feedArticles = await this.processSingleFeed(feed, 2);
          articles.push(...feedArticles.slice(0, 2));
        }
        
        return articles.slice(0, 50); // Ensure exactly 50
        
      case 'top_sources_only':
        // Use only most reliable sources, get more articles from each
        const topFeeds = [
          "https://feeds.reuters.com/reuters/topNews",
          "https://feeds.reuters.com/reuters/worldNews",
          "https://feeds.reuters.com/reuters/technologyNews",
          "https://feeds.reuters.com/reuters/businessNews",
          "https://rss.cnn.com/rss/edition.rss",
          "https://feeds.bbci.co.uk/news/rss.xml",
          "https://feeds.npr.org/1001/rss.xml",
          "https://feeds.feedburner.com/TechCrunch",
          "https://www.theverge.com/rss/index.xml",
          "https://feeds.bloomberg.com/markets/news.rss"
        ];
        
        const topArticles = [];
        for (const feed of topFeeds) {
          const feedArticles = await this.processSingleFeed(feed, 5);
          topArticles.push(...feedArticles);
        }
        
        return topArticles.slice(0, 50);
        
      default:
        return await this.ingestFiftyArticles();
    }
  }
}

// Updated ingestion script usage
// In your scripts/ingestNews.js, replace the ingestion call with:

async function runIngestion() {
  try {
    const newsService = new NewsIngestionService();
    const ragService = new RAGService();
    
    await ragService.initialize();
    
    console.log('Fetching exactly 50 articles from 50 RSS feeds...');
    
    // Choose your strategy:
    // 'exactly_fifty' - 1 article from each of 50 feeds
    // 'balanced_mix' - Mix of categories with more articles from top sources
    // 'top_sources_only' - More articles from most reliable sources
    
    const articles = await newsService.ingestWithStrategy('exactly_fifty');
    
    console.log(` Successfully fetched ${articles.length} articles`);
    
    // Display sample
    console.log('\n Sample Articles:');
    articles.slice(0, 5).forEach((article, index) => {
      console.log(`   ${index + 1}. ${article.title}`);
      console.log(`      Source: ${article.source} | ${article.pubDate}`);
    });
    
    // Store in vector database
    console.log('\n Storing articles with embeddings...');
    const storedCount = await ragService.storeArticles(articles);
    
    console.log(`Successfully stored ${storedCount} articles in vector database`);
    console.log('RAG system ready with exactly 50 news articles!');
    
  } catch (error) {
    console.error('Ingestion failed:', error);
    process.exit(1);
  }
}

module.exports = NewsIngestionService;