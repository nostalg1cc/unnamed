// p2p_chat/renderer.js

// SimplePeer is expected to be loaded globally from a CDN script tag in index.html
// We will declare SimplePeer here so it's in the module scope, but it's assigned by the global script.
let SimplePeer = window.SimplePeer; // Assign directly from global scope

if (typeof SimplePeer === 'undefined') {
    console.error("SimplePeer is not loaded! Make sure the CDN script tag is in index.html and loaded correctly before renderer.js.");
    alert("Critical component SimplePeer could not be loaded. P2P functionality will be unavailable. Please check the browser console for errors related to SimplePeer CDN loading.");
    // Application may not function correctly beyond this point.
    // To prevent further errors if SimplePeer is absolutely critical from the start:
    // throw new Error("SimplePeer is not available.");
} else {
    console.log("SimplePeer assigned from global scope (presumably from CDN).");
    // Check if SimplePeer object has a version or a clear indicator it's the correct library
    if (SimplePeer.WEBRTC_SUPPORT) { // simple-peer has this static property
        console.log("SimplePeer WEBRTC_SUPPORT detected. Version:", SimplePeer.VERSION);
    } else {
        console.warn("SimplePeer loaded, but it might not be the expected library (missing WEBRTC_SUPPORT property).");
    }
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
    }
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

// --- P2P Connection Globals ---
let peerConnection = null;
let localStream = null; // Reserved for future A/V
let chatPartnerID = null;
let localUserProfile = null; // Loaded in DOMContentLoaded

// --- DOM Elements ---
let initialSetupView, displayNameInputSetup, saveProfileButtonSetup;
let p2pManagementView, initiateChatDivModal, peerIdInputModal, connectPeerButtonModal;
let receiveOfferDivModal, incomingOfferPeerIdModal, incomingOfferSdpInputModal, processOfferButtonModal;
let signalingExchangeAreaModal, outgoingSignalTextareaModal, initiatorWaitsForAnswerDivModal, incomingAnswerSdpInputModal, submitIncomingAnswerButtonModal;
let cancelP2PSetupButtonModal;

let sidebar, initiateNewChatSidebarButton, currentChatDmItem, dmListCurrentChatName;
let localUserDisplayNameSidebar, localUserIdSidebar, localUserAvatarSidebar;

let mainContent, chatViewArea, noChatView;
let chatHeaderPartnerName, exportChatButtonHeader, disconnectChatButtonHeader;
let messagesArea, messageInputBox, sendMessageButtonBox;
// Specific elements for ICE candidates if they are part of the modal.
let localIceCandidatesOutputModal, remoteIceCandidateInputModal, addRemoteIceCandidateButtonModal;


function cacheDOMElements() {
    initialSetupView = document.getElementById('initial-setup-view');
    displayNameInputSetup = document.getElementById('display-name-input');
    saveProfileButtonSetup = document.getElementById('save-profile-button');

    p2pManagementView = document.getElementById('p2p-management-view');
    initiateChatDivModal = document.getElementById('initiate-chat-div');
    peerIdInputModal = document.getElementById('peer-id-input');
    connectPeerButtonModal = document.getElementById('connect-peer-button');
    receiveOfferDivModal = document.getElementById('receive-offer-div');
    incomingOfferPeerIdModal = document.getElementById('incoming-offer-peer-id');
    incomingOfferSdpInputModal = document.getElementById('incoming-offer-sdp-input');
    processOfferButtonModal = document.getElementById('process-offer-button');
    signalingExchangeAreaModal = document.getElementById('signaling-exchange-area');
    outgoingSignalTextareaModal = document.getElementById('outgoing-signal-textarea');
    initiatorWaitsForAnswerDivModal = document.getElementById('initiator-waits-for-answer-div');
    incomingAnswerSdpInputModal = document.getElementById('incoming-answer-sdp-input');
    submitIncomingAnswerButtonModal = document.getElementById('submit-incoming-answer-button');
    cancelP2PSetupButtonModal = document.getElementById('cancel-p2p-setup-button');

    // ICE Candidate related elements - assuming they are part of the p2p-management-view modal
    // If these IDs exist in the new HTML structure for the modal:
    localIceCandidatesOutputModal = document.getElementById('local-ice-candidates-output'); // Ensure this ID exists in modal HTML
    remoteIceCandidateInputModal = document.getElementById('remote-ice-candidate-input');   // Ensure this ID exists
    addRemoteIceCandidateButtonModal = document.getElementById('add-remote-ice-candidate-button'); // Ensure this ID exists


    sidebar = document.querySelector('.sidebar');
    initiateNewChatSidebarButton = document.getElementById('initiate-new-chat-sidebar-button');
    currentChatDmItem = document.getElementById('current-chat-dm-item');
    dmListCurrentChatName = document.getElementById('dm-list-current-chat-name');
    localUserDisplayNameSidebar = document.getElementById('local-user-display-name-sidebar');
    localUserIdSidebar = document.getElementById('local-user-id-sidebar');
    localUserAvatarSidebar = document.getElementById('local-user-avatar-sidebar');


    mainContent = document.querySelector('.main-content');
    chatViewArea = document.getElementById('chat-view-area');
    noChatView = document.getElementById('no-chat-view');

    chatHeaderPartnerName = document.getElementById('chat-partner-name-header');
    exportChatButtonHeader = document.getElementById('export-chat-button');
    disconnectChatButtonHeader = document.getElementById('disconnect-chat-button');
    messagesArea = document.getElementById('messages-area');
    messageInputBox = document.getElementById('message-input');
    sendMessageButtonBox = document.getElementById('send-message-button');
}

// --- UI Update Functions ---
function displayLocalUserProfile() {
    const profileData = localUserProfile;

    if (localUserDisplayNameSidebar) localUserDisplayNameSidebar.textContent = profileData && profileData.displayName ? profileData.displayName : 'Display Name';
    if (localUserAvatarSidebar && profileData && profileData.displayName) { // Simple text avatar
        localUserAvatarSidebar.textContent = profileData.displayName.substring(0,1).toUpperCase();
    } else if (localUserAvatarSidebar) {
        localUserAvatarSidebar.textContent = '?';
    }
    if (localUserIdSidebar) localUserIdSidebar.textContent = profileData && profileData.userId ? profileData.userId : 'Not Set';

    if (profileData && profileData.displayName && profileData.userId) {
        if (initialSetupView) initialSetupView.classList.remove('active-overlay');
        // Show noChatView only if chatView is also not active
        if (noChatView && (!chatViewArea || chatViewArea.style.display === 'none')) {
             noChatView.style.display = 'flex';
        } else if (noChatView) {
            noChatView.style.display = 'none';
        }
    } else {
        if (initialSetupView) initialSetupView.classList.add('active-overlay');
        if (noChatView) noChatView.style.display = 'none';
        if (chatViewArea) chatViewArea.style.display = 'none';
    }
}

function appendMessage(messageObject, isHistory = false) {
    if (!messagesArea || !localUserProfile) return;

    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper');

    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content-wrapper');

    // Optional: Avatar next to message (can be added here if desired)
    // const avatarDiv = document.createElement('div');
    // avatarDiv.classList.add('msg-avatar');
    // messageWrapper.appendChild(avatarDiv); // If avatar is outside content-wrapper

    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    try {
        timestampSpan.textContent = new Date(messageObject.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        timestampSpan.textContent = 'Invalid date'; // Fallback for invalid timestamp
    }

    const textDiv = document.createElement('div');
    textDiv.classList.add('message-text');
    textDiv.textContent = messageObject.text;

    const messageType = (messageObject.sender === localUserProfile.userId) ? 'self' : 'peer';
    messageWrapper.classList.add(messageType);

    senderSpan.textContent = messageType === 'self'
        ? (localUserProfile.displayName)
        : (messageObject.senderName || messageObject.sender); // Use senderName if available, else sender ID

    messageHeader.appendChild(senderSpan);
    messageHeader.appendChild(timestampSpan);
    messageContent.appendChild(messageHeader);
    messageContent.appendChild(textDiv);
    messageWrapper.appendChild(messageContent);

    messagesArea.appendChild(messageWrapper);

    // Scroll to bottom for new messages or if loading history and user is already at bottom
    // More robust scrolling might be needed for loading history if user was scrolled up.
    // For now, always scroll to bottom.
    messagesArea.scrollTop = messagesArea.scrollHeight;
}


// --- P2P Functions (To be refactored in next chunk) ---
function initiateChatRequest() {
    if (!SimplePeer) { alert("SimplePeer is not available."); return; }
    if (peerConnection) { alert("Already in a session or attempting. Disconnect first."); return; }

    const targetPeerIdText = peerIdInputModal.value.trim(); // Use modal ID
    if (!targetPeerIdText) { alert("Please enter the Peer's User ID."); return; }
    chatPartnerID = targetPeerIdText;

    peerConnection = new SimplePeer({ initiator: true, trickle: false });
    initializePeerEvents(peerConnection);

    if (initiateChatDivModal) initiateChatDivModal.style.display = 'none';
    if (receiveOfferDivModal) receiveOfferDivModal.style.display = 'none';
    if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'block';
    if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'block';

    if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
    if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
    if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';
    console.log("Initiating chat. Waiting for offer SDP...");
}

function processIncomingOffer() {
    if (!SimplePeer) { alert("SimplePeer is not available."); return; }
    if (peerConnection) { alert("Already in a session or attempting. Disconnect first."); return; }

    const offerSdpString = incomingOfferSdpInputModal.value.trim();
    if (!offerSdpString) {
        alert("Please paste the Offer SDP from your peer.");
        return;
    }

    const peerIdFromInput = incomingOfferPeerIdModal.value.trim();
    chatPartnerID = peerIdFromInput || 'Incoming Peer (ID unknown)';

    try {
        const offer = JSON.parse(offerSdpString);
        peerConnection = new SimplePeer({ initiator: false, trickle: false });
        initializePeerEvents(peerConnection);
        peerConnection.signal(offer);

        if (initiateChatDivModal) initiateChatDivModal.style.display = 'none';
        if (receiveOfferDivModal) receiveOfferDivModal.style.display = 'none';
        if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'block';
        if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';

        if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
        if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';
        console.log("Received offer, processing. Waiting for answer SDP...");
    } catch (err) {
        alert("Invalid Offer SDP format. It should be a JSON string.");
        console.error("Error parsing offer SDP:", err);
        if (p2pManagementView) p2pManagementView.classList.remove('active-overlay'); // Close modal on error
        cleanupPeerConnection(); // Or just reset modal state
    }
}

function submitPeerAnswer() {
    if (!peerConnection || !peerConnection.initiator) {
        alert("Not in initiator connection attempt."); return;
    }

    const answerSdpString = incomingAnswerSdpInputModal.value.trim();
    if (!answerSdpString) {
        alert("Please paste the peer's Answer SDP."); return;
    }

    try {
        const answer = JSON.parse(answerSdpString);
        peerConnection.signal(answer);
        console.log("Submitted peer's answer.");
        if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = "";
    } catch (err) {
        alert("Invalid Answer SDP format.");
        console.error("Error parsing answer SDP:", err);
    }
}

function handleAddRemoteIceCandidate() {
    if (!peerConnection) { alert("No active connection attempt."); return; }
    if(!remoteIceCandidateInputModal || !remoteIceCandidateInputModal.value){
        alert("ICE candidate input is missing or empty."); return;
    }
    try {
        const candidateSignal = JSON.parse(remoteIceCandidateInputModal.value.trim());
        peerConnection.signal(candidateSignal);
        console.log("Added remote ICE candidate.");
        remoteIceCandidateInputModal.value = '';
    } catch (err) {
        alert("Invalid ICE candidate format.");
        console.error("Error parsing/adding ICE candidate:", err);
    }
}


// --- cleanupPeerConnection (Refactored for new UI) ---
function cleanupPeerConnection() {
    if (peerConnection) {
        peerConnection.destroy();
        peerConnection = null;
    }
    if (chatViewArea) chatViewArea.style.display = 'none';
    if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');

    if (initialSetupView && !initialSetupView.classList.contains('active-overlay') && noChatView) {
        noChatView.style.display = 'flex';
    } else if (noChatView) {
        noChatView.style.display = 'none';
    }

    if (currentChatDmItem) currentChatDmItem.style.display = 'none';
    if (dmListCurrentChatName) dmListCurrentChatName.textContent = 'Peer Name';
    if (chatHeaderPartnerName) chatHeaderPartnerName.textContent = 'Chat with Peer';

    if (messageInputBox) messageInputBox.disabled = true;
    if (sendMessageButtonBox) sendMessageButtonBox.disabled = true;
    if (exportChatButtonHeader) exportChatButtonHeader.style.display = 'none';
    if (disconnectChatButtonHeader) disconnectChatButtonHeader.style.display = 'none';

    chatPartnerID = null;
    // Modal fields
    if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
    if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
    if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';
    if (remoteIceCandidateInputModal) remoteIceCandidateInputModal.value = '';
    if (peerIdInputModal) peerIdInputModal.value = '';
    if (incomingOfferSdpInputModal) incomingOfferSdpInputModal.value = '';
    if (incomingOfferPeerIdModal) incomingOfferPeerIdModal.value = '';

    if (initiateChatDivModal) initiateChatDivModal.style.display = 'block';
    if (receiveOfferDivModal) receiveOfferDivModal.style.display = 'block';
    if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
    if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
}


// --- initializePeerEvents (Refactored for new UI) ---
function initializePeerEvents(currentPeer) {
    currentPeer.on('signal', data => {
        console.log('SIGNAL:', JSON.stringify(data));
        if (data.type === 'offer' || data.type === 'answer') {
            if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = JSON.stringify(data);
            if (data.type === 'offer') {
                alert("Offer SDP generated. Copy from 'Your Outgoing Signal' textarea and send to your peer.");
                if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'block';
            } else {
                alert("Answer SDP generated. Copy from 'Your Outgoing Signal' textarea and send back to the initiator.");
            }
        } else if (data.candidate) {
            if (localIceCandidatesOutputModal) {
                 localIceCandidatesOutputModal.value += JSON.stringify(data.candidate) + '\n\n';
            }
        }
    });

    currentPeer.on('connect', () => {
        console.log('CONNECT: Connection established!');
        alert(`Connected to ${chatPartnerID || 'peer'}! You can now close the P2P setup window if it's still open, or it will close automatically.`);

        if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');
        if (noChatView) noChatView.style.display = 'none';
        if (chatViewArea) chatViewArea.style.display = 'flex';

        if (chatHeaderPartnerName) chatHeaderPartnerName.textContent = chatPartnerID || 'Peer';
        if (dmListCurrentChatName) dmListCurrentChatName.textContent = chatPartnerID || 'Peer Name';
        if (currentChatDmItem) currentChatDmItem.style.display = 'flex';

        if (messagesArea) messagesArea.innerHTML = '';
        const history = loadChatHistory(chatPartnerID);
        history.forEach(msg => {
            appendMessage(msg, true);
        });
        if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;

        if (messageInputBox) messageInputBox.disabled = false;
        if (sendMessageButtonBox) sendMessageButtonBox.disabled = false;
        if (exportChatButtonHeader) exportChatButtonHeader.style.display = 'inline-block';
        if (disconnectChatButtonHeader) disconnectChatButtonHeader.style.display = 'inline-block';
    });

    currentPeer.on('data', receivedData => {
        const messageText = receivedData.toString();
        const messageObject = {
            text: messageText,
            timestamp: new Date().toISOString(),
            sender: chatPartnerID,
            senderName: chatPartnerID // For now, until we exchange display names
        };
        saveMessageToHistory(chatPartnerID, messageObject);
        appendMessage(messageObject);
    });

    currentPeer.on('close', () => {
        console.log('CLOSE: Connection closed.');
        alert(`Connection with ${chatPartnerID || 'peer'} closed.`);
        cleanupPeerConnection();
    });
    currentPeer.on('error', err => {
        console.error('ERROR in peer connection:', err);
        alert(`Connection error: ${err.message || JSON.stringify(err)}`);
        if (err.code === 'ERR_CONNECTION_FAILURE' || err.code === 'ERR_ICE_CONNECTION_FAILURE' ||
            err.code === 'ERR_DTLS_ERROR' || err.code === 'ERR_WEBRTC_SUPPORT') {
            cleanupPeerConnection();
        }
    });
}

// --- DOMContentLoaded (Refactored for new UI) ---
window.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer.js loaded. DOM fully parsed.');
    cacheDOMElements();

    localUserProfile = loadUserProfile();
    displayLocalUserProfile();

    if (saveProfileButtonSetup) {
        saveProfileButtonSetup.addEventListener('click', () => {
            const name = displayNameInputSetup.value.trim();
            if (!name) { alert('Display name cannot be empty.'); return; }
            const newUserId = generateUserId();
            saveUserProfile(name, newUserId);
            localUserProfile = { displayName: name, userId: newUserId };
            displayLocalUserProfile();
        });
    }

    if (initiateNewChatSidebarButton) {
        initiateNewChatSidebarButton.addEventListener('click', () => {
            if (p2pManagementView) p2pManagementView.classList.add('active-overlay');
            if (initiateChatDivModal) initiateChatDivModal.style.display = 'block';
            if (receiveOfferDivModal) receiveOfferDivModal.style.display = 'block';
            if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
            if (peerIdInputModal) peerIdInputModal.value = '';
            if (incomingOfferPeerIdModal) incomingOfferPeerIdModal.value = '';
            if (incomingOfferSdpInputModal) incomingOfferSdpInputModal.value = '';
            if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
            if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
        });
    }
    if (cancelP2PSetupButtonModal) {
        cancelP2PSetupButtonModal.addEventListener('click', () => {
            if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');
            // Don't fully cleanupPeerConnection here, as a connection might be active or user just cancelling setup.
            // Reset modal state only
            if (initiateChatDivModal) initiateChatDivModal.style.display = 'block';
            if (receiveOfferDivModal) receiveOfferDivModal.style.display = 'block';
            if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
        });
    }

    if (connectPeerButtonModal) connectPeerButtonModal.addEventListener('click', initiateChatRequest);
    if (processOfferButtonModal) processOfferButtonModal.addEventListener('click', processIncomingOffer);
    if (submitIncomingAnswerButtonModal) submitIncomingAnswerButtonModal.addEventListener('click', submitPeerAnswer);
    if (addRemoteIceCandidateButtonModal) addRemoteIceCandidateButtonModal.addEventListener('click', handleAddRemoteIceCandidate);

    if (disconnectChatButtonHeader) {
        disconnectChatButtonHeader.addEventListener('click', () => {
            if (peerConnection) peerConnection.destroy(); else cleanupPeerConnection();
        });
    }

    if (sendMessageButtonBox && messageInputBox) {
        const sendMessage = () => {
            const messageText = messageInputBox.value.trim();
            if (messageText && peerConnection && peerConnection.connected) {
                if (!localUserProfile) { alert("Profile not set!"); return; }
                const messageObject = {
                    text: messageText,
                    timestamp: new Date().toISOString(),
                    sender: localUserProfile.userId,
                    senderName: localUserProfile.displayName
                };
                saveMessageToHistory(chatPartnerID, messageObject);
                peerConnection.send(messageText);
                appendMessage(messageObject);
                messageInputBox.value = '';
            }
        };
        sendMessageButtonBox.addEventListener('click', sendMessage);
        messageInputBox.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, allow Shift+Enter for newline
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (exportChatButtonHeader) exportChatButtonHeader.addEventListener('click', handleExportChat);

    // Initial UI state based on profile
    if (!localUserProfile || !localUserProfile.userId) {
        if (initialSetupView) initialSetupView.classList.add('active-overlay');
        if (noChatView) noChatView.style.display = 'none';
        if (chatViewArea) chatViewArea.style.display = 'none';
    } else {
        if (initialSetupView) initialSetupView.classList.remove('active-overlay');
        if (noChatView) noChatView.style.display = 'flex';
        if (chatViewArea) chatViewArea.style.display = 'none';
    }
    // Call cleanup to ensure P2P elements are in their default states,
    // but not affecting the initialSetupView or noChatView which are handled above.
    // cleanupPeerConnection(); // This might hide noChatView if called unconditionally.
    // Selective reset for P2P modal elements if needed, or rely on open modal to reset.
    if (messageInputBox) messageInputBox.disabled = true; // Ensure disabled initially
    if (sendMessageButtonBox) sendMessageButtonBox.disabled = true;
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
        chatBetween: [localUserProfile.userId, chatPartnerID].sort(),
        participants: [
            {userId: localUserProfile.userId, displayName: localUserProfile.displayName},
            // We don't have peer's display name reliably yet, so use ID
            {userId: chatPartnerID, displayName: chatPartnerID}
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
    const dateSuffix = new Date().toISOString().split('T')[0];
    a.download = `p2p_chat_with_${safePeerId}_on_${dateSuffix}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Chat history with ${chatPartnerID} prepared for download.`);
}
