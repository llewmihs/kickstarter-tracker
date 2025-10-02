// Kickstarter Follower Count Scraper
// Install dependencies: npm install puppeteer
// Run: node scraper.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const KICKSTARTER_URL = 'https://www.kickstarter.com/projects/what-if-games/word-dungeon';
// Use persistent volume in Railway, or local file for development
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '.';
const DATA_FILE = path.join(DATA_DIR, 'follower_data.json');

async function scrapeFollowerCount() {
  console.log('Launching browser...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('Navigating to Kickstarter page...');
    await page.goto(KICKSTARTER_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to find the follower count
    // This selector may need adjustment based on Kickstarter's current HTML structure
    const followerCount = await page.evaluate(() => {
      // Look for text containing "followers" or "Follow"
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (let element of elements) {
        const text = element.textContent;
        
        // Pattern to match follower counts like "1,234 followers" or "234 people following"
        const match = text.match(/(\d{1,3}(,\d{3})*)\s*(followers?|people following)/i);
        if (match) {
          // Remove commas and convert to number
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      return null;
    });

    if (followerCount === null) {
      console.error('Could not find follower count on page');
      console.log('Taking screenshot for debugging...');
      await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
    }

    await browser.close();
    return followerCount;

  } catch (error) {
    await browser.close();
    throw error;
  }
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  try {
    console.log('Starting Kickstarter follower tracker...\n');
    
    const followerCount = await scrapeFollowerCount();
    
    if (followerCount !== null) {
      const timestamp = new Date().toISOString();
      
      // Load existing data
      const data = loadData();
      
      // Calculate change from previous entry
      const previousCount = data.length > 0 ? data[data.length - 1].count : null;
      const change = previousCount !== null ? followerCount - previousCount : 0;
      
      // Add new entry
      const entry = {
        timestamp,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB'),
        count: followerCount,
        change: change
      };
      
      data.push(entry);
      saveData(data);
      
      console.log('\n✓ Success!');
      console.log(`Followers: ${followerCount}`);
      if (previousCount !== null) {
        console.log(`Change: ${change >= 0 ? '+' : ''}${change}`);
      }
      console.log(`Saved to ${DATA_FILE}`);
      
      // Display recent history
      if (data.length > 1) {
        console.log('\nRecent history:');
        data.slice(-5).forEach(d => {
          const changeStr = d.change !== 0 ? ` (${d.change >= 0 ? '+' : ''}${d.change})` : '';
          console.log(`  ${d.date} ${d.time}: ${d.count}${changeStr}`);
        });
      }
      
    } else {
      console.error('\n✗ Failed to extract follower count');
      console.log('Check debug_screenshot.png to see what the page looks like');
    }
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }
}

main();
