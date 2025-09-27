// Complete NewsIngestionService.js with 100 RSS feeds across all categories
// Though assignment mentions ~50 articles, we're using 100 feeds for comprehensive coverage
// This ensures broad knowledge representation across all domains

const Parser = require('rss-parser');
const logger = require('../utils/logger');

class NewsIngestionService {
  constructor() {
    this.parser = new Parser({
      timeout: 15000, // 15 second timeout for slow feeds
      customFields: {
        feed: ['language', 'copyright', 'generator'],
        item: [
          ['media:content', 'mediaContent'],
          ['dc:creator', 'creator'],
          ['content:encoded', 'contentEncoded'],
          ['media:thumbnail', 'mediaThumbnail'],
          'category',
          'categories',
          'description',
          'summary'
        ]
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    this.maxArticlesPerFeed = 1; // 1 article per feed for balanced representation
  }

  // Complete 100 RSS feeds organized by category as per your updated list
  getHundredRSSFeeds() {
    return {
      // MAJOR NEWS (10 feeds)
      majorNews: [
        "https://feeds.bbci.co.uk/news/rss.xml",
        "http://rss.cnn.com/rss/edition.rss",
        "http://feeds.reuters.com/Reuters/worldNews",
        "https://www.theguardian.com/world/rss",
        "https://www.aljazeera.com/xml/rss/all.xml",
        "https://apnews.com/rss",
        "https://feeds.npr.org/1001/rss.xml",
        "https://rss.dw.com/rdf/rss-en-all",
        "https://www.politico.com/rss/politics08.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
      ],

      // TECHNOLOGY & STARTUPS (10 feeds)
      technology: [
        "http://feeds.feedburner.com/TechCrunch/",
        "https://www.wired.com/feed/rss",
        "https://www.theverge.com/rss/index.xml",
        "http://feeds.arstechnica.com/arstechnica/index/",
        "http://feeds.mashable.com/Mashable",
        "https://news.ycombinator.com/rss",
        "https://www.engadget.com/rss.xml",
        "https://venturebeat.com/feed/",
        "https://www.producthunt.com/feed",
        "https://gizmodo.com/rss"
      ],

      // BUSINESS & FINANCE (10 feeds)
      business: [
        "https://www.bloomberg.com/feed/podcast/etf-report.xml",
        "https://www.forbes.com/business/feed/",
        "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "https://www.ft.com/?format=rss",
        "https://www.economist.com/latest/rss.xml",
        "https://hbr.org/feed",
        "https://www.marketwatch.com/rss/topstories",
        "https://www.businessinsider.com/rss",
        "https://www.investopedia.com/feedbuilder/feed/getfeed/?feedName=rss_articles",
        "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"
      ],

      // SPORTS (10 feeds)
      sports: [
        "https://www.espn.com/espn/rss/news",
        "https://feeds.bbci.co.uk/sport/rss.xml",
        "https://www.skysports.com/rss/12040",
        "https://www.si.com/rss/si_topstories.rss",
        "https://www.formula1.com/rss/news/headlines.rss",
        "https://www.nba.com/rss/nba_rss.xml",
        "https://www.nfl.com/rss/rsslanding?searchString=home",
        "https://theathletic.com/feed/",
        "https://www.fifa.com/rss-feeds/",
        "https://www.eurosport.com/rss.xml"
      ],

      // ENTERTAINMENT & POP CULTURE (10 feeds)
      entertainment: [
        "https://variety.com/feed/",
        "https://www.rollingstone.com/music/music-news/feed/",
        "https://www.billboard.com/feed/",
        "https://deadline.com/feed/",
        "https://www.hollywoodreporter.com/t/feed/",
        "https://www.imdb.com/news/feed",
        "https://www.eonline.com/syndication/feeds/rssfeeds/topstories",
        "http://www.mtv.com/news/rss/",
        "https://pitchfork.com/rss/reviews/albums/",
        "https://ew.com/feed/"
      ],

      // HEALTH & WELLNESS (10 feeds)
      health: [
        "https://www.who.int/feeds/entity/mediacentre/news/en/rss.xml",
        "https://www.healthline.com/rss",
        "https://www.medicalnewstoday.com/rss",
        "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC",
        "https://www.everydayhealth.com/rss/all.aspx",
        "https://www.health.harvard.edu/blog/feed",
        "https://newsnetwork.mayoclinic.org/feed/",
        "https://www.england.nhs.uk/feed/",
        "https://www.psychologytoday.com/us/rss",
        "https://www.medscape.com/rss/siteupdates.xml"
      ],

      // SCIENCE & EDUCATION (10 feeds)
      science: [
        "https://www.nasa.gov/rss/dyn/breaking_news.rss",
        "https://www.nature.com/nature.rss",
        "https://www.scientificamerican.com/feed/",
        "https://www.popsci.com/arcio/rss/",
        "https://www.livescience.com/feeds/all",
        "https://www.smithsonianmag.com/rss/",
        "https://feeds.feedburner.com/tedtalks_video",
        "https://theconversation.com/us/articles.atom",
        "https://www.nationalgeographic.com/content/nationalgeographic/en_us/rss",
        "https://www.sciencemag.org/rss/current.xml"
      ],

      // TRAVEL & LIFESTYLE (10 feeds)
      travel: [
        "https://www.lonelyplanet.com/blog.rss",
        "https://www.cntraveler.com/feed/rss",
        "https://www.travelandleisure.com/rss",
        "https://www.nomadicmatt.com/feed/",
        "https://thepointsguy.com/feed/",
        "https://theculturetrip.com/feed/",
        "https://www.luxurytravelmagazine.com/rss",
        "https://www.smartertravel.com/rss/",
        "https://www.adventure-journal.com/feed/",
        "https://www.nationalgeographic.com/content/nationalgeographic/en_us/travel/rss"
      ],

      // SPECIAL INTEREST & HOBBIES (10 feeds)
      hobbies: [
        "https://www.seriouseats.com/rss",
        "https://food52.com/blog.rss",
        "https://www.vogue.com/feed/rss",
        "https://www.elle.com/rss/all.xml/",
        "https://feeds.ign.com/ign/all",
        "https://kotaku.com/rss",
        "https://petapixel.com/feed/",
        "https://fstoppers.com/feed",
        "https://www.goodreads.com/blog.atom",
        "https://www.goodreads.com/choiceawards/best-books-2024.rss"
      ],

      // WORDPRESS & WEB DEVELOPMENT (10 feeds)
      webdev: [
        "https://wptavern.com/feed",
        "https://themeisle.com/blog/feed/",
        "https://wpshout.com/feed/",
        "https://www.wpbeginner.com/feed/",
        "https://torquemag.io/feed/",
        "https://www.wpexplorer.com/feed/",
        "https://css-tricks.com/feed/",
        "https://www.smashingmagazine.com/feed/",
        "https://www.sitepoint.com/feed/",
        "https://wpmayor.com/feed/"
      ]
    };
  }

  // Get flattened array of all 100 feeds
  getFlattenedFeeds() {
    const categorizedFeeds = this.getHundredRSSFeeds();
    const allFeeds = [];
    
    // Add feeds from each category with category labeling
    for (const [category, feeds] of Object.entries(categorizedFeeds)) {
      feeds.forEach(feed => {
        allFeeds.push({ url: feed, category: category });
      });
    }
    
    return allFeeds;
  }

  // Enhanced article processing with better error handling and content extraction
  async processArticleItem(item, feed, category = 'general') {
    try {
      // Extract and clean content with multiple fallbacks
      const title = this.cleanText(item.title || 'Untitled Article');
      
      // Try multiple content sources
      let description = this.cleanText(
        item.contentSnippet || 
        item.description || 
        item.contentEncoded ||
        item.summary ||
        item.content ||
        ''
      );

      // Additional content extraction from encoded content
      if (!description && item['content:encoded']) {
        description = this.cleanText(item['content:encoded']);
      }

      // Skip articles with insufficient content
      if (!title || title.length < 10) {
        throw new Error(`Article title too short: "${title}"`);
      }

      if (!description || description.length < 30) {
        throw new Error(`Article description too short: "${description}"`);
      }

      // Enhanced article object
      const article = {
        id: this.generateArticleId(item, feed),
        title: title,
        description: description,
        content: description, // Use description as main content
        url: this.cleanUrl(item.link || item.guid || ''),
        source: this.cleanText(feed.title || 'Unknown Source'),
        author: this.cleanText(item.creator || item.author || 'Unknown Author'),
        pubDate: this.parseDate(item.pubDate || item.isoDate),
        category: category,
        tags: this.extractTags(item),
        mediaUrl: this.extractMediaUrl(item),
        wordCount: this.countWords(description),
        language: feed.language || 'en'
      };

      // Final validation
      if (!this.isValidArticle(article)) {
        throw new Error('Article failed final validation');
      }

      return article;
    } catch (error) {
      logger.warn(`Error processing article: ${error.message}`);
      throw error;
    }
  }

  // Helper methods for better data processing
  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&#\d+;/g, '') // Remove HTML entities
      .replace(/&[a-zA-Z]+;/g, '') // Remove named entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 2000); // Limit length
  }

  cleanUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      return new URL(url).toString();
    } catch {
      return url.trim();
    }
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  countWords(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  generateArticleId(item, feed) {
    const identifier = [
      item.title || '',
      item.link || '',
      item.pubDate || '',
      feed.title || ''
    ].join('|');
    
    return Buffer.from(identifier).toString('base64').slice(0, 20);
  }

  extractTags(item) {
    const tags = new Set();
    
    // Add categories
    if (item.category) tags.add(item.category);
    if (item.categories && Array.isArray(item.categories)) {
      item.categories.forEach(cat => tags.add(cat));
    }
    
    // Extract keywords from title
    if (item.title) {
      const keywords = item.title.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 3);
      keywords.forEach(keyword => tags.add(keyword));
    }
    
    return Array.from(tags).slice(0, 8);
  }

  extractMediaUrl(item) {
    if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
      return item.mediaContent.$.url;
    }
    if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
      return item.mediaThumbnail.$.url;
    }
    if (item.enclosure && item.enclosure.url) {
      return item.enclosure.url;
    }
    return null;
  }

  // Enhanced validation
  isValidArticle(article) {
    return article &&
           article.title &&
           article.title.length >= 10 &&
           article.description &&
           article.description.length >= 30 &&
           article.url &&
           article.source &&
           article.wordCount > 10 &&
           article.pubDate;
  }

  // Enhanced feed processing with retry logic and better error handling
  async processSingleFeed(feedConfig, maxArticles = 1, retries = 3) {
    const feedUrl = typeof feedConfig === 'string' ? feedConfig : feedConfig.url;
    const category = typeof feedConfig === 'object' ? feedConfig.category : 'general';

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`Processing feed (attempt ${attempt}): [${category}] ${feedUrl}`);
        
        const feed = await this.parser.parseURL(feedUrl);
        const articles = [];

        if (!feed.items || feed.items.length === 0) {
          logger.warn(`No items found in feed: ${feedUrl}`);
          return articles;
        }

        const itemsToProcess = Math.min(feed.items.length, maxArticles);
        
        for (let i = 0; i < itemsToProcess; i++) {
          const item = feed.items[i];
          
          try {
            const article = await this.processArticleItem(item, feed, category);
            if (article && this.isValidArticle(article)) {
              articles.push(article);
              logger.info(`✓ [${category}] ${article.title.substring(0, 50)}...`);
            }
          } catch (error) {
            logger.warn(`Skipping article: ${error.message}`);
            continue;
          }
        }

        if (articles.length > 0) {
          return articles;
        } else if (attempt < retries) {
          logger.warn(`No valid articles found, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      } catch (error) {
        logger.warn(`Feed processing attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else {
          logger.error(`All attempts failed for ${feedUrl}: ${error.message}`);
        }
      }
    }
    return [];
  }

  // Main ingestion method with comprehensive category coverage
  async ingestComprehensiveArticles(targetCount = 50) {
    const categorizedFeeds = this.getHundredRSSFeeds();
    const allArticles = [];
    const categoryStats = {};
    
    logger.info(`Starting comprehensive ingestion targeting ${targetCount} articles from 100+ RSS feeds`);
    logger.info('Categories: News, Technology, Business, Sports, Entertainment, Health, Science, Travel, Hobbies, WebDev');

    // Process each category to ensure representation
    for (const [categoryName, feeds] of Object.entries(categorizedFeeds)) {
      logger.info(`\n=== Processing ${categoryName.toUpperCase()} category (${feeds.length} feeds) ===`);
      
      categoryStats[categoryName] = { attempted: feeds.length, successful: 0, failed: 0 };
      
      for (let i = 0; i < feeds.length; i++) {
        if (allArticles.length >= targetCount) {
          logger.info(`Target of ${targetCount} articles reached, stopping ingestion`);
          break;
        }

        const feedUrl = feeds[i];
        
        try {
          logger.info(`[${categoryName}] Processing feed ${i + 1}/${feeds.length}`);
          
          const articles = await this.processSingleFeed(
            { url: feedUrl, category: categoryName }, 
            1
          );
          
          if (articles.length > 0) {
            allArticles.push(...articles);
            categoryStats[categoryName].successful++;
            logger.info(`✓ [${categoryName}] Article added (Total: ${allArticles.length})`);
          } else {
            categoryStats[categoryName].failed++;
            logger.warn(`✗ [${categoryName}] No articles from this feed`);
          }
          
          // Respectful delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          categoryStats[categoryName].failed++;
          logger.error(`✗ [${categoryName}] Error: ${error.message}`);
        }

        // Break outer loop if target reached
        if (allArticles.length >= targetCount) break;
      }

      if (allArticles.length >= targetCount) break;
    }

    // Log comprehensive statistics
    logger.info('\n=== INGESTION SUMMARY ===');
    logger.info(`Total articles collected: ${allArticles.length}`);
    
    for (const [category, stats] of Object.entries(categoryStats)) {
      const successRate = ((stats.successful / stats.attempted) * 100).toFixed(1);
      logger.info(`${category}: ${stats.successful}/${stats.attempted} feeds successful (${successRate}%)`);
    }

    return allArticles;
  }

  // Strategy-based ingestion methods
  async ingestWithStrategy(strategy = 'comprehensive', targetCount = 50) {
    logger.info(`Using ingestion strategy: ${strategy}`);
    
    switch (strategy) {
      case 'comprehensive':
        // Default comprehensive approach across all categories
        return await this.ingestComprehensiveArticles(targetCount);
        
      case 'news_focused':
        // Focus more on news and current events
        const newsArticles = await this.ingestCategorySpecific(['majorNews', 'technology', 'business'], targetCount);
        return newsArticles;
        
      case 'balanced_lifestyle':
        // Include more lifestyle and entertainment content
        const lifestyleArticles = await this.ingestCategorySpecific(
          ['majorNews', 'entertainment', 'health', 'travel', 'hobbies'], 
          targetCount
        );
        return lifestyleArticles;
        
      case 'tech_business':
        // Focus on technology and business
        const techArticles = await this.ingestCategorySpecific(['technology', 'business', 'webdev'], targetCount);
        return techArticles;

      default:
        return await this.ingestComprehensiveArticles(targetCount);
    }
  }

  // Category-specific ingestion helper
  async ingestCategorySpecific(categories, targetCount) {
    const categorizedFeeds = this.getHundredRSSFeeds();
    const allArticles = [];
    
    for (const category of categories) {
      const feeds = categorizedFeeds[category] || [];
      const articlesPerCategory = Math.ceil(targetCount / categories.length);
      
      for (const feedUrl of feeds) {
        if (allArticles.length >= targetCount) break;
        
        const articles = await this.processSingleFeed(
          { url: feedUrl, category: category }, 
          1
        );
        allArticles.push(...articles);
        
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    
    return allArticles.slice(0, targetCount);
  }

  // Debug and testing methods
  async testCategoryFeeds(category, maxFeeds = 3) {
    const categorizedFeeds = this.getHundredRSSFeeds();
    const feeds = categorizedFeeds[category] || [];
    const results = [];
    
    logger.info(`Testing ${maxFeeds} feeds from ${category} category`);
    
    for (let i = 0; i < Math.min(feeds.length, maxFeeds); i++) {
      const feedUrl = feeds[i];
      try {
        const articles = await this.processSingleFeed(
          { url: feedUrl, category: category }, 
          1
        );
        results.push({
          category: category,
          url: feedUrl,
          success: articles.length > 0,
          articleCount: articles.length,
          sample: articles[0] ? articles[0].title : 'No articles'
        });
      } catch (error) {
        results.push({
          category: category,
          url: feedUrl,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Get statistics about feed categories
  getCategoryStatistics() {
    const categorizedFeeds = this.getHundredRSSFeeds();
    const stats = {};
    
    for (const [category, feeds] of Object.entries(categorizedFeeds)) {
      stats[category] = {
        feedCount: feeds.length,
        description: this.getCategoryDescription(category)
      };
    }
    
    stats.total = Object.values(stats).reduce((sum, cat) => sum + cat.feedCount, 0);
    return stats;
  }

  getCategoryDescription(category) {
    const descriptions = {
      majorNews: 'Breaking news, world events, and current affairs',
      technology: 'Tech trends, startups, and innovation',
      business: 'Finance, markets, and business strategy',
      sports: 'Sports news, scores, and analysis',
      entertainment: 'Movies, music, celebrities, and pop culture',
      health: 'Medical news, wellness, and health advice',
      science: 'Scientific discoveries, research, and education',
      travel: 'Travel guides, lifestyle, and culture',
      hobbies: 'Food, fashion, gaming, and special interests',
      webdev: 'Web development, WordPress, and programming'
    };
    return descriptions[category] || 'General interest';
  }
}

module.exports = NewsIngestionService;