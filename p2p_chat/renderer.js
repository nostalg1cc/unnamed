// p2p_chat/renderer.js

// IMPORTANT: For 'require' to work in renderer process with nodeIntegration: false (default for security),
// SimplePeer (and other Node modules) must be exposed via contextBridge in preload.js,
// or a bundler like Webpack/Parcel must be used.
// As a temporary simplification for development IF issues arise, one might set nodeIntegration: true in main.js,
// but this is not recommended for production.
let SimplePeer;
if (window.electronAPI && window.electronAPI.SimplePeer) {
    SimplePeer = window.electronAPI.SimplePeer;
    console.log("SimplePeer loaded via preload.js");
} else {
    console.error("SimplePeer not found on window.electronAPI. Check preload.js exposure.");
    alert("Critical component SimplePeer could not be loaded. P2P functionality will be unavailable. Ensure preload.js is correctly exposing SimplePeer.");
    // To prevent further errors, assign a dummy object or throw an error
    // For now, app functionality relying on SimplePeer will fail.
}

const USER_PROFILE_KEY = 'p2pChatUserProfile';
const CHAT_HISTORY_PREFIX = 'p2pChatHistory_';

// --- Chat History Storage ---
function saveMessageToHistory(peerId, messageObject) {
    if (!peerId) return;
    const key = `${CHAT_HISTORY_PREFIX}${peerId}`;
    let history = [];
    try {
        const existingHistoryJson = localStorage.getItem(key);
        if (existingHistoryJson) {
            history = JSON.parse(existingHistoryJson);
        }
    } catch (e) {
        console.error(`Error parsing chat history for ${peerId} from localStorage:`, e);
        // Optionally, clear corrupted data: localStorage.removeItem(key);
    }
    // Ensure history is an array, in case of corruption or unexpected data type
    if (!Array.isArray(history)) {
        history = [];
    }
    history.push(messageObject);
    try {
        localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.error(`Error saving chat history for ${peerId} to localStorage:`, e);
        alert("Could not save message. Local storage may be full or disabled.");
    }
}

function loadChatHistory(peerId) {
    if (!peerId) return [];
    const key = `${CHAT_HISTORY_PREFIX}${peerId}`;
    try {
        const historyJson = localStorage.getItem(key);
        if (historyJson) {
            const history = JSON.parse(historyJson);
            return Array.isArray(history) ? history : [];
        }
    } catch (e) {
        console.error(`Error loading or parsing chat history for ${peerId} from localStorage:`, e);
    }
    return [];
}

// --- User Profile Management ---
function generateUserId(length = 24) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function loadUserProfile() {
    const profileJson = localStorage.getItem(USER_PROFILE_KEY);
    if (profileJson) {
        try {
            return JSON.parse(profileJson);
        } catch (e) {
            console.error("Error parsing user profile from localStorage:", e);
            localStorage.removeItem(USER_PROFILE_KEY);
            return null;
        }
    }
    return null;
}

function saveUserProfile(displayName, userId) {
    const profile = { displayName, userId, timestamp: new Date().toISOString() };
    try {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.error("Error saving user profile to localStorage:", e);
        alert("Error saving profile. LocalStorage might be full or disabled.");
    }
}

function displayProfile(profileData) {
    const displayNameOutput = document.getElementById('display-name-output');
    const userIdOutput = document.getElementById('user-id-output');
    const setupProfileDiv = document.getElementById('setup-profile');

    if (profileData && profileData.displayName && profileData.userId) {
        displayNameOutput.textContent = profileData.displayName;
        userIdOutput.textContent = profileData.userId;
        if (setupProfileDiv) setupProfileDiv.style.display = 'none';
    } else {
        displayNameOutput.textContent = 'Not set';
        userIdOutput.textContent = 'Not set';
        if (setupProfileDiv) setupProfileDiv.style.display = 'block';
    }
}

// --- P2P Connection Globals & Functions ---
let peerConnection = null;
let localStream = null; // Reserved for future A/V
let chatPartnerID = null;
let localUserProfile = null; // Loaded in DOMContentLoaded

// DOM Elements (cached in DOMContentLoaded)
let connectPeerButton, peerIdInput, signalingExchangeArea, outgoingSignalTextarea;
let incomingAnswerSdpInput, submitIncomingAnswerButton, localIceCandidatesOutput; // Renamed answerSdpInput and submitAnswerSdpButton
let remoteIceCandidateInput, addRemoteIceCandidateButton;
let chatRequestsSection, requestsList;
let activeChatSection, chatPartnerIdDisplay, messagesArea, messageInput, sendMessageButton, disconnectPeerButton, exportChatButton; // Added exportChatButton
let initiateChatDiv, receiveOfferDiv, incomingOfferSdpInput, incomingOfferPeerId, processOfferButton;
let initiatorWaitsForAnswerDiv;


function appendMessage(text, type, peerDisplayName = 'Peer') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    // Basic text content; sanitize if HTML is ever allowed from peers.
    // For user's own messages, it's generally safer.
    messageDiv.textContent = text;

    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function cleanupPeerConnection() {
    if (peerConnection) {
        peerConnection.destroy();
        peerConnection = null;
    }
    if (activeChatSection) activeChatSection.style.display = 'none';
    if (signalingExchangeArea) signalingExchangeArea.style.display = 'none';
    if (initiatorWaitsForAnswerDiv) initiatorWaitsForAnswerDiv.style.display = 'none';
    if (initiateChatDiv) initiateChatDiv.style.display = 'block';
    if (receiveOfferDiv) receiveOfferDiv.style.display = 'block'; // Show both options initially

    if (chatPartnerIdDisplay) chatPartnerIdDisplay.textContent = 'Peer';
    if (messageInput) messageInput.disabled = true;
    if (sendMessageButton) sendMessageButton.disabled = true;
    if (disconnectPeerButton) disconnectPeerButton.style.display = 'none';
    if (exportChatButton) exportChatButton.style.display = 'none'; // Hide export button

    chatPartnerID = null;
    if (outgoingSignalTextarea) outgoingSignalTextarea.value = '';
    if (incomingAnswerSdpInput) incomingAnswerSdpInput.value = '';
    if (localIceCandidatesOutput) localIceCandidatesOutput.value = '';
    if (remoteIceCandidateInput) remoteIceCandidateInput.value = '';
    if (peerIdInput) peerIdInput.value = '';
    if (incomingOfferSdpInput) incomingOfferSdpInput.value = '';
    if (incomingOfferPeerId) incomingOfferPeerId.value = '';
}


function initializePeerEvents(currentPeer) {
    currentPeer.on('signal', data => {
        console.log('SIGNAL:', JSON.stringify(data));
        // Output any signal (offer or answer) to the designated outgoing text area
        if (data.type === 'offer' || data.type === 'answer') {
            outgoingSignalTextarea.value = JSON.stringify(data);
            if (data.type === 'offer') {
                alert("Offer SDP generated. Copy from 'Your Outgoing Signal' textarea and send to your peer.");
                if (initiatorWaitsForAnswerDiv) initiatorWaitsForAnswerDiv.style.display = 'block';
            } else { // 'answer'
                alert("Answer SDP generated. Copy from 'Your Outgoing Signal' textarea and send back to the initiator.");
                // No need to show initiatorWaitsForAnswerDiv for the peer generating an answer
            }
        } else if (data.candidate) {
            localIceCandidatesOutput.value += JSON.stringify(data.candidate) + '\n\n';
        }
    });

    currentPeer.on('connect', () => {
        console.log('CONNECT: Connection established!');
        alert(`Connected to ${chatPartnerID || 'peer'}!`);
        if (signalingExchangeArea) signalingExchangeArea.style.display = 'none';
        if (initiatorWaitsForAnswerDiv) initiatorWaitsForAnswerDiv.style.display = 'none';
        if (activeChatSection) activeChatSection.style.display = 'block';
        if (chatPartnerIdDisplay) chatPartnerIdDisplay.textContent = chatPartnerID || 'Peer';
        if (messagesArea) messagesArea.innerHTML = ''; // Clear before loading history

        // Load and display chat history
        const history = loadChatHistory(chatPartnerID);
        history.forEach(msg => {
            const messageTypeForDisplay = (msg.sender === (localUserProfile ? localUserProfile.userId : null)) ? 'self' : 'peer';
            const displayName = messageTypeForDisplay === 'self'
                ? (localUserProfile ? localUserProfile.displayName : 'You')
                : (msg.senderName || msg.sender || chatPartnerID || 'Peer'); // Use senderName, then sender ID, then current peer ID
            appendMessage(msg.text, messageTypeForDisplay, displayName);
        });

        if (messageInput) messageInput.disabled = false;
        if (sendMessageButton) sendMessageButton.disabled = false;
        if (disconnectPeerButton) disconnectPeerButton.style.display = 'inline-block';
        if (exportChatButton) exportChatButton.style.display = 'inline-block'; // Show export button
        if (chatRequestsSection) chatRequestsSection.style.display = 'none'; // Hide request if one was accepted
    });

    currentPeer.on('data', receivedData => {
        const messageText = receivedData.toString();
        console.log('DATA: Received message:', messageText);

        const messageObject = {
            type: 'peer',
            text: messageText,
            timestamp: new Date().toISOString(),
            sender: chatPartnerID // The ID of the peer who sent this message
            // senderName: chatPartnerDisplayName // If we had a way to get the peer's display name
        };
        saveMessageToHistory(chatPartnerID, messageObject);
        appendMessage(messageText, 'peer', chatPartnerID); // Display name for peer might just be their ID for now
    });

    currentPeer.on('close', () => {
        console.log('CLOSE: Connection closed.');
        alert(`Connection with ${chatPartnerID || 'peer'} closed.`);
        cleanupPeerConnection();
    });

    currentPeer.on('error', err => {
        console.error('ERROR in peer connection:', err);
        alert(`Connection error: ${err.message || JSON.stringify(err)}`);
        // Consider cleanup, but some errors are recoverable or part of negotiation.
        // If error is fatal like 'ERR_CONNECTION_FAILURE', then cleanup.
        if (err.code === 'ERR_CONNECTION_FAILURE' ||
            err.code === 'ERR_ICE_CONNECTION_FAILURE' ||
            err.code === 'ERR_DTLS_ERROR' ||
            err.code === 'ERR_WEBRTC_SUPPORT') {
            cleanupPeerConnection();
        }
    });
}

// Called when "Request Chat" is clicked (we are initiator)
function initiateChatRequest() {
    if (!SimplePeer) { alert("SimplePeer is not available."); return; }
    if (peerConnection) { alert("Already in a session or attempting. Disconnect first."); return; }

    const targetPeerIdText = peerIdInput.value.trim();
    if (!targetPeerIdText) { alert("Please enter the Peer's User ID."); return; }
    chatPartnerID = targetPeerIdText;

    peerConnection = new SimplePeer({ initiator: true, trickle: false }); // trickle:false for simpler manual signaling
    initializePeerEvents(peerConnection);

    // UI updates
    if (initiateChatDiv) initiateChatDiv.style.display = 'none';
    if (receiveOfferDiv) receiveOfferDiv.style.display = 'none';
    if (signalingExchangeArea) signalingExchangeArea.style.display = 'block';
    if (initiatorWaitsForAnswerDiv) initiatorWaitsForAnswerDiv.style.display = 'block'; // Show section for pasting answer

    if (outgoingSignalTextarea) outgoingSignalTextarea.value = ''; // Clear previous outgoing signal
    if (incomingAnswerSdpInput) incomingAnswerSdpInput.value = ''; // Clear previous incoming answer
    if (localIceCandidatesOutput) localIceCandidatesOutput.value = '';
    console.log("Initiating chat. Waiting for offer SDP to be generated by SimplePeer...");
}

// Called when "Process Offer & Generate Answer" is clicked (we are non-initiator)
function processIncomingOffer() {
    if (!SimplePeer) { alert("SimplePeer is not available."); return; }
    if (peerConnection) { alert("Already in a session or attempting. Disconnect first."); return; }

    const offerSdpString = incomingOfferSdpInput.value.trim();
    if (!offerSdpString) {
        alert("Please paste the Offer SDP from your peer.");
        return;
    }

    const peerIdFromInput = incomingOfferPeerId.value.trim();
    chatPartnerID = peerIdFromInput || 'Incoming Peer'; // Set chatPartnerID

    try {
        const offer = JSON.parse(offerSdpString);
        peerConnection = new SimplePeer({ initiator: false, trickle: false });
        initializePeerEvents(peerConnection);
        peerConnection.signal(offer); // Process the offer, this will trigger 'signal' event with our Answer

        // UI updates
        if (initiateChatDiv) initiateChatDiv.style.display = 'none';
        if (receiveOfferDiv) receiveOfferDiv.style.display = 'none';
        if (signalingExchangeArea) signalingExchangeArea.style.display = 'block';
        if (initiatorWaitsForAnswerDiv) initiatorWaitsForAnswerDiv.style.display = 'none'; // Hide answer input for receiver

        if (outgoingSignalTextarea) outgoingSignalTextarea.value = ''; // Will be populated by 'signal' event
        if (localIceCandidatesOutput) localIceCandidatesOutput.value = '';
        console.log("Received offer, processing. Waiting for answer SDP to be generated by SimplePeer...");
    } catch (err) {
        alert("Invalid Offer SDP format. It should be a JSON string.");
        console.error("Error parsing offer SDP:", err);
    }
}


// Called when "Submit Peer's Answer" is clicked by the INITIATOR
function submitPeerAnswer() {
    if (!peerConnection) { alert("Not in connection attempt. Initiate a chat first."); return; }
    if (!peerConnection.initiator) { // Should only be called by initiator
        alert("This action is for the initiator after receiving an answer.");
        return;
    }

    const answerSdpString = incomingAnswerSdpInput.value.trim();
    if (!answerSdpString) {
        alert("Please paste the peer's Answer SDP.");
        return;
    }

    try {
        const answer = JSON.parse(answerSdpString);
        peerConnection.signal(answer);
        console.log("Submitted peer's answer to local PeerConnection.");
        incomingAnswerSdpInput.value = ""; // Clear after use
        // Connection should establish now if all goes well (event 'connect')
    } catch (err) {
        alert("Invalid Answer SDP format. It should be a JSON string.");
        console.error("Error parsing answer SDP:", err);
    }
}

// Called when "Add Peer's ICE Candidate" is clicked (applies to both sides)
function handleAddRemoteIceCandidate() {
    if (!peerConnection) { alert("No active connection attempt."); return; }

    try {
        // simple-peer expects candidates as objects, not strings, if they are not part of offer/answer
        // For trickle:true, signal data might be { candidate: { candidate: "...", sdpMid: "...", ... } }
        // For manual copy-paste, ensure the JSON is correct.
        const candidateSignal = JSON.parse(remoteIceCandidateInput.value.trim());
        peerConnection.signal(candidateSignal);
        console.log("Added remote ICE candidate.");
        remoteIceCandidateInput.value = '';
    } catch (err) {
        alert("Invalid ICE candidate format. Ensure it's a valid JSON string representing the candidate object.");
        console.error("Error parsing/adding ICE candidate:", err);
    }
}


// --- DOMContentLoaded ---
window.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer.js loaded. DOM fully parsed.');

    // Cache DOM elements
    initiateChatDiv = document.getElementById('initiate-chat-div');
    connectPeerButton = document.getElementById('connect-peer-button');
    peerIdInput = document.getElementById('peer-id-input');

    receiveOfferDiv = document.getElementById('receive-offer-div');
    incomingOfferSdpInput = document.getElementById('incoming-offer-sdp-input');
    incomingOfferPeerId = document.getElementById('incoming-offer-peer-id');
    processOfferButton = document.getElementById('process-offer-button');

    signalingExchangeArea = document.getElementById('signaling-exchange-area');
    outgoingSignalTextarea = document.getElementById('outgoing-signal-textarea');

    initiatorWaitsForAnswerDiv = document.getElementById('initiator-waits-for-answer-div');
    incomingAnswerSdpInput = document.getElementById('incoming-answer-sdp-input');
    submitIncomingAnswerButton = document.getElementById('submit-incoming-answer-button');

    localIceCandidatesOutput = document.getElementById('local-ice-candidates-output');
    remoteIceCandidateInput = document.getElementById('remote-ice-candidate-input');
    addRemoteIceCandidateButton = document.getElementById('add-remote-ice-candidate-button');

    chatRequestsSection = document.getElementById('chat-requests-section'); // Still here, for future use
    requestsList = document.getElementById('requests-list');

    activeChatSection = document.getElementById('active-chat-section');
    chatPartnerIdDisplay = document.getElementById('chat-partner-id-display');
    messagesArea = document.getElementById('messages-area');
    messageInput = document.getElementById('message-input');
    sendMessageButton = document.getElementById('send-message-button');
    disconnectPeerButton = document.getElementById('disconnect-peer-button');

    // --- Profile Setup ---
    const saveProfileButton = document.getElementById('save-profile-button');
    const displayNameInput = document.getElementById('display-name-input');
    if (!saveProfileButton || !displayNameInput) {
        console.error("Required profile setup elements not found.");
    } else {
        saveProfileButton.addEventListener('click', () => {
            const name = displayNameInput.value.trim();
            if (!name) { alert('Display name cannot be empty.'); return; }
            const newUserId = generateUserId();
            saveUserProfile(name, newUserId);
            localUserProfile = { displayName: name, userId: newUserId };
            displayProfile(localUserProfile);
            displayNameInput.value = '';
            alert(`Profile saved!\nDisplay Name: ${name}\nUser ID: ${newUserId}\nThis ID is how others will find you.`);
        });
    }
    localUserProfile = loadUserProfile();
    displayProfile(localUserProfile);
    if (!localUserProfile) {
        alert("Please set up your profile (Display Name) to use the chat.");
    }


    // --- P2P Event Listeners ---
    if (connectPeerButton) connectPeerButton.addEventListener('click', initiateChatRequest);
    if (processOfferButton) processOfferButton.addEventListener('click', processIncomingOffer);
    if (submitIncomingAnswerButton) submitIncomingAnswerButton.addEventListener('click', submitPeerAnswer);
    if (addRemoteIceCandidateButton) addRemoteIceCandidateButton.addEventListener('click', handleAddRemoteIceCandidate);

    if (disconnectPeerButton) {
        disconnectPeerButton.addEventListener('click', () => {
            if (peerConnection) {
                peerConnection.destroy(); // Triggers 'close' event for cleanup
            } else {
                cleanupPeerConnection(); // Fallback
            }
        });
    }

    if (sendMessageButton && messageInput) {
        sendMessageButton.addEventListener('click', () => {
            const messageText = messageInput.value.trim();
            if (messageText && peerConnection && peerConnection.connected) {
                if (!localUserProfile || !localUserProfile.displayName) {
                    appendMessage("Error: Profile not set.", 'self'); // Should not happen if profile check is done
                    return;
                }
                // Optional: Send as JSON object with sender name
                // const messageObject = { sender: localUserProfile.displayName, text: messageText };
                // peerConnection.send(JSON.stringify(messageObject));
                peerConnection.send(messageText);
                appendMessage(messageText, 'self', localUserProfile.displayName);
                messageInput.value = '';
            }
        });
        messageInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent form submission if it were in a form
                sendMessageButton.click();
            }
        });
    }

    // Initial UI state
    cleanupPeerConnection(); // Sets initial display states for chat sections
    if (messageInput) messageInput.disabled = true;
    if (sendMessageButton) sendMessageButton.disabled = true;

    // The 'acceptChatOffer' function will be wired up in the Chat Request Mechanism step
    // when we define how offers are received and presented to the user.

    if (exportChatButton) exportChatButton.addEventListener('click', handleExportChat);
    if (exportChatButton) exportChatButton.style.display = 'none'; // Ensure it's hidden initially
});

function handleExportChat() {
    if (!chatPartnerID) {
        alert("No active chat to export.");
        return;
    }
    if (!localUserProfile || !localUserProfile.userId) {
        alert("User profile not loaded. Cannot determine full context for export.");
        return;
    }

    const history = loadChatHistory(chatPartnerID);
    if (!history || history.length === 0) {
        alert("No chat history found for this peer.");
        return;
    }

    const exportData = {
        chatBetween: [localUserProfile.userId, chatPartnerID].sort(), // Sort for consistent key if imported
        participants: [
            {userId: localUserProfile.userId, displayName: localUserProfile.displayName},
            {userId: chatPartnerID, displayName: chatPartnerID} // We don't have peer's display name yet
        ],
        exportedBy: localUserProfile.userId,
        exportTimestamp: new Date().toISOString(),
        messages: history
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const safePeerId = String(chatPartnerID).replace(/[^a-z0-9_.-]/gi, '_');
    const dateSuffix = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    a.download = `p2p_chat_with_${safePeerId}_on_${dateSuffix}.json`;

    document.body.appendChild(a); // Required for Firefox for the click to work
    a.click();
    document.body.removeChild(a); // Clean up
    URL.revokeObjectURL(url); // Release the object URL

    alert(`Chat history with ${chatPartnerID} prepared for download.`);
}
