// Broadcast Types
$(document).on("turbolinks:load", function(){
  'use strict';
  const JOIN_ROOM = "JOIN_ROOM";
  const EXCHANGE = "EXCHANGE";
  const REMOVE_USER = "REMOVE_USER";

  // DOM Elements
  let currentRoom;
  let localVideo;
  let remoteVideoContainer;
  // Objects
  let pcPeers = {};
  let localstream;
  let callButton = document.getElementById("callButton")
  let hangoutButton = document.getElementById("hangoutButton")

  let startButton = document.getElementById("startButton") 
  currentRoom = document.getElementById("room-name").value;
  localVideo = document.getElementById("local-video");
  remoteVideoContainer = document.getElementById("remote-video-container");
  let roomId = document.getElementById("room-id").value
  // Ice Credentials
  if (currentRoom && roomId && localVideo && remoteVideoContainer) {
    const ice = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    // Initialize user's own video
    // navigator.mediaDevices
    //   .getUserMedia({
    //     audio: true,
    //     video: true
    //   })
    //   .then(stream => {
    //     localstream = stream;
    //     localVideo.srcObject = stream;
    //   })
    //   .catch(logError);
    function gotStream(stream) {
      localVideo.srcObject = stream;
      window.localStream = stream;
    }

    let start = () => {
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      })
      .then(gotStream)
      .catch(function(e) {
        console.log('getUserMedia() error: ', e);
      });
    }

    window.onload = () =>{
      start()
    }

    window.handleJoinSession = async () => {
      roomId = document.getElementById("room-id").value
      App.call = await App.cable.subscriptions.create("CallChannel", {
        connected: () => {
          debugger
          broadcastData({
            room_id: roomId,
            type: JOIN_ROOM,
            from: currentRoom
          });
        },
        received: data => {
          debugger
          console.log("received", data);
          if (data.from === currentUser) return;
          switch (data.type) {
            case JOIN_ROOM:
              return joinRoom(data);
            case EXCHANGE:
              if (data.to !== currentUser) return;
              return exchange(data);
            case REMOVE_USER:
              return removeUser(data);
            default:
              return;
          }
        }
      });
    };

    window.handleLeaveSession = () => {
      for (user in pcPeers) {
        pcPeers[user].close();
      }
      pcPeers = {};

      App.call.unsubscribe();

      remoteVideoContainer.innerHTML = "";

      broadcastData({
        type: REMOVE_USER,
        from: currentRoom
      });
    };

    const joinRoom = data => {
      createPC(data.from, true);
    };

    const removeUser = data => {
      console.log("removing user", data.from);
      let video = document.getElementById(`remoteVideoContainer+${data.from}`);
      video && video.remove();
      delete pcPeers[data.from];
    };

    const createPC = (userId, isOffer) => {
      let pc = new RTCPeerConnection(ice);
      pcPeers[userId] = pc;
      pc.addStream(localstream);

      isOffer &&
        pc
          .createOffer()
          .then(offer => {
            pc.setLocalDescription(offer);
            broadcastData({
              type: EXCHANGE,
              from: currentRoom,
              to: userId,
              sdp: JSON.stringify(pc.localDescription)
            });
          })
          .catch(logError);

      pc.onicecandidate = event => {
        event.candidate &&
          broadcastData({
            type: EXCHANGE,
            from: currentRoom,
            to: userId,
            candidate: JSON.stringify(event.candidate)
          });
      };

      pc.onaddstream = event => {
        const element = document.createElement("video");
        element.id = `remoteVideoContainer+${userId}`;
        element.autoplay = "autoplay";
        element.srcObject = event.stream;
        remoteVideoContainer.appendChild(element);
      };

      pc.oniceconnectionstatechange = event => {
        if (pc.iceConnectionState == "disconnected") {
          console.log("Disconnected:", userId);
          broadcastData({
            type: REMOVE_USER,
            from: userId
          });
        }
      };

      return pc;
    };

    const exchange = data => {
      let pc;

      if (!pcPeers[data.from]) {
        pc = createPC(data.from, false);
      } else {
        pc = pcPeers[data.from];
      }

      if (data.candidate) {
        pc
          .addIceCandidate(new RTCIceCandidate(JSON.parse(data.candidate)))
          .then(() => console.log("Ice candidate added"))
          .catch(logError);
      }

      if (data.sdp) {
        sdp = JSON.parse(data.sdp);
        pc
          .setRemoteDescription(new RTCSessionDescription(sdp))
          .then(() => {
            if (sdp.type === "offer") {
              pc.createAnswer().then(answer => {
                pc.setLocalDescription(answer);
                broadcastData({
                  type: EXCHANGE,
                  from: currentRoom,
                  to: data.from,
                  sdp: JSON.stringify(pc.localDescription)
                });
              });
            }
          })
          .catch(logError);
      }
    };

    const broadcastData = data => {
      fetch("/videos", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "content-type": "application/json"
        }
      });
    };

    const logError = error => console.warn("Whoops! Error:", error);
  }
})