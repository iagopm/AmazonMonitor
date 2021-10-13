const { MessageEmbed } = require("discord.js");

module.exports = {
  type: "view",
};

module.exports.run = async (bot, guild, message, args) => {
  if (!args[1]) {
    message.channel.send('Error de sintaxis');
  } else {
    for (var i = 1; i < args.length; i++) {
      message.channel.send(eval(args[i]));
    }
  }
};
