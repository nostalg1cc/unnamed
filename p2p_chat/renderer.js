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
const FONT_SIZE_CLASSES = ['font-scale-normal', 'font-scale-large', 'font-scale-larger'];
const FONT_SIZE_LABELS = ['Normal', 'Large', 'Larger'];
const FONT_SIZE_STORAGE_KEY = 'p2pChatFontSizePreference';

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

// P2P Management Modal Elements
let p2pManagementView, cancelP2PSetupButtonModal;
let chatInitiationSectionModal, peerIdInputModal, initialMessageInputModal, sendInitialMessageButtonModal;
let pasteRequestSectionModal, incomingChatPackageInputModal, processIncomingPackageButtonModal;
let signalingExchangeAreaModal, outgoingSignalDivModal, outgoingSignalTextareaModal;
let initiatorWaitsForAnswerDivModal, incomingAnswerSdpInputModal, submitIncomingAnswerButtonModal;


let sidebar, initiateNewChatSidebarButton, currentChatDmItem, dmListCurrentChatName;
let localUserDisplayNameSidebar, localUserIdSidebar, localUserAvatarSidebar, copyUserIdButton, fontSizeToggleButton; // Added fontSizeToggleButton

let mainContent, chatViewArea, noChatView, appContainer; // Added appContainer
let chatHeaderPartnerName, exportChatButtonHeader, disconnectChatButtonHeader;
let messagesArea, messageInputBox, sendMessageButtonBox;
// Specific elements for ICE candidates if they are part of the modal.
let localIceCandidatesOutputModal, remoteIceCandidateInputModal, addRemoteIceCandidateButtonModal;


function cacheDOMElements() {
    appContainer = document.querySelector('.app-container'); // Cache app container
    initialSetupView = document.getElementById('initial-setup-view');
    displayNameInputSetup = document.getElementById('display-name-input');
    saveProfileButtonSetup = document.getElementById('save-profile-button');

    // P2P Management Modal Elements
    p2pManagementView = document.getElementById('p2p-management-view');
    cancelP2PSetupButtonModal = document.getElementById('cancel-p2p-setup-button');

    chatInitiationSectionModal = document.getElementById('chat-initiation-section');
    peerIdInputModal = document.getElementById('peer-id-input-modal');
    initialMessageInputModal = document.getElementById('initial-message-input-modal');
    sendInitialMessageButtonModal = document.getElementById('send-initial-message-button-modal');

    pasteRequestSectionModal = document.getElementById('paste-request-section');
    incomingChatPackageInputModal = document.getElementById('incoming-chat-package-input-modal');
    processIncomingPackageButtonModal = document.getElementById('process-incoming-package-button-modal');

    signalingExchangeAreaModal = document.getElementById('signaling-exchange-area-modal');
    outgoingSignalDivModal = document.getElementById('outgoing-signal-div-modal');
    outgoingSignalTextareaModal = document.getElementById('outgoing-signal-textarea-modal');
    initiatorWaitsForAnswerDivModal = document.getElementById('initiator-waits-for-answer-div-modal');
    incomingAnswerSdpInputModal = document.getElementById('incoming-answer-sdp-input-modal');
    submitIncomingAnswerButtonModal = document.getElementById('submit-incoming-answer-button-modal');

    // ICE Candidate related elements - these IDs are from the old HTML, ensure they are updated if used
    // If these IDs exist in the new HTML structure for the modal:
    localIceCandidatesOutputModal = document.getElementById('local-ice-candidates-output'); // Ensure this ID exists in modal HTML
    remoteIceCandidateInputModal = document.getElementById('remote-ice-candidate-input');   // Ensure this ID exists
    addRemoteIceCandidateButtonModal = document.getElementById('add-remote-ice-candidate-button'); // Ensure this ID exists


    sidebar = document.querySelector('.sidebar');
    initiateNewChatSidebarButton = document.getElementById('initiate-new-chat-sidebar-button');
    currentChatDmItem = document.getElementById('current-chat-dm-item');
    dmListCurrentChatName = document.getElementById('dm-list-current-chat-name');
    localUserDisplayNameSidebar = document.getElementById('local-user-display-name-sidebar');
    localUserIdSidebar = document.getElementById('local-user-id-sidebar'); // This is the SPAN for the ID value
    localUserAvatarSidebar = document.getElementById('local-user-avatar-sidebar');
    copyUserIdButton = document.getElementById('copy-user-id-button');
    fontSizeToggleButton = document.getElementById('font-size-toggle-button');


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

// Helper function to generate a random vibrant color based on a seed string
function getRandomBgColorForAvatar(seedText = "") {
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    const h = Math.abs(hash % 360); // Hue (0-359)
    const s = 60 + Math.abs(hash % 20); // Saturation (60-80%)
    const l = 40 + Math.abs(hash % 10); // Lightness (40-50%)
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function displayLocalUserProfile() {
    const profileData = localUserProfile;

    if (localUserDisplayNameSidebar) {
        localUserDisplayNameSidebar.textContent = profileData && profileData.displayName ? profileData.displayName : 'Display Name';
    }

    if (localUserAvatarSidebar) {
        if (profileData && profileData.displayName) {
            localUserAvatarSidebar.textContent = profileData.displayName.substring(0,1).toUpperCase();
            const bgColor = getRandomBgColorForAvatar(profileData.displayName);
            localUserAvatarSidebar.style.backgroundColor = bgColor;
            // Text color is set by CSS to be light, should contrast well with these darker random bg colors.
        } else {
            localUserAvatarSidebar.textContent = '?';
            localUserAvatarSidebar.style.backgroundColor = 'var(--interactive-bg)';
        }
    }

    if (localUserIdSidebar) { // The span inside the div
        localUserIdSidebar.textContent = profileData && profileData.userId ? profileData.userId : 'Not Set';
    }

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


// --- P2P Functions ---
function sendInitialChatRequest() { // Formerly initiateChatRequest
    if (!SimplePeer) { alert("SimplePeer is not available."); return; }
    if (peerConnection) {
        alert("Already in a session or attempting to connect. Please close the current P2P setup or disconnect first.");
        if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');
        return;
    }
    if (!localUserProfile || !localUserProfile.userId) {
        alert("Your profile is not set up. Please save your profile first.");
        if (initialSetupView) initialSetupView.classList.add('active-overlay');
        return;
    }

    const targetPeerIdText = peerIdInputModal.value.trim();
    if (!targetPeerIdText) { alert("Please enter the Peer's User ID."); return; }

    chatPartnerID = targetPeerIdText; // Tentatively set
    const initialMessageText = initialMessageInputModal.value.trim();

    peerConnection = new SimplePeer({ initiator: true, trickle: false });
    initializePeerEvents(peerConnection, initialMessageText); // Pass initial message to handler

    // UI updates for modal: Hide initial input sections, show signaling area
    if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'none';
    if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'none';
    if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'block';
    if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'block'; // Ensure this is visible
    if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'block';

    if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = ''; // Will be populated by 'signal' event
    if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
    if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = ''; // If using trickle:true later
    console.log("Attempting to create chat request. Waiting for offer SDP...");
}

function handleIncomingChatPackage() { // Formerly processIncomingOffer
    if (!SimplePeer) { alert("SimplePeer is not available."); return; }
    if (peerConnection) {
        alert("Already in a session or attempting to connect. Please close the current P2P setup or disconnect first.");
        if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');
        return;
    }
     if (!localUserProfile || !localUserProfile.userId) {
        alert("Your profile is not set up. Please save your profile first.");
        if (initialSetupView) initialSetupView.classList.add('active-overlay');
        return;
    }

    const chatPackageString = incomingChatPackageInputModal.value.trim();
    if (!chatPackageString) {
        alert("Please paste the Chat Request Data from your peer.");
        return;
    }

    try {
        const receivedPackage = JSON.parse(chatPackageString);
        if (!receivedPackage.offerSdp || !receivedPackage.senderId || !receivedPackage.senderDisplayName) {
            alert("Invalid Chat Request Data format. Missing required fields.");
            return;
        }

        chatPartnerID = receivedPackage.senderId; // Set chatPartnerID from the package
        const peerDisplayName = receivedPackage.senderDisplayName;
        const initialMessageFromPeer = receivedPackage.initialMessage;

        peerConnection = new SimplePeer({ initiator: false, trickle: false });
        initializePeerEvents(peerConnection); // No initial message to send from this side
        peerConnection.signal(receivedPackage.offerSdp); // Process the extracted offer

        // UI updates for modal
        if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'none';
        if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'none';
        if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'block';
        if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'block'; // For our answer
        if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none'; // We are not waiting for an answer here

        if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = ''; // Will be populated by 'signal' event with our answer
        if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';

        console.log(`Processing chat request from ${peerDisplayName} (ID: ${chatPartnerID}). Waiting for answer SDP to be generated...`);

        // If there was an initial message from the peer, display and save it
        if (initialMessageFromPeer) {
            const messageObject = {
                text: initialMessageFromPeer,
                timestamp: new Date().toISOString(), // Or use a timestamp from package if provided
                sender: chatPartnerID,
                senderName: peerDisplayName
            };
            // Displaying it now might be premature if connection isn't up.
            // Let's store it and display it upon 'connect' event.
            // Or, we can display it optimistically. For now, let's wait for 'connect'.
            // This initial message will be the first one loaded from history effectively if saved now.
            saveMessageToHistory(chatPartnerID, messageObject);
            // To display immediately (optional, might look odd if connection fails):
            // appendMessage(messageObject);
        }

    } catch (err) {
        alert("Invalid Chat Request Data. Ensure it's a valid JSON package.");
        console.error("Error parsing chat request package:", err);
    }
}

function submitPeerAnswer() { // For initiator to submit the answer SDP received from peer
    if (!peerConnection || !peerConnection.initiator) {
        alert("Not in initiator connection attempt, or SimplePeer instance missing."); return;
    }

    const answerSdpString = incomingAnswerSdpInputModal.value.trim();
    if (!answerSdpString) {
        alert("Please paste the peer's Answer SDP."); return;
    }

    try {
        const answer = JSON.parse(answerSdpString); // Answer should be just the SDP object
        peerConnection.signal(answer);
        console.log("Submitted peer's answer to local PeerConnection.");
        if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = "";
        // UI: initiatorWaitsForAnswerDivModal can be hidden now, connection will proceed or fail.
        if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
        if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'none'; // Hide the offer too
        alert("Answer submitted. Waiting for connection...");

    } catch (err) {
        alert("Invalid Answer SDP format. It should be a JSON object.");
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
    // Do not hide p2pManagementView here, user might want to start another connection
    // if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');

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

    // Reset P2P modal to its initial state (showing both options)
    // Modal fields
    if (peerIdInputModal) peerIdInputModal.value = '';
    if (initialMessageInputModal) initialMessageInputModal.value = '';
    if (incomingChatPackageInputModal) incomingChatPackageInputModal.value = '';
    if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
    if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
    if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = ''; // If using
    if (remoteIceCandidateInputModal) remoteIceCandidateInputModal.value = '';   // If using

    if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'block';
    if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'block';
    if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
    if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
    if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'block'; // Ensure this is visible for next use
}


// --- initializePeerEvents (Refactored for new UI and packaged data) ---
function initializePeerEvents(currentPeer, initialMessageForOffer = null) {
    currentPeer.on('signal', data => {
        console.log('SIGNAL:', JSON.stringify(data));
        if (data.type === 'offer') {
            // Package offer with initial message and sender info
            const offerPackage = {
                type: 'chat-request-package',
                offerSdp: data,
                initialMessage: initialMessageForOffer || "", // Include the initial message
                senderId: localUserProfile.userId,
                senderDisplayName: localUserProfile.displayName
            };
            if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = JSON.stringify(offerPackage, null, 2);
            alert("Chat Request Data generated. Copy from 'Your Outgoing Data' textarea and send to your peer.");
            // UI for waiting for answer is already handled by sendInitialChatRequest
        } else if (data.type === 'answer') {
            // This is just the answer SDP, no need to package further for sending back.
            if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = JSON.stringify(data, null, 2);
            alert("Answer SDP generated. Copy from 'Your Outgoing Data' textarea and send back to the initiator.");
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

    if (sendInitialMessageButtonModal) sendInitialMessageButtonModal.addEventListener('click', sendInitialChatRequest);
    if (processIncomingPackageButtonModal) processIncomingPackageButtonModal.addEventListener('click', handleIncomingChatPackage);
    if (submitIncomingAnswerButtonModal) submitIncomingAnswerButtonModal.addEventListener('click', submitPeerAnswer);

    // Check if addRemoteIceCandidateButtonModal exists before adding listener
    if (addRemoteIceCandidateButtonModal) {
        addRemoteIceCandidateButtonModal.addEventListener('click', handleAddRemoteIceCandidate);
    } else {
        // This is fine for trickle:false, just a note if we enable trickle:true later
        // console.warn("'add-remote-ice-candidate-button' not found in DOM. ICE candidate functionality might be limited if trickle:true is used later.");
    }

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

    if (copyUserIdButton) {
        copyUserIdButton.addEventListener('click', () => {
            if (localUserProfile && localUserProfile.userId) {
                navigator.clipboard.writeText(localUserProfile.userId)
                    .then(() => {
                        const originalText = copyUserIdButton.textContent;
                        copyUserIdButton.textContent = '✓'; // Checkmark for copied
                        copyUserIdButton.classList.add('copy-id-feedback');
                        setTimeout(() => {
                            copyUserIdButton.textContent = '📋'; // Restore icon
                            copyUserIdButton.classList.remove('copy-id-feedback');
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Failed to copy User ID: ', err);
                        alert('Failed to copy ID. Your browser might not support this feature or permission was denied.');
                    });
            }
        });
    }

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
    if (messageInputBox) messageInputBox.disabled = true; // Ensure disabled initially
    if (sendMessageButtonBox) sendMessageButtonBox.disabled = true;

    // --- Font Size Toggle Setup ---
    const savedFontSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (savedFontSize && FONT_SIZE_CLASSES.includes(savedFontSize)) {
        applyFontSize(savedFontSize);
    } else {
        applyFontSize(FONT_SIZE_CLASSES[0]); // Default to normal
    }

    if (fontSizeToggleButton) {
        fontSizeToggleButton.addEventListener('click', () => {
            let currentSizeClass = FONT_SIZE_CLASSES[0]; // Default
            // Find current applied class from appContainer
            if(appContainer) {
                for (const cls of FONT_SIZE_CLASSES) {
                    if (appContainer.classList.contains(cls)) {
                        currentSizeClass = cls;
                        break;
                    }
                }
            }
            let currentIndex = FONT_SIZE_CLASSES.indexOf(currentSizeClass);
            let nextIndex = (currentIndex + 1) % FONT_SIZE_CLASSES.length;
            applyFontSize(FONT_SIZE_CLASSES[nextIndex]);
        });
    }
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

// --- Accessibility Functions ---
function applyFontSize(sizeClass) {
    if (!appContainer) {
        console.warn("App container not cached, cannot apply font size.");
        return;
    }
    // Remove any existing font size classes
    FONT_SIZE_CLASSES.forEach(cls => appContainer.classList.remove(cls));

    // Add the new one
    if (FONT_SIZE_CLASSES.includes(sizeClass)) {
        appContainer.classList.add(sizeClass);
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, sizeClass);

        // Update button text
        if (fontSizeToggleButton) {
            const classIndex = FONT_SIZE_CLASSES.indexOf(sizeClass);
            fontSizeToggleButton.textContent = `Font Size: ${FONT_SIZE_LABELS[classIndex] || 'Normal'}`;
        }
    } else {
        console.warn("Unknown font size class:", sizeClass, ".Applying default.");
        appContainer.classList.add(FONT_SIZE_CLASSES[0]); // Default to normal
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, FONT_SIZE_CLASSES[0]);
        if (fontSizeToggleButton) {
            fontSizeToggleButton.textContent = `Font Size: ${FONT_SIZE_LABELS[0]}`;
        }
    }
}
