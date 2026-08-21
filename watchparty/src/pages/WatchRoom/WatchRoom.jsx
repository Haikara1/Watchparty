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

import styles from "./WatchRoom.module.css";


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


function ScreenSharePreview({ share, isActive, onSelect }) {

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
        <button
            type="button"
            className={`${styles.screenPreview} ${
                isActive ? styles.screenPreviewActive : ""
            }`}
            onClick={() => onSelect(share.userId)}
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
            </span>
        </button>
    );
}


function WatchRoom() {

    const { roomId } = useParams();

    const navigate = useNavigate();

    const channelRef = useRef(null);

    const isConnectingRef = useRef(false);

    const isRetrackingPresenceRef = useRef(false);

    /*
    ============================================================
    SALA
    ============================================================
    */

    const [room, setRoom] = useState(null);

    const [isLoading, setIsLoading] = useState(true);

    /*
    ============================================================
    COMPARTILHAMENTO
    ============================================================
    */

    const [copyStatus, setCopyStatus] = useState("idle");

    const [canNativeShare] = useState(
        () =>
            typeof navigator !== "undefined" &&
            typeof navigator.share === "function"
    );

    const shareFeedbackTimeoutRef = useRef(null);

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

        };

    }, []);

    /*
    ============================================================
    CHAT
    ============================================================
    */

    const [messages, setMessages] = useState([]);

    const [chatMessage, setChatMessage] = useState("");

    /*
    ============================================================
    PRESENÇA
    ============================================================
    */

    const [participants, setParticipants] = useState([]);

    const [showParticipants, setShowParticipants] =
        useState(false);

    /*
    ============================================================
    IDENTIDADE
    ============================================================
    */

    const userIdRef = useRef(
        crypto.randomUUID()
    );

    const usernameRef = useRef(
        `Usuário ${Math.floor(Math.random() * 1000)}`
    );

    /*
    ============================================================
    WEBRTC
    ============================================================
    */

    const localScreenStreamRef = useRef(null);

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

    function addRemoteScreenShare(userId, username, stream) {

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
                    stream
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
                stream
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
        setActiveScreenShareId(userId);
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

    const [screenShareError, setScreenShareError] =
        useState("");

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
            return;
        }

        outgoingPeersRef.current.delete(userId);
        clearPeerRecoveryState(userId, "outgoing");
        pendingIceCandidatesRef.current.delete(
            `${userId}:${userIdRef.current}`
        );

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
                    offer
                }
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

    async function handleStartScreenShare() {

        if (
            isScreenSharing ||
            localScreenStreamRef.current ||
            isStoppingScreenShareRef.current
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

        try {

            const stream =
                await screenShareService.startScreenShare();

            localScreenStreamRef.current =
                stream;

            setIsScreenSharing(true);

            const videoTrack =
                stream.getVideoTracks()[0];

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
                    username: usernameRef.current
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

            setIsScreenSharing(false);
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

        if (!stream) {
            return;
        }

        isStoppingScreenShareRef.current = true;

        try {
            localScreenStreamRef.current = null;

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

                    addRemoteScreenShare(
                        remoteUserId,
                        signal.username,
                        stream
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

            switch (signal.type) {

                case "started":

                    remoteShareUsernamesRef.current.set(
                        signal.senderId,
                        signal.username || "Participante"
                    );

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

        if (!localScreenStreamRef.current) {
            return;
        }

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

            closeIncomingPeer(leftUserId);
            closeOutgoingPeer(leftUserId);
            removeRemoteScreenShare(leftUserId);

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

                const foundRoom =
                    await getRoomById(roomId);

                if (!isActive) {
                    return;
                }

                setRoom(
                    foundRoom || null
                );

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

        function handlePageExit() {

            const localStream = localScreenStreamRef.current;

            if (localStream) {
                localStream.getTracks().forEach(track => {
                    track.onended = null;
                });
                screenShareService.stopScreenShare(localStream);
                localScreenStreamRef.current = null;
            }

            closeAllScreenSharePeers();
        }

        window.addEventListener("pagehide", handlePageExit);
        window.addEventListener("beforeunload", handlePageExit);

        return () => {
            window.removeEventListener("pagehide", handlePageExit);
            window.removeEventListener("beforeunload", handlePageExit);
        };

    }, []);

    /*
    ============================================================
    SUPABASE REALTIME
    ============================================================
    */

    useEffect(() => {

        if (!roomId) {
            return;
        }

        if (isConnectingRef.current) {
            return;
        }

        let isActive = true;

        const remoteShareUsernames =
            remoteShareUsernamesRef.current;

        const announcedRemoteShares =
            announcedRemoteSharesRef.current;

        isConnectingRef.current = true;

        const channel =
            realtimeService.createRoomChannel(
                roomId
            );

        channelRef.current = channel;

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

                const hasCurrentUser = uniqueUsers.some(
                    user => user.userId === userIdRef.current
                );

                if (
                    !hasCurrentUser &&
                    !isRetrackingPresenceRef.current &&
                    realtimeService.isChannelReady(channel)
                ) {
                    isRetrackingPresenceRef.current = true;

                    void realtimeService.trackPresence(
                        channel,
                        {
                            userId: userIdRef.current,
                            username: usernameRef.current
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
                    username:
                        usernameRef.current
                };

                try {

                    await realtimeService.trackPresence(
                        channel,
                        currentUser
                    );

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

            if (
                localScreenStreamRef.current
            ) {

                screenShareService.stopScreenShare(
                    localScreenStreamRef.current
                );

                localScreenStreamRef.current =
                    null;
            }

            closeAllScreenSharePeers();

            setIsScreenSharing(false);

            setRemoteScreenShares([]);

            remoteScreenSharesRef.current = [];

            setActiveScreenShareId(null);

            remoteShareUsernames.clear();

            announcedRemoteShares.clear();

            setParticipants([]);

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

    }, [roomId]);

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

        const activeChannel =
            channelRef.current;

        if (!activeChannel) {
            return;
        }

        const message = {
            id:
                crypto.randomUUID(),
            userId:
                userIdRef.current,
            username:
                usernameRef.current,
            message:
                text,
            timestamp:
                Date.now()
        };

        try {

            await realtimeService.sendChatMessage(
                activeChannel,
                message
            );

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

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar chat:",
                error
            );
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

    const currentUser =
        participants.find(
            participant =>
                participant.userId ===
                userIdRef.current
        );

    const participantCount =
        participants.length;

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

                    <div className={styles.connectionStatus}>
                        <span className={styles.connectionDot} />
                        Conectado
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
                    >
                        ⚙
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

                <aside className={styles.leftSidebar}>

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
                                        userIdRef.current;

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
                                {usernameRef.current}
                            </strong>

                            <span>
                                Online
                            </span>

                        </div>

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

                                        {isScreenSharing && (
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
                                                    Parar transmissão
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

                                {isScreenSharing ? (

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
                                        Parar compartilhamento
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
                                    isScreenSharing
                                        ? styles.bottomMainControlActive
                                        : ""
                                }`}
                                onClick={
                                    isScreenSharing
                                        ? handleStopScreenShare
                                        : handleStartScreenShare
                                }
                            >

                                <span>
                                    {isScreenSharing
                                        ? "■"
                                        : "🖥"}
                                </span>

                                <span>
                                    {isScreenSharing
                                        ? "Parar transmissão"
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
                                className={
                                    styles.chatMessages
                                }
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
                                                userIdRef.current;

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

            {/* ==================================================
                STATUS LOCAL
            ================================================== */}

            {isScreenSharing && (
                <div className={styles.screenSharingToast}>

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
                        Parar
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

