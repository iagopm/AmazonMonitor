const Parser = require("rss-parser");
const pup = require('puppeteer');
const cheerio = require('cheerio');
const request = require('request');

const { weather, vandal, date } = require('../config.json');
const parser = new Parser();

let vandalPublished = 0;
let weatherPublished = 0;
exports.startRoutines = (bot) => {

    // Set an interval to publish elden ring
    eldenRing(bot);
    setInterval(() => {
        eldenRing(bot);
    }, (86400000) || 12000),

    // Is 10 a.m M-S
    setInterval(() => {
        if (is10AM()) {
            if (!vandalAlreadyPublished()) {
                vandalNews(bot);
            }
        }
    }, (300000) || 120000),
    
    setInterval(() => {
        if (is10AM()) {
            if (!weatherAlreadyPublished()) {
                weatherCoruna(bot);
            }
        }
    }, (300000) || 120000)
}



function weatherAlreadyPublished() {
    return (new Date().getDay() == weatherPublished);
}

async function weatherCoruna(bot) {
    request(weather, function (error, response, html) {
        if (!error && response.statusCode == 200) {
            var prediccion = "[La Coruña] \n";
            var $ = cheerio.load(html, {
                xmlMode: true
            });
            let dias = $('dia');
            for (var i = 0; i < dias.length; i++) {
                let dia = dias[i];
                //fecha
                var fecha = $(dia).attr('fecha');
                prediccion += "Dia ->" + fecha;
                //temperatura
                var min = $(dia).children('temperatura').children('minima').text();
                var max = $(dia).children('temperatura').children('maxima').text();
                prediccion += " la temp.min ->" + min + "º  la temp.max ->" + max + "º ";
                //cond climatica
                var estadoCielo = $(dia).children('estado_cielo');
                for (var j = 0; j < estadoCielo.length; j++) {
                    if (!($(estadoCielo[j]).attr('descripcion')=="")) {
                        prediccion += "[" + $(estadoCielo[j]).attr('descripcion') + "]\n"
                        break;
                    }
                }
            }
            let channel = bot.channels.cache.get("877874452849889280");
            channel.send(prediccion);
            weatherPublished = new Date().getDay();
        }
    });
}

function vandalAlreadyPublished() {
    return (new Date().getDay() == vandalPublished);
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
    vandalPublished = new Date().getDay();
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