const { MessageEmbed } = require('discord.js')
const  Parser  = require("rss-parser");
const pup = require('puppeteer')
const { proxyRequest } = require('puppeteer-proxy')
const cheerio = require('cheerio')
const fs = require('fs')
const amazon = require('./Amazon')
const debug = require('./debug')
const { getWatchlist, updateWatchlistItem, addWatchlistItem, removeWatchlistItem } = require('./data')
const { vandal,news_channel,date, auto_cart_link, cache_limit, tld, minutes_per_check } = require('../config.json')
const parser = new Parser();

let userAgents = [
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:75.0) Gecko/20100101 Firefox/75.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.11 (KHTML, like Gecko) Ubuntu/14.04.6 Chrome/81.0.3990.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.3538.77 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.62 Safari/537.36 Edg/81.0.416.31'
]
let browser

/**
 * Format prices 
 */
exports.priceFormat = (p) => {
  p = '' + p
  let currencySymbol = p.replace(/[,.]+/g, '').replace(/\d/g, '')
  if (currencySymbol) p = p.replace(currencySymbol, '')

  if (!p.includes('.') && !p.includes(',')) {
    p += '.00'
  }

  // Strip symbols from number
  if (p.indexOf('.') > p.indexOf(',')) {
    const cents = p.split('.')[1]
    const dollars = p.split(`.${cents}`)[0].split(',').join('')

    p = `${dollars}.${cents}`
  } else {
    const cents = p.split(',')[1]
    const dollars = p.split(`,${cents}`)[0].split('.').join('')

    p = `${dollars}.${cents}`
  }

  p = parseFloat(p).toFixed(2)

  return p
}

/**
 * Parse arguments from an array, kinda like a commandline.
 * 
 * @param {Array} opts
 * @param {Array} avblArgs 
 */
exports.argParser = (opts, avblArgs) => {
  for (let i = 0; i < opts.length; i++) {
    if (opts[i].startsWith('-')) {
      // Get part of flag after hyphen
      let argVal = opts[i].split('-')[opts[i].lastIndexOf('-') + 1]
      // Get matching argument in avblArgs
      let avblArg = Object.keys(avblArgs).filter(x => x.startsWith(argVal[0]))
      
      if(typeof(avblArgs[avblArg]) === 'boolean' && (opts[i + 1] && opts[i + 1].startsWith('-') || !opts[i + 1])) {
        // If the argument has no value associated with it, assume boolean
        avblArgs[avblArg] = true
  
        // Otherwise, assume actual
      } else avblArgs[avblArg] = opts[i + 1]
    }
  }

  // Return object with filled in values
  return avblArgs
}

/*
 *  Appends ... to long strings
 */
exports.trim = (s, lim) => {
  if(s.length > lim) {
    return s.substr(0, lim) + '...'
  } else return s
}

/**
 * Parses the url_params object to a URL-appendable string
 * 
 * @param {Object} obj 
 */
exports.parseParams = (obj) => {
  if(Object.keys(obj).length === 0) return '?'
  let str = '?'
  Object.keys(obj).forEach(k => {
    str += `${k}=${obj[k]}&`
  })
  return str
}

/**
 * Start a puppeteer instance
 */
exports.startPup = async () => {
  browser = await pup.launch()
  debug.log('Puppeteer Launched', 'info')
}

/**
 * Get page HTML
 */
exports.getPage = async (url, opts) => {
  debug.log('Type: ' + opts.type, 'info')
  let now = new Date().getTime()
  let proxy
  if (opts.type === 'proxy') {
    let l = fs.readFileSync('proxylist.txt', 'utf8')
    let proxies = l.split('\n')

    if (proxies.length > 0) {
      proxy = proxies[Math.floor(Math.random() * proxies.length)]
    } else {
      debug.log('No proxies found in proxylist.txt', 'error')
    }
  }

  let page = await browser.newPage()
  let uAgent = userAgents[Math.floor(Math.random() * userAgents.length)]
  if (proxy) {
    debug.log('Selected proxy URL: ' + proxy, 'info')
    page.setRequestInterception(true)
    page.on('request', (request) => {
      proxyRequest({
        page,
        proxyUrl: proxy,
        request
      })
    })
  }

  await page.setUserAgent(uAgent)
  await page.goto(url)

  debug.log('Waiting a couple seconds for JavaScript to load...', 'info')
  await page.waitForTimeout(2000)

  let html = await page.evaluate(() => document.body.innerHTML).catch(e => debug.log(e, 'error'))
  let $ = await load(html).catch(e => debug.log(e, 'error'))

  await page.close()

  debug.log(`Got page in ${new Date().getTime() - now}ms`, 'debug')

  if (typeof $ !== 'function') throw new Error('Cheerio.load() returned something other than a function')

  return $
}

/**
 * Checks for errors, I guess. Not super reliable I will admit
 * 
 * @param {*} $ 
 */
function hasErrors($) {
  if($('title').first().text().trim().includes('Sorry!')) {
    return true
  } else return false
}

/**
 * Load HTML with cheerio
 */
async function load(html) {
  let $ = cheerio.load(html)
  if (hasErrors($)) {
    return {
      message: 'Amazon Service Error'
    }
  } else {
    return $
  }
}

/**
 * Inits a watcher that'll check all of the items for price drops
 */
exports.startWatcher = async (bot) => {
  const rows = await getWatchlist()
  bot.watchlist = JSON.parse(JSON.stringify(rows))
  debug.log('Watchlist Loaded', 'info')

  bot.user.setActivity(`${rows.length} items! | ${bot.prefix}help`, {
    type: 'WATCHING'
  })

  // Set an interval to publish elden ring
  eldenRing(bot);
  setInterval(() => {
    eldenRing(bot);
  }, (86400000/5)||12000),

  // Is 9 a.m M-S
  setInterval(() => {
    if(is9AM){
      vandalNews(bot);
    }
  }, (300000) || 120000),

  // Set an interval with an offset so we don't decimate Amazon with requests
  setInterval(() => {
    debug.log('Checking item prices...', 'message')
    if (bot.watchlist.length > 0) doCheck(bot, 0)
  }, (minutes_per_check * 60000) || 120000)
}

async function vandalNews(bot) {
  var noticias = "";

  let feed = await parser.parseURL(vandal);

  feed.items.forEach((item) => {
    noticias += item.title + "\n";
  });
  let channel = bot.channels.cache.get("877874452849889280");

  var noticiasArray = noticias.match(/.{1,1999}/g);
  for (var i = 0; i < noticiasArray.length; i++) {
    channel.send(noticiasArray[i]);
  }
}

function is9AM() {
  return new Date().getHours() == 10;
}

function eldenRing(bot) {
  const date1 = new Date(Date.now());
  const date2 = new Date(date);

  // One day in milliseconds
  const oneDay = 1000 * 60 * 60 * 24;

  // Calculating the time difference between two dates
  const diffInTime = date2.getTime() - date1.getTime();

  // Calculating the no. of days between two dates
  const diffInDays = diffInTime / oneDay;

  let channel = bot.channels.cache.get("877874452849889280");
  channel.send("Rei dice -> Elden ring " + diffInDays + " días restantes");
}

/**
 * Loops through all watchlist items, looking for price drops
 */
async function doCheck(bot, i) {
  if (i < bot.watchlist.length) {
    const obj = bot.watchlist[i]

    if (obj.type === 'link') {
      // Get details
      const item = await amazon.details(bot, obj.link)
      const curPrice = parseFloat(item.price.replace(/,/g, '')) || 0

      priceCheck(bot, obj, item)
      if (obj.lastPrice !== curPrice) pushPriceChange(obj, item)
    } else if (obj.type === 'category') {
      let total = 0
      // First, get current items in category for comparison
      const newItems = await amazon.categoryDetails(bot, obj.link)

      // Match items in both arrays and only compare those prices.
      const itemsToCompare = newItems.list.filter(ni => obj.cache.find(o => o.asin === ni.asin))

      // Compare new items to cache and alert on price change
      itemsToCompare.forEach(item => {
        const matchingObj = obj.cache.find(o => o.asin === item.asin)

        // Assign channel_id in case there is an alert to send
        matchingObj.channel_id = obj.channel_id
        if (priceCheck(bot, matchingObj, item)) total++
      })

      // Push new list to watchlist
      const addition = {
        guild_id: obj.guild_id,
        channel_id: obj.channel_id,
        link: obj.link,
        cache: newItems.list.slice(0, cache_limit),
        priceLimit: obj.priceLimit|| 0,
        type: 'category'
      }

      debug.log(`${total} item(s) changed`, 'debug')

      // Remove old stuff
      await removeWatchlistItem(bot, obj.link)
      // Add new stuff
      await addWatchlistItem(addition)
      bot.watchlist.push(obj)
    } else if (obj.type === 'query') {
      let total = 0
      // Same concept as category. Get new items...
      const newItems = await amazon.find(bot, obj.query, tld)

      // Match items for comparison
      const itemsToCompare = newItems.filter(ni => obj.cache.find(o => o.asin === ni.asin))

      itemsToCompare.forEach(item => {
        const matchingObj = obj.cache.find(o => o.asin === item.asin)

        // Assign channel_id in case there is an alert to send
        matchingObj.channel_id = obj.channel_id
        if (priceCheck(bot, matchingObj, item)) total++
      })

      debug.log(`${total} item(s) changed`, 'debug')

      // Push changes
      const addition = {
        guild_id: obj.guild_id,
        channel_id: obj.channel_id,
        query: obj.query,
        cache: newItems.slice(0, cache_limit),
        priceLimit: obj.priceLimit || 0,
        type: 'query'
      }

      // Remove old stuff
      await removeWatchlistItem(bot, obj.link)
      // Add new stuff
      await addWatchlistItem(addition) 
      bot.watchlist.push(obj)
    }

    // Do check with next item
    setTimeout(() => doCheck(bot, i + 1), 6000)
  }

  getWatchlist().then(rows => {
    bot.watchlist = JSON.parse(JSON.stringify(rows))

    bot.user.setActivity(`${rows.length} items! | ${bot.prefix}help`, { type: 'WATCHING' })
  })
}

/**
 * Shorthand function for performing simle price comparison.
 * 
 * @param {Any} bot 
 * @param {Object} obj 
 * @param {Object} item 
 */
function priceCheck(bot, obj, item) {
  const curPrice = parseFloat(item.price.replace(/,/g, '')) || item.lastPrice || 0
  const underLimit = !obj.priceLimit || obj.priceLimit === 0 || curPrice < obj.priceLimit

  // Compare prices
  if (obj.lastPrice === 0 && curPrice !== 0 && underLimit) {
    sendInStockAlert(bot, obj, item)
    return true
  }
  if (obj.lastPrice > curPrice && curPrice !== 0 && underLimit) {
    sendPriceAlert(bot, obj, item)
    return true
  }

  return false
}

/**
 * Sends an alert to the guildChannel specified in the DB entry
 */
function sendPriceAlert(bot, obj, item) {
  // Yeah yeah, I'll fix the inconsistant link props later
  let link = (obj.link || obj.full_link) + exports.parseParams(bot.url_params)
  let channel = bot.channels.cache.get(obj.channel_id)

  // Rework the link to automatically add it to the cart of the person that clicked it
  if(auto_cart_link) link = `${link.split('/dp/')[0]}/gp/aws/cart/add.html${exports.parseParams(bot.url_params)}&ASIN.1=${item.asin}&Quantity.1=1`

  let embed = new MessageEmbed()
    .setTitle(`Price alert for "${item.full_title}"`)
    .setAuthor(item.seller ? item.seller:'Amazon')
    .setDescription(`Old Price: ${item.symbol} ${exports.priceFormat(obj.lastPrice)}\nNew Price: ${item.symbol} ${item.price}\n\n${link}`)
    .setColor('GREEN')

  if(channel) channel.send(embed)
}

/**
 * Pushes a change in price to the DB
 */
function pushPriceChange(obj, item) {
  // Check if we *actually* got data
  if (!item.full_title && item.image.includes('via.placeholder.com')) {
    debug.log('Aborting price update, data not valid', 'warn')
    return
  }

  let price = item.price.replace(/,/g, '')

  updateWatchlistItem({
    lastPrice: (parseFloat(price) || 0)
  }, {
    link: obj.link
  })
}

/**
 * Sends an alert that an item that wasn't in stock now is
 */
function sendInStockAlert(bot, obj, item) {
  let channel = bot.channels.cache.get(obj.channel_id)
  let link = (obj.link || obj.full_link) + exports.parseParams(bot.url_params)

  // Rework the link to automatically add it to the cart of the person that clicked it
  if(auto_cart_link) link = `${obj.link.split('/dp/')[0]}/gp/aws/cart/add.html${exports.parseParams(bot.url_params)}&ASIN.1=${item.asin}&Quantity.1=1`

  let embed = new MessageEmbed()
    .setTitle(`"${item.full_title}" is now in stock!`)
    .setAuthor(item.seller)
    .setDescription(`Current Price: ${item.symbol} ${item.price}\n\n${link}`)
    .setColor('GREEN')

  if(channel) channel.send(embed)
}
