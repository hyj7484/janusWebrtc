/*
  설정 해줘야 실행됨
  videoId => video Tag 가 들어갈 상위 태그의 아이디
  state => join or create
  join(), create() 함수로 설정가능

  roomNumber => setRoomNumber( value ) 를 이용하여 설정이 가능
             => getRoomNumber() 로 방번호 가져올수 있음

  startBtn => 시작할 버튼 설정
*/
var janusValue = {
  videoId : "videoDiv",
  state : null,
  roomNumber : null,
  startBtn : "start",
}

function startJanusGate(){
  if(janusValue.state == "create"){
    preShareScreen();
  }else if(janusValue.state == "join"){
    joinScreen();
  }else{
    return;
  }
}
function getStartBtn(){
  return janusValue.startBtn;
}

function setNum(){
  janusValue.roomNumber = $("#roomNumber").val();
  console.log("roomNumber set : " + janusValue.roomNumber);
}

function create(){
  janusValue.state = "create";
  console.log("state is create");
}
function join(){
  janusValue.state = "join";
  console.log("state is join");
}
function setRoomNumber(argValue){
  janusValue.roomNumber = argValue;
}
function getRoomNumber(){
  return janusValue.roomNumber;
}
