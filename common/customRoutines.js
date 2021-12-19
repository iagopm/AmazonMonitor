const Parser = require("rss-parser");
const pup = require('puppeteer')
const { vandal, date } = require('../config.json')
const parser = new Parser();

let todayHasBeenPublished = 0;

exports.startRoutines = (bot) => {

    // Set an interval to seriess
    seriess(bot);
    setInterval(() => {
        seriess(bot);
    }, (180000) || 12000),
    // Set an interval to publish elden ring
    eldenRing(bot);
    setInterval(() => {
        eldenRing(bot);
    }, (86400000) || 12000),

    // Is 10 a.m M-S
    setInterval(() => {
        if (is10AM()) {
            if (!todayHasntBeenPublished()) {
                vandalNews(bot);
            }
        }
    }, (300000) || 120000)
}

function todayHasntBeenPublished() {
    return (new Date().getDay() == todayHasBeenPublished);
}

async function seriess(bot) {
    var stock = true;
    let channel = bot.channels.cache.get("877874452849889280");

    (async () => {

        const browser = await pup.launch()

        const page = await browser.newPage()

        await page.goto('https://www.movistar.es/particulares/fusion/elige-smartphone')

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

        await sleep(4000)

        const data = await page.evaluate(() => {
            const tds = Array.from(document.querySelectorAll('.OutOfStock'))
            return tds.map(td => td.innerText)
        });

        for (var i = 0; i < data.length; i++) {
            if (data[i].includes("Series S")) {
                stock = false;
            }
        }
        browser.close()
        if (stock) {
            channel.send("Series S -> " + stock);
        }
    })()


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
    todayHasBeenPublished = new Date().getDay();
}

function is10AM() {
    return new Date().getHours() == 10;
}

function eldenRing(bot) {
    const date1 = new Date(Date.now());
    const date2 = new Date(date);

    var delta = Math.abs(date2 - date1) / 1000;

    var days = Math.floor(delta / 86400);
    delta -= days * 86400;

    var hours = Math.floor(delta / 3600) % 24;
    delta -= hours * 3600;

    var minutes = Math.floor(delta / 60) % 60;
    delta -= minutes * 60;

    var seconds = delta % 60; // in theory the modulus is not required

    console.log();

    let channel = bot.channels.cache.get("877874452849889280");
    channel.send("Elden ring " + days + " días " + hours + " horas " + minutes + " minutos " + Math.round(seconds) + " segundos");
}