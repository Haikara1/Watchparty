import { useEffect, useRef, useState } from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    getRoomById
} from "../../services/roomStorage";

import realtimeService from "../../services/realtimeService";

import screenShareService from "../../services/screenShareService";

import {
    getOrCreateParticipantId,
    getSavedUsername,
    normalizeUsername,
    saveUsername,
    validateUsername
} from "../../services/participantIdentity";

import styles from "./WatchRoom.module.css";


const ADAPTIVE_PROFILES = [
    { id: "very-low", label: "Muito baixa", maxBitrate: 700_000, maxFramerate: 15, scaleResolutionDownBy: 2 },
    { id: "low", label: "Baixa", maxBitrate: 1_200_000, maxFramerate: 24, scaleResolutionDownBy: 1.5 },
    { id: "medium", label: "Média", maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
    { id: "high", label: "Alta", maxBitrate: 4_500_000, maxFramerate: 60, scaleResolutionDownBy: 1 }
];

const MAX_SIMULTANEOUS_SCREEN_SHARES = 3;


function getAdaptiveProfile(index, settings) {
    const base = ADAPTIVE_PROFILES[index];
    const selectedFps = Number(settings?.selectedFps) || 30;
    const selectedQuality = settings?.selectedQuality || "1080p";
    const bitrateCeiling = selectedQuality === "720p"
        ? 2_500_000
        : 4_500_000;

    return {
        ...base,
        maxBitrate: Math.min(base.maxBitrate, bitrateCeiling),
        maxFramerate: Math.min(base.maxFramerate, selectedFps)
    };
}


function getCurrentTimestamp() {
    return Date.now();
}

async function playScreenShareStartedSound() {

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        return;
    }

    let audioContext;

    try {
        audioContext = new AudioContextClass();

        if (audioContext.state === "suspended") {
            await Promise.race([
                audioContext.resume(),
                new Promise(resolve => {
                    setTimeout(resolve, 100);
                })
            ]);

            if (audioContext.state !== "running") {
                await audioContext.close();
                return;
            }
        }

        const masterGain = audioContext.createGain();
        const startedAt = audioContext.currentTime;

        masterGain.gain.setValueAtTime(0.0001, startedAt);
        masterGain.gain.exponentialRampToValueAtTime(
            0.12,
            startedAt + 0.025
        );
        masterGain.gain.exponentialRampToValueAtTime(
            0.0001,
            startedAt + 0.38
        );
        masterGain.connect(audioContext.destination);

        [
            { frequency: 523.25, offset: 0 },
            { frequency: 659.25, offset: 0.11 }
        ].forEach(({ frequency, offset }) => {
            const oscillator = audioContext.createOscillator();
            const noteGain = audioContext.createGain();
            const noteStartedAt = startedAt + offset;

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(
                frequency,
                noteStartedAt
            );

            noteGain.gain.setValueAtTime(
                0.0001,
                noteStartedAt
            );
            noteGain.gain.exponentialRampToValueAtTime(
                1,
                noteStartedAt + 0.018
            );
            noteGain.gain.exponentialRampToValueAtTime(
                0.0001,
                noteStartedAt + 0.2
            );

            oscillator.connect(noteGain);
            noteGain.connect(masterGain);
            oscillator.start(noteStartedAt);
            oscillator.stop(noteStartedAt + 0.21);
        });

        setTimeout(() => {
            audioContext.close().catch(() => {});
        }, 500);

    } catch (error) {
        console.warn(
            "[ScreenShare] Som de início bloqueado pelo navegador:",
            error
        );

        if (audioContext && audioContext.state !== "closed") {
            audioContext.close().catch(() => {});
        }
    }
}


function ScreenSharePreview({
    share,
    isActive,
    onSelect,
    isHostShare = false,
    canForceStop = false,
    onForceStop
}) {

    const videoRef = useRef(null);

    useEffect(() => {

        const video = videoRef.current;

        if (!video) {
            return;
        }

        if (video.srcObject !== share.stream) {
            video.srcObject = share.stream;
        }

        video.muted = true;

        video.play().catch(error => {
            console.warn(
                "[ScreenShare] Autoplay do preview bloqueado:",
                error
            );
        });

        return () => {
            if (video.srcObject === share.stream) {
                video.srcObject = null;
            }
        };

    }, [share.stream]);

    return (
        <div
            className={`${styles.screenPreview} ${
                isActive ? styles.screenPreviewActive : ""
            }`}
            onClick={() => onSelect(share.userId)}
            onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(share.userId);
                }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Assistir ao compartilhamento de ${share.username}`}
            aria-pressed={isActive}
        >
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={styles.screenPreviewVideo}
            />

            <span className={styles.screenPreviewOverlay}>
                <span className={styles.screenPreviewUsername}>
                    {share.username}
                </span>
                <span className={styles.screenPreviewLive}>
                    LIVE
                </span>
                {isHostShare && (
                    <span className={styles.screenShareHostBadge}>HOST</span>
                )}
                {share.streamSettings && (
                    <span className={styles.streamQualityBadge}>
                        {formatStreamQuality(share.streamSettings)}
                    </span>
                )}
            </span>

            {canForceStop && (
                <button
                    type="button"
                    className={styles.shareAdminButton}
                    onClick={event => {
                        event.stopPropagation();
                        onForceStop(share.userId);
                    }}
                >
                    Encerrar transmissão
                </button>
            )}
        </div>
    );
}


function PendingScreenPreview({ stream }) {

    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        video.srcObject = stream || null;

        if (stream) {
            video.play().catch(() => {});
        }

        return () => {
            video.srcObject = null;
        };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className={styles.screenSelectionPreviewVideo}
            aria-label="Prévia local da tela selecionada"
        />
    );
}


function formatStreamQuality(settings) {

    if (!settings) {
        return "";
    }

    const height = Number(settings.height);
    const frameRate = Math.round(Number(settings.frameRate) || 0);
    const resolution = height
        ? `${height}p`
        : "Qualidade automática";

    return frameRate
        ? `${resolution} • ${frameRate} FPS`
        : resolution;
}


function formatDisplaySurface(displaySurface) {
    return {
        monitor: "Tela inteira",
        window: "Janela",
        browser: "Aba do navegador"
    }[displaySurface] || "Tela selecionada";
}


function WatchRoom() {

    const { roomId } = useParams();

    const navigate = useNavigate();

    const channelRef = useRef(null);

    const isConnectingRef = useRef(false);

    const isRetrackingPresenceRef = useRef(false);
    const hasTrackedPresenceRef = useRef(false);

    /*
    ============================================================
    SALA
    ============================================================
    */

    const [room, setRoom] = useState(null);

    const [isLoading, setIsLoading] = useState(true);

    const [authUserId, setAuthUserId] = useState(null);

    const isRoomOwner = Boolean(
        authUserId && room?.ownerId && authUserId === room.ownerId
    );

    /*
    ============================================================
    COMPARTILHAMENTO
    ============================================================
    */

    const [copyStatus, setCopyStatus] = useState("idle");

    const [showRoomInfo, setShowRoomInfo] = useState(false);
    const [roomCodeCopyStatus, setRoomCodeCopyStatus] = useState("idle");
    const [connectionStatus, setConnectionStatus] = useState(
        () => navigator.onLine ? "connecting" : "offline"
    );
    const [roomFull, setRoomFull] = useState(false);

    const [canNativeShare] = useState(
        () =>
            typeof navigator !== "undefined" &&
            typeof navigator.share === "function"
    );

    const shareFeedbackTimeoutRef = useRef(null);
    const roomCodeCopyTimeoutRef = useRef(null);

    function getShareUrl() {
        return `${window.location.origin}/watch/${roomId}`;
    }

    function showCopyStatus(status) {

        if (shareFeedbackTimeoutRef.current) {
            clearTimeout(shareFeedbackTimeoutRef.current);
        }

        setCopyStatus(status);

        shareFeedbackTimeoutRef.current = setTimeout(() => {
            setCopyStatus("idle");
            shareFeedbackTimeoutRef.current = null;
        }, 3000);
    }

    async function handleCopyRoomLink() {

        try {

            if (!navigator.clipboard?.writeText) {
                throw new Error("Clipboard API indisponível.");
            }

            await navigator.clipboard.writeText(getShareUrl());

            showCopyStatus("success");

        } catch (error) {

            console.error(
                "[Compartilhamento] Erro ao copiar:",
                error
            );

            showCopyStatus("error");
        }
    }

    async function handleNativeShare() {

        if (!room) {
            return;
        }

        try {

            await navigator.share({
                title: "WatchParty",
                text: `Venha assistir comigo na sala "${room.name}".`,
                url: getShareUrl()
            });

        } catch (error) {

            if (error?.name !== "AbortError") {

                console.error(
                    "[Compartilhamento] Erro ao compartilhar:",
                    error
                );
            }
        }
    }

    useEffect(() => {

        return () => {

            if (shareFeedbackTimeoutRef.current) {
                clearTimeout(
                    shareFeedbackTimeoutRef.current
                );
            }

            if (roomCodeCopyTimeoutRef.current) {
                clearTimeout(roomCodeCopyTimeoutRef.current);
            }

        };

    }, []);

    /*
    ============================================================
    CHAT
    ============================================================
    */

    const [messages, setMessages] = useState([]);

    const [chatMessage, setChatMessage] = useState("");
    const [chatError, setChatError] = useState("");
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const chatMessagesRef = useRef(null);
    const shouldAutoScrollChatRef = useRef(true);
    const lastMessageSentAtRef = useRef(0);

    /*
    ============================================================
    PRESENÇA
    ============================================================
    */

    const [participants, setParticipants] = useState([]);

    const participantsRef = useRef([]);

    const [showParticipants, setShowParticipants] =
        useState(false);

    const [blockedScreenShareParticipants, setBlockedScreenShareParticipants] =
        useState(() => new Set());

    const blockedScreenShareParticipantsRef = useRef(new Set());

    const [openParticipantMenuId, setOpenParticipantMenuId] =
        useState(null);

    const [sharePermissionNotice, setSharePermissionNotice] =
        useState("");

    const sharePermissionNoticeTimerRef = useRef(null);

    /*
    ============================================================
    IDENTIDADE
    ============================================================
    */

    const [participantId] = useState(getOrCreateParticipantId);

    const [connectionId] = useState(() => crypto.randomUUID());

    const userIdRef = useRef(connectionId);

    const [username, setUsername] = useState(getSavedUsername);

    const usernameRef = useRef(username);

    const [showIdentityModal, setShowIdentityModal] = useState(() => !getSavedUsername());

    const [isEditingUsername, setIsEditingUsername] = useState(false);

    const [usernameDraft, setUsernameDraft] = useState(username);

    const [usernameError, setUsernameError] = useState("");

    const identityInputRef = useRef(null);

    const identityReady = Boolean(username);

    useEffect(() => {
        blockedScreenShareParticipantsRef.current = blockedScreenShareParticipants;
    }, [blockedScreenShareParticipants]);

    useEffect(() => {
        usernameRef.current = username;
    }, [username]);

    useEffect(() => {
        function handleOnline() {
            setConnectionStatus(
                realtimeService.isChannelReady(channelRef.current)
                    ? "connected"
                    : "reconnecting"
            );
        }

        function handleOffline() {
            setConnectionStatus("offline");
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        const container = chatMessagesRef.current;

        if (!container || messages.length === 0) {
            return;
        }

        if (shouldAutoScrollChatRef.current) {
            container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
            setHasUnreadMessages(false);
        } else {
            setHasUnreadMessages(true);
        }
    }, [messages]);

    useEffect(() => {
        if (!showIdentityModal) {
            return;
        }

        const focusFrame = requestAnimationFrame(
            () => identityInputRef.current?.focus()
        );

        function handleIdentityKeyDown(event) {
            if (event.key === "Escape" && isEditingUsername) {
                setShowIdentityModal(false);
                setIsEditingUsername(false);
                setUsernameError("");
            }
        }

        document.addEventListener("keydown", handleIdentityKeyDown);
        return () => {
            cancelAnimationFrame(focusFrame);
            document.removeEventListener("keydown", handleIdentityKeyDown);
        };
    }, [showIdentityModal, isEditingUsername]);

    function openUsernameEditor() {
        setUsernameDraft(username);
        setUsernameError("");
        setIsEditingUsername(true);
        setShowIdentityModal(true);
        setOpenParticipantMenuId(null);
    }

    async function handleCopyRoomCode() {
        try {
            await navigator.clipboard.writeText(roomId);
            setRoomCodeCopyStatus("success");
        } catch (error) {
            console.error("[Sala] Erro ao copiar código:", error);
            setRoomCodeCopyStatus("error");
        }

        if (roomCodeCopyTimeoutRef.current) {
            clearTimeout(roomCodeCopyTimeoutRef.current);
        }

        roomCodeCopyTimeoutRef.current = window.setTimeout(() => {
            setRoomCodeCopyStatus("idle");
            roomCodeCopyTimeoutRef.current = null;
        }, 2500);
    }

    async function handleSaveUsername(event) {
        event.preventDefault();

        const normalizedUsername = normalizeUsername(usernameDraft);
        const validationError = validateUsername(normalizedUsername);

        if (validationError) {
            setUsernameError(validationError);
            return;
        }

        saveUsername(normalizedUsername);
        usernameRef.current = normalizedUsername;
        setUsername(normalizedUsername);
        setUsernameDraft(normalizedUsername);
        setUsernameError("");
        setShowIdentityModal(false);
        setIsEditingUsername(false);

        const activeChannel = channelRef.current;
        if (activeChannel && realtimeService.isChannelReady(activeChannel)) {
            await realtimeService.trackPresence(activeChannel, {
                userId: userIdRef.current,
                participantId,
                username: normalizedUsername,
                isHost: isRoomOwner
            });
        }
    }

    /*
    ============================================================
    WEBRTC
    ============================================================
    */

    const localScreenStreamRef = useRef(null);

    const localScreenShareOwnerRef = useRef(null);

    const outgoingPeersRef = useRef(new Map());

    const incomingPeersRef = useRef(new Map());

    const pendingIceCandidatesRef = useRef(new Map());

    const peerDisconnectTimersRef = useRef(new Map());

    const peerRecoveryAttemptsRef = useRef(new Map());

    const peerRecoveryInProgressRef = useRef(new Set());

    const isStoppingScreenShareRef = useRef(false);

    /*
    ============================================================
    STREAM REMOTA
    ============================================================
    */

    const [remoteScreenShares, setRemoteScreenShares] =
        useState([]);

    const remoteScreenSharesRef = useRef([]);

    const [activeScreenShareId, setActiveScreenShareId] =
        useState(null);

    const remoteShareUsernamesRef = useRef(new Map());

    const announcedRemoteSharesRef = useRef(new Set());

    const remoteStreamSettingsRef = useRef(new Map());

    function addRemoteScreenShare(
        userId,
        username,
        stream,
        streamSettings = null
    ) {

        if (!userId || !stream) {
            return;
        }

        const resolvedUsername =
            username ||
            remoteShareUsernamesRef.current.get(userId) ||
            "Participante";

        remoteShareUsernamesRef.current.set(
            userId,
            resolvedUsername
        );

        const resolvedStreamSettings =
            streamSettings ||
            remoteStreamSettingsRef.current.get(userId) ||
            null;

        if (resolvedStreamSettings) {
            remoteStreamSettingsRef.current.set(
                userId,
                resolvedStreamSettings
            );
        }

        const previous = remoteScreenSharesRef.current;

        const existingIndex = previous.findIndex(
            share => share.userId === userId
        );

        let next;

        if (existingIndex === -1) {
            next = [
                ...previous,
                {
                    userId,
                    username: resolvedUsername,
                    stream,
                    streamSettings: resolvedStreamSettings
                }
            ];
        } else {
            const existing = previous[existingIndex];

            if (
                existing.stream === stream &&
                existing.username === resolvedUsername
            ) {
                return;
            }

            next = [...previous];

            next[existingIndex] = {
                ...existing,
                username: resolvedUsername,
                stream,
                streamSettings: resolvedStreamSettings
            };
        }

        remoteScreenSharesRef.current = next;
        setRemoteScreenShares(next);

    }

    function removeRemoteScreenShare(userId) {

        if (!userId) {
            return;
        }

        remoteShareUsernamesRef.current.delete(userId);
        announcedRemoteSharesRef.current.delete(userId);
        remoteStreamSettingsRef.current.delete(userId);

        const next =
            remoteScreenSharesRef.current.filter(
                share => share.userId !== userId
            );

        remoteScreenSharesRef.current = next;
        setRemoteScreenShares(next);

        setActiveScreenShareId(
            current =>
                current === null
                    ? null
                    : current !== userId && next.some(
                        share => share.userId === current
                    )
                        ? current
                        : next[0]?.userId || null
        );
    }

    function selectScreenShare(userId) {
        setConnectionQuality(null);
        setActiveScreenShareId(userId);
    }

    function handleLeaveRemoteScreenShare() {
        console.log("[ScreenShare] LEAVE REMOTE solicitado", {
            connectionId: userIdRef.current,
            activeScreenShareId
        });
        setIsPlaying(false);
        setConnectionQuality(null);
        setActiveScreenShareId(null);
    }

    const activeScreenShare =
        remoteScreenShares.find(
            share => share.userId === activeScreenShareId
        ) || null;

    const remoteScreenStream =
        activeScreenShare?.stream || null;

    /*
    ============================================================
    COMPARTILHAMENTO LOCAL
    ============================================================
    */

    const [isScreenSharing, setIsScreenSharing] =
        useState(false);

    // Este estado representa exclusivamente a captura local deste cliente.
    const hasLocalScreenShare = isScreenSharing;

    const [screenShareError, setScreenShareError] =
        useState("");

    const [showScreenShareSettings, setShowScreenShareSettings] =
        useState(false);

    const [screenShareQuality, setScreenShareQuality] =
        useState("1080p");

    const [screenShareFps, setScreenShareFps] = useState(30);

    const [screenShareQualityMode, setScreenShareQualityMode] =
        useState("auto");

    const pendingScreenShareStreamRef = useRef(null);

    const screenSelectionRequestRef = useRef(0);

    const [pendingScreenShareStream, setPendingScreenShareStream] =
        useState(null);

    const [pendingScreenShareSettings, setPendingScreenShareSettings] =
        useState(null);

    const [isSelectingScreen, setIsSelectingScreen] = useState(false);

    const [isStartingScreenShare, setIsStartingScreenShare] =
        useState(false);

    const [screenSelectionError, setScreenSelectionError] =
        useState("");

    const [localScreenShareSettings, setLocalScreenShareSettings] =
        useState(null);

    const localScreenShareSettingsRef = useRef(null);

    const localScreenShareQualityModeRef = useRef("auto");

    const outgoingStatsIntervalsRef = useRef(new Map());
    const outgoingStatsPreviousRef = useRef(new Map());
    const peerQualityProfileRef = useRef(new Map());
    const peerQualityCountersRef = useRef(new Map());
    const peerLastAdaptationRef = useRef(new Map());
    const adaptiveUnsupportedPeersRef = useRef(new Set());

    const [adaptiveStatus, setAdaptiveStatus] = useState(null);

    const [connectionQuality, setConnectionQuality] = useState(null);

    /*
    ============================================================
    PLAYER
    ============================================================
    */

    const remoteVideoRef = useRef(null);

    const playerContainerRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);

    const [volume, setVolume] = useState(1);

    const [isMuted, setIsMuted] = useState(true);

    const [isFullscreen, setIsFullscreen] = useState(false);

    const [isPictureInPicture, setIsPictureInPicture] =
        useState(false);

    const [showControls, setShowControls] = useState(true);

    const controlsTimeoutRef = useRef(null);

    /*
    ============================================================
    PLAYER - ÁUDIO
    ============================================================
    */

    useEffect(() => {

        const video = remoteVideoRef.current;

        if (!video) {
            return;
        }

        video.volume = volume;
        video.muted = isMuted;

    }, [volume, isMuted]);

    /*
    ============================================================
    PLAYER - STREAM REMOTA
    ============================================================
    */

    useEffect(() => {

        const video = remoteVideoRef.current;

        if (!video) {
            return;
        }

        if (remoteScreenStream) {

            if (video.srcObject !== remoteScreenStream) {
                video.srcObject = remoteScreenStream;
            }

            video.volume = volume;

            /*
            O stream remoto começa mutado para
            evitar bloqueio de autoplay.
            */

            video.muted = true;

            const playVideo = async () => {

                try {

                    setIsMuted(true);

                    await video.play();

                    setIsPlaying(true);

                } catch (error) {

                    console.warn(
                        "[ScreenShare] Autoplay bloqueado:",
                        error
                    );

                    setIsPlaying(false);
                }
            };

            const timeoutId = setTimeout(
                playVideo,
                50
            );

            return () => {
                clearTimeout(timeoutId);
            };
        }

        video.pause();

        video.srcObject = null;

    }, [remoteScreenStream]);

    useEffect(() => {

        if (!activeScreenShareId) {
            return;
        }

        const peerConnection =
            incomingPeersRef.current.get(activeScreenShareId);

        if (!peerConnection || peerConnection.signalingState === "closed") {
            return;
        }

        let isActive = true;
        const recentLevels = [];

        async function collectConnectionStats() {
            try {
                const reports = await peerConnection.getStats();
                let videoStats = null;

                reports.forEach(report => {
                    if (
                        report.type === "inbound-rtp" &&
                        !report.isRemote &&
                        (report.kind === "video" || report.mediaType === "video")
                    ) {
                        videoStats = report;
                    }
                });

                if (!videoStats || !isActive) {
                    return;
                }

                const received = Number(videoStats.packetsReceived) || 0;
                const lost = Number(videoStats.packetsLost) || 0;
                const lossRate = lost / Math.max(received + lost, 1);
                const jitter = Number(videoStats.jitter) || 0;
                const decoded = Number(videoStats.framesDecoded) || 0;
                const dropped = Number(videoStats.framesDropped) || 0;
                const dropRate = dropped / Math.max(decoded + dropped, 1);

                const level =
                    lossRate > 0.08 || jitter > 0.2 || dropRate > 0.12
                        ? 2
                        : lossRate > 0.025 || jitter > 0.08 || dropRate > 0.05
                            ? 1
                            : 0;

                recentLevels.push(level);

                if (recentLevels.length > 3) {
                    recentLevels.shift();
                }

                const poorSamples = recentLevels.filter(item => item === 2).length;
                const mediumSamples = recentLevels.filter(item => item >= 1).length;
                const quality = poorSamples >= 2
                    ? "poor"
                    : mediumSamples >= 2
                        ? "medium"
                        : "good";

                setConnectionQuality({
                    level: quality,
                    text: quality === "good"
                        ? "Boa conexão"
                        : quality === "medium"
                            ? "Conexão instável"
                            : "Conexão ruim",
                    stats: {
                        packetsLost: lost,
                        packetsReceived: received,
                        framesDecoded: decoded,
                        framesDropped: dropped,
                        framesPerSecond:
                            Number(videoStats.framesPerSecond) || 0,
                        jitter,
                        bytesReceived:
                            Number(videoStats.bytesReceived) || 0
                    }
                });
            } catch (error) {
                if (isActive) {
                    console.warn("[ScreenShare] Falha ao obter getStats:", error);
                }
            }
        }

        void collectConnectionStats();
        const intervalId = setInterval(collectConnectionStats, 2500);

        return () => {
            isActive = false;
            clearInterval(intervalId);
        };

    }, [activeScreenShareId]);

    /*
    ============================================================
    CONTROLES
    ============================================================
    */

    function resetControlsTimeout() {

        setShowControls(true);

        if (controlsTimeoutRef.current) {
            clearTimeout(
                controlsTimeoutRef.current
            );
        }

        if (isPlaying) {

            controlsTimeoutRef.current =
                setTimeout(() => {

                    setShowControls(false);

                }, 3000);
        }
    }

    useEffect(() => {

        return () => {

            if (controlsTimeoutRef.current) {
                clearTimeout(
                    controlsTimeoutRef.current
                );
            }

        };

    }, []);

    /*
    ============================================================
    PLAY / PAUSE
    ============================================================
    */

    async function handleTogglePlay() {

        const video = remoteVideoRef.current;

        if (!video) {
            return;
        }

        try {

            if (video.paused) {

                await video.play();

                setIsPlaying(true);

            } else {

                video.pause();

                setIsPlaying(false);
            }

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao reproduzir:",
                error
            );
        }

        resetControlsTimeout();
    }

    /*
    ============================================================
    VOLUME
    ============================================================
    */

    function handleVolumeChange(event) {

        const value = Number(event.target.value);

        setVolume(value);

        const muted = value === 0;

        setIsMuted(muted);

        const video = remoteVideoRef.current;

        if (!video) {
            resetControlsTimeout();
            return;
        }

        video.volume = value;

        video.muted = muted;

        if (!muted && video.paused) {

            video.play()
                .then(() => {
                    setIsPlaying(true);
                })
                .catch(error => {

                    console.warn(
                        "[ScreenShare] Não foi possível iniciar áudio:",
                        error
                    );

                });
        }

        resetControlsTimeout();
    }

    /*
    ============================================================
    MUTE
    ============================================================
    */

    function handleToggleMute() {

        const video = remoteVideoRef.current;

        if (!video) {
            return;
        }

        if (video.muted) {

            video.muted = false;

            setIsMuted(false);

            if (video.volume === 0) {

                video.volume = 1;

                setVolume(1);
            }

            if (video.paused) {

                video.play()
                    .then(() => {
                        setIsPlaying(true);
                    })
                    .catch(error => {

                        console.warn(
                            "[ScreenShare] Erro ao ativar áudio:",
                            error
                        );

                    });
            }

        } else {

            video.muted = true;

            setIsMuted(true);
        }

        resetControlsTimeout();
    }

    /*
    ============================================================
    FULLSCREEN
    ============================================================
    */

    async function handleToggleFullscreen() {

        const container =
            playerContainerRef.current;

        if (!container) {
            return;
        }

        try {

            if (!document.fullscreenElement) {

                await container.requestFullscreen();

            } else {

                await document.exitFullscreen();
            }

        } catch (error) {

            console.error(
                "[ScreenShare] Erro no fullscreen:",
                error
            );
        }

        resetControlsTimeout();
    }

    useEffect(() => {

        function handleFullscreenChange() {

            setIsFullscreen(
                Boolean(document.fullscreenElement)
            );
        }

        document.addEventListener(
            "fullscreenchange",
            handleFullscreenChange
        );

        return () => {

            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange
            );

        };

    }, []);

    /*
    ============================================================
    PICTURE-IN-PICTURE
    ============================================================
    */

    async function handleTogglePictureInPicture() {

        const video = remoteVideoRef.current;

        if (!video) {
            return;
        }

        if (!document.pictureInPictureEnabled) {
            return;
        }

        try {

            if (document.pictureInPictureElement) {

                await document.exitPictureInPicture();

            } else {

                await video.requestPictureInPicture();
            }

        } catch (error) {

            console.error(
                "[ScreenShare] Erro no Picture-in-Picture:",
                error
            );
        }

        resetControlsTimeout();
    }

    useEffect(() => {

        const video = remoteVideoRef.current;

        if (!video) {
            return;
        }

        function handleEnter() {
            setIsPictureInPicture(true);
        }

        function handleLeave() {
            setIsPictureInPicture(false);
        }

        video.addEventListener(
            "enterpictureinpicture",
            handleEnter
        );

        video.addEventListener(
            "leavepictureinpicture",
            handleLeave
        );

        return () => {

            video.removeEventListener(
                "enterpictureinpicture",
                handleEnter
            );

            video.removeEventListener(
                "leavepictureinpicture",
                handleLeave
            );

        };

    }, [remoteScreenStream]);

    /*
    ============================================================
    AUXILIARES WEBRTC
    ============================================================
    */

    function getActiveChannel() {
        return channelRef.current;
    }

    function isCurrentUser(userId) {
        return userId === userIdRef.current;
    }

    function getMaximumAdaptiveProfileIndex() {
        const settings = localScreenShareSettingsRef.current;
        return settings?.selectedQuality === "720p" &&
            settings?.selectedFps === 30
            ? 2
            : 3;
    }

    function refreshAdaptiveStatus() {
        const maximumIndex = getMaximumAdaptiveProfileIndex();
        const profiles = Array.from(peerQualityProfileRef.current.values());
        const lowestIndex = profiles.length
            ? Math.min(...profiles)
            : maximumIndex;

        setAdaptiveStatus(
            lowestIndex < maximumIndex
                ? `⚡ Ajustando qualidade: ${ADAPTIVE_PROFILES[lowestIndex].label}`
                : null
        );
    }

    function stopOutgoingStatsMonitor(userId) {
        const intervalId = outgoingStatsIntervalsRef.current.get(userId);

        if (intervalId) {
            clearInterval(intervalId);
            outgoingStatsIntervalsRef.current.delete(userId);
            console.log("[ScreenShare][Adaptive] Monitor encerrado:", userId);
        }

        outgoingStatsPreviousRef.current.delete(userId);
        peerQualityProfileRef.current.delete(userId);
        peerQualityCountersRef.current.delete(userId);
        peerLastAdaptationRef.current.delete(userId);
        adaptiveUnsupportedPeersRef.current.delete(userId);
    }

    async function applyAdaptiveProfile(
        userId,
        peerConnection,
        profileIndex
    ) {
        if (
            localScreenShareQualityModeRef.current !== "auto" ||
            adaptiveUnsupportedPeersRef.current.has(userId) ||
            outgoingPeersRef.current.get(userId) !== peerConnection
        ) {
            return false;
        }

        const profile = getAdaptiveProfile(
            profileIndex,
            localScreenShareSettingsRef.current
        );

        try {
            await screenShareService.setVideoSenderParameters(
                peerConnection,
                profile
            );

            if (
                outgoingPeersRef.current.get(userId) !== peerConnection
            ) {
                return false;
            }

            peerQualityProfileRef.current.set(userId, profileIndex);
            peerLastAdaptationRef.current.set(userId, getCurrentTimestamp());
            console.log(
                "[ScreenShare][Adaptive] Perfil alterado:",
                userId,
                profile.id
            );
            refreshAdaptiveStatus();
            return true;
        } catch (error) {
            adaptiveUnsupportedPeersRef.current.add(userId);
            console.warn(
                "[ScreenShare][Adaptive] setParameters não suportado:",
                userId,
                error
            );
            return false;
        }
    }

    async function collectOutgoingStats(userId, peerConnection) {
        if (
            outgoingPeersRef.current.get(userId) !== peerConnection ||
            peerConnection.connectionState !== "connected" ||
            peerRecoveryInProgressRef.current.has(
                getPeerStateKey(userId, "outgoing")
            )
        ) {
            return;
        }

        try {
            const reports = await screenShareService.getPeerStats(peerConnection);

            if (!reports) {
                return;
            }

            let outbound = null;
            let remoteInbound = null;

            reports.forEach(report => {
                if (
                    report.type === "outbound-rtp" &&
                    !report.isRemote &&
                    (report.kind === "video" || report.mediaType === "video")
                ) {
                    outbound = report;
                }

                if (
                    report.type === "remote-inbound-rtp" &&
                    (report.kind === "video" || report.mediaType === "video")
                ) {
                    remoteInbound = report;
                }
            });

            if (!outbound) {
                return;
            }

            const current = {
                timestamp: Number(outbound.timestamp) || getCurrentTimestamp(),
                bytesSent: Number(outbound.bytesSent) || 0,
                packetsSent: Number(outbound.packetsSent) || 0,
                packetsLost: Number(remoteInbound?.packetsLost) || 0,
                framesEncoded: Number(outbound.framesEncoded) || 0
            };
            const previous = outgoingStatsPreviousRef.current.get(userId);
            outgoingStatsPreviousRef.current.set(userId, current);

            if (!previous) {
                return;
            }

            const seconds = Math.max(
                (current.timestamp - previous.timestamp) / 1000,
                0.001
            );
            const bitrate = Math.max(
                ((current.bytesSent - previous.bytesSent) * 8) / seconds,
                0
            );
            const sentDelta = Math.max(current.packetsSent - previous.packetsSent, 0);
            const lostDelta = Math.max(current.packetsLost - previous.packetsLost, 0);
            const packetLossRate = Number.isFinite(remoteInbound?.fractionLost)
                ? Number(remoteInbound.fractionLost)
                : lostDelta / Math.max(sentDelta + lostDelta, 1);
            const rtt = Number(remoteInbound?.roundTripTime) || 0;
            const jitter = Number(remoteInbound?.jitter) || 0;

            const quality = packetLossRate > 0.08 || rtt > 0.45 || jitter > 0.2
                ? "poor"
                : packetLossRate > 0.025 || rtt > 0.22 || jitter > 0.08
                    ? "medium"
                    : "good";

            console.debug(
                "[ScreenShare][Adaptive] Bitrate aproximado:",
                userId,
                `${(bitrate / 1_000_000).toFixed(2)} Mbps`
            );

            const counters = peerQualityCountersRef.current.get(userId) || {
                good: 0,
                medium: 0,
                poor: 0
            };
            counters.good = quality === "good" ? counters.good + 1 : 0;
            counters.medium = quality === "medium" ? counters.medium + 1 : 0;
            counters.poor = quality === "poor" ? counters.poor + 1 : 0;
            peerQualityCountersRef.current.set(userId, counters);

            console.log(
                "[ScreenShare][Adaptive] Qualidade avaliada:",
                userId,
                quality
            );

            const maximumIndex = getMaximumAdaptiveProfileIndex();
            const currentIndex = peerQualityProfileRef.current.get(userId) ?? maximumIndex;
            const cooldownElapsed =
                getCurrentTimestamp() -
                    (peerLastAdaptationRef.current.get(userId) || 0) >= 5000;
            let nextIndex = currentIndex;

            if (cooldownElapsed && counters.poor >= 2) {
                nextIndex = Math.max(currentIndex - 2, 0);
            } else if (cooldownElapsed && counters.medium >= 2) {
                nextIndex = Math.max(currentIndex - 1, 0);
            } else if (cooldownElapsed && counters.good >= 4) {
                nextIndex = Math.min(currentIndex + 1, maximumIndex);
            }

            if (nextIndex !== currentIndex) {
                counters.good = 0;
                counters.medium = 0;
                counters.poor = 0;
                await applyAdaptiveProfile(userId, peerConnection, nextIndex);
            }
        } catch (error) {
            console.warn("[ScreenShare][Adaptive] Falha no monitor:", userId, error);
        }
    }

    async function startOutgoingStatsMonitor(userId, peerConnection) {
        if (localScreenShareQualityModeRef.current !== "auto") {
            return;
        }

        stopOutgoingStatsMonitor(userId);
        const maximumIndex = getMaximumAdaptiveProfileIndex();
        const supported = await applyAdaptiveProfile(
            userId,
            peerConnection,
            maximumIndex
        );

        if (
            !supported ||
            outgoingPeersRef.current.get(userId) !== peerConnection
        ) {
            return;
        }

        const intervalId = setInterval(() => {
            void collectOutgoingStats(userId, peerConnection);
        }, 2750);

        outgoingStatsIntervalsRef.current.set(userId, intervalId);
        console.log("[ScreenShare][Adaptive] Monitor iniciado:", userId);
    }

    function getPeerStateKey(userId, direction) {
        return `${direction}:${userId}`;
    }

    function cancelPeerDisconnectCleanup(userId, direction) {

        const key = getPeerStateKey(userId, direction);
        const timeoutId = peerDisconnectTimersRef.current.get(key);

        if (timeoutId) {
            clearTimeout(timeoutId);
            peerDisconnectTimersRef.current.delete(key);
        }
    }

    function clearPeerRecoveryState(userId, direction) {

        const key = getPeerStateKey(userId, direction);

        cancelPeerDisconnectCleanup(userId, direction);
        peerRecoveryAttemptsRef.current.delete(key);
        peerRecoveryInProgressRef.current.delete(key);
    }

    function closeOutgoingPeer(userId) {

        const peer =
            outgoingPeersRef.current.get(userId);

        if (!peer) {
            stopOutgoingStatsMonitor(userId);
            return;
        }

        outgoingPeersRef.current.delete(userId);
        clearPeerRecoveryState(userId, "outgoing");
        pendingIceCandidatesRef.current.delete(
            `${userId}:${userIdRef.current}`
        );
        stopOutgoingStatsMonitor(userId);
        refreshAdaptiveStatus();

        screenShareService.closePeerConnection(peer);
    }

    function closeIncomingPeer(
        userId,
        expectedPeer = null
    ) {

        const peer =
            incomingPeersRef.current.get(userId);

        if (
            !peer ||
            (expectedPeer && peer !== expectedPeer)
        ) {
            return;
        }

        incomingPeersRef.current.delete(userId);
        clearPeerRecoveryState(userId, "incoming");

        pendingIceCandidatesRef.current.delete(
            `${userId}:${userId}`
        );

        screenShareService.closePeerConnection(peer);
    }

    function closeAllScreenSharePeers() {

        const outgoingPeers = Array.from(
            outgoingPeersRef.current.values()
        );

        const incomingPeers = Array.from(
            incomingPeersRef.current.values()
        );

        Array.from(outgoingStatsIntervalsRef.current.keys()).forEach(
            userId => stopOutgoingStatsMonitor(userId)
        );

        outgoingPeersRef.current.clear();

        incomingPeersRef.current.clear();

        outgoingPeers.forEach(peer => {
            screenShareService.closePeerConnection(peer);
        });

        incomingPeers.forEach(peer => {
            screenShareService.closePeerConnection(peer);
        });

        pendingIceCandidatesRef.current.clear();

        peerDisconnectTimersRef.current.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });

        peerDisconnectTimersRef.current.clear();
        peerRecoveryAttemptsRef.current.clear();
        peerRecoveryInProgressRef.current.clear();
        outgoingStatsIntervalsRef.current.clear();
        outgoingStatsPreviousRef.current.clear();
        peerQualityProfileRef.current.clear();
        peerQualityCountersRef.current.clear();
        peerLastAdaptationRef.current.clear();
        adaptiveUnsupportedPeersRef.current.clear();
        setAdaptiveStatus(null);
    }

    async function flushPendingIceCandidates(
        peerConnection,
        remoteUserId,
        shareOwnerId = remoteUserId
    ) {

        const pendingKey =
            `${remoteUserId}:${shareOwnerId}`;

        const candidates =
            pendingIceCandidatesRef.current.get(
                pendingKey
            );

        if (!candidates?.length) {
            return;
        }

        for (const candidate of candidates) {

            await screenShareService.addIceCandidate(
                peerConnection,
                candidate
            );
        }

        pendingIceCandidatesRef.current.delete(
            pendingKey
        );
    }

    async function attemptOutgoingPeerRecovery(
        remoteUserId,
        expectedPeer
    ) {

        const key = getPeerStateKey(remoteUserId, "outgoing");
        const peerConnection =
            outgoingPeersRef.current.get(remoteUserId);

        if (
            !peerConnection ||
            peerConnection !== expectedPeer ||
            peerConnection.signalingState === "closed" ||
            peerRecoveryInProgressRef.current.has(key)
        ) {
            return;
        }

        const attempts =
            peerRecoveryAttemptsRef.current.get(key) || 0;

        if (attempts >= 2) {
            console.warn(
                "[ScreenShare] Recovery falhou:",
                remoteUserId
            );
            closeOutgoingPeer(remoteUserId);
            return;
        }

        peerRecoveryAttemptsRef.current.set(key, attempts + 1);
        peerRecoveryInProgressRef.current.add(key);

        console.log(
            "[ScreenShare] ICE restart iniciado:",
            remoteUserId
        );

        try {
            peerConnection.restartIce?.();

            const offer = await screenShareService.createOffer(
                peerConnection,
                { iceRestart: true }
            );

            if (
                outgoingPeersRef.current.get(remoteUserId) !==
                peerConnection
            ) {
                return;
            }

            await screenShareService.sendSignal(
                getActiveChannel(),
                {
                    type: "offer",
                    senderId: userIdRef.current,
                    targetId: remoteUserId,
                    username: usernameRef.current,
                    shareOwnerId: userIdRef.current,
                    iceRestart: true,
                    qualityMode:
                        localScreenShareQualityModeRef.current,
                    streamSettings:
                        localScreenShareSettingsRef.current,
                    offer
                }
            );

            console.log(
                "[ScreenShare] ICE restart concluído:",
                remoteUserId
            );

        } catch (error) {
            console.warn(
                "[ScreenShare] Recovery falhou:",
                remoteUserId,
                error
            );
        } finally {
            peerRecoveryInProgressRef.current.delete(key);

            if (
                outgoingPeersRef.current.get(remoteUserId) ===
                peerConnection &&
                peerConnection.connectionState !== "connected"
            ) {
                schedulePeerDisconnectCleanup(
                    remoteUserId,
                    "outgoing",
                    peerConnection
                );
            }
        }
    }

    function schedulePeerDisconnectCleanup(
        userId,
        direction,
        peerConnection
    ) {

        const key = getPeerStateKey(userId, direction);

        if (peerDisconnectTimersRef.current.has(key)) {
            return;
        }

        console.log(
            "[ScreenShare] Peer temporariamente desconectado:",
            direction,
            userId
        );

        const timeoutId = setTimeout(() => {
            peerDisconnectTimersRef.current.delete(key);

            const peers = direction === "outgoing"
                ? outgoingPeersRef.current
                : incomingPeersRef.current;

            if (
                peers.get(userId) !== peerConnection ||
                ["connected", "completed"].includes(
                    peerConnection.connectionState
                )
            ) {
                return;
            }

            console.warn(
                "[ScreenShare] Peer removido após timeout:",
                direction,
                userId
            );

            if (direction === "outgoing") {
                void attemptOutgoingPeerRecovery(
                    userId,
                    peerConnection
                );
            } else {
                closeIncomingPeer(userId, peerConnection);
                removeRemoteScreenShare(userId);
            }
        }, 5000);

        peerDisconnectTimersRef.current.set(key, timeoutId);
    }

    function handlePeerConnectionState(
        userId,
        direction,
        peerConnection,
        state
    ) {

        const peers = direction === "outgoing"
            ? outgoingPeersRef.current
            : incomingPeersRef.current;

        if (peers.get(userId) !== peerConnection) {
            return;
        }

        if (state === "connected" || state === "completed") {
            const hadTimer = peerDisconnectTimersRef.current.has(
                getPeerStateKey(userId, direction)
            );

            cancelPeerDisconnectCleanup(userId, direction);
            peerRecoveryAttemptsRef.current.delete(
                getPeerStateKey(userId, direction)
            );

            if (hadTimer) {
                console.log(
                    "[ScreenShare] Peer reconectado:",
                    direction,
                    userId
                );
            }
            return;
        }

        if (state === "disconnected") {
            schedulePeerDisconnectCleanup(
                userId,
                direction,
                peerConnection
            );
            return;
        }

        if (state === "failed") {
            cancelPeerDisconnectCleanup(userId, direction);

            if (direction === "outgoing") {
                void attemptOutgoingPeerRecovery(userId, peerConnection);
            } else {
                closeIncomingPeer(userId, peerConnection);
                removeRemoteScreenShare(userId);
            }
            return;
        }

        if (state === "closed") {
            if (direction === "outgoing") {
                closeOutgoingPeer(userId);
            } else {
                closeIncomingPeer(userId, peerConnection);
                removeRemoteScreenShare(userId);
            }
        }
    }

    /*
    ============================================================
    PEER DE SAÍDA
    ============================================================
    */

    async function createOutgoingPeer(remoteUser) {

        const activeChannel =
            getActiveChannel();

        const localStream =
            localScreenStreamRef.current;

        if (
            !activeChannel ||
            !localStream ||
            !remoteUser?.userId
        ) {
            return;
        }

        const remoteUserId =
            remoteUser.userId;

        if (isCurrentUser(remoteUserId)) {
            return;
        }

        if (
            outgoingPeersRef.current.has(
                remoteUserId
            )
        ) {
            return;
        }

        const peerConnection =
            screenShareService.createPeerConnection();

        outgoingPeersRef.current.set(
            remoteUserId,
            peerConnection
        );

        screenShareService.addStreamToPeer(
            peerConnection,
            localStream
        );

        screenShareService.onIceCandidate(
            peerConnection,
            candidate => {

                screenShareService.sendSignal(
                    activeChannel,
                    {
                        type: "ice-candidate",
                        senderId: userIdRef.current,
                        targetId: remoteUserId,
                        shareOwnerId: userIdRef.current,
                        candidate
                    }
                );
            }
        );

        screenShareService.onConnectionStateChange(
            peerConnection,
            state => {
                handlePeerConnectionState(
                    remoteUserId,
                    "outgoing",
                    peerConnection,
                    state
                );
            }
        );

        screenShareService.onIceConnectionStateChange(
            peerConnection,
            state => {
                handlePeerConnectionState(
                    remoteUserId,
                    "outgoing",
                    peerConnection,
                    state
                );
            }
        );

        try {

            const offer =
                await screenShareService.createOffer(
                    peerConnection
                );

            await screenShareService.sendSignal(
                activeChannel,
                {
                    type: "offer",
                    senderId: userIdRef.current,
                    targetId: remoteUserId,
                    username: usernameRef.current,
                    shareOwnerId: userIdRef.current,
                    qualityMode:
                        localScreenShareQualityModeRef.current,
                    streamSettings:
                        localScreenShareSettingsRef.current,
                    offer
                }
            );

            await startOutgoingStatsMonitor(
                remoteUserId,
                peerConnection
            );

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao criar offer:",
                error
            );

            closeOutgoingPeer(
                remoteUserId
            );
        }
    }

    /*
    ============================================================
    INICIAR COMPARTILHAMENTO
    ============================================================
    */

    const isCurrentUserScreenShareBlocked =
        blockedScreenShareParticipants.has(participantId);

    const activeScreenShareCount =
        remoteScreenShares.length + (isScreenSharing ? 1 : 0);

    const isScreenShareLimitReached =
        activeScreenShareCount >= MAX_SIMULTANEOUS_SCREEN_SHARES;

    const screenShareUnavailableReason =
        isCurrentUserScreenShareBlocked
            ? "Compartilhamento desativado pelo host"
            : isScreenShareLimitReached
                ? "Limite de transmissões simultâneas atingido"
                : "";

    function showSharePermissionNotice(message) {
        if (sharePermissionNoticeTimerRef.current) {
            clearTimeout(sharePermissionNoticeTimerRef.current);
        }

        setSharePermissionNotice(message);
        sharePermissionNoticeTimerRef.current = setTimeout(() => {
            setSharePermissionNotice("");
            sharePermissionNoticeTimerRef.current = null;
        }, 5000);
    }

    async function sendScreenShareAdminSignal(type, targetId, targetParticipantId) {
        if (
            !isRoomOwner ||
            !targetId ||
            targetId === userIdRef.current ||
            !["permission-blocked", "permission-unblocked", "force-stop"]
                .includes(type)
        ) {
            return;
        }

        await screenShareService.sendSignal(
            getActiveChannel(),
            {
                type,
                senderId: userIdRef.current,
                targetId,
                targetParticipantId
            }
        );
    }

    async function handleToggleScreenSharePermission(targetParticipant) {
        if (!isRoomOwner) {
            return;
        }

        const targetId = targetParticipant?.userId;
        const targetParticipantId = targetParticipant?.participantId || targetId;
        const shouldUnblock = blockedScreenShareParticipants.has(targetParticipantId);

        setBlockedScreenShareParticipants(previous => {
            const next = new Set(previous);
            if (shouldUnblock) {
                next.delete(targetParticipantId);
            } else {
                next.add(targetParticipantId);
            }
            return next;
        });

        setOpenParticipantMenuId(null);
        const targetConnections = participantsRef.current.filter(
            participant =>
                (participant.participantId || participant.userId) === targetParticipantId
        );

        await Promise.all(targetConnections.map(participant =>
            sendScreenShareAdminSignal(
                shouldUnblock ? "permission-unblocked" : "permission-blocked",
                participant.userId,
                targetParticipantId
            )
        ));
    }

    async function handleForceStopScreenShare(targetId) {
        const isValidRemoteShare = remoteScreenSharesRef.current.some(
            share => share.userId === targetId
        );

        if (
            !isRoomOwner ||
            !targetId ||
            targetId === userIdRef.current ||
            !isValidRemoteShare
        ) {
            return;
        }

        console.log("[ScreenShare] FORCE STOP solicitado", {
            connectionId: userIdRef.current,
            targetId
        });

        await sendScreenShareAdminSignal("force-stop", targetId);
    }

    function handleStartScreenShare() {

        if (isCurrentUserScreenShareBlocked) {
            showSharePermissionNotice(
                "Compartilhamento desativado pelo host."
            );
            return;
        }

        if (isScreenShareLimitReached) {
            showSharePermissionNotice(
                "Limite de transmissões simultâneas atingido."
            );
            return;
        }

        if (
            isScreenSharing ||
            localScreenStreamRef.current ||
            isStoppingScreenShareRef.current
        ) {
            return;
        }

        setScreenShareError("");
        setScreenSelectionError("");
        setShowScreenShareSettings(true);
    }

    function clearPendingScreenShare() {
        screenSelectionRequestRef.current += 1;
        const stream = pendingScreenShareStreamRef.current;

        if (stream) {
            stream.getTracks().forEach(track => {
                track.onended = null;
                track.stop();
            });
        }

        pendingScreenShareStreamRef.current = null;
        setPendingScreenShareStream(null);
        setPendingScreenShareSettings(null);
        setIsSelectingScreen(false);
    }

    function closeScreenShareSettings() {
        if (isStartingScreenShare) {
            return;
        }

        clearPendingScreenShare();
        setScreenSelectionError("");
        setShowScreenShareSettings(false);
    }

    async function selectScreenForSharing() {
        if (blockedScreenShareParticipants.has(participantId)) {
            showSharePermissionNotice("Compartilhamento desativado pelo host.");
            return;
        }

        if (
            remoteScreenShares.length + (isScreenSharing ? 1 : 0) >=
            MAX_SIMULTANEOUS_SCREEN_SHARES
        ) {
            showSharePermissionNotice(
                "Limite de transmissões simultâneas atingido."
            );
            return;
        }

        if (isSelectingScreen || isStartingScreenShare) {
            return;
        }

        clearPendingScreenShare();
        const requestId = screenSelectionRequestRef.current;
        setIsSelectingScreen(true);
        setScreenSelectionError("");

        try {
            console.log("[ScreenShare][AUDIT] getDisplayMedia solicitado", {
                connectionId: userIdRef.current,
                reason: "user-click"
            });

            const stream = await screenShareService.startScreenShare();

            if (screenSelectionRequestRef.current !== requestId) {
                screenShareService.stopScreenShare(stream);
                return;
            }

            const videoTrack = stream.getVideoTracks()[0];

            if (!videoTrack) {
                screenShareService.stopScreenShare(stream);
                throw new Error("NotFoundError");
            }

            pendingScreenShareStreamRef.current = stream;
            setPendingScreenShareStream(stream);
            setPendingScreenShareSettings(videoTrack.getSettings());

            videoTrack.onended = () => {
                if (pendingScreenShareStreamRef.current === stream) {
                    clearPendingScreenShare();
                    setScreenSelectionError(
                        "A captura selecionada foi encerrada. Escolha uma tela novamente."
                    );
                }
            };
        } catch (error) {
            if (screenSelectionRequestRef.current !== requestId) {
                return;
            }

            const messages = {
                NotAllowedError: "O compartilhamento foi cancelado.",
                AbortError: "O compartilhamento foi cancelado.",
                NotFoundError: "Nenhuma tela disponível foi encontrada.",
                NotReadableError: "A tela selecionada não pôde ser capturada.",
                OverconstrainedError: "A configuração escolhida não é suportada."
            };

            setScreenSelectionError(
                messages[error?.name] ||
                messages[error?.message] ||
                "Não foi possível selecionar a tela."
            );
        } finally {
            if (screenSelectionRequestRef.current === requestId) {
                setIsSelectingScreen(false);
            }
        }
    }

    async function confirmStartScreenShare() {

        const selectedStream = pendingScreenShareStreamRef.current;

        if (blockedScreenShareParticipants.has(participantId)) {
            showSharePermissionNotice("Compartilhamento desativado pelo host.");
            closeScreenShareSettings();
            return;
        }

        if (
            remoteScreenShares.length + (isScreenSharing ? 1 : 0) >=
            MAX_SIMULTANEOUS_SCREEN_SHARES
        ) {
            showSharePermissionNotice(
                "Limite de transmissões simultâneas atingido."
            );
            return;
        }

        if (
            isScreenSharing ||
            localScreenStreamRef.current ||
            isStoppingScreenShareRef.current ||
            isStartingScreenShare ||
            !selectedStream
        ) {
            return;
        }

        const activeChannel =
            getActiveChannel();

        if (
            !activeChannel ||
            !realtimeService.isChannelReady(
                activeChannel
            )
        ) {

            setScreenShareError(
                "A conexão da sala ainda não está pronta."
            );

            return;
        }

        setScreenShareError("");
        setIsStartingScreenShare(true);

        try {

            const stream = selectedStream;
            const videoTrack = stream.getVideoTracks()[0];
            const quality = screenShareQuality === "720p"
                ? { width: 1280, height: 720 }
                : { width: 1920, height: 1080 };

            if (videoTrack?.applyConstraints) {
                try {
                    await videoTrack.applyConstraints({
                        width: { ideal: quality.width },
                        height: { ideal: quality.height },
                        frameRate: { ideal: screenShareFps }
                    });
                } catch (error) {
                    console.warn(
                        "[ScreenShare] Preferências de qualidade não aplicadas:",
                        error
                    );
                }
            }

            if (
                pendingScreenShareStreamRef.current !== stream ||
                videoTrack?.readyState !== "live"
            ) {
                throw new DOMException(
                    "A captura foi encerrada antes da confirmação.",
                    "AbortError"
                );
            }

            const actualSettings = {
                ...(videoTrack?.getSettings?.() || {}),
                selectedQuality: screenShareQuality,
                selectedFps: screenShareFps,
                qualityMode: screenShareQualityMode
            };

            pendingScreenShareStreamRef.current = null;
            setPendingScreenShareStream(null);
            setPendingScreenShareSettings(null);

            localScreenStreamRef.current =
                stream;
            localScreenShareOwnerRef.current = userIdRef.current;

            console.log("[ScreenShare][AUDIT] localScreenStream definida", {
                connectionId: userIdRef.current
            });

            localScreenShareSettingsRef.current = actualSettings;
            localScreenShareQualityModeRef.current = screenShareQualityMode;
            setLocalScreenShareSettings(actualSettings);

            setIsScreenSharing(true);

            if (videoTrack) {

                videoTrack.onended =
                    () => {

                        void handleStopScreenShare();

                    };
            }

            await screenShareService.sendSignal(
                activeChannel,
                {
                    type: "started",
                    senderId: userIdRef.current,
                    username: usernameRef.current,
                    qualityMode: screenShareQualityMode,
                    streamSettings: actualSettings
                }
            );

            const otherParticipants =
                participants.filter(
                    participant =>
                        participant.userId !==
                        userIdRef.current
                );

            for (const participant of otherParticipants) {

                await createOutgoingPeer(
                    participant
                );
            }

            setShowScreenShareSettings(false);

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao iniciar:",
                error
            );

            setScreenShareError(
                error?.name === "NotAllowedError"
                    ? "O compartilhamento de tela foi cancelado."
                    : "Não foi possível iniciar o compartilhamento de tela."
            );

            localScreenStreamRef.current = null;
            localScreenShareOwnerRef.current = null;

            screenShareService.stopScreenShare(selectedStream);
            localScreenShareSettingsRef.current = null;
            setLocalScreenShareSettings(null);

            setIsScreenSharing(false);
        } finally {
            setIsStartingScreenShare(false);
        }
    }

    /*
    ============================================================
    PARAR COMPARTILHAMENTO
    ============================================================
    */

    async function handleStopScreenShare() {

        if (isStoppingScreenShareRef.current) {
            return;
        }

        const activeChannel =
            getActiveChannel();

        const stream =
            localScreenStreamRef.current;

        if (
            !stream ||
            localScreenShareOwnerRef.current !== userIdRef.current
        ) {
            return;
        }

        console.log("[ScreenShare] STOP LOCAL solicitado", {
            connectionId: userIdRef.current,
            activeScreenShareId,
            hasLocalStream: true
        });

        isStoppingScreenShareRef.current = true;

        try {
            localScreenStreamRef.current = null;
            localScreenShareOwnerRef.current = null;

            localScreenShareSettingsRef.current = null;
            setLocalScreenShareSettings(null);

            setIsScreenSharing(false);

            stream.getTracks().forEach(track => {
                track.onended = null;
            });

            screenShareService.stopScreenShare(stream);

            Array.from(outgoingPeersRef.current.keys()).forEach(
                remoteUserId => closeOutgoingPeer(remoteUserId)
            );

            if (
                activeChannel &&
                realtimeService.isChannelReady(activeChannel)
            ) {
                await screenShareService.sendSignal(
                    activeChannel,
                    {
                        type: "stopped",
                        senderId: userIdRef.current
                    }
                );
            }
        } finally {
            isStoppingScreenShareRef.current = false;
        }
    }

    /*
    ============================================================
    OFFER RECEBIDA
    ============================================================
    */

    async function handleIncomingOffer(signal) {

        const activeChannel =
            getActiveChannel();

        if (!activeChannel || !signal) {
            return;
        }

        if (
            signal.targetId !==
            userIdRef.current
        ) {
            return;
        }

        const remoteUserId =
            signal.senderId;

        remoteShareUsernamesRef.current.set(
            remoteUserId,
            signal.username || "Participante"
        );

        if (signal.streamSettings) {
            remoteStreamSettingsRef.current.set(
                remoteUserId,
                signal.streamSettings
            );
        }

        const existingPeer =
            incomingPeersRef.current.get(remoteUserId);

        const canReusePeer = Boolean(
            existingPeer &&
            existingPeer.signalingState !== "closed" &&
            existingPeer.connectionState !== "closed" &&
            existingPeer.connectionState !== "failed"
        );

        if (existingPeer && !canReusePeer) {
            closeIncomingPeer(remoteUserId, existingPeer);
        }

        const peerConnection = canReusePeer
            ? existingPeer
            : screenShareService.createPeerConnection();

        if (!canReusePeer) {
            incomingPeersRef.current.set(
                remoteUserId,
                peerConnection
            );

            screenShareService.onRemoteStream(
                peerConnection,
                stream => {

                    console.log("[ScreenShare][AUDIT] remote stream recebida", {
                        connectionId: userIdRef.current,
                        senderId: remoteUserId
                    });

                    addRemoteScreenShare(
                        remoteUserId,
                        signal.username,
                        stream,
                        signal.streamSettings
                    );

                    stream.getTracks().forEach(track => {
                        track.onended = () => {
                            console.log(
                                "[ScreenShare] Track remota encerrada:",
                                remoteUserId,
                                track.kind
                            );

                            queueMicrotask(() => {
                                if (
                                    incomingPeersRef.current.get(remoteUserId) ===
                                        peerConnection &&
                                    stream.getTracks().every(
                                        item => item.readyState === "ended"
                                    )
                                ) {
                                    closeIncomingPeer(
                                        remoteUserId,
                                        peerConnection
                                    );
                                    removeRemoteScreenShare(remoteUserId);
                                }
                            });
                        };
                    });
                }
            );

            screenShareService.onIceCandidate(
                peerConnection,
                candidate => {

                    screenShareService.sendSignal(
                        activeChannel,
                        {
                            type: "ice-candidate",
                            senderId: userIdRef.current,
                            targetId: remoteUserId,
                            shareOwnerId: remoteUserId,
                            candidate
                        }
                    );
                }
            );

            screenShareService.onConnectionStateChange(
                peerConnection,
                state => {
                    handlePeerConnectionState(
                        remoteUserId,
                        "incoming",
                        peerConnection,
                        state
                    );
                }
            );

            screenShareService.onIceConnectionStateChange(
                peerConnection,
                state => {
                    handlePeerConnectionState(
                        remoteUserId,
                        "incoming",
                        peerConnection,
                        state
                    );
                }
            );
        }

        try {

            const answer =
                await screenShareService.createAnswer(
                    peerConnection,
                    signal.offer
                );

            await flushPendingIceCandidates(
                peerConnection,
                remoteUserId,
                remoteUserId
            );

            await screenShareService.sendSignal(
                activeChannel,
                {
                    type: "answer",
                    senderId: userIdRef.current,
                    targetId: remoteUserId,
                    shareOwnerId: remoteUserId,
                    answer
                }
            );

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao processar offer:",
                error
            );

            closeIncomingPeer(
                remoteUserId,
                peerConnection
            );
        }
    }

    /*
    ============================================================
    ANSWER RECEBIDA
    ============================================================
    */

    async function handleIncomingAnswer(signal) {

        if (
            signal.targetId !==
            userIdRef.current
        ) {
            return;
        }

        const remoteUserId =
            signal.senderId;

        const peerConnection =
            outgoingPeersRef.current.get(
                remoteUserId
            );

        if (!peerConnection) {
            return;
        }

        try {

            await screenShareService.setRemoteAnswer(
                peerConnection,
                signal.answer
            );

            await flushPendingIceCandidates(
                peerConnection,
                remoteUserId,
                userIdRef.current
            );

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao aplicar answer:",
                error
            );
        }
    }

    /*
    ============================================================
    ICE RECEBIDO
    ============================================================
    */

    async function handleIncomingIceCandidate(signal) {

        if (
            signal.targetId !==
            userIdRef.current
        ) {
            return;
        }

        const remoteUserId =
            signal.senderId;

        const shareOwnerId =
            signal.shareOwnerId;

        const peerConnection = shareOwnerId
            ? shareOwnerId === userIdRef.current
                ? outgoingPeersRef.current.get(remoteUserId)
                : incomingPeersRef.current.get(remoteUserId)
            : outgoingPeersRef.current.get(remoteUserId) ||
                incomingPeersRef.current.get(remoteUserId);

        const pendingKey =
            `${remoteUserId}:${shareOwnerId || remoteUserId}`;

        if (!peerConnection) {

            const pending =
                pendingIceCandidatesRef.current.get(
                    pendingKey
                ) || [];

            pending.push(
                signal.candidate
            );

                pendingIceCandidatesRef.current.set(
                    pendingKey,
                    pending
            );

            return;
        }

        if (!peerConnection.remoteDescription) {

            const pending =
                pendingIceCandidatesRef.current.get(
                    pendingKey
                ) || [];

            pending.push(
                signal.candidate
            );

                pendingIceCandidatesRef.current.set(
                    pendingKey,
                    pending
            );

            return;
        }

        try {

            await screenShareService.addIceCandidate(
                peerConnection,
                signal.candidate
            );

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao adicionar ICE:",
                error
            );
        }
    }

    /*
    ============================================================
    SIGNALING
    ============================================================
    */

    async function handleScreenShareSignal(signal) {

        if (!signal) {
            return;
        }

        if (
            signal.senderId ===
            userIdRef.current
        ) {
            return;
        }

        if (
            signal.targetId &&
            signal.targetId !==
            userIdRef.current
        ) {
            return;
        }

        try {

            const isAdministrativeSignal = [
                "permission-blocked",
                "permission-unblocked",
                "force-stop"
            ].includes(signal.type);

            if (isAdministrativeSignal) {
                const senderIsHost = participantsRef.current.some(
                    participant =>
                        participant.userId === signal.senderId &&
                        participant.isHost === true
                );

                if (
                    !signal.senderId ||
                    !signal.targetId ||
                    !senderIsHost ||
                    (signal.targetParticipantId && signal.targetParticipantId !== participantId)
                ) {
                    console.warn(
                        "[ScreenShare] Controle administrativo inválido ignorado."
                    );
                    return;
                }
            }

            switch (signal.type) {

                case "permission-blocked":
                    clearPendingScreenShare();
                    setShowScreenShareSettings(false);
                    setBlockedScreenShareParticipants(previous => {
                        const next = new Set(previous);
                        next.add(participantId);
                        return next;
                    });
                    showSharePermissionNotice(
                        "Compartilhamento desativado pelo host."
                    );
                    break;

                case "permission-unblocked":
                    setBlockedScreenShareParticipants(previous => {
                        const next = new Set(previous);
                        next.delete(participantId);
                        return next;
                    });
                    showSharePermissionNotice(
                        "O host permitiu seu compartilhamento."
                    );
                    break;

                case "force-stop":
                    clearPendingScreenShare();
                    setShowScreenShareSettings(false);
                    await handleStopScreenShare();
                    showSharePermissionNotice(
                        "O host encerrou seu compartilhamento."
                    );
                    break;

                case "started":

                    remoteShareUsernamesRef.current.set(
                        signal.senderId,
                        signal.username || "Participante"
                    );

                    if (signal.streamSettings) {
                        remoteStreamSettingsRef.current.set(
                            signal.senderId,
                            signal.streamSettings
                        );
                    }

                    if (
                        !announcedRemoteSharesRef.current.has(
                            signal.senderId
                        )
                    ) {
                        announcedRemoteSharesRef.current.add(
                            signal.senderId
                        );

                        void playScreenShareStartedSound();
                    }

                    break;

                case "offer":

                    await handleIncomingOffer(
                        signal
                    );

                    break;

                case "answer":

                    await handleIncomingAnswer(
                        signal
                    );

                    break;

                case "ice-candidate":

                    await handleIncomingIceCandidate(
                        signal
                    );

                    break;

                case "stopped":

                    closeIncomingPeer(
                        signal.senderId
                    );

                    removeRemoteScreenShare(
                        signal.senderId
                    );

                    break;

                default:

                    console.warn(
                        "[ScreenShare] Sinal desconhecido:",
                        signal.type
                    );
            }

        } catch (error) {

            console.error(
                "[ScreenShare] Erro no signaling:",
                error
            );
        }
    }

    /*
    ============================================================
    PARTICIPANTE ENTROU
    ============================================================
    */

    async function handleParticipantJoin(payload) {
        const joins =
            payload?.newPresences || [];

        for (const joinedUser of joins) {

            if (!joinedUser?.userId) {
                continue;
            }

            if (
                joinedUser.userId ===
                userIdRef.current
            ) {
                continue;
            }

            const joinedParticipantId = joinedUser.participantId || joinedUser.userId;

            if (
                isRoomOwner &&
                blockedScreenShareParticipantsRef.current.has(joinedParticipantId)
            ) {
                await sendScreenShareAdminSignal(
                    "permission-blocked",
                    joinedUser.userId,
                    joinedParticipantId
                );
            }

            if (!localScreenStreamRef.current) {
                continue;
            }

            await createOutgoingPeer(
                joinedUser
            );
        }
    }

    function handleParticipantLeave(payload) {

        const leftPresences =
            payload?.leftPresences || [];

        leftPresences.forEach(leftUser => {

            const leftUserId = leftUser?.userId;

            if (!leftUserId || isCurrentUser(leftUserId)) {
                return;
            }

            if (leftUser.isHost) {
                setBlockedScreenShareParticipants(new Set());
            }

            closeIncomingPeer(leftUserId);
            closeOutgoingPeer(leftUserId);
            removeRemoteScreenShare(leftUserId);

            setOpenParticipantMenuId(current =>
                current === leftUserId ? null : current
            );

            Array.from(
                pendingIceCandidatesRef.current.keys()
            ).forEach(key => {
                if (key.startsWith(`${leftUserId}:`)) {
                    pendingIceCandidatesRef.current.delete(key);
                }
            });
        });
    }

    /*
    ============================================================
    CARREGAR SALA
    ============================================================
    */

    useEffect(() => {

        let isActive = true;

        async function loadRoom() {

            setIsLoading(true);

            try {

                const [foundRoom, session] = await Promise.all([
                    getRoomById(roomId),
                    realtimeService.ensureAnonymousSession()
                ]);

                if (!isActive) {
                    return;
                }

                setRoom(
                    foundRoom || null
                );

                setAuthUserId(session?.user?.id || null);

            } catch (error) {

                console.error(
                    "[Supabase] Erro ao carregar sala:",
                    error
                );

                if (isActive) {
                    setRoom(null);
                }

            } finally {

                if (isActive) {
                    setIsLoading(false);
                }
            }
        }

        if (roomId) {
            loadRoom();
        } else {
            queueMicrotask(() => {

                if (!isActive) {
                    return;
                }

                setRoom(null);
                setIsLoading(false);
            });
        }

        return () => {
            isActive = false;
        };

    }, [roomId]);

    useEffect(() => {

        if (!openParticipantMenuId) {
            return;
        }

        function closeParticipantMenu(event) {
            if (event.type === "keydown" && event.key !== "Escape") {
                return;
            }
            setOpenParticipantMenuId(null);
        }

        document.addEventListener("pointerdown", closeParticipantMenu);
        document.addEventListener("keydown", closeParticipantMenu);

        return () => {
            document.removeEventListener("pointerdown", closeParticipantMenu);
            document.removeEventListener("keydown", closeParticipantMenu);
        };

    }, [openParticipantMenuId]);

    useEffect(() => {

        return () => {
            if (sharePermissionNoticeTimerRef.current) {
                clearTimeout(sharePermissionNoticeTimerRef.current);
            }
        };

    }, []);

    useEffect(() => {
        if (!showRoomInfo) {
            return;
        }

        function handleRoomInfoKeyDown(event) {
            if (event.key === "Escape") {
                setShowRoomInfo(false);
            }
        }

        document.addEventListener("keydown", handleRoomInfoKeyDown);
        return () => document.removeEventListener("keydown", handleRoomInfoKeyDown);
    }, [showRoomInfo]);

    useEffect(() => {

        if (!showScreenShareSettings) {
            return;
        }

        function handleModalKeyDown(event) {
            if (event.key === "Escape") {
                closeScreenShareSettings();
            }
        }

        document.addEventListener("keydown", handleModalKeyDown);

        return () => {
            document.removeEventListener("keydown", handleModalKeyDown);
        };

    }, [showScreenShareSettings, closeScreenShareSettings]);

    useEffect(() => {

        function handlePageExit() {

            screenSelectionRequestRef.current += 1;

            const pendingStream = pendingScreenShareStreamRef.current;

            if (pendingStream) {
                screenShareService.stopScreenShare(pendingStream);
                pendingScreenShareStreamRef.current = null;
            }

            const localStream = localScreenStreamRef.current;

            if (localStream) {
                localStream.getTracks().forEach(track => {
                    track.onended = null;
                });
                screenShareService.stopScreenShare(localStream);
                localScreenStreamRef.current = null;
                localScreenShareOwnerRef.current = null;
            }

            closeAllScreenSharePeers();
        }

        window.addEventListener("pagehide", handlePageExit);
        window.addEventListener("beforeunload", handlePageExit);

        return () => {
            window.removeEventListener("pagehide", handlePageExit);
            window.removeEventListener("beforeunload", handlePageExit);
            handlePageExit();
        };

    }, []);

    /*
    ============================================================
    SUPABASE REALTIME
    ============================================================
    */

    useEffect(() => {

        if (
            !roomId ||
            !room?.ownerId ||
            !authUserId ||
            !identityReady ||
            room.id !== roomId
        ) {
            return;
        }

        const presenceIsHost =
            authUserId === room.ownerId;

        if (isConnectingRef.current) {
            return;
        }

        let isActive = true;

        const remoteShareUsernames =
            remoteShareUsernamesRef.current;

        const announcedRemoteShares =
            announcedRemoteSharesRef.current;

        const remoteStreamSettings =
            remoteStreamSettingsRef.current;

        isConnectingRef.current = true;
        setConnectionStatus(navigator.onLine ? "connecting" : "offline");

        const channel =
            realtimeService.createRoomChannel(
                roomId
            );

        channelRef.current = channel;

        const removeConnectionStatusListener = realtimeService.onConnectionStatus(
            channel,
            status => {
                if (isActive && navigator.onLine) {
                    setConnectionStatus(status);
                }
            }
        );

        /*
        CHAT
        */

        realtimeService.onChatMessage(
            channel,
            message => {

                if (!isActive || !message) {
                    return;
                }

                setMessages(previous => {

                    const exists =
                        previous.some(
                            item =>
                                item.id ===
                                message.id
                        );

                    if (exists) {
                        return previous;
                    }

                    return [
                        ...previous,
                        message
                    ];
                });
            }
        );

        /*
        PRESENÇA
        */

        realtimeService.onPresenceChange(
            channel,
            state => {

                if (!isActive) {
                    return;
                }

                const users = [];

                Object.entries(
                    state || {}
                ).forEach(
                    ([key, entries]) => {

                        if (
                            !Array.isArray(entries)
                        ) {
                            return;
                        }

                        entries.forEach(user => {

                            if (!user) {
                                return;
                            }

                            users.push({
                                ...user,
                                presenceKey: key
                            });
                        });
                    }
                );

                const uniqueUsers =
                    users.filter(
                        (
                            user,
                            index,
                            array
                        ) =>
                            index ===
                            array.findIndex(
                                item =>
                                    item.userId ===
                                    user.userId
                            )
                    );

                setParticipants(
                    uniqueUsers
                );

                participantsRef.current = uniqueUsers;

                setRemoteScreenShares(previous => {
                    const renamedShares = previous.map(share => {
                    const participant = uniqueUsers.find(
                        user => user.userId === share.userId
                    );
                    return participant?.username && participant.username !== share.username
                        ? { ...share, username: participant.username }
                        : share;
                    });
                    remoteScreenSharesRef.current = renamedShares;
                    return renamedShares;
                });

                const hasCurrentUser = uniqueUsers.some(
                    user => user.userId === userIdRef.current
                );

                if (
                    !hasCurrentUser &&
                    hasTrackedPresenceRef.current &&
                    !isRetrackingPresenceRef.current &&
                    realtimeService.isChannelReady(channel)
                ) {
                    isRetrackingPresenceRef.current = true;

                    void realtimeService.trackPresence(
                        channel,
                        {
                            userId: userIdRef.current,
                            participantId,
                            username: usernameRef.current,
                            isHost: presenceIsHost
                        }
                    ).catch(error => {
                        console.warn(
                            "[Presence] Falha ao restaurar presença:",
                            error
                        );
                    }).finally(() => {
                        isRetrackingPresenceRef.current = false;
                    });
                }
            }
        );

        /*
        PARTICIPANTE ENTROU
        */

        realtimeService.onPresenceJoin(
            channel,
            payload => {

                if (!isActive) {
                    return;
                }

                handleParticipantJoin(
                    payload
                );
            }
        );

        realtimeService.onPresenceLeave(
            channel,
            payload => {

                if (!isActive) {
                    return;
                }

                handleParticipantLeave(payload);
            }
        );

        /*
        SIGNALING
        */

        screenShareService.onSignal(
            channel,
            signal => {

                if (!isActive) {
                    return;
                }

                handleScreenShareSignal(
                    signal
                );
            }
        );

        /*
        CONECTAR
        */

        realtimeService
            .connect(channel)
            .then(async () => {

                if (!isActive) {
                    return;
                }

                const currentUser = {
                    userId:
                        userIdRef.current,
                    participantId,
                    username:
                        usernameRef.current,
                    isHost:
                        presenceIsHost
                };

                try {

                    const existingPresence = Object.values(
                        channel.presenceState?.() || {}
                    ).flat().filter(Boolean);
                    const alreadyPresent = existingPresence.some(
                        participant => participant.userId === userIdRef.current
                    );

                    if (
                        !alreadyPresent &&
                        Number(room.maxUsers) > 0 &&
                        existingPresence.length >= Number(room.maxUsers)
                    ) {
                        setRoomFull(true);
                        setConnectionStatus("connected");
                        return;
                    }

                    await realtimeService.trackPresence(
                        channel,
                        currentUser
                    );

                    hasTrackedPresenceRef.current = true;
                    setRoomFull(false);
                    setConnectionStatus("connected");

                } catch (error) {

                    console.error(
                        "[Presence] Erro:",
                        error
                    );
                }

            })
            .catch(error => {

                if (!isActive) {
                    return;
                }

                console.error(
                    "[Realtime] Erro ao conectar:",
                    error
                );
                setConnectionStatus(navigator.onLine ? "error" : "offline");

            })
            .finally(() => {

                if (isActive) {
                    isConnectingRef.current =
                        false;
                }
            });

        /*
        CLEANUP
        */

        return () => {

            isActive = false;

            isConnectingRef.current =
                false;

            isRetrackingPresenceRef.current = false;
            hasTrackedPresenceRef.current = false;

            removeConnectionStatusListener();

            if (
                localScreenStreamRef.current
            ) {

                screenShareService.stopScreenShare(
                    localScreenStreamRef.current
                );

                localScreenStreamRef.current =
                    null;
                localScreenShareOwnerRef.current = null;
            }

            closeAllScreenSharePeers();

            setIsScreenSharing(false);

            setRemoteScreenShares([]);

            remoteScreenSharesRef.current = [];

            setActiveScreenShareId(null);

            remoteShareUsernames.clear();

            announcedRemoteShares.clear();

            remoteStreamSettings.clear();

            localScreenShareSettingsRef.current = null;

            setParticipants([]);
            setConnectionStatus(navigator.onLine ? "reconnecting" : "offline");

            if (
                channelRef.current ===
                channel
            ) {

                realtimeService.disconnect(
                    channel
                );

                channelRef.current = null;
            }
        };

    }, [roomId, room, authUserId, identityReady, participantId]);

    /*
    ============================================================
    CHAT
    ============================================================
    */

    async function handleSendMessage(event) {

        event.preventDefault();

        const text =
            chatMessage.trim();

        if (!text) {
            return;
        }

        if (text.length > 500) {
            setChatError("A mensagem pode ter no máximo 500 caracteres.");
            return;
        }

        const now = Date.now();
        if (now - lastMessageSentAtRef.current < 400) {
            setChatError("Aguarde um instante antes de enviar outra mensagem.");
            return;
        }

        const activeChannel =
            channelRef.current;

        if (!activeChannel) {
            setChatError("Não foi possível enviar: sala desconectada.");
            return;
        }

        const message = {
            id:
                crypto.randomUUID(),
            userId:
                userIdRef.current,
            participantId,
            username:
                usernameRef.current,
            message:
                text,
            timestamp:
                Date.now()
        };

        try {

            const result = await realtimeService.sendChatMessage(
                activeChannel,
                message
            );

            if (result !== "ok") {
                throw new Error("O Realtime não confirmou o envio.");
            }

            setMessages(previous => {

                const exists =
                    previous.some(
                        item =>
                            item.id ===
                            message.id
                    );

                if (exists) {
                    return previous;
                }

                return [
                    ...previous,
                    message
                ];
            });

            setChatMessage("");
            setChatError("");
            lastMessageSentAtRef.current = Date.now();
            shouldAutoScrollChatRef.current = true;

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar chat:",
                error
            );
            setChatError("Não foi possível enviar a mensagem. Tente novamente.");
        }
    }

    /*
    ============================================================
    NAVEGAÇÃO
    ============================================================
    */

    function handleGoHome() {
        navigate("/");
    }

    async function handleLeaveRoom() {
        screenSelectionRequestRef.current += 1;

        if (pendingScreenShareStreamRef.current) {
            screenShareService.stopScreenShare(pendingScreenShareStreamRef.current);
            pendingScreenShareStreamRef.current = null;
            setPendingScreenShareStream(null);
        }

        if (localScreenStreamRef.current) {
            await handleStopScreenShare();
        }

        closeAllScreenSharePeers();

        const activeChannel = channelRef.current;
        channelRef.current = null;
        if (activeChannel) {
            await realtimeService.disconnect(activeChannel);
        }

        navigate("/");
    }

    /*
    ============================================================
    LOADING
    ============================================================
    */

    if (isLoading) {

        return (
            <main className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.loadingSpinner} />
                    <p>Entrando na sala...</p>
                </div>
            </main>
        );
    }

    /*
    ============================================================
    SALA NÃO ENCONTRADA
    ============================================================
    */

    if (!room) {

        return (
            <main className={styles.page}>
                <div className={styles.notFound}>
                    <div className={styles.notFoundIcon}>
                        🎬
                    </div>

                    <h1>Sala não encontrada</h1>

                    <p>
                        A sala que você tentou acessar
                        não existe ou foi removida.
                    </p>

                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleGoHome}
                    >
                        Voltar para o início
                    </button>
                </div>
            </main>
        );
    }

    /*
    ============================================================
    INTERFACE
    ============================================================
    */

    if (roomFull) {
        return (
            <main className={styles.page}>
                <div className={styles.notFound} role="status">
                    <div className={styles.notFoundIcon}>👥</div>
                    <h1>Sala cheia</h1>
                    <p>Esta sala atingiu o limite de participantes. Tente novamente mais tarde.</p>
                    <button type="button" className={styles.primaryButton} onClick={handleGoHome}>
                        Voltar para o início
                    </button>
                </div>
            </main>
        );
    }

    const currentUser =
        participants.find(
            participant =>
                participant.userId ===
                connectionId
        );

    const participantCount =
        participants.length;

    const hostName = participants.find(participant => participant.isHost)?.username ||
        (isRoomOwner ? username : "Host ausente");

    const connectionLabels = {
        connecting: "Conectando...",
        connected: "Conectado",
        reconnecting: "Reconectando...",
        offline: "Você está offline.",
        error: "Erro de conexão"
    };

    return (
        <main className={styles.page}>

            {/* ==================================================
                TOPBAR
            ================================================== */}

            <header className={styles.topbar}>

                <div className={styles.topbarLeft}>

                    <div className={styles.brand}>

                        <div className={styles.brandLogo}>
                            ▶
                        </div>

                        <div className={styles.brandText}>
                            WatchParty
                        </div>

                    </div>

                    <div className={styles.topbarDivider} />

                    <div className={styles.roomTitle}>

                        <span className={styles.roomTitleIcon}>
                            #
                        </span>

                        <span>
                            {room.name}
                        </span>

                    </div>

                </div>

                <div className={styles.topbarCenter}>

                    <div className={styles.connectionStatus} role="status" aria-live="polite">
                        <span className={`${styles.connectionDot} ${styles[`connectionDot_${connectionStatus}`] || ""}`} />
                        {connectionLabels[connectionStatus]}
                    </div>

                    <div className={styles.memberCount}>
                        <span>●</span>
                        {participantCount}/{room.maxUsers}
                    </div>

                </div>

                <div className={styles.topbarActions}>

                    <button
                        type="button"
                        className={`${styles.topbarButton} ${
                            copyStatus === "success"
                                ? styles.successButton
                                : ""
                        }`}
                        onClick={handleCopyRoomLink}
                    >

                        <span className={styles.buttonIcon}>
                            {copyStatus === "success"
                                ? "✓"
                                : "🔗"}
                        </span>

                        <span className={styles.desktopOnly}>
                            {copyStatus === "success"
                                ? "Link copiado"
                                : "Convidar"}
                        </span>

                    </button>

                    {canNativeShare && (
                        <button
                            type="button"
                            className={styles.topbarButton}
                            onClick={handleNativeShare}
                        >
                            <span className={styles.buttonIcon}>
                                ↗
                            </span>

                            <span className={styles.desktopOnly}>
                                Compartilhar
                            </span>
                        </button>
                    )}

                    <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Configurações"
                        onClick={() => setShowRoomInfo(true)}
                    >
                        ⚙
                    </button>

                    <button
                        type="button"
                        className={`${styles.topbarButton} ${styles.leaveButton}`}
                        onClick={() => void handleLeaveRoom()}
                        aria-label="Sair da sala"
                    >
                        <span className={styles.buttonIcon}>↪</span>
                        <span className={styles.desktopOnly}>Sair</span>
                    </button>

                </div>

            </header>

            {/* ==================================================
                LAYOUT PRINCIPAL
            ================================================== */}

            <div className={styles.layout}>

                {/* ==================================================
                    SIDEBAR ESQUERDA
                ================================================== */}

                <aside className={`${styles.leftSidebar} ${
                    showParticipants ? styles.mobileParticipantsOpen : ""
                }`}>

                    <div className={styles.sidebarHeader}>

                        <div>
                            <span className={styles.sidebarTitle}>
                                PARTICIPANTES
                            </span>

                            <span className={styles.sidebarCount}>
                                {participantCount}
                            </span>
                        </div>

                    </div>

                    <div className={styles.participantsList}>

                        {participants.length === 0 ? (

                            <div className={styles.emptyParticipants}>
                                <span>👥</span>
                                <p>
                                    Ninguém está na sala.
                                </p>
                            </div>

                        ) : (

                            participants.map(
                                participant => {

                                    const isUser =
                                        participant.userId ===
                                        connectionId;

                                    const isSharing =
                                        (isUser && isScreenSharing) ||
                                        remoteScreenShares.some(
                                            share =>
                                                share.userId ===
                                                participant.userId
                                        );

                                    const initial =
                                        participant.username
                                            ?.charAt(0)
                                            ?.toUpperCase() ||
                                        "U";

                                    return (
                                        <div
                                            key={participant.userId}
                                            className={styles.participant}
                                        >

                                            <div
                                                className={
                                                    styles.avatarWrapper
                                                }
                                            >

                                                <div
                                                    className={
                                                        styles.avatar
                                                    }
                                                >
                                                    {initial}
                                                </div>

                                                <span
                                                    className={
                                                        styles.onlineIndicator
                                                    }
                                                />

                                            </div>

                                            <div
                                                className={
                                                    styles.participantDetails
                                                }
                                            >

                                                <div
                                                    className={
                                                        styles.participantName
                                                    }
                                                >

                                                    <span>
                                                        {
                                                            participant.username
                                                        }
                                                    </span>

                                                    {isUser && (
                                                        <span
                                                            className={
                                                                styles.youBadge
                                                            }
                                                        >
                                                            Você
                                                        </span>
                                                    )}

                                                    {participant.isHost && (
                                                        <span className={styles.hostBadge}>
                                                            HOST
                                                        </span>
                                                    )}

                                                </div>

                                                {isSharing && (
                                                    <span
                                                        className={
                                                            styles.streamingLabel
                                                        }
                                                    >
                                                        🖥 Compartilhando tela
                                                    </span>
                                                )}

                                            </div>

                                            {isRoomOwner && !isUser && (
                                                <div
                                                    className={styles.participantActions}
                                                    onPointerDown={event => event.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        className={styles.participantMenuButton}
                                                        onClick={() => {
                                                            setOpenParticipantMenuId(current =>
                                                                current === participant.userId
                                                                    ? null
                                                                    : participant.userId
                                                            );
                                                        }}
                                                        aria-label={`Ações de ${participant.username}`}
                                                        aria-expanded={
                                                            openParticipantMenuId ===
                                                            participant.userId
                                                        }
                                                    >
                                                        ⋯
                                                    </button>

                                                    {openParticipantMenuId === participant.userId && (
                                                        <div className={styles.participantAdminMenu}>
                                                            <button
                                                                type="button"
                                                                className={styles.participantAdminAction}
                                                                onClick={() =>
                                                                    void handleToggleScreenSharePermission(
                                                                        participant
                                                                    )
                                                                }
                                                            >
                                                                {blockedScreenShareParticipants.has(
                                                                    participant.participantId || participant.userId
                                                                )
                                                                    ? "Permitir compartilhamento"
                                                                    : "Bloquear compartilhamento"}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    );
                                }
                            )
                        )}

                    </div>

                    <div className={styles.currentUser}>

                        <div className={styles.currentUserAvatar}>
                            {
                                currentUser?.username
                                    ?.charAt(0)
                                    ?.toUpperCase()
                                || "U"
                            }

                            <span
                                className={
                                    styles.currentUserStatus
                                }
                            />
                        </div>

                        <div className={styles.currentUserInfo}>

                            <strong>
                                {username}
                            </strong>

                            <span>
                                Online
                            </span>

                        </div>

                        <button
                            type="button"
                            className={styles.editUsernameButton}
                            onClick={openUsernameEditor}
                            aria-label="Editar nome"
                            title="Editar nome"
                        >
                            ✎
                        </button>

                    </div>

                </aside>

                {/* ==================================================
                    ÁREA CENTRAL
                ================================================== */}

                <section className={styles.mainArea}>

                    <div
                        ref={playerContainerRef}
                        className={styles.screenArea}
                        onMouseMove={resetControlsTimeout}
                        onMouseEnter={() =>
                            setShowControls(true)
                        }
                    >

                        {remoteScreenStream ? (

                            <>

                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={
                                        styles.screenVideo
                                    }
                                    onPlay={() =>
                                        setIsPlaying(true)
                                    }
                                    onPause={() =>
                                        setIsPlaying(false)
                                    }
                                />

                                {/* TRANSMISSOR */}

                                <div
                                    className={
                                        styles.streamInfo
                                    }
                                >

                                    <div
                                        className={
                                            styles.liveDot
                                        }
                                    />

                                    <span>
                                        AO VIVO
                                    </span>

                                    <div
                                        className={
                                            styles.streamInfoDivider
                                        }
                                    />

                                    <strong>
                                        {
                                            activeScreenShare?.username ||
                                            "Participante"
                                        }
                                    </strong>

                                    <span>
                                        está compartilhando a tela
                                    </span>

                                    {connectionQuality && (
                                        <span
                                            className={`${styles.connectionQuality} ${
                                                styles[
                                                    `connection${connectionQuality.level
                                                        .charAt(0)
                                                        .toUpperCase()}${connectionQuality.level.slice(1)}`
                                                ]
                                            }`}
                                        >
                                            {connectionQuality.text}
                                        </span>
                                    )}

                                </div>

                                {/* CONTROLES */}

                                <div
                                    className={`${styles.playerControls} ${
                                        showControls
                                            ? styles.playerControlsVisible
                                            : ""
                                    }`}
                                >

                                    <div
                                        className={
                                            styles.controlsInner
                                        }
                                    >

                                        <button
                                            type="button"
                                            className={
                                                styles.playerButton
                                            }
                                            onClick={
                                                handleTogglePlay
                                            }
                                            aria-label={
                                                isPlaying
                                                    ? "Pausar"
                                                    : "Reproduzir"
                                            }
                                        >
                                            {isPlaying
                                                ? "❚❚"
                                                : "▶"}
                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                styles.playerButton
                                            }
                                            onClick={
                                                handleToggleMute
                                            }
                                            aria-label="Som"
                                        >
                                            {isMuted || volume === 0
                                                ? "🔇"
                                                : "🔊"}
                                        </button>

                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={
                                                isMuted
                                                    ? 0
                                                    : volume
                                            }
                                            onChange={
                                                handleVolumeChange
                                            }
                                            className={
                                                styles.volumeSlider
                                            }
                                            aria-label="Volume"
                                        />

                                        <div
                                            className={
                                                styles.controlsSpacer
                                            }
                                        />

                                        {document.pictureInPictureEnabled && (
                                            <button
                                                type="button"
                                                className={`${styles.playerButton} ${
                                                    isPictureInPicture
                                                        ? styles.activeControl
                                                        : ""
                                                }`}
                                                onClick={
                                                    handleTogglePictureInPicture
                                                }
                                                aria-label="Picture-in-Picture"
                                            >
                                                ▣
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className={
                                                styles.playerButton
                                            }
                                            onClick={
                                                handleToggleFullscreen
                                            }
                                            aria-label="Tela cheia"
                                        >
                                            {isFullscreen
                                                ? "⛶"
                                                : "⛶"}
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.playerButton}
                                            onClick={handleLeaveRemoteScreenShare}
                                            aria-label="Sair da transmissão"
                                            title="Sair da transmissão"
                                        >
                                            ✕
                                        </button>

                                        {hasLocalScreenShare && (
                                            <button
                                                type="button"
                                                className={
                                                    styles.stopButton
                                                }
                                                onClick={
                                                    handleStopScreenShare
                                                }
                                            >
                                                ■
                                                <span>
                                                    Parar meu compartilhamento
                                                </span>
                                            </button>
                                        )}

                                    </div>

                                </div>

                            </>

                        ) : (

                            <div
                                className={`${styles.noStream} ${
                                    remoteScreenShares.length > 0
                                        ? styles.availableStreams
                                        : ""
                                }`}
                            >

                                {remoteScreenShares.length > 0 && (
                                    <div className={styles.availableStreamsCopy}>
                                        <h1>Escolha uma transmissão</h1>
                                        <p>
                                            Existem pessoas compartilhando a tela.
                                            Selecione uma transmissão abaixo para assistir.
                                        </p>
                                    </div>
                                )}

                                <div
                                    className={
                                        styles.noStreamIcon
                                    }
                                >
                                    🖥
                                </div>

                                <h1>
                                    Ninguém está compartilhando a tela
                                </h1>

                                <p>
                                    Compartilhe sua tela para que
                                    todos na sala possam assistir
                                    junto com você.
                                </p>

                                {hasLocalScreenShare ? (

                                    <button
                                        type="button"
                                        className={
                                            styles.shareScreenButton
                                        }
                                        onClick={
                                            handleStopScreenShare
                                        }
                                    >
                                        <span>■</span>
                                        Parar meu compartilhamento
                                    </button>

                                ) : (

                                    <button
                                        type="button"
                                        className={
                                            styles.shareScreenButton
                                        }
                                        onClick={
                                            handleStartScreenShare
                                        }
                                        disabled={Boolean(screenShareUnavailableReason)}
                                        title={screenShareUnavailableReason}
                                    >
                                        <span>🖥</span>
                                        Compartilhar minha tela
                                    </button>
                                )}

                                {screenShareError && (
                                    <div
                                        className={
                                            styles.screenError
                                        }
                                    >
                                        {screenShareError}
                                    </div>
                                )}

                            </div>

                        )}

                    </div>

                    {remoteScreenShares.length > 0 && (
                        <div
                            className={`${styles.screenPreviews} ${
                                activeScreenShareId === null
                                    ? styles.screenPreviewsPending
                                    : ""
                            }`}
                            aria-label="Compartilhamentos de tela ativos"
                        >
                            {remoteScreenShares.map(share => (
                                <ScreenSharePreview
                                    key={share.userId}
                                    share={share}
                                    isActive={
                                        share.userId ===
                                        activeScreenShareId
                                    }
                                    onSelect={selectScreenShare}
                                    isHostShare={participants.some(
                                        participant =>
                                            participant.userId === share.userId &&
                                            participant.isHost
                                    )}
                                    canForceStop={
                                        isRoomOwner &&
                                        share.userId !== connectionId
                                    }
                                    onForceStop={handleForceStopScreenShare}
                                />
                            ))}
                        </div>
                    )}

                    {/* ==================================================
                        BARRA INFERIOR
                    ================================================== */}

                    <div className={styles.bottomBar}>

                        <div className={styles.bottomLeft}>

                            <button
                                type="button"
                                className={
                                    styles.bottomControl
                                }
                                aria-label="Microfone"
                            >
                                🎙
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.bottomControl
                                }
                                aria-label="Áudio"
                            >
                                🔊
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.bottomControl
                                }
                                aria-label="Câmera"
                            >
                                📹
                            </button>

                        </div>

                        <div className={styles.bottomCenter}>

                            <button
                                type="button"
                                className={`${styles.bottomMainControl} ${
                                    hasLocalScreenShare
                                        ? styles.bottomMainControlActive
                                        : ""
                                }`}
                                onClick={
                                    hasLocalScreenShare
                                        ? handleStopScreenShare
                                        : handleStartScreenShare
                                }
                                disabled={
                                    !hasLocalScreenShare &&
                                    Boolean(screenShareUnavailableReason)
                                }
                                title={
                                    !hasLocalScreenShare
                                        ? screenShareUnavailableReason
                                        : ""
                                }
                            >

                                <span>
                                    {hasLocalScreenShare
                                        ? "■"
                                        : "🖥"}
                                </span>

                                <span>
                                    {hasLocalScreenShare
                                        ? "Parar meu compartilhamento"
                                        : "Compartilhar tela"}
                                </span>

                            </button>

                        </div>

                        <div className={styles.bottomRight}>

                            <button
                                type="button"
                                className={
                                    styles.bottomControl
                                }
                                onClick={() =>
                                    setShowParticipants(
                                        previous =>
                                            !previous
                                    )
                                }
                                aria-label="Participantes"
                            >
                                👥
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.bottomControl
                                }
                                onClick={() =>
                                    document.pictureInPictureEnabled &&
                                    handleTogglePictureInPicture()
                                }
                                aria-label="Picture-in-Picture"
                            >
                                ▣
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.bottomControl
                                }
                                onClick={
                                    handleToggleFullscreen
                                }
                                aria-label="Tela cheia"
                            >
                                ⛶
                            </button>

                        </div>

                    </div>

                </section>

                {/* ==================================================
                    CHAT
                ================================================== */}

                <aside className={styles.chatSidebar}>

                    <div className={styles.chatHeader}>

                        <div className={styles.chatHeaderTitle}>

                            <span className={styles.chatHash}>
                                #
                            </span>

                            <strong>
                                chat
                            </strong>

                        </div>

                        <button
                            type="button"
                            className={
                                styles.chatHeaderButton
                            }
                            onClick={() =>
                                setShowParticipants(
                                    previous =>
                                        !previous
                                )
                            }
                            aria-label="Participantes"
                        >
                            👥
                        </button>

                    </div>

                    {showParticipants ? (

                        <div
                            className={
                                styles.chatParticipantsView
                            }
                        >

                            <div
                                className={
                                    styles.chatParticipantsTitle
                                }
                            >
                                PARTICIPANTES — {participantCount}
                            </div>

                            {participants.map(
                                participant => {

                                    const initial =
                                        participant.username
                                            ?.charAt(0)
                                            ?.toUpperCase()
                                        || "U";

                                    return (
                                        <div
                                            key={
                                                participant.userId
                                            }
                                            className={
                                                styles.chatParticipant
                                            }
                                        >

                                            <div
                                                className={
                                                    styles.chatParticipantAvatar
                                                }
                                            >
                                                {initial}

                                                <span />
                                            </div>

                                            <div>

                                                <strong>
                                                    {
                                                        participant.username
                                                    }
                                                </strong>

                                                {participant.userId === connectionId && (
                                                    <button
                                                        type="button"
                                                        className={styles.mobileEditUsernameButton}
                                                        onClick={openUsernameEditor}
                                                    >
                                                        Editar nome
                                                    </button>
                                                )}

                                                <small>
                                                    Online
                                                </small>

                                            </div>

                                        </div>
                                    );
                                }
                            )}

                        </div>

                    ) : (

                        <>

                            <div
                                ref={chatMessagesRef}
                                className={
                                    styles.chatMessages
                                }
                                onScroll={event => {
                                    const element = event.currentTarget;
                                    const distanceFromBottom =
                                        element.scrollHeight - element.scrollTop - element.clientHeight;
                                    shouldAutoScrollChatRef.current = distanceFromBottom < 72;
                                    if (distanceFromBottom < 72) {
                                        setHasUnreadMessages(false);
                                    }
                                }}
                            >

                                {messages.length === 0 ? (

                                    <div
                                        className={
                                            styles.emptyChat
                                        }
                                    >

                                        <div
                                            className={
                                                styles.emptyChatIcon
                                            }
                                        >
                                            #
                                        </div>

                                        <h2>
                                            Bem-vindo ao chat!
                                        </h2>

                                        <p>
                                            Este é o começo da
                                            conversa nesta sala.
                                        </p>

                                    </div>

                                ) : (

                                    messages.map(
                                        message => {

                                            const isOwn =
                                                message.userId ===
                                                connectionId;

                                            return (
                                                <div
                                                    key={
                                                        message.id
                                                    }
                                                    className={`${styles.chatMessage} ${
                                                        isOwn
                                                            ? styles.ownMessage
                                                            : ""
                                                    }`}
                                                >

                                                    <div
                                                        className={
                                                            styles.messageAvatar
                                                        }
                                                    >
                                                        {
                                                            message.username
                                                                ?.charAt(0)
                                                                ?.toUpperCase()
                                                            || "U"
                                                        }
                                                    </div>

                                                    <div
                                                        className={
                                                            styles.messageContent
                                                        }
                                                    >

                                                        <div
                                                            className={
                                                                styles.messageMeta
                                                            }
                                                        >

                                                            <strong>
                                                                {
                                                                    message.username
                                                                }
                                                            </strong>

                                                            <span>
                                                                {
                                                                    formatMessageTime(
                                                                        message.timestamp
                                                                    )
                                                                }
                                                            </span>

                                                        </div>

                                                        <p>
                                                            {
                                                                message.message
                                                            }
                                                        </p>

                                                    </div>

                                                </div>
                                            );
                                        }
                                    )
                                )}

                            </div>

                            {hasUnreadMessages && (
                                <button
                                    type="button"
                                    className={styles.newMessagesButton}
                                    onClick={() => {
                                        shouldAutoScrollChatRef.current = true;
                                        chatMessagesRef.current?.scrollTo({
                                            top: chatMessagesRef.current.scrollHeight,
                                            behavior: "smooth"
                                        });
                                        setHasUnreadMessages(false);
                                    }}
                                >
                                    Novas mensagens ↓
                                </button>
                            )}

                            <div className={styles.chatError} role="status" aria-live="polite">
                                {chatError}
                            </div>

                            <form
                                className={
                                    styles.chatForm
                                }
                                onSubmit={
                                    handleSendMessage
                                }
                            >

                                <input
                                    type="text"
                                    value={chatMessage}
                                    onChange={event =>
                                        setChatMessage(
                                            event.target.value
                                        )
                                    }
                                    placeholder={
                                        `Conversar em #chat`
                                    }
                                    maxLength={500}
                                    aria-label="Mensagem"
                                />

                                <button
                                    type="submit"
                                    disabled={
                                        !chatMessage.trim()
                                    }
                                    aria-label="Enviar mensagem"
                                >
                                    ➤
                                </button>

                            </form>

                        </>
                    )}

                </aside>

            </div>

            {showRoomInfo && (
                <div
                    className={styles.roomInfoBackdrop}
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) {
                            setShowRoomInfo(false);
                        }
                    }}
                >
                    <section
                        className={styles.roomInfoModal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="room-info-title"
                    >
                        <header className={styles.roomInfoHeader}>
                            <div>
                                <h2 id="room-info-title">Informações da sala</h2>
                                <p>{room.name}</p>
                            </div>
                            <button type="button" onClick={() => setShowRoomInfo(false)} aria-label="Fechar">×</button>
                        </header>
                        <dl className={styles.roomInfoList}>
                            <div><dt>Tipo</dt><dd>{room.type || "Não informado"}</dd></div>
                            <div><dt>Participantes</dt><dd>{participantCount} de {room.maxUsers}</dd></div>
                            <div><dt>Host</dt><dd>{hostName}</dd></div>
                            <div><dt>Código</dt><dd title={roomId}>{roomId}</dd></div>
                            <div><dt>Link</dt><dd title={getShareUrl()}>{getShareUrl()}</dd></div>
                        </dl>
                        <div className={styles.roomInfoActions}>
                            <button type="button" onClick={() => void handleCopyRoomCode()}>
                                {roomCodeCopyStatus === "success" ? "Código copiado" : "Copiar código"}
                            </button>
                            <button type="button" onClick={() => void handleCopyRoomLink()}>
                                {copyStatus === "success" ? "Link copiado" : "Copiar link"}
                            </button>
                            <button type="button" className={styles.roomInfoLeave} onClick={() => void handleLeaveRoom()}>
                                Sair da sala
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {(sharePermissionNotice ||
                (!isScreenSharing && screenShareUnavailableReason)) && (
                <div className={styles.sharePermissionNotice} role="status">
                    {sharePermissionNotice || screenShareUnavailableReason}
                </div>
            )}

            {showIdentityModal && (
                <div
                    className={styles.identityBackdrop}
                    onMouseDown={event => {
                        if (
                            event.target === event.currentTarget &&
                            isEditingUsername
                        ) {
                            setShowIdentityModal(false);
                            setIsEditingUsername(false);
                            setUsernameError("");
                        }
                    }}
                >
                    <form
                        className={styles.identityModal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="identity-title"
                        onSubmit={handleSaveUsername}
                    >
                        <div className={styles.identityAvatar} aria-hidden="true">
                            {normalizeUsername(usernameDraft).charAt(0).toUpperCase() || "U"}
                        </div>

                        <div className={styles.identityHeader}>
                            <h2 id="identity-title">
                                {isEditingUsername ? "Editar nome" : "Como devemos chamar você?"}
                            </h2>
                            <p>
                                {isEditingUsername
                                    ? "Seu novo nome aparecerá para todos na sala."
                                    : "Escolha um nome para aparecer nesta sala."}
                            </p>
                        </div>

                        <label className={styles.identityLabel} htmlFor="participant-username">
                            Nome de exibição
                        </label>
                        <input
                            ref={identityInputRef}
                            id="participant-username"
                            className={`${styles.identityInput} ${usernameError ? styles.identityInputError : ""}`}
                            value={usernameDraft}
                            onChange={event => {
                                setUsernameDraft(event.target.value);
                                if (usernameError) {
                                    setUsernameError("");
                                }
                            }}
                            maxLength={24}
                            autoComplete="nickname"
                            aria-describedby="identity-help identity-error"
                        />
                        <div id="identity-help" className={styles.identityHelp}>
                            Entre 2 e 24 caracteres.
                        </div>
                        <div id="identity-error" className={styles.identityError} aria-live="polite">
                            {usernameError}
                        </div>

                        <div className={styles.identityActions}>
                            {isEditingUsername && (
                                <button
                                    type="button"
                                    className={styles.identityCancelButton}
                                    onClick={() => {
                                        setShowIdentityModal(false);
                                        setIsEditingUsername(false);
                                        setUsernameError("");
                                    }}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button type="submit" className={styles.identityConfirmButton}>
                                {isEditingUsername ? "Salvar" : "Entrar na sala"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showScreenShareSettings && (
                <div
                    className={styles.screenShareSettingsBackdrop}
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) {
                            closeScreenShareSettings();
                        }
                    }}
                >
                    <div
                        className={styles.screenShareSettingsModal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="screen-share-settings-title"
                    >
                        <header className={styles.screenShareSettingsHeader}>
                            <div>
                                <h2 id="screen-share-settings-title">Compartilhar sua tela</h2>
                                <p>Configure sua transmissão antes de começar.</p>
                            </div>
                            <button type="button" className={styles.screenShareSettingsClose}
                                onClick={closeScreenShareSettings} aria-label="Fechar"
                                disabled={isStartingScreenShare}>×</button>
                        </header>

                        <div className={styles.screenShareSettingsBody}>
                            <h3 className={styles.screenSelectionTitle}>Fonte</h3>
                            <section className={styles.screenSelectionCard}>
                                {pendingScreenShareStream ? (
                                    <div className={styles.screenSelectionPreview}>
                                        <PendingScreenPreview stream={pendingScreenShareStream} />
                                    </div>
                                ) : (
                                    <div className={styles.screenSelectionPlaceholder}>
                                        <span>▣</span>
                                        <strong>Selecionar tela, janela ou aba</strong>
                                        <small>O navegador abrirá o seletor seguro de tela.</small>
                                    </div>
                                )}
                                <div className={styles.screenSelectionMeta}>
                                    <div>
                                        <strong>{pendingScreenShareSettings
                                            ? `✓ ${formatDisplaySurface(pendingScreenShareSettings.displaySurface)}`
                                            : "Escolha o conteúdo que deseja transmitir"}</strong>
                                        {pendingScreenShareSettings && (
                                            <span>{formatStreamQuality(pendingScreenShareSettings)}</span>
                                        )}
                                    </div>
                                    <button type="button"
                                        className={styles.screenSelectionChooseButton}
                                        onClick={selectScreenForSharing}
                                        disabled={isSelectingScreen || isStartingScreenShare}>
                                        {isSelectingScreen ? "Aguardando seleção..."
                                            : pendingScreenShareStream ? "Trocar tela" : "Escolher tela"}
                                    </button>
                                </div>
                                {screenSelectionError && (
                                    <p className={styles.screenSelectionError}>{screenSelectionError}</p>
                                )}
                            </section>

                            <section className={styles.screenShareSettingsSection}>
                                <h3>Modo de qualidade</h3>
                                <div className={styles.screenShareOptionGrid}>
                                    {[
                                        {
                                            id: "auto",
                                            label: "Automático",
                                            description: "Ajusta conforme a conexão."
                                        },
                                        {
                                            id: "fixed",
                                            label: "Fixo",
                                            description: "Mantém sua preferência."
                                        }
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            className={`${styles.screenShareOption} ${styles.screenShareModeOption} ${
                                                screenShareQualityMode === mode.id
                                                    ? styles.screenShareOptionActive
                                                    : ""
                                            }`}
                                            onClick={() => setScreenShareQualityMode(mode.id)}
                                            aria-pressed={screenShareQualityMode === mode.id}
                                        >
                                            <strong>{mode.label}</strong>
                                            <small>{mode.description}</small>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className={styles.screenShareSettingsSection}>
                                <h3>Qualidade</h3>
                                <div className={styles.screenShareOptionGrid}>
                                    {["720p", "1080p"].map(quality => (
                                        <button key={quality} type="button"
                                            className={`${styles.screenShareOption} ${screenShareQuality === quality ? styles.screenShareOptionActive : ""}`}
                                            onClick={() => setScreenShareQuality(quality)}
                                            aria-pressed={screenShareQuality === quality}>{quality}</button>
                                    ))}
                                </div>
                            </section>

                            <section className={styles.screenShareSettingsSection}>
                                <h3>Taxa de quadros</h3>
                                <div className={styles.screenShareOptionGrid}>
                                    {[30, 60].map(fps => (
                                        <button key={fps} type="button"
                                            className={`${styles.screenShareOption} ${screenShareFps === fps ? styles.screenShareOptionActive : ""}`}
                                            onClick={() => setScreenShareFps(fps)}
                                            aria-pressed={screenShareFps === fps}>{fps} FPS</button>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <footer className={styles.screenShareSettingsActions}>
                            <button type="button" className={styles.screenShareCancelButton}
                                onClick={closeScreenShareSettings} disabled={isStartingScreenShare}>Cancelar</button>
                            <button type="button" className={styles.screenShareConfirmButton}
                                onClick={confirmStartScreenShare}
                                disabled={!pendingScreenShareStream || isSelectingScreen || isStartingScreenShare}>
                                {isStartingScreenShare ? "Iniciando..." : "Compartilhar"}
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {/* ==================================================
                STATUS LOCAL
            ================================================== */}

            {hasLocalScreenShare && (
                <div
                    className={styles.screenSharingToast}
                    data-quality={`${formatStreamQuality(localScreenShareSettings)} • ${
                        localScreenShareSettings?.qualityMode === "fixed"
                            ? "Fixo"
                            : "Automático"
                    }`}
                    data-adaptive={adaptiveStatus || ""}
                >

                    <span
                        className={
                            styles.toastIndicator
                        }
                    />

                    <span>
                        Você está compartilhando sua tela
                    </span>

                    <button
                        type="button"
                        onClick={
                            handleStopScreenShare
                        }
                    >
                        Parar meu compartilhamento
                    </button>

                </div>
            )}

        </main>
    );
}


/*
============================================================
HORÁRIO DA MENSAGEM
============================================================
*/

function formatMessageTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    return new Date(timestamp).toLocaleTimeString(
        "pt-BR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


export default WatchRoom;

