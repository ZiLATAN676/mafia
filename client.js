const socket=io(); let roomId="",myName="";
function createRoom(){myName=name.value;socket.emit("createRoom",{name:myName});}
function joinRoom(){myName=name.value;roomId=document.getElementById("roomId").value;socket.emit("joinRoom",{roomId,name:myName});}
function addBot(){socket.emit("addBot",roomId);}
function startGame(){socket.emit("startGame",roomId);}
socket.on("roomCreated",id=>{roomId=id;alert("Room: "+id);});
socket.on("updatePlayers",players=>{playersList.innerHTML="";players.forEach(p=>{const li=document.createElement("li");li.innerText=p.name+(p.alive?"":" 💀");li.onclick=()=>vote(p.name);playersList.appendChild(li);});});
socket.on("yourRole",role=>{roleCard.innerText=role.toUpperCase();roleCard.classList.remove("hidden");roleCard.classList.add("show");});
socket.on("phase",p=>{phase.innerText="Phase: "+p;});
function vote(name){socket.emit("vote",{roomId,target:name});}
function sendMsg(){socket.emit("chat",{roomId,msg:msg.value,name:myName});}
socket.on("chat",data=>{chatBox.innerHTML+=`<p><b>${data.name}:</b> ${data.msg}</p>`;});
socket.on("gameOver",msg=>{alert(msg);});
socket.on("timer",t=>{document.getElementById("timer").innerText="Time: "+t;});
