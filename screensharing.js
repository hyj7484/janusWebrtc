
var server = null;
if (window.location.protocol === 'http:')
  server = "http://sinjuku.o-r.kr/janus";
else
  server = "https://sinjuku.o-r.kr/janus";

var janus = null;
var screentest = null;
var opaqueId = "screensharingtest-" + Janus.randomString(12);
console.log("opaqueId : " + opaqueId);

var myusername = null;
var myid = null;

var capture = null;
var role = null;
var room = null;
var source = null;

var spinner = null;

var janusPlugin = null;
var janusSession = null;

/*
		set Value
*/
var videoId = janusValue.videoId;
var startBtn = janusValue.startBtn;
var userState = janusValue.state;
// Just an helper to generate random usernames
function randomString(len, charSet) {
  charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

$(document).ready(function() {
    Janus.init({
      debug: "all",
      callback: function() {
        if (!Janus.isWebrtcSupported()) {
          bootbox.alert("No WebRTC support... ");
          return;
        }
        janus = new Janus({
          server: server,
          success: function() {
            janus.attach({
              plugin: "janus.plugin.videoroom",
              opaqueId: opaqueId,
              success: function(pluginHandle) {
								$('#details').remove();
	              janusPlugin = pluginHandle;
	              Janus.log("Plugin attached! (" + janusPlugin.getPlugin() + ", id=" + janusPlugin.getId() + ")");

                if(userState == "create"){
                  $("#"+startBtn).click(preShareScreen);
                }else if(userState == "join"){
                  $("#"+startBtn).click(joinScreen);
                }
              },
							// end
              error: function(error) {
								Janus.error("  -- Error attaching plugin...", error);
	              bootbox.alert("Error attaching plugin... " + error);
              },
							// end
              consentDialog: function(on) {
								Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
								if (on) {
									// Darken screen
									$.blockUI({
										message: '',
										css: {
											border: 'none',
											padding: '15px',
											backgroundColor: 'transparent',
											color: '#aaa'
										}
									});
								} else {
									// Restore screen
									$.unblockUI();
								}
              },
							// end
              iceState: function(state) {
								Janus.log("ICE state changed to " + state);
              },
							// end
              mediaState: function(medium, on) {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
              },
              // end ?
              webrtcState: function(on) {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                $("#" + videoId).parent().unblock();
                if (on) {
                  // bootbox.alert("Your screen sharing session just started: pass the <b>" + room + "</b> session identifier to those who want to attend.");
                } else {
                  bootbox.alert("Your screen sharing session just stopped.", function() {
                    janus.destroy();
                    window.location.reload();
                  });
                }
              },
              onmessage: function(msg, jsep) {
								Janus.debug(" ::: Got a message (publisher) :::", msg);
								var event = msg["videoroom"];
								Janus.debug("Event: " + event);
								if (event) {
									if (event === "joined") {
										myid = msg["id"];
										Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
										if (role === "publisher") {
											// This is our session, publish our stream
											Janus.debug("Negotiating WebRTC stream for our screen (capture " + capture + ")");
											// Safari expects a user gesture to share the screen: see issue #2455
											if (Janus.webRTCAdapter.browserDetails.browser === "safari") {
												bootbox.alert("Safari requires a user gesture before the screen can be shared: close this dialog to do that. See issue #2455 for more details", function() {
													janusPlugin.createOffer({
														media: {
															video: capture,
															audioSend: true,
															videoRecv: false
														}, // Screen sharing Publishers are sendonly
														success: function(jsep) {
															Janus.debug("Got publisher SDP!", jsep);
															var publish = {
																request: "configure",
																audio: true,
																video: true
															};
															janusPlugin.send({
																message: publish,
																jsep: jsep
															});
														},
														error: function(error) {
															Janus.error("WebRTC error:", error);
															bootbox.alert("WebRTC error... " + error.message);
														}
													});
												});
											} else {
												// Other browsers should be fine, we try to call getDisplayMedia directly
												janusPlugin.createOffer({
													media: {
														video: capture,
														audioSend: true,
														videoRecv: false
													}, // Screen sharing Publishers are sendonly
													success: function(jsep) {
														Janus.debug("Got publisher SDP!", jsep);
														var publish = {
															request: "configure",
															audio: true,
															video: true
														};
														janusPlugin.send({
															message: publish,
															jsep: jsep
														});
													},
													error: function(error) {
														Janus.error("WebRTC error:", error);
														bootbox.alert("WebRTC error... " + error.message);
													}
												});
											}
										} else {
											// We're just watching a session, any feed to attach to?
											if (msg["publishers"]) {
												var list = msg["publishers"];
												Janus.debug("Got a list of available publishers/feeds:", list);
												for (var f in list) {
													var id = list[f]["id"];
													var display = list[f]["display"];
													Janus.debug("  >> [" + id + "] " + display);
													newRemoteFeed(id, display);
												}
											}
										}
									} else if (event === "event") {
										// Any feed to attach to?
										if (role === "listener" && msg["publishers"]) {
											var list = msg["publishers"];
											Janus.debug("Got a list of available publishers/feeds:", list);
											for (var f in list) {
												var id = list[f]["id"];
												var display = list[f]["display"];
												Janus.debug("  >> [" + id + "] " + display);
												newRemoteFeed(id, display)
											}
										} else if (msg["leaving"]) {
											// One of the publishers has gone away?
											var leaving = msg["leaving"];
											Janus.log("Publisher left: " + leaving);
											if (role === "listener" && msg["leaving"] === source) {
												bootbox.alert("The screen sharing session is over, the publisher left", function() {
													window.location.reload();
												});
											}
										} else if (msg["error"]) {
											bootbox.alert(msg["error"]);
										}
									}
								}
								if (jsep) {
									Janus.debug("Handling SDP as well...", jsep);
									janusPlugin.handleRemoteJsep({
										jsep: jsep
									});
								}
              },
              onlocalstream: function(stream) {
                /*
                  recorder code ...
                */
                // var mediaRecorder = new MediaRecorder({audio : true});
                // visualize(stream);
                // mediaRecorder.start();
                // console.log(mediaRecorder.state);
                // $('#recordcheck').css("backgroundColor", red);
                /*
                  recorder code ...
                */


								Janus.debug(" ::: Got a local stream :::", stream);
	              if ($('#screenvideo').length === 0) {
	                $("#"+videoId).append('<video class="rounded centered" id="screenvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
	              }
	              Janus.attachMediaStream($('#screenvideo').get(0), stream);
	              if (janusPlugin.webrtcStuff.pc.iceConnectionState !== "completed" &&
	                janusPlugin.webrtcStuff.pc.iceConnectionState !== "connected") {
	                $("#"+videoId).parent().block({
	                  message: '<b>Publishing...</b>',
	                  css: {
	                    border: 'none',
	                    backgroundColor: 'transparent',
	                    color: 'white'
	                  }
	                });
	              }
              },
              // end
              oncleanup: function() {
								Janus.log(" ::: Got a cleanup notification :::");
              }
            });
          },
          error: function(error) {
            Janus.error(error);
            bootbox.alert(error, function() {
              window.location.reload();
            });
          },
          destroyed: function() {
            window.loaction.reload();
          }
        });
      }
    });
});

function preShareScreen() {
  if (!Janus.isExtensionEnabled()) {
    bootbox.alert("You're using Chrome but don't have the screensharing extension installed: click <b><a href='https://chrome.google.com/webstore/detail/janus-webrtc-screensharin/hapfgfdkleiggjjpfpenajgdnfckjpaj' target='_blank'>here</a></b> to do so", function() {
      window.location.reload();
    });
    return;
  }
  // Create a new room
  capture = "screen";
  if (navigator.mozGetUserMedia) {
    // Firefox needs a different constraint for screen and window sharing
    bootbox.dialog({
      title: "Share whole screen or a window?",
      message: "Firefox handles screensharing in a different way: are you going to share the whole screen, or would you rather pick a single window/application to share instead?",
      buttons: {
        screen: {
          label: "Share screen",
          className: "btn-primary",
          callback: function() {
            capture = "screen";
            shareScreen();
          }
        },
        window: {
          label: "Pick a window",
          className: "btn-success",
          callback: function() {
            capture = "window";
            shareScreen();
          }
        }
      },
    });
  } else {
    shareScreen();
  }
}

function shareScreen() {
  // Create a new room
  var desc = getRoomNumber();
	if(desc == null){
		desc = randomString(12, "0123456789");
	}
  role = "publisher";
  var create = {
    request: "create",
    description: desc,
    bitrate: 500000,
    publishers: 1
  };
  janusPlugin.send({
    message: create,
    success: function(result) {
      var event = result["videoroom"];
      Janus.debug("Event: " + event);
      if (event) {
        // Our own screen sharing session has been created, join it
        room = result["room"];
				console.log("result : " + JSON.stringify(result));
        Janus.log("Screen sharing session created: " + room);
        setRoomNumber(room);
        $("#roomId").html(getRoomNumber());
        myusername = randomString(12);
        var register = {
          request: "join",
          room: room,
          ptype: "publisher",
          display: myusername
        };
        janusPlugin.send({
          message: register
        });
      }
    }
  });
}


function joinScreen() {
  // Join an existing screen sharing session
  var roomid = getRoomNumber();
  console.log("roomId" + roomid);
  if (isNaN(roomid)) {
    return;
  }
  room = parseInt(roomid);
  role = "listener";
  myusername = randomString(12);
  var register = {
    request: "join",
    room: room,
    ptype: "publisher",
    display: myusername
  };
  janusPlugin.send({
    message: register
  });
}

function newRemoteFeed(id, display) {
  // A new feed has been published, create a new plugin handle and attach to it as a listener
  source = id;
  var remoteFeed = null;
  janus.attach({
    plugin: "janus.plugin.videoroom",
    opaqueId: opaqueId,
    success: function(pluginHandle) {
      remoteFeed = pluginHandle;
      Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
      Janus.log("  -- This is a subscriber");
      // We wait for the plugin to send us an offer
      var listen = {
        request: "join",
        room: room,
        ptype: "listener",
        feed: id
      };
      remoteFeed.send({
        message: listen
      });
    },
    error: function(error) {
      Janus.error("  -- Error attaching plugin...", error);
      bootbox.alert("Error attaching plugin... " + error);
    },
    onmessage: function(msg, jsep) {
      Janus.debug(" ::: Got a message (listener) :::", msg);
      var event = msg["videoroom"];
      Janus.debug("Event: " + event);
      if (event) {
        if (event === "attached") {
          // Subscriber created and attached
          if (!spinner) {
            var target = document.getElementById(videoId);
            spinner = new Spinner({
              top: 100
            }).spin(target);
          } else {
            spinner.spin();
          }
					setRoomNumber(msg['room']);
          Janus.log("Successfully attached to feed " + id + " (" + display + ") in room " + msg["room"]);
        } else {
          // What has just happened?
        }
      }
      if (jsep) {
        Janus.debug("Handling SDP as well...", jsep);
        // Answer and attach
        remoteFeed.createAnswer({
          jsep: jsep,
          media: {
            audioSend: false,
            videoSend: false
          }, // We want recvonly audio/video
          success: function(jsep) {
            Janus.debug("Got SDP!", jsep);
            var body = {
              request: "start",
              room: room
            };
            remoteFeed.send({
              message: body,
              jsep: jsep
            });
          },
          error: function(error) {
            Janus.error("WebRTC error:", error);
            bootbox.alert("WebRTC error... " + error.message);
          }
        });
      }
    },
    onremotestream: function(stream) {
      if ($('#screenvideo').length === 0) {
        // No remote video yet
        $("#"+videoId).append('<video class="rounded centered" id="waitingvideo" width="100%" height="100%" />');
        $("#"+videoId).append('<video class="rounded centered hide" id="screenvideo" width="100%" height="100%" playsinline/>');
        $('#screenvideo').get(0).volume = 0;
        // Show the video, hide the spinner and show the resolution when we get a playing event
        $("#screenvideo").bind("playing", function() {
          $('#waitingvideo').remove();
          $('#screenvideo').removeClass('hide');
          if (spinner)
            spinner.stop();
          spinner = null;
        });
      }
      Janus.attachMediaStream($('#screenvideo').get(0), stream);
      $("#screenvideo").get(0).play();
      $("#screenvideo").get(0).volume = 1;
    },
    oncleanup: function() {
      Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
      $('#waitingvideo').remove();
      if (spinner)
        spinner.stop();
      spinner = null;
    }
  });
}
