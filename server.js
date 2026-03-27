const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let rooms = {};

function createDeck(){
  let colors=['red','blue','green','yellow'];
  let deck=[];
  colors.forEach(c=>{
    for(let i=0;i<=9;i++){
      deck.push({color:c,value:i});
      if(i!==0) deck.push({color:c,value:i});
    }
    ['skip','reverse','+2'].forEach(v=>{
      deck.push({color:c,value:v});
      deck.push({color:c,value:v});
    });
  });
  for(let i=0;i<4;i++){
    deck.push({color:'black',value:'wild'});
    deck.push({color:'black',value:'+4'});
  }
  return deck.sort(()=>Math.random()-0.5);
}

function nextTurn(room){
  room.turn = (room.turn + 1) % room.players.length;
}

function startTimer(roomId){
  let room=rooms[roomId];
  if(room.timer) clearInterval(room.timer);

  room.timeLeft=15;

  room.timer=setInterval(()=>{
    room.timeLeft--;
    io.to(roomId).emit('timer', room.timeLeft);

    if(room.timeLeft<=0){
      let player=room.players[room.turn];
      player.hand.push(room.deck.pop());
      nextTurn(room);
      room.timeLeft=15;

      io.to(roomId).emit('gameState', room);
    }
  },1000);
}

io.on('connection', socket=>{

  socket.on('createRoom', name=>{
    let id=Math.random().toString(36).substr(2,5);
    rooms[id]={
      players:[{id:socket.id,name,hand:[]}],
      deck:createDeck(),
      top:null,
      turn:0
    };
    socket.join(id);
    socket.emit('roomCreated', id);
  });

  socket.on('joinRoom', ({roomId,name})=>{
    let room=rooms[roomId];
    if(!room) return;
    room.players.push({id:socket.id,name,hand:[]});
    socket.join(roomId);
  });

  socket.on('startGame', roomId=>{
    let room=rooms[roomId];
    room.players.forEach(p=>p.hand=room.deck.splice(0,7));
    room.top=room.deck.pop();
    startTimer(roomId);
    io.to(roomId).emit('gameState', room);
  });

  socket.on('playCard', ({roomId,index})=>{
    let room=rooms[roomId];
    let player=room.players[room.turn];
    if(player.id!==socket.id) return;

    let card=player.hand[index];
    if(card.color===room.top.color || card.value===room.top.value || card.color==='black'){
      player.hand.splice(index,1);
      room.top=card;

      nextTurn(room);
      startTimer(roomId);

      io.to(roomId).emit('animatePlay');
      io.to(roomId).emit('gameState', room);

      if(player.hand.length===0){
        io.to(roomId).emit('winner', player.name);
      }
    }
  });

  socket.on('drawCard', roomId=>{
    let room=rooms[roomId];
    let player=room.players[room.turn];
    if(player.id!==socket.id) return;

    player.hand.push(room.deck.pop());
    nextTurn(room);
    startTimer(roomId);

    io.to(roomId).emit('gameState', room);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log('Running...'));