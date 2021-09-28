let  Parser  = require("rss-parser");

let parser = new Parser();

const {vandal, news_channel} = require('../config.json')

module.exports = {
  type: "view",
};

module.exports.run = async (bot, guild, message) => {
  var noticias = "";

  let feed = await parser.parseURL(vandal);

  feed.items.forEach((item) => {
    noticias += item.title + "\n";
  });
  var channel = bot.channels.cache.find(ch => ch.name === news_channel);

  var noticiasArray = noticias.match(/.{1,1999}/g);
  for (var i = 0; i < noticiasArray.length; i++) {
    channel.send(noticiasArray[i]);
  }
};