
// Initiate dependencies:load discord.js,config.json,ytdl;

//dependencies NPM node discord.js  discord-youtube-api ytdl youtube-search
//one line search;


const Discord = require('discord.js');
const{prefix,token,gtoken} = require('./config.json');


const search = require('youtube-search');
const opts = {
  maxResults:25,
  key:gtoken,
  type:"video"
}

const ytdl = require('ytdl-core');

// Create client

const client = new Discord.Client();

const queue = new Map();

client.login(token);


//Add event listeners for status


client.once("ready", () => {
    console.log("READY!");
});
client.once('reconnecting', () => {
    console.log("RECONNECTING!");
});
client.once("disconnect", () => {
    console.log("DISCONNECTED!");
});

//Add event handler for messages recived

client.on("message", async message =>{

    //if message is sent by bot || doesn't have prefix than ignore

    if(message.author.bot) return;
    if(!message.content.startsWith(prefix)) return;

    //create a queue for the server when called

    const serverQueue = queue.get(message.guild.id);

    //find what command needs to be executed(can extend list)

    if (message.content.startsWith(`${prefix}play` )) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}die`)) {
        stop(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}queue`)) {
      showQueue(message, serverQueue);
      return;
    } else if (message.content.startsWith(`${prefix}loop`)) {
      loop(message, serverQueue);
      return;
    }else if (message.content.startsWith(`${prefix}search`)) {
      searchYT(message, serverQueue);
      return;
    }else if(message.content.startsWith(`${prefix}help`)){
        message.channel.send(`
        -play : play a song
-skip : skip a song
-clear : clear the queue
-queue : see the current queue
-loop : loop current queue`)
    } else {
        message.channel.send({embed:{title:"You need to enter a valid command! Use '-help' to see all the available commands"}});
    }

})



//create the main function

async function execute(message,serverQueue){
    //"Read" the message
    const mess = message.content.split(" ");
    
    const voiceChannel = message.member.voice.channel;
    
    const permission = voiceChannel.permissionsFor(message.client.user);

    //check if user is in a voice channel || the bot has permission to join channel

    if(!voiceChannel){
        return message.channel.send({embed:{title:"You need to be in a voice channel to do that!"}});
    }
    if(!permission.has("CONNECT") || !permission.has("SPEAK")){
        return message.channel.send({embed:{title:"I need permissions to join and speak here!"}});
    }

    //get song info
    
    
    const songInfo = await ytdl.getInfo(mess[1]);
    const song = {
        title:songInfo.videoDetails.title,
        url:songInfo.videoDetails.video_url,
        duration:songInfo.videoDetails.lengthSeconds,
        author:songInfo.videoDetails.author.name
    }

    //check if queue is empty or not

    if(!serverQueue){

        const queueConstruct = {
            textChannel : message.channel,
            voiceChannel :voiceChannel,
            connection : null,
            songs:[],
            volume:5,
            playing:true,
            isLooping:false
        }

        //create an entry to the queue with the id and the current queue

        queue.set(message.guild.id, queueConstruct);

        //push in the song

        queueConstruct.songs.push(song);

        //try to join voice channel

        try{
            var connection = await voiceChannel.join();
            //save VC to construct
            queueConstruct.connection = connection;
            play(message.guild , queueConstruct.songs[0])
        }catch(err){
            //Log the error if needed
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }

    }else{

        //push song to queue
        serverQueue.songs.push(song);
        return message.channel.send({embed:{title:`${song.title} has been added to the queue!`}});
    }

    function play(guild,song){
        //if song list is empty than leave 
        const serverQueue = queue.get(guild.id);
        if(!song){
            serverQueue.voiceChannel.leave();
            queue.delete(guild.id);
            return;
        }
        //play a song
        const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      if(serverQueue.isLooping){
      serverQueue.songs.push(serverQueue.songs.shift());
      }else{
        serverQueue.songs.shift();
      }
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send({embed:{title:`Start playing: **${song.title}**`}});
    }
}

//skip function

function skip(message,serverQueue){

  //check condititons

  if(!message.member.voice.channel){
    return message.channel.send({embed:{title:'You need to be in a voice channel!'}})
  }
  if(!serverQueue){
    return message.channel.send({embed:{title:'No song to skip!'}})
  }
  //skip
  serverQueue.connection.dispatcher.end();
}
function stop(message,serverQueue){

  //check condition

  if(!message.member.voice.channel){
    return message.channel.send({embed:{title:'You need to be in a voice channel!'}})
  }
  if(!serverQueue){
    return message.channel.send({embed:{title:'No queue to clear'}})
  }

  //clear queue

  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function showQueue(message,serverQueue){

  if(!message.member.voice.channel){
    return message.channel.send({embed:{title:'You need to be in a voice channel!'}});
  }
  if(!serverQueue){
    return message.channel.send({embed:{title:'Your queue is empty!'}});
  }
  let currQueue = []
  serverQueue.songs.forEach(elem => currQueue.push({title:elem.title,author:elem.author,duration:elem.duration}));
  let i=0;
  currQueue = currQueue.map(elem=>{
    i++
    return i+") "+elem.author+"  "+elem.title+"  "+`${Math.floor(elem.duration / 60)} : ${elem.duration-(Math.floor(elem.duration / 60)*60)}`;
  })
  return message.channel.send({
    embed:{
      title:'Your queue',
      description: currQueue.join("\n")
    }
  }).catch(err=>console.log(err))
}

function loop(message,serverQueue){
  if(serverQueue.isLooping){
    serverQueue.isLooping = false;
    return message.channel.send({embed:{title:"Queue not looping!"}})
  }
  if(!serverQueue.isLooping){
    serverQueue.isLooping = true;
    return message.channel.send({embed:{title:"Queue looping!"}})
  }
}


async function searchYT(message, serverQueue){

  // let filter = m=>m.author.id === message.author.id;
  // let test = await message.channel.send("Type your querry")
  // let collector = await message.channel.awaitMessages(filter,{max:1}) collector.first().content
  let result = await search(message.content.split(" ")[1],opts)
  if(result){
    let youtubeResults = result.results;
    let i = 0;
    let titles = youtubeResults.map(result =>{
      i++;
      return i+") "+result.title+" a:"+result.channelTitle;
    })
    message.channel.send({
      embed:{
        title:'Select your song',
        description: titles.join("\n")
      }
    }).catch(err=>console.log(err))

    filter = m =>(m.author.id === message.author.id)
    let nr = await message.channel.awaitMessages(filter,{max : 1})
    var selectedSong = youtubeResults[nr.first().content - 1];
    await message.channel.send({
      embed:{
        title:`${selectedSong.title}`,
        URL:`${selectedSong.link}`,
        Description:`${selectedSong.description}`,
        Thumbnail:`${selectedSong.thumbnails.default.url}`
      }
    })

  }
  message.content = `-play ${selectedSong.link}`
  execute(message,serverQueue)

}