// p2p_chat/renderer.js

// SimplePeer is expected to be loaded globally from a CDN script tag in index.html
let SimplePeer = window.SimplePeer;

if (typeof SimplePeer === 'undefined') {
    console.error("SimplePeer is not loaded! Make sure the CDN script tag is in index.html and loaded correctly before renderer.js.");
    alert("Critical component SimplePeer could not be loaded. P2P functionality will be unavailable. Please check the browser console for errors related to SimplePeer CDN loading.");
} else {
    console.log("SimplePeer assigned from global scope (presumably from CDN).");
    if (SimplePeer.WEBRTC_SUPPORT) {
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
const PEER_DISPLAY_NAME_PREFIX = 'p2pPeerDisplayName_';
const NICKNAME_PREFIX = 'p2pNickname_';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

// --- Nickname Storage ---
function saveNickname(peerId, nickname) {
    if (!peerId) return;
    try {
        if (nickname && nickname.trim() !== "") {
            localStorage.setItem(`${NICKNAME_PREFIX}${peerId}`, nickname.trim());
        } else {
            localStorage.removeItem(`${NICKNAME_PREFIX}${peerId}`);
        }
    } catch (e) { console.error("Error saving nickname:", e); }
}

function loadNickname(peerId) {
    if (!peerId) return null;
    try {
        return localStorage.getItem(`${NICKNAME_PREFIX}${peerId}`);
    } catch (e) { console.error("Error loading nickname:", e); return null; }
}

// --- Peer Display Name Storage ---
function savePeerDisplayName(peerId, displayName) {
    if (!peerId || typeof displayName === 'undefined') return;
    try {
        localStorage.setItem(`${PEER_DISPLAY_NAME_PREFIX}${peerId}`, displayName);
    } catch (e) {
        console.error("Error saving peer display name to localStorage:", e);
    }
}

function loadPeerDisplayName(peerId) {
    if (!peerId) return null;
    try {
        return localStorage.getItem(`${PEER_DISPLAY_NAME_PREFIX}${peerId}`);
    } catch (e) {
        console.error("Error loading peer display name from localStorage:", e);
        return null;
    }
}

// --- Chat History Storage ---
function saveMessageToHistory(peerId, messageObject) {
    if (!peerId) return;
    // Ensure messageObject.type (display type) and dataUrl are not stored in text log
    const { type, dataUrl, ...restOfMessageObject } = messageObject;

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
    history.push(restOfMessageObject);
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
let localStream = null;
let chatPartnerID = null;
let localUserProfile = null;

// --- DOM Elements ---
let initialSetupView, displayNameInputSetup, saveProfileButtonSetup, importProfileFileInput, importProfileButtonLabel;
let p2pManagementView, cancelP2PSetupButtonModal;
let chatInitiationSectionModal, peerIdInputModal, initialMessageInputModal, sendInitialMessageButtonModal;
let pasteRequestSectionModal, incomingChatPackageInputModal, processIncomingPackageButtonModal;
let signalingExchangeAreaModal, outgoingSignalDivModal, outgoingSignalTextareaModal;
let initiatorWaitsForAnswerDivModal, incomingAnswerSdpInputModal, submitIncomingAnswerButtonModal;
let sidebar, initiateNewChatSidebarButton, currentChatDmItem, dmListCurrentChatAvatar, dmListCurrentChatNameTooltip;
let localUserAvatarSidebar, userPanelClickable, userPanelDetailsTooltip, tooltipUsernameLocal, tooltipUseridLocal;
let settingsModalView, closeSettingsModalButton;
let settingsUsernameDisplay, settingsUseridDisplay, settingsCopyUseridButton;
let settingsFontSizeToggleButton;
let settingsExportChatButton, settingsImportChatFileInput, settingsExportProfileButton;
let audioInputSelect, audioOutputSelect;
let mainContent, chatViewArea, noChatView, appContainer;
let chatHeaderPartnerName, exportChatButtonHeader, disconnectChatButtonHeader, startVoiceCallButton, setNicknameButton;
let messagesArea, messageInputBox, sendMessageButtonBox, attachFileButton, mediaFileInput;
let localIceCandidatesOutputModal, remoteIceCandidateInputModal, addRemoteIceCandidateButtonModal;


function cacheDOMElements() {
    appContainer = document.querySelector('.app-container');
    initialSetupView = document.getElementById('initial-setup-view');
    displayNameInputSetup = document.getElementById('display-name-input');
    saveProfileButtonSetup = document.getElementById('save-profile-button');
    importProfileFileInput = document.getElementById('import-profile-file-input');
    importProfileButtonLabel = document.querySelector('label[for="import-profile-file-input"]');

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
    localIceCandidatesOutputModal = document.getElementById('local-ice-candidates-output');
    remoteIceCandidateInputModal = document.getElementById('remote-ice-candidate-input');
    addRemoteIceCandidateButtonModal = document.getElementById('add-remote-ice-candidate-button');

    sidebar = document.querySelector('.sidebar');
    initiateNewChatSidebarButton = document.getElementById('initiate-new-chat-sidebar-button');
    currentChatDmItem = document.getElementById('current-chat-dm-item');
    dmListCurrentChatAvatar = document.getElementById('dm-list-current-chat-avatar');
    dmListCurrentChatNameTooltip = document.getElementById('dm-list-current-chat-name-tooltip');
    userPanelClickable = document.getElementById('user-panel-clickable');
    localUserAvatarSidebar = document.getElementById('local-user-avatar-sidebar');
    userPanelDetailsTooltip = document.getElementById('user-panel-details-tooltip');
    tooltipUsernameLocal = document.getElementById('tooltip-username-local');
    tooltipUseridLocal = document.getElementById('tooltip-userid-local');

    settingsModalView = document.getElementById('settings-modal-view');
    closeSettingsModalButton = document.getElementById('close-settings-modal-button');
    settingsUsernameDisplay = document.getElementById('settings-username-display');
    settingsUseridDisplay = document.getElementById('settings-userid-display');
    settingsCopyUseridButton = document.getElementById('settings-copy-userid-button');
    settingsFontSizeToggleButton = document.getElementById('settings-font-size-toggle-button');
    settingsExportChatButton = document.getElementById('settings-export-chat-button');
    settingsImportChatFileInput = document.getElementById('settings-import-chat-file-input');
    settingsExportProfileButton = document.getElementById('settings-export-profile-button');
    audioInputSelect = document.getElementById('audio-input-select');
    audioOutputSelect = document.getElementById('audio-output-select');

    mainContent = document.querySelector('.main-content');
    chatViewArea = document.getElementById('chat-view-area');
    noChatView = document.getElementById('no-chat-view');
    chatHeaderPartnerName = document.getElementById('chat-partner-name-header');
    exportChatButtonHeader = document.getElementById('export-chat-button');
    disconnectChatButtonHeader = document.getElementById('disconnect-chat-button');
    startVoiceCallButton = document.getElementById('start-voice-call-button');
    setNicknameButton = document.getElementById('set-nickname-button');
    messagesArea = document.getElementById('messages-area');
    messageInputBox = document.getElementById('message-input');
    sendMessageButtonBox = document.getElementById('send-message-button');
    attachFileButton = document.getElementById('attach-file-button');
    mediaFileInput = document.getElementById('media-file-input');
}

// --- UI Update Functions ---
function getAvatarColors(seedText = "") {
    let hash = 0;
    if (seedText) {
        for (let i = 0; i < seedText.length; i++) {
            hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash;
        }
    } else {
        hash = 12345;
    }
    const h = Math.abs(hash % 360);
    const s = 50 + Math.abs(hash % 25);
    const l_bg = 40 + Math.abs(hash % 15);
    const l_fg_tint = Math.min(95, l_bg + 45);
    return {
        background: `hsl(${h}, ${s}%, ${l_bg}%)`,
        foreground: `hsl(${h}, ${s}%, ${l_fg_tint}%)`
    };
}

function getPeerPreferredName(peerId) {
    if (!peerId) return 'Peer';
    const nickname = loadNickname(peerId);
    if (nickname) return nickname;
    const sharedUsername = loadPeerDisplayName(peerId);
    if (sharedUsername) return sharedUsername;
    return peerId;
}

function displayLocalUserProfile() {
    const profileData = localUserProfile;
    if (localUserAvatarSidebar) {
        if (profileData && profileData.displayName) {
            localUserAvatarSidebar.textContent = profileData.displayName.substring(0,1).toUpperCase();
            const colors = getAvatarColors(profileData.displayName);
            localUserAvatarSidebar.style.backgroundColor = colors.background;
            localUserAvatarSidebar.style.color = colors.foreground;
        } else {
            localUserAvatarSidebar.textContent = '?';
            localUserAvatarSidebar.style.backgroundColor = 'var(--interactive-bg)';
            localUserAvatarSidebar.style.color = 'rgba(255, 255, 255, 0.8)';
        }
    }
    if (tooltipUsernameLocal) {
        tooltipUsernameLocal.textContent = profileData && profileData.displayName ? profileData.displayName : 'Username';
    }
    if (tooltipUseridLocal) {
        tooltipUseridLocal.textContent = profileData && profileData.userId ? profileData.userId : 'Not Set';
    }
    if (settingsUsernameDisplay) {
        settingsUsernameDisplay.textContent = profileData && profileData.displayName ? profileData.displayName : 'N/A';
    }
    if (settingsUseridDisplay) {
        settingsUseridDisplay.textContent = profileData && profileData.userId ? profileData.userId : 'N/A';
    }

    if (profileData && profileData.displayName && profileData.userId) {
        if (initialSetupView) initialSetupView.classList.remove('active-overlay');
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

function updatePeerNameInUI(peerIdToUpdate) {
    if (!peerIdToUpdate) return;
    const nameToShow = getPeerPreferredName(peerIdToUpdate);
    if (peerIdToUpdate === chatPartnerID) {
        if (chatHeaderPartnerName) chatHeaderPartnerName.textContent = nameToShow;
        if (dmListCurrentChatNameTooltip) dmListCurrentChatNameTooltip.textContent = nameToShow;
        if (dmListCurrentChatAvatar) {
            dmListCurrentChatAvatar.textContent = nameToShow.substring(0,1).toUpperCase();
            const peerColors = getAvatarColors(nameToShow);
            dmListCurrentChatAvatar.style.backgroundColor = peerColors.background;
            dmListCurrentChatAvatar.style.color = peerColors.foreground;
        }
    }
}

function appendMessage(messageObject, isHistory = false) {
    if (!messagesArea || !localUserProfile) return;
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper');
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content-wrapper');
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    try {
        timestampSpan.textContent = new Date(messageObject.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        timestampSpan.textContent = 'Invalid date';
    }
    const textDiv = document.createElement('div');
    textDiv.classList.add('message-text');
    textDiv.textContent = messageObject.text;

    const messageType = (messageObject.sender === localUserProfile.userId) ? 'self' : 'peer';
    messageWrapper.classList.add(messageType);
    const displayNameForMessage = messageType === 'self'
        ? (localUserProfile.displayName)
        : getPeerPreferredName(messageObject.sender);
    senderSpan.textContent = displayNameForMessage;

    messageHeader.appendChild(senderSpan);
    messageHeader.appendChild(timestampSpan);
    messageContent.appendChild(messageHeader);
    messageContent.appendChild(textDiv);
    messageWrapper.appendChild(messageContent);
    messagesArea.appendChild(messageWrapper);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function appendMediaMessage(messageObject) {
    if (!messagesArea || !localUserProfile) return;

    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-wrapper');
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content-wrapper');
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    try {
        timestampSpan.textContent = new Date(messageObject.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) { timestampSpan.textContent = 'Invalid date'; }

    let mediaElement;
    if (messageObject.type === 'media-image' && messageObject.dataUrl) {
        mediaElement = document.createElement('img');
        mediaElement.src = messageObject.dataUrl;
        mediaElement.alt = messageObject.filename || 'Received image';
        mediaElement.style.maxWidth = '300px';
        mediaElement.style.maxHeight = '300px';
        mediaElement.style.borderRadius = 'var(--border-radius-m)';
        mediaElement.style.marginTop = '5px';
        mediaElement.style.cursor = 'pointer';
        mediaElement.onclick = () => window.open(messageObject.dataUrl, '_blank'); // Open full image
    } else if (messageObject.type === 'media-video' && messageObject.dataUrl) {
        mediaElement = document.createElement('video');
        mediaElement.src = messageObject.dataUrl;
        mediaElement.controls = true;
        mediaElement.alt = messageObject.filename || 'Received video';
        mediaElement.style.maxWidth = '300px';
        mediaElement.style.maxHeight = '300px';
        mediaElement.style.borderRadius = 'var(--border-radius-m)';
        mediaElement.style.marginTop = '5px';
    } else {
        mediaElement = document.createElement('div');
        mediaElement.classList.add('message-text');
        mediaElement.textContent = `[Unsupported media: ${messageObject.filename || 'unknown file'}]`;
    }

    const messageTypeForDisplay = (messageObject.sender === localUserProfile.userId) ? 'self' : 'peer';
    messageWrapper.classList.add(messageTypeForDisplay);
    if (messageTypeForDisplay === 'self') {
        messageContent.style.backgroundColor = 'transparent';
    }
    senderSpan.textContent = messageTypeForDisplay === 'self'
        ? (localUserProfile.displayName)
        : getPeerPreferredName(messageObject.sender);

    messageHeader.appendChild(senderSpan);
    messageHeader.appendChild(timestampSpan);
    messageContent.appendChild(messageHeader);
    messageContent.appendChild(mediaElement);
    messageWrapper.appendChild(messageContent);
    messagesArea.appendChild(messageWrapper);
    messagesArea.scrollTop = messagesArea.scrollHeight;

    // Save a placeholder to text history, not the dataUrl
    const historyPlaceholder = {
        text: `[Media: ${messageObject.type === 'media-image' ? 'Image' : 'Video'} - ${messageObject.filename || 'shared file'}]`,
        timestamp: messageObject.timestamp,
        sender: messageObject.sender,
        senderName: messageObject.senderName // This should be the actual shared name or ID
    };
    saveMessageToHistory(chatPartnerID, historyPlaceholder);
}


// --- P2P Functions ---
function sendInitialChatRequest() {
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

    chatPartnerID = targetPeerIdText;
    const initialMessageText = initialMessageInputModal.value.trim();
    peerConnection = new SimplePeer({ initiator: true, trickle: false });
    initializePeerEvents(peerConnection, initialMessageText);

    if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'none';
    if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'none';
    if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'block';
    if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'block';
    if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'block';
    if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
    if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
    if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';
    console.log("Attempting to create chat request. Waiting for offer SDP...");
}

function handleIncomingChatPackage() {
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
        chatPartnerID = receivedPackage.senderId;
        const peerDisplayName = receivedPackage.senderDisplayName;
        const initialMessageFromPeer = receivedPackage.initialMessage;
        savePeerDisplayName(chatPartnerID, peerDisplayName);
        peerConnection = new SimplePeer({ initiator: false, trickle: false });
        initializePeerEvents(peerConnection);
        peerConnection.signal(receivedPackage.offerSdp);
        if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'none';
        if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'none';
        if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'block';
        if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'block';
        if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
        if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
        if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';
        console.log(`Processing chat request from ${peerDisplayName} (ID: ${chatPartnerID}). Waiting for answer SDP to be generated...`);
        if (initialMessageFromPeer) {
            const messageObject = {
                text: initialMessageFromPeer,
                timestamp: new Date().toISOString(),
                sender: chatPartnerID,
                senderName: peerDisplayName
            };
            saveMessageToHistory(chatPartnerID, messageObject);
        }
    } catch (err) {
        alert("Invalid Chat Request Data. Ensure it's a valid JSON package.");
        console.error("Error parsing chat request package:", err);
    }
}

function submitPeerAnswer() {
    if (!peerConnection || !peerConnection.initiator) {
        alert("Not in initiator connection attempt, or SimplePeer instance missing."); return;
    }
    const answerSdpString = incomingAnswerSdpInputModal.value.trim();
    if (!answerSdpString) {
        alert("Please paste the peer's Answer SDP."); return;
    }
    try {
        const answer = JSON.parse(answerSdpString);
        peerConnection.signal(answer);
        console.log("Submitted peer's answer to local PeerConnection.");
        if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = "";
        if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
        if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'none';
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

function cleanupPeerConnection() {
    if (peerConnection) {
        peerConnection.destroy();
        peerConnection = null;
    }
    if (chatViewArea) chatViewArea.style.display = 'none';
    if (initialSetupView && !initialSetupView.classList.contains('active-overlay') && noChatView) {
        noChatView.style.display = 'flex';
    } else if (noChatView) {
        noChatView.style.display = 'none';
    }
    if (currentChatDmItem) currentChatDmItem.style.display = 'none';
    if (dmListCurrentChatNameTooltip) dmListCurrentChatNameTooltip.textContent = 'Peer Name';
    if (chatHeaderPartnerName) chatHeaderPartnerName.textContent = 'Chat with Peer';
    if (setNicknameButton) setNicknameButton.style.display = 'none';
    if (messageInputBox) messageInputBox.disabled = true;
    if (sendMessageButtonBox) sendMessageButtonBox.disabled = true;
    if (exportChatButtonHeader) exportChatButtonHeader.style.display = 'none';
    if (disconnectChatButtonHeader) disconnectChatButtonHeader.style.display = 'none';
    if (startVoiceCallButton) startVoiceCallButton.style.display = 'none';
    if (attachFileButton) attachFileButton.style.display = 'none'; // Hide attach on disconnect
    chatPartnerID = null;
    if (peerIdInputModal) peerIdInputModal.value = '';
    if (initialMessageInputModal) initialMessageInputModal.value = '';
    if (incomingChatPackageInputModal) incomingChatPackageInputModal.value = '';
    if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
    if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
    if (localIceCandidatesOutputModal) localIceCandidatesOutputModal.value = '';
    if (remoteIceCandidateInputModal) remoteIceCandidateInputModal.value = '';
    if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'block';
    if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'block';
    if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
    if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
    if (outgoingSignalDivModal) outgoingSignalDivModal.style.display = 'block';
}

function initializePeerEvents(currentPeer, initialMessageForOffer = null) {
    currentPeer.on('signal', data => {
        console.log('SIGNAL:', JSON.stringify(data));
        if (data.type === 'offer') {
            const offerPackage = {
                type: 'chat-request-package',
                offerSdp: data,
                initialMessage: initialMessageForOffer || "",
                senderId: localUserProfile.userId,
                senderDisplayName: localUserProfile.displayName
            };
            if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = JSON.stringify(offerPackage, null, 2);
            alert("Chat Request Data generated. Copy from 'Your Outgoing Data' textarea and send to your peer.");
        } else if (data.type === 'answer') {
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
        alert(`Connected to ${getPeerPreferredName(chatPartnerID)}! You can now close the P2P setup window or it will close automatically.`);
        if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');
        if (noChatView) noChatView.style.display = 'none';
        if (chatViewArea) chatViewArea.style.display = 'flex';
        updatePeerNameInUI(chatPartnerID);
        if (currentChatDmItem) currentChatDmItem.style.display = 'flex';
        if (setNicknameButton) setNicknameButton.style.display = 'inline-block';
        if (attachFileButton) attachFileButton.style.display = 'inline-block'; // Show attach button

        if (currentPeer && localUserProfile) {
            const profileUpdateMessage = {
                type: 'user-profile-update',
                userId: localUserProfile.userId,
                displayName: localUserProfile.displayName
            };
            currentPeer.send(JSON.stringify(profileUpdateMessage));
            console.log("Sent profile update to peer:", profileUpdateMessage);
        }
        if (initialMessageForOffer && currentPeer.initiator) {
            const initialMsgObject = {
                text: initialMessageForOffer,
                timestamp: new Date().toISOString(),
                sender: localUserProfile.userId,
                senderName: localUserProfile.displayName
            };
            saveMessageToHistory(chatPartnerID, initialMsgObject);
        }
        if (messagesArea) messagesArea.innerHTML = '';
        const history = loadChatHistory(chatPartnerID);
        history.forEach(msg => {
            if (msg.sender !== localUserProfile.userId && !msg.senderName) {
                msg.senderName = loadPeerDisplayName(msg.sender) || msg.sender;
            } else if (msg.sender === localUserProfile.userId && !msg.senderName) {
                msg.senderName = localUserProfile.displayName;
            }
            // Check if it's a media placeholder to render appropriately, or text
            if (msg.text && msg.text.startsWith("[Media: Image")) { // Simple check for image placeholder
                 appendMediaMessage({ // Reconstruct a minimal media object for display
                    type: 'media-image', // Assume image from placeholder
                    filename: msg.text.substring(msg.text.indexOf('- ') + 2, msg.text.lastIndexOf(']')),
                    // dataUrl is not available for history items, show placeholder or broken image
                    dataUrl: null, // Or a placeholder image URL
                    sender: msg.sender,
                    timestamp: msg.timestamp,
                    senderName: msg.senderName
                }, true);
            } else {
                 appendMessage(msg, true);
            }
        });
        if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
        if (messageInputBox) messageInputBox.disabled = false;
        if (sendMessageButtonBox) sendMessageButtonBox.disabled = false;
        if (exportChatButtonHeader) exportChatButtonHeader.style.display = 'inline-block';
        if (disconnectChatButtonHeader) disconnectChatButtonHeader.style.display = 'inline-block';
        if (startVoiceCallButton) startVoiceCallButton.style.display = 'inline-block';
    });

    currentPeer.on('data', receivedData => {
        let messageText = receivedData.toString();
        let messageObject;
        let isMedia = false;
        try {
            const parsedData = JSON.parse(messageText);
            if (parsedData.type === 'user-profile-update' && parsedData.userId && parsedData.displayName) {
                console.log("Received profile update from peer:", parsedData);
                if (parsedData.userId === chatPartnerID) {
                    savePeerDisplayName(parsedData.userId, parsedData.displayName);
                    updatePeerNameInUI(parsedData.userId);
                }
                return;
            } else if (parsedData.type === 'media-image' && parsedData.dataUrl) {
                console.log("Received image data from peer:", parsedData.filename);
                appendMediaMessage(parsedData);
                isMedia = true;
                // Placeholder is saved by appendMediaMessage
                return; // Media message handled
            } else if (parsedData.type === 'media-video' && parsedData.dataUrl) {
                console.log("Received video data from peer:", parsedData.filename);
                appendMediaMessage(parsedData);
                isMedia = true;
                return; // Media message handled
            }
            // Fallback for other JSON to treat as text, or extract text if possible
            messageObject = {
                text: parsedData.text || messageText,
                timestamp: parsedData.timestamp || new Date().toISOString(),
                sender: parsedData.sender || chatPartnerID,
                senderName: loadPeerDisplayName(parsedData.sender || chatPartnerID) || parsedData.sender || chatPartnerID
            };
        } catch (e) {
            // Not JSON, treat as plain text chat message
            messageObject = {
                text: messageText,
                timestamp: new Date().toISOString(),
                sender: chatPartnerID,
                senderName: loadPeerDisplayName(chatPartnerID) || chatPartnerID
            };
        }

        if (!isMedia) { // Only save and append if not already handled by appendMediaMessage
            saveMessageToHistory(chatPartnerID, messageObject);
            appendMessage(messageObject);
        }
    });

    currentPeer.on('close', () => {
        console.log('CLOSE: Connection closed.');
        alert(`Connection with ${getPeerPreferredName(chatPartnerID)} closed.`);
        cleanupPeerConnection();
    });
    currentPeer.on('error', err => {
        console.error('ERROR in peer connection:', err);
        alert(`Connection error with ${getPeerPreferredName(chatPartnerID)}: ${err.message || JSON.stringify(err)}`);
        if (err.code === 'ERR_CONNECTION_FAILURE' || err.code === 'ERR_ICE_CONNECTION_FAILURE' ||
            err.code === 'ERR_DTLS_ERROR' || err.code === 'ERR_WEBRTC_SUPPORT') {
            cleanupPeerConnection();
        }
    });
}

// --- DOMContentLoaded ---
window.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer.js loaded. DOM fully parsed.');
    cacheDOMElements();
    localUserProfile = loadUserProfile();
    displayLocalUserProfile();

    if (saveProfileButtonSetup) {
        saveProfileButtonSetup.addEventListener('click', () => {
            const name = displayNameInputSetup.value.trim();
            if (!name) { alert('Username cannot be empty.'); return; }
            const newUserId = generateUserId();
            saveUserProfile(name, newUserId);
            localUserProfile = { displayName: name, userId: newUserId };
            displayLocalUserProfile();
        });
    }

    if (initiateNewChatSidebarButton) {
        initiateNewChatSidebarButton.addEventListener('click', () => {
            if (p2pManagementView) p2pManagementView.classList.add('active-overlay');
            if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'block';
            if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'block';
            if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
            if (peerIdInputModal) peerIdInputModal.value = '';
            if (initialMessageInputModal) initialMessageInputModal.value = ''; // Clear initial message field
            if (incomingChatPackageInputModal) incomingChatPackageInputModal.value = ''; // Clear incoming package field
            if (outgoingSignalTextareaModal) outgoingSignalTextareaModal.value = '';
            if (incomingAnswerSdpInputModal) incomingAnswerSdpInputModal.value = '';
        });
    }
    if (cancelP2PSetupButtonModal) {
        cancelP2PSetupButtonModal.addEventListener('click', () => {
            if (p2pManagementView) p2pManagementView.classList.remove('active-overlay');
            if (peerConnection && !peerConnection.connected) {
                cleanupPeerConnection();
            }
            if (chatInitiationSectionModal) chatInitiationSectionModal.style.display = 'block';
            if (pasteRequestSectionModal) pasteRequestSectionModal.style.display = 'block';
            if (signalingExchangeAreaModal) signalingExchangeAreaModal.style.display = 'none';
            if (initiatorWaitsForAnswerDivModal) initiatorWaitsForAnswerDivModal.style.display = 'none';
        });
    }

    if (sendInitialMessageButtonModal) sendInitialMessageButtonModal.addEventListener('click', sendInitialChatRequest);
    if (processIncomingPackageButtonModal) processIncomingPackageButtonModal.addEventListener('click', handleIncomingChatPackage);
    if (submitIncomingAnswerButtonModal) submitIncomingAnswerButtonModal.addEventListener('click', submitPeerAnswer);

    if (addRemoteIceCandidateButtonModal) {
        addRemoteIceCandidateButtonModal.addEventListener('click', handleAddRemoteIceCandidate);
    } else {
        // console.warn("'add-remote-ice-candidate-button' not found in DOM.");
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
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    // Settings Modal Toggle & Content Listeners
    if (userPanelClickable) {
        userPanelClickable.addEventListener('click', () => {
            if (settingsModalView) settingsModalView.classList.toggle('active-overlay');
            if (settingsModalView && settingsModalView.classList.contains('active-overlay')) {
                displayLocalUserProfile();
            }
        });
    }
    if (closeSettingsModalButton) {
        closeSettingsModalButton.addEventListener('click', () => {
            if (settingsModalView) settingsModalView.classList.remove('active-overlay');
        });
    }
    if (settingsCopyUseridButton) {
        settingsCopyUseridButton.addEventListener('click', () => {
            if (localUserProfile && localUserProfile.userId) {
                navigator.clipboard.writeText(localUserProfile.userId)
                    .then(() => {
                        const originalText = settingsCopyUseridButton.textContent;
                        settingsCopyUseridButton.textContent = '✓';
                        settingsCopyUseridButton.classList.add('copy-id-feedback');
                        setTimeout(() => {
                            settingsCopyUseridButton.textContent = '📋';
                            settingsCopyUseridButton.classList.remove('copy-id-feedback');
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Failed to copy User ID from settings: ', err);
                        alert('Failed to copy ID.');
                    });
            }
        });
    }
    if (settingsFontSizeToggleButton) {
        settingsFontSizeToggleButton.addEventListener('click', () => {
            let currentSizeClass = FONT_SIZE_CLASSES[0];
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
    if (setNicknameButton) {
        setNicknameButton.addEventListener('click', () => {
            if (!chatPartnerID) {
                alert("No active chat to set a nickname for.");
                return;
            }
            const currentDisplayName = getPeerPreferredName(chatPartnerID);
            const actualNickname = loadNickname(chatPartnerID) || '';
            const newNickname = prompt(`Set nickname for ${currentDisplayName} (currently displaying as '${currentDisplayName}').\nYour current nickname for them is '${actualNickname}'.\nLeave empty to remove nickname.`, actualNickname);

            if (newNickname !== null) {
                saveNickname(chatPartnerID, newNickname);
                updatePeerNameInUI(chatPartnerID);
            }
        });
    }
    if (settingsExportProfileButton) {
        settingsExportProfileButton.addEventListener('click', handleExportProfile);
    }
    if (importProfileFileInput) {
        importProfileFileInput.addEventListener('change', handleImportProfile);
    }
    if (settingsExportChatButton) {
        settingsExportChatButton.addEventListener('click', () => {
            if (chatPartnerID) {
                handleExportChat();
            } else {
                alert("Please select an active chat to export. (Future: allow selecting from history).");
            }
        });
    }
    if (settingsImportChatFileInput) {
        settingsImportChatFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                alert(`Chat Import: Selected file '${file.name}'. (Full import logic not yet implemented).`);
                event.target.value = "";
            }
        });
    }
    if (startVoiceCallButton) {
        startVoiceCallButton.addEventListener('click', () => {
            if (!peerConnection || !peerConnection.connected) {
                alert("You must be connected to a peer to start a call.");
                return;
            }
            alert("Voice call feature coming soon! This button is a placeholder.");
        });
    }
    if (attachFileButton) {
        attachFileButton.addEventListener('click', () => {
            if (mediaFileInput) mediaFileInput.click();
        });
    }
    if (mediaFileInput) {
        mediaFileInput.addEventListener('change', handleMediaFileSelected);
    }

    // Initial UI state
    if (!localUserProfile || !localUserProfile.userId) {
        if (initialSetupView) initialSetupView.classList.add('active-overlay');
        if (noChatView) noChatView.style.display = 'none';
        if (chatViewArea) chatViewArea.style.display = 'none';
    } else {
        if (initialSetupView) initialSetupView.classList.remove('active-overlay');
        if (noChatView) noChatView.style.display = 'flex';
        if (chatViewArea) chatViewArea.style.display = 'none';
    }
    if (messageInputBox) messageInputBox.disabled = true;
    if (sendMessageButtonBox) sendMessageButtonBox.disabled = true;
    const savedFontSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (savedFontSize && FONT_SIZE_CLASSES.includes(savedFontSize)) {
        applyFontSize(savedFontSize);
    } else {
        applyFontSize(FONT_SIZE_CLASSES[0]);
    }
});

// --- Profile Portability Functions, handleExportChat, Accessibility Functions (applyFontSize) ---
// (These functions are defined below this point)
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
            {userId: chatPartnerID, displayName: getPeerPreferredName(chatPartnerID)} // Use preferred name for export
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

    const safePeerId = String(getPeerPreferredName(chatPartnerID)).replace(/[^a-z0-9_.-]/gi, '_'); // Use preferred name in filename
    const dateSuffix = new Date().toISOString().split('T')[0];
    a.download = `p2p_chat_with_${safePeerId}_on_${dateSuffix}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Chat history with ${getPeerPreferredName(chatPartnerID)} prepared for download.`);
}

function handleExportProfile() {
    if (!localUserProfile || !localUserProfile.userId || !localUserProfile.displayName) {
        alert("Your profile is not fully set up. Cannot export.");
        return;
    }
    const profileToExport = {
        userId: localUserProfile.userId,
        displayName: localUserProfile.displayName,
        fontSizePreference: localStorage.getItem(FONT_SIZE_STORAGE_KEY) || FONT_SIZE_CLASSES[0] // Include font pref
    };
    const jsonString = JSON.stringify(profileToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateSuffix = new Date().toISOString().split('T')[0];
    a.download = `p2p_chat_profile_${dateSuffix}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Profile exported successfully!");
}

function handleImportProfile(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedProfile = JSON.parse(e.target.result);
            if (importedProfile && importedProfile.userId && importedProfile.displayName) {
                localUserProfile = {
                    userId: importedProfile.userId,
                    displayName: importedProfile.displayName
                };
                saveUserProfile(localUserProfile.displayName, localUserProfile.userId);
                displayLocalUserProfile();
                if (importedProfile.fontSizePreference && FONT_SIZE_CLASSES.includes(importedProfile.fontSizePreference)) {
                    applyFontSize(importedProfile.fontSizePreference);
                } else {
                    applyFontSize(FONT_SIZE_CLASSES[0]); // Default if not in imported profile
                }
                alert("Profile imported successfully!");
                if (initialSetupView) initialSetupView.classList.remove('active-overlay');
                if (noChatView && (!chatViewArea || chatViewArea.style.display === 'none')) {
                    noChatView.style.display = 'flex';
                } else if (noChatView) {
                    noChatView.style.display = 'none';
                }
            } else {
                alert("Invalid profile file format. Missing userId or displayName.");
            }
        } catch (error) {
            console.error("Error parsing imported profile file:", error);
            alert("Failed to import profile. The file might be corrupted or not a valid JSON profile.");
        } finally {
            if(importProfileFileInput) importProfileFileInput.value = "";
        }
    };
    reader.readAsText(file);
}

function applyFontSize(sizeClass) {
    if (!appContainer) {
        console.warn("App container not cached, cannot apply font size.");
        return;
    }
    FONT_SIZE_CLASSES.forEach(cls => appContainer.classList.remove(cls));
    if (FONT_SIZE_CLASSES.includes(sizeClass)) {
        appContainer.classList.add(sizeClass);
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, sizeClass);
        if (settingsFontSizeToggleButton) { // Check if button exists (it's in settings modal)
            const classIndex = FONT_SIZE_CLASSES.indexOf(sizeClass);
            settingsFontSizeToggleButton.textContent = `Font Size: ${FONT_SIZE_LABELS[classIndex] || 'Normal'}`;
        }
    } else {
        console.warn("Unknown font size class:", sizeClass, ".Applying default.");
        appContainer.classList.add(FONT_SIZE_CLASSES[0]);
        localStorage.setItem(FONT_SIZE_STORAGE_KEY, FONT_SIZE_CLASSES[0]);
        if (settingsFontSizeToggleButton) {
            settingsFontSizeToggleButton.textContent = `Font Size: ${FONT_SIZE_LABELS[0]}`;
        }
    }
}

[end of p2p_chat/renderer.js]
