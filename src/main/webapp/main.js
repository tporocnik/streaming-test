
// The WebRTC connection used for streaming. 
var peerConnection;

// Local media stream
var localStream;

// Setup exit button function.
const exitButton = document.getElementById('exit-button');
exitButton.addEventListener('click', exit);

// Setup start button function.
const startButton = document.getElementById('start-button');
startButton.addEventListener('click', startConference);

// Setup signaling.
var signalingWebSocket = new WebSocket("wss://" + window.location.host + "/streaming-test/signal");

signalingWebSocket.onmessage = (msg) => {
    console.log("Received message", msg.data);
    var signal = JSON.parse(msg.data);
    switch (signal.type) {
        case "offer":
            handleOfferSignal(signal);
            break;
        case "answer":
            handleAnswerSignal(signal);
            break;
        case "candidate":
            handleCandidateSignal(signal);
            break;
        default:
            break;
    }
};


/*
 * Send signal to signaling server
 */
function sendSignal(signal) {
    if (signalingWebSocket.readyState == 1) {
        signalJson = JSON.stringify(signal)
        console.log("Sending signal: " + signalJson)
        signalingWebSocket.send(signalJson);
    }
};


/*
 * Prepare WebRTC connection & setup event handlers.
 */
function initPeerConnection() {

    // Using public Google STUN server.
    const configuration = {
        iceServers: [{
            urls: 'stun:stun.l.google.com:19302'
        }]
    };

    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
    peerConnection.ontrack = handleTrackEvent;
    peerConnection.onicecandidate = handleICECandidateEvent;

};

/**
 * Initialize the conference
 */
function startConference() {
    initPeerConnection();
    initLocalStream();
}

/*
 * Closing connection and leaving the page
 */
function exit() {
    console.log('Exiting call');
    peerConnection.close();
    signalingWebSocket.close();
    window.location.reload();
};


/**
 * Connect local video and audio to UI and peerConnection.
 */
async function initLocalStream() {
    console.log('Init local stream');

    // Request access to local video & audio stream and set it to local UI element, prefer front camera.
    // If started from offer it may be called multiple times
    if (!localStream) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });

            document.getElementById("local-video").srcObject = localStream;
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        } catch (e) {
            console.log(`Couldn't access local media stream via getUserMedia(). Error: ${e.message}`);
            throw e;
        }
    }
    console.log('Local initialization complete');
};


/**
 *  This event is emitted by our own end of the connection so that it can be transmitted.
 */
function handleICECandidateEvent(event) {
    console.log('New local ice candidate created.');
    //Send candidate via signal server
    if (event.candidate) {
        sendSignal({
            type: "candidate",
            candidate: event.candidate
        });
    }
}

/**
 * Stream was added on the remote side, connect it to the local element.
 */
function handleTrackEvent(event) {
    console.log('Remote stream added.');
    const remoteVideo = document.getElementById('remote-video');
    remoteVideo.srcObject = event.streams[0];
};

/**
 * Event emitted by the WebRTC layer to signal that negotiation is to start.
 */
async function handleNegotiationNeededEvent() {
    console.log('Negotiation needed.');
    //create and send offer via signal server
    peerConnection.createOffer()
        .then((offer) => {
            return peerConnection.setLocalDescription(offer);
        }).then(() => {
            sendSignal({
                type: "offer",
                sdp: peerConnection.localDescription
            })
        }).catch((e) => {
            console.log("Error creating an offer: " + e.message);
        });
};


/**
 * Handle the offer sent by remote participant and send back an answer.
 */
async function handleOfferSignal(offer) {
    console.log("Handling offer: " + JSON.stringify(offer));

    //init own connection if not done
    if (!peerConnection) {
        initPeerConnection();
    }

    var desc = new RTCSessionDescription(offer.sdp);

    peerConnection.setRemoteDescription(new RTCSessionDescription(desc))
        .then(initLocalStream())
        .then(function () {
            return peerConnection.createAnswer();
        })
        .then(function (answer) {
            return peerConnection.setLocalDescription(answer)
        }).then(function () {
            sendSignal({
                type: "answer",
                sdp: peerConnection.localDescription
            })
        });

};

/*
 * Finish the handshake by receiving the answer. 
 */
async function handleAnswerSignal(answer) {
    console.log("Handling answer: " + JSON.stringify(answer));
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp));
};

/*
 * Add received ICE candidate to connection. ICE candidate has information about
 * how to connect to remote participant.
 */
async function handleCandidateSignal(candidate) {
    console.log("Add new candidate: " + JSON.stringify(candidate));
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate.candidate));
};



