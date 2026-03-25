const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const rooms = {};

function assignRoles(players) {
  const roles = ["werewolf","doctor","seer"];
  players.forEach((p,i)=>{
    p.role=roles[i]||"villager";
    p.alive=true;
    p.isBot=p.isBot||false;
    p.suspicion={};
  });
  players.sort(()=>Math.random()-0.5);
}

function alivePlayers(room){ return room.players.filter(p=>p.alive); }

function runBots(room){
  const alive=alivePlayers(room);
  room.players.forEach(bot=>{
    if(!bot.isBot||!bot.alive) return;
    alive.forEach(p=>{if(p.name!==bot.name) bot.suspicion[p.name]=(bot.suspicion[p.name]||0)+Math.random();});
    let target=Object.keys(bot.suspicion).reduce((a,b)=> bot.suspicion[a]>bot.suspicion[b]?a:b);
    if(room.phase==="night"){
      if(bot.role==="werewolf") room.actions["werewolf"]=target;
      if(bot.role==="doctor") room.actions["doctor"]=bot.name;
      if(bot.role==="seer") room.actions["seer"]=target;
    }
    if(room.phase==="day") room.votes[target]=(room.votes[target]||0)+1;
  });
}

function checkWin(room, roomId){
  const alive=alivePlayers(room);
  const wolves=alive.filter(p=>p.role==="werewolf").length;
  const villagers=alive.length-wolves;
  if(wolves===0){ io.to(roomId).emit("gameOver","Villagers Win 🎉"); room.phase="ended"; }
  if(wolves>=villagers){ io.to(roomId).emit("gameOver","Werewolves Win 🐺"); room.phase="ended"; }
}

function startTimer(roomId, seconds, nextPhase){
  let time=seconds;
  const interval=setInterval(()=>{
    io.to(roomId).emit("timer",time);
    time--;
    if(time<0){ clearInterval(interval); nextPhase(); }
  },1000);
}

io.on("connection", socket=>{
  socket.on("createRoom",({name})=>{
    const roomId=Math.random().toString(36).substr(2,6);
    rooms[roomId]={players:[{id:socket.id,name}],phase:"lobby",votes:{},actions:{}};
    socket.join(roomId);
    socket.emit("roomCreated",roomId);
  });

  socket.on("joinRoom",({roomId,name})=>{
    const room=rooms[roomId]; if(!room) return;
    room.players.push({id:socket.id,name});
    socket.join(roomId);
    io.to(roomId).emit("updatePlayers",room.players);
  });

  socket.on("addBot",roomId=>{
    const room=rooms[roomId];
    const botName="Bot_"+Math.floor(Math.random()*1000);
    room.players.push({name:botName,isBot:true,alive:true,suspicion:{}});
    io.to(roomId).emit("updatePlayers",room.players);
  });

  socket.on("startGame",roomId=>{
    const room=rooms[roomId];
    assignRoles(room.players);
    room.phase="night";
    room.players.forEach(p=>{ if(!p.isBot) io.to(p.id).emit("yourRole",p.role); });
    io.to(roomId).emit("phase","night");

    startTimer(roomId,15,()=>{ socket.emit("endNight",roomId); });
  });

  socket.on("nightAction",({roomId,role,target})=>{ rooms[roomId].actions[role]=target; });

  socket.on("endNight",roomId=>{
    const room=rooms[roomId];
    runBots(room);
    const kill=room.actions["werewolf"];
    const save=room.actions["doctor"];
    if(kill && kill!==save){ const player=room.players.find(p=>p.name===kill); if(player) player.alive=false; }
    room.actions={}; room.phase="day";
    io.to(roomId).emit("updatePlayers",room.players);
    io.to(roomId).emit("phase","day");
    checkWin(room,roomId);
    startTimer(roomId,30,()=>{ socket.emit("endVote",roomId); });
  });

  socket.on("vote",({roomId,target})=>{ rooms[roomId].votes[target]=(rooms[roomId].votes[target]||0)+1; });

  socket.on("endVote",roomId=>{
    const room=rooms[roomId];
    runBots(room);
    let max=0,out;
    for(let p in room.votes){ if(room.votes[p]>max){ max=room.votes[p]; out=p; } }
    const player=room.players.find(p=>p.name===out);
    if(player) player.alive=false;
    room.votes={}; room.phase="night";
    io.to(roomId).emit("updatePlayers",room.players);
    io.to(roomId).emit("phase","night");
    checkWin(room,roomId);
    startTimer(roomId,15,()=>{ socket.emit("endNight",roomId); });
  });

  socket.on("chat",({roomId,msg,name})=>{ io.to(roomId).emit("chat",{msg,name}); });

});

http.listen(3000,()=>console.log("Server running on port 3000"));
