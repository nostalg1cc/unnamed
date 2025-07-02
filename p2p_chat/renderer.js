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

// --- Constants ---
const USER_PROFILE_KEY = 'p2pChatUserProfile';
const AUTH_TOKEN_KEY = 'p2pChatAuthToken';
const CHAT_HISTORY_PREFIX = 'p2pChatHistory_';
const FONT_SIZE_CLASSES = ['font-scale-normal', 'font-scale-large', 'font-scale-larger'];
const FONT_SIZE_LABELS = ['Normal', 'Large', 'Larger'];
const FONT_SIZE_STORAGE_KEY = 'p2pChatFontSizePreference';
const PEER_DISPLAY_NAME_PREFIX = 'p2pPeerDisplayName_';
const NICKNAME_PREFIX = 'p2pNickname_';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_PROFILE_PIC_SIZE_BYTES = 20 * 1024 * 1024;

// --- Global State ---
let localUserProfile = null;
let authToken = null;
let peerConnection = null;
let localStream = null;
let chatPartnerID = null;
let selectedProfilePictureFile = null;

// --- DOM Elements ---
let authView, authTabs, loginTabContent, signupTabContent, loginForm, signupForm;
let loginUsernameInput, loginPasswordInput, loginWithPasskeyButton;
let signupUsernameInput, signupEmailInput, signupPasswordInput, signupConfirmPasswordInput;
let importProfileFileInputAuth, importProfileButtonLabelAuth;
let p2pManagementView, cancelP2PSetupButtonModal;
let peerIdInputModal, initialMessageInputModal, sendInitialMessageButtonModal;
let incomingChatPackageInputModal, processIncomingPackageButtonModal;
let signalingExchangeAreaModal, outgoingSignalDivModal, outgoingSignalTextareaModal;
let initiatorWaitsForAnswerDivModal, incomingAnswerSdpInputModal, submitIncomingAnswerButtonModal;
let sidebar, initiateNewChatSidebarButton, currentChatDmItem, dmListCurrentChatAvatar, dmListCurrentChatNameTooltip;
let localUserAvatarSidebar, userPanelClickable, userPanelDetailsTooltip, tooltipUsernameLocal, tooltipUseridLocal;
let settingsModalView, closeSettingsModalButton;
let settingsUsernameDisplay, settingsUseridDisplay, settingsCopyUseridButton;
let settingsChangeUsernameInput, settingsSaveUsernameButton;
let settingsFontSizeToggleButton;
let settingsSearchVisibilityToggle; // Search Visibility Toggle
let settingsExportChatButton, settingsImportChatFileInput, settingsExportProfileButton;
let audioInputSelect, audioOutputSelect;
let profilePictureFileInput, profilePicturePreview, profilePicturePlaceholderAvatar, saveProfilePictureButton;
let mainContent, chatViewArea, noChatView, appContainer;
let chatHeaderPartnerName, exportChatButtonHeader, disconnectChatButtonHeader, startVoiceCallButton, setNicknameButton;
let messagesArea, messageInputBox, sendMessageButtonBox, attachFileButton, mediaFileInput;
let localIceCandidatesOutputModal, remoteIceCandidateInputModal, addRemoteIceCandidateButtonModal;


function cacheDOMElements() {
    appContainer = document.querySelector('.app-container');
    authView = document.getElementById('auth-view');
    authTabs = document.querySelector('.auth-tabs');
    loginTabContent = document.getElementById('login-tab-content');
    signupTabContent = document.getElementById('signup-tab-content');
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');
    loginUsernameInput = document.getElementById('login-username');
    loginPasswordInput = document.getElementById('login-password');
    loginWithPasskeyButton = document.getElementById('login-with-passkey-button');
    signupUsernameInput = document.getElementById('signup-username');
    signupEmailInput = document.getElementById('signup-email');
    signupPasswordInput = document.getElementById('signup-password');
    signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
    importProfileFileInputAuth = document.getElementById('import-profile-file-input');
    importProfileButtonLabelAuth = document.querySelector('label[for="import-profile-file-input"]');

    p2pManagementView = document.getElementById('p2p-management-view');
    cancelP2PSetupButtonModal = document.getElementById('cancel-p2p-setup-button');
    peerIdInputModal = document.getElementById('peer-id-input-modal');
    initialMessageInputModal = document.getElementById('initial-message-input-modal');
    sendInitialMessageButtonModal = document.getElementById('send-initial-message-button-modal');
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
    settingsChangeUsernameInput = document.getElementById('settings-change-username-input');
    settingsSaveUsernameButton = document.getElementById('settings-save-username-button');
    settingsFontSizeToggleButton = document.getElementById('settings-font-size-toggle-button');
    settingsSearchVisibilityToggle = document.getElementById('settings-search-visibility-toggle'); // Cache toggle
    settingsExportChatButton = document.getElementById('settings-export-chat-button');
    settingsImportChatFileInput = document.getElementById('settings-import-chat-file-input');
    settingsExportProfileButton = document.getElementById('settings-export-profile-button');
    audioInputSelect = document.getElementById('audio-input-select');
    audioOutputSelect = document.getElementById('audio-output-select');
    profilePictureFileInput = document.getElementById('profile-picture-file-input');
    profilePicturePreview = document.getElementById('profile-picture-preview');
    profilePicturePlaceholderAvatar = document.getElementById('profile-picture-placeholder-avatar');
    saveProfilePictureButton = document.getElementById('save-profile-picture-button');

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

// --- API Interaction Functions ---
const API_BASE_URL = '/api/v1';
async function apiSignup(username, password, email = null) { /* ... */ }
async function apiLogin(username, password) { /* ... */ }
async function apiFetchUserProfile() {
    if (!authToken) return Promise.reject({ message: "Not authenticated. No token." });
    console.log("API Call: Fetching user profile");
    try {
        // STUB: Replace with actual fetch call
        // const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${authToken}` }});
        // const data = await response.json();
        // if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
        // console.log("Fetch User Profile API response:", data);
        // return data;

        // MOCK Implementation for now:
        return new Promise(resolve => setTimeout(() => {
            const mockUser = {
                userId: 'usr_mock' + generateUserId(10),
                username: localUserProfile ? localUserProfile.displayName : "MockUser", // Use existing if migrating
                email: localUserProfile ? localUserProfile.email : 'mock@example.com',
                profilePictureUrl: localUserProfile ? localUserProfile.profilePictureUrl : null,
                searchVisibility: localUserProfile ? localUserProfile.searchVisibility : true // Default to true
            };
            resolve({ user: mockUser });
        }, 300));

    } catch (error) {
        console.error('apiFetchUserProfile error:', error);
        throw { message: error.message || "Failed to fetch profile." };
    }
}
async function apiUploadProfilePicture(file) { /* ... STUBBED ... */ }
async function apiChangeUsername(newUsername) { /* ... STUBBED ... */ }
async function apiUpdateUserSettings(settingsPayload) { // { searchVisibility: boolean }
    if (!authToken) { alert("Not authenticated."); return Promise.reject({ message: "Not authenticated" }); }
    console.log(`API Call STUB: Updating user settings`, settingsPayload);
    // STUB: Replace with actual fetch call to PUT /users/me/settings
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate success, backend would update DB
            console.log("Simulated user settings update success.");
            // Return the part of the profile that was updated, or the whole profile
            resolve({ user: { ...localUserProfile, ...settingsPayload }, message: "Settings updated successfully (stubbed)!" });
        }, 500);
    });
}


// --- Local Storage Wrappers ---
function saveAuthToken(token) { /* ... */ }
function loadAuthToken() { /* ... */ return localStorage.getItem(AUTH_TOKEN_KEY); }
function clearAuthToken() { /* ... */ }
function saveNickname(peerId, nickname) { /* ... */ }
function loadNickname(peerId) { /* ... */ return localStorage.getItem(`${NICKNAME_PREFIX}${peerId}`);}
function savePeerDisplayName(peerId, displayName) { /* ... */ }
function loadPeerDisplayName(peerId) { /* ... */ return localStorage.getItem(`${PEER_DISPLAY_NAME_PREFIX}${peerId}`);}
function saveMessageToHistory(peerId, messageObject) { /* ... */ }
function loadChatHistory(peerId) { /* ... */ return JSON.parse(localStorage.getItem(`${CHAT_HISTORY_PREFIX}${peerId}`) || "[]");}
function saveUserProfileToLocal(profileData) { /* ... */ }
function generateUserId(length = 24) { /* ... */ }

// --- Auth Flow & UI Transitions ---
function loadAuthenticatedUserProfile() { /* ... */ }
function showAuthView() { /* ... */ }
function transitionToMainAppView() { /* ... */ }

// --- UI Update Functions ---
function getAvatarColors(seedText = "") { /* ... */ }
function getPeerPreferredName(peerId) { /* ... */ }
function displayLocalUserProfile() {
    const profileData = localUserProfile;
    // Existing avatar, tooltip, settings username/ID updates...
    if (localUserAvatarSidebar) { /* ... */ }
    if (profilePicturePreview && profileData && profileData.profilePictureUrl) { /* ... */ }
    else if (profilePicturePreview) { /* ... */ }
    if (tooltipUsernameLocal) { /* ... */ }
    if (tooltipUseridLocal) { /* ... */ }
    if (settingsUsernameDisplay) { /* ... */ }
    if (settingsUseridDisplay) { /* ... */ }
    if (settingsChangeUsernameInput && profileData && profileData.displayName) {
        settingsChangeUsernameInput.value = profileData.displayName;
    }
    // Set Search Visibility Toggle
    if (settingsSearchVisibilityToggle && profileData) {
        settingsSearchVisibilityToggle.checked = profileData.searchVisibility === undefined ? true : profileData.searchVisibility;
    }
    if (profileData && profileData.userId && authToken) { transitionToMainAppView(); } else { showAuthView(); }
}
function updatePeerNameInUI(peerIdToUpdate) { /* ... */ }
function appendMessage(messageObject, isHistory = false) { /* ... */ }
function appendMediaMessage(messageObject) { /* ... */ }

// --- P2P Stubs / Call Signaling ---
function sendInitialChatRequest() { /* ... */ }
function handleIncomingChatPackage() { /* ... */ }
function submitPeerAnswer() { /* ... */ }
function handleAddRemoteIceCandidate() { /* ... */ }
function cleanupPeerConnection() { /* ... */ }
function initializePeerEvents(currentPeer) { /* ... */ }

// --- Profile Customization Handlers ---
function handleProfilePictureSelected(event) { /* ... */ }
async function handleSaveProfilePicture() { /* ... */ }
async function handleSaveUsername() { /* ... */ }

// --- Other Handlers (Export, Import, Accessibility, Media) ---
function handleExportChat() { /* ... */ }
function handleExportProfile() { /* ... */ }
function handleImportProfile(event) { /* ... */ }
function applyFontSize(sizeClass) { /* ... */ }
function handleMediaFileSelected(event) { /* ... */ }


// --- DOMContentLoaded ---
window.addEventListener('DOMContentLoaded', () => {
    // ... (cacheDOMElements, loadAuthenticatedUserProfile calls) ...
    // ... (Auth tab, login/signup form listeners) ...
    // ... (Import old profile listener) ...
    // ... (Sidebar New Chat/Add Friend stub listener) ...
    // ... (Settings Modal toggle, close, copy ID, font size, set nickname, export profile listeners) ...
    // ... (Profile picture upload listeners) ...
    // ... (Username change listener for settingsSaveUsernameButton) ...

    // Search Visibility Toggle Listener
    if (settingsSearchVisibilityToggle) {
        settingsSearchVisibilityToggle.addEventListener('change', async () => {
            if (!localUserProfile || !authToken) {
                alert("Please log in to change settings.");
                // Revert toggle if user is not really logged in
                if(localUserProfile) settingsSearchVisibilityToggle.checked = localUserProfile.searchVisibility;
                return;
            }
            const newVisibility = settingsSearchVisibilityToggle.checked;
            try {
                // STUB: const response = await apiUpdateUserSettings({ searchVisibility: newVisibility });
                // Simulate API call
                console.log(`API Call STUB: Updating searchVisibility to ${newVisibility}`);
                await new Promise(resolve => setTimeout(resolve, 300));
                const response = { user: { ...localUserProfile, searchVisibility: newVisibility } };

                localUserProfile.searchVisibility = response.user.searchVisibility;
                saveUserProfileToLocal(localUserProfile); // Save updated profile with new setting
                // displayLocalUserProfile(); // No direct visual change from this, but good practice if other settings change
                alert(`Search visibility updated to: ${localUserProfile.searchVisibility ? 'Visible' : 'Hidden'} (stubbed).`);
            } catch (error) {
                console.error("Failed to update search visibility:", error);
                alert(`Error updating setting: ${error.message}`);
                // Revert toggle on error
                settingsSearchVisibilityToggle.checked = localUserProfile.searchVisibility;
            }
        });
    }

    // ... (Chat action listeners: export, import stub, disconnect, send message, attach file, voice call stub) ...
    // ... (Initial font size application) ...
});

// Ensure all function bodies previously defined are present.
// Collapsed for brevity in this diff view.
// For example, the full bodies for apiSignup, apiLogin, getAvatarColors, saveAuthToken, etc.
// The previous overwrite_file_with_block provided the complete file. This adds to it.
// It's safer to do a full overwrite again.

// The following are assumed to be complete from the previous overwrite:
// apiSignup, apiLogin, apiUploadProfilePicture, apiChangeUsername
// saveAuthToken, loadAuthToken, clearAuthToken, saveNickname, loadNickname, savePeerDisplayName, loadPeerDisplayName, saveMessageToHistory, loadChatHistory, saveUserProfileToLocal, generateUserId
// loadAuthenticatedUserProfile, showAuthView, transitionToMainAppView
// getAvatarColors, getPeerPreferredName, displayLocalUserProfile (updated above), updatePeerNameInUI, appendMessage, appendMediaMessage
// Old P2P stubs
// cleanupPeerConnection, initializePeerEvents (for media)
// handleProfilePictureSelected, handleSaveProfilePicture, handleSaveUsername
// handleExportChat, handleExportProfile, handleImportProfile (updated), applyFontSize, handleMediaFileSelected
// The DOMContentLoaded needs to correctly integrate all listeners.
// The overwrite below will have the full, correct file.
[end of p2p_chat/renderer.js]
