// Broadcast Types
$(document).on("turbolinks:load", function(){
  'use strict';
  const JOIN_ROOM = "JOIN_ROOM";
  const EXCHANGE = "EXCHANGE";
  const REMOVE_USER = "REMOVE_USER";

  // DOM Elements
  let currentUser;
  let localVideo;
  let remoteVideoContainer;
  // Objects
  let pcPeers = {};
  let localStream = {};
  let callButton = document.getElementById("callButton")
  let hangoutButton = document.getElementById("hangoutButton")

  let startButton = document.getElementById("startButton") 
  currentUser = document.getElementById("currentUser").value;
  localVideo = document.getElementById("local-video");
  remoteVideoContainer = document.getElementById("remote-video-container");
  let roomId = document.getElementById("room-id").value
  // Ice Credentials
  if (currentUser && roomId && localVideo && remoteVideoContainer) {
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
      localStream = stream;
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

    window.handleJoinSession = () => {
      roomId = document.getElementById("room-id").value
      App.call = App.cable.subscriptions.create(
        {
          channel: "CallChannel",
          roomId: roomId
        }, {
        connected: () => {
          broadcastData({
            room_id: roomId,
            type: JOIN_ROOM,
            from: currentUser
          });
        },
        received: data => {
          console.log("received", data);
          callButton.disabled = true
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
      roomId = document.getElementById("room-id").value
      for (user in pcPeers) {
        pcPeers[user].close();
      }
      pcPeers = {};

      App.call.unsubscribe();

      remoteVideoContainer.innerHTML = "";

      broadcastData({
        type: REMOVE_USER,
        from: currentUser,
        room_id: roomId
      });
    };

    const joinRoom = data => {
      let pc = createPC(data.from, true);
    };

    const removeUser = data => {
      console.log("removing user", data.from);
      let video = document.getElementById(`remoteVideoContainer+${data.from}`);
      video && video.remove();
      delete pcPeers[data.from];
    };

    const createPC = (userId, isOffer) => {
      roomId = document.getElementById("room-id").value
      let pc = new RTCPeerConnection(ice);
      pcPeers[userId] = pc;
      pc.addStream(localStream);
      isOffer &&
        pc
          .createOffer({offerToReceiveAudio: 1,
                offerToReceiveVideo: 1})
          .then(offer => {
            pc.setLocalDescription(offer);
            broadcastData({
              type: EXCHANGE,
              from: currentUser,
              to: userId,
              sdp: JSON.stringify(pc.localDescription),
              room_id: roomId
            });
          })
          .catch(logError);
      pc.onicecandidate = event => {
        event.candidate &&
          broadcastData({
            type: EXCHANGE,
            from: currentUser,
            to: userId,
            candidate: JSON.stringify(event.candidate),
            room_id: roomId
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
            from: userId,
            room_id: roomId
          });
        }
      };

      return pc;
    };

    const exchange = data => {
      roomId = document.getElementById("room-id").value
      let pc;
      let sdp;
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
                  from: currentUser,
                  to: data.from,
                  sdp: JSON.stringify(pc.localDescription),
                  room_id: roomId
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