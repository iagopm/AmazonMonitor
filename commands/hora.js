
const { MessageEmbed } = require("discord.js");

module.exports = {
  type: "view",
};

module.exports.run = async (bot, guild, message) => {
    var date = new Date(); /* UTC time */
    message.channel.send("Londres -> "+date.toLocaleString("es-ES",{hour: '2-digit', minute:'2-digit', timeZone: "Europe/London" }));
    message.channel.send("Nueva york -> "+date.toLocaleString("es-ES",{hour: '2-digit', minute:'2-digit', timeZone: "America/New_York" }));
    message.channel.send("Tokyo -> "+date.toLocaleString("es-ES",{hour: '2-digit', minute:'2-digit', timeZone: "Asia/Tokyo" }));
    message.channel.send("Madrid -> "+date.toLocaleString("es-ES",{hour: '2-digit', minute:'2-digit', timeZone: "Europe/Madrid" }));
};
