import {
    useEffect,
    useRef,
    useState
} from "react";

import styles from "./ScreenShare.module.css";


function ScreenShare({

    remoteStream,

    remoteSharer,

    localStream,

    isScreenSharing,

    onStart,

    onStop,

    error

}) {

    const remoteVideoRef =
        useRef(null);


    const localVideoRef =
        useRef(null);


    const playerRef =
        useRef(null);


    const controlsTimeoutRef =
        useRef(null);


    /*
    ============================================================
    ESTADOS DO PLAYER
    ============================================================
    */

    const [showControls, setShowControls] =
        useState(true);


    const [isFullscreen, setIsFullscreen] =
        useState(false);


    const [isMuted, setIsMuted] =
        useState(false);


    const [volume, setVolume] =
        useState(1);


    const [isPictureInPicture, setIsPictureInPicture] =
        useState(false);


    /*
    ============================================================
    STREAM REMOTA
    ============================================================
    */

    useEffect(
        () => {

            if (
                !remoteVideoRef.current
            ) {

                return;

            }


            remoteVideoRef.current.srcObject =
                remoteStream || null;


        },
        [remoteStream]
    );


    /*
    ============================================================
    STREAM LOCAL
    ============================================================
    */

    useEffect(
        () => {

            if (
                !localVideoRef.current
            ) {

                return;

            }


            localVideoRef.current.srcObject =
                localStream || null;


        },
        [localStream]
    );


    /*
    ============================================================
    LIMPAR TIMEOUT
    ============================================================
    */

    useEffect(
        () => {

            return () => {

                if (
                    controlsTimeoutRef.current
                ) {

                    clearTimeout(
                        controlsTimeoutRef.current
                    );

                }

            };

        },
        []
    );


    /*
    ============================================================
    DETECTAR FULLSCREEN
    ============================================================
    */

    useEffect(
        () => {

            function handleFullscreenChange() {

                setIsFullscreen(
                    Boolean(
                        document.fullscreenElement
                    )
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

        },
        []
    );


    /*
    ============================================================
    MOSTRAR HUD
    ============================================================
    */

    function revealControls() {

        setShowControls(
            true
        );


        if (
            controlsTimeoutRef.current
        ) {

            clearTimeout(
                controlsTimeoutRef.current
            );

        }


        if (
            remoteStream ||
            localStream
        ) {

            controlsTimeoutRef.current =
                setTimeout(
                    () => {

                        setShowControls(
                            false
                        );

                    },
                    3500
                );

        }

    }


    /*
    ============================================================
    FULLSCREEN
    ============================================================
    */

    async function handleFullscreen() {

        try {

            if (
                document.fullscreenElement
            ) {

                await document.exitFullscreen();

                return;

            }


            if (
                playerRef.current?.requestFullscreen
            ) {

                await playerRef.current.requestFullscreen();

            }

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao alternar fullscreen:",
                error
            );

        }

    }


    /*
    ============================================================
    VOLUME
    ============================================================
    */

    function handleVolumeChange(
        event
    ) {

        const nextVolume =
            Number(
                event.target.value
            );


        setVolume(
            nextVolume
        );


        setIsMuted(
            nextVolume === 0
        );


        if (
            remoteVideoRef.current
        ) {

            remoteVideoRef.current.volume =
                nextVolume;

            remoteVideoRef.current.muted =
                nextVolume === 0;

        }

    }


    /*
    ============================================================
    MUTE
    ============================================================
    */

    function handleToggleMute() {

        const nextMuted =
            !isMuted;


        setIsMuted(
            nextMuted
        );


        if (
            remoteVideoRef.current
        ) {

            remoteVideoRef.current.muted =
                nextMuted;

        }

    }


    /*
    ============================================================
    PICTURE IN PICTURE
    ============================================================
    */

    async function handlePictureInPicture() {

        const video =
            remoteVideoRef.current;


        if (
            !video
        ) {

            return;

        }


        try {

            if (
                document.pictureInPictureElement
            ) {

                await document.exitPictureInPicture();

                setIsPictureInPicture(
                    false
                );

                return;

            }


            if (
                document.pictureInPictureEnabled &&
                video.requestPictureInPicture
            ) {

                await video.requestPictureInPicture();

                setIsPictureInPicture(
                    true
                );

            }

        } catch (error) {

            console.error(
                "[ScreenShare] Picture-in-Picture indisponível:",
                error
            );

        }

    }


    /*
    ============================================================
    PICTURE IN PICTURE ENCERRADO
    ============================================================
    */

    useEffect(
        () => {

            const video =
                remoteVideoRef.current;


            if (
                !video
            ) {

                return;

            }


            function handleLeavePiP() {

                setIsPictureInPicture(
                    false
                );

            }


            video.addEventListener(
                "leavepictureinpicture",
                handleLeavePiP
            );


            return () => {

                video.removeEventListener(
                    "leavepictureinpicture",
                    handleLeavePiP
                );

            };

        },
        [remoteStream]
    );


    /*
    ============================================================
    STREAM DISPONÍVEL
    ============================================================
    */

    const hasRemoteStream =
        Boolean(
            remoteStream
        );


    const hasLocalStream =
        Boolean(
            localStream
        );


    /*
    ============================================================
    ÁUDIO
    ============================================================
    */

    const remoteHasAudio =
        Boolean(
            remoteStream?.getAudioTracks?.().length
        );


    /*
    ============================================================
    RENDER
    ============================================================
    */

    return (

        <section
            className={
                styles.container
            }
        >

            <div
                ref={
                    playerRef
                }
                className={`
                    ${styles.player}

                    ${
                        showControls
                            ? styles.controlsVisible
                            : styles.controlsHidden
                    }

                    ${
                        isFullscreen
                            ? styles.fullscreen
                            : ""
                    }
                `}
                onMouseMove={
                    revealControls
                }
                onMouseEnter={
                    revealControls
                }
                onClick={
                    revealControls
                }
            >

                {/* ==================================================
                    VÍDEO REMOTO
                ================================================== */}

                {hasRemoteStream ? (

                    <video
                        ref={
                            remoteVideoRef
                        }
                        className={
                            styles.remoteVideo
                        }
                        autoPlay
                        playsInline
                        onLoadedMetadata={
                            () => {

                                if (
                                    remoteVideoRef.current
                                ) {

                                    remoteVideoRef.current.volume =
                                        volume;

                                    remoteVideoRef.current.muted =
                                        isMuted;

                                }

                            }
                        }
                    />

                ) : (

                    <div
                        className={
                            styles.emptyState
                        }
                    >

                        <div
                            className={
                                styles.emptyIcon
                            }
                        >
                            🖥️
                        </div>


                        <span
                            className={
                                styles.badge
                            }
                        >
                            COMPARTILHAMENTO DE TELA
                        </span>


                        <h1>
                            Assista junto com sua sala
                        </h1>


                        <p>
                            Compartilhe sua tela para que
                            os participantes possam
                            acompanhar em tempo real.
                        </p>


                        <button
                            type="button"
                            className={
                                styles.startButton
                            }
                            onClick={
                                onStart
                            }
                        >

                            <span>
                                🖥️
                            </span>

                            Compartilhar minha tela

                        </button>


                        {error && (

                            <div
                                className={
                                    styles.error
                                }
                            >
                                {error}
                            </div>

                        )}

                    </div>

                )}


                {/* ==================================================
                    PREVIEW LOCAL
                ================================================== */}

                {hasLocalStream && (

                    <div
                        className={
                            styles.localPreview
                        }
                    >

                        <video
                            ref={
                                localVideoRef
                            }
                            autoPlay
                            muted
                            playsInline
                        />


                        <div
                            className={
                                styles.localPreviewLabel
                            }
                        >
                            Você
                        </div>

                    </div>

                )}


                {/* ==================================================
                    INDICADOR DO COMPARTILHAMENTO
                ================================================== */}

                {hasRemoteStream && remoteSharer && (

                    <div
                        className={
                            styles.sharerInfo
                        }
                    >

                        <div
                            className={
                                styles.liveIndicator
                            }
                        />

                        <span>
                            {remoteSharer.username}
                            {" "}
                            está compartilhando a tela
                        </span>

                    </div>

                )}


                {/* ==================================================
                    HUD
                ================================================== */}

                {(hasRemoteStream || hasLocalStream) && (

                    <div
                        className={
                            styles.hud
                        }
                    >

                        <div
                            className={
                                styles.hudLeft
                            }
                        >

                            {isScreenSharing ? (

                                <button
                                    type="button"
                                    className={`${styles.controlButton} ${styles.stopButton}`}
                                    onClick={
                                        onStop
                                    }
                                    title="Parar compartilhamento"
                                >
                                    ■
                                </button>

                            ) : (

                                <button
                                    type="button"
                                    className={
                                        styles.controlButton
                                    }
                                    onClick={
                                        onStart
                                    }
                                    title="Compartilhar tela"
                                >
                                    🖥
                                </button>

                            )}


                            {hasRemoteStream && (

                                <>

                                    <button
                                        type="button"
                                        className={
                                            styles.controlButton
                                        }
                                        onClick={
                                            handleToggleMute
                                        }
                                        disabled={
                                            !remoteHasAudio
                                        }
                                        title={
                                            remoteHasAudio
                                                ? "Ativar/desativar áudio"
                                                : "Compartilhamento sem áudio"
                                        }
                                    >
                                        {
                                            isMuted
                                                ? "🔇"
                                                : "🔊"
                                        }
                                    </button>


                                    <input
                                        className={
                                            styles.volume
                                        }
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
                                        aria-label="Volume"
                                    />

                                </>

                            )}

                        </div>


                        <div
                            className={
                                styles.hudCenter
                            }
                        >

                            <span
                                className={
                                    styles.liveBadge
                                }
                            >
                                ● AO VIVO
                            </span>

                        </div>


                        <div
                            className={
                                styles.hudRight
                            }
                        >

                            {hasRemoteStream && (

                                <button
                                    type="button"
                                    className={
                                        styles.controlButton
                                    }
                                    onClick={
                                        handlePictureInPicture
                                    }
                                    title="Picture-in-Picture"
                                >
                                    {
                                        isPictureInPicture
                                            ? "↙"
                                            : "▣"
                                    }
                                </button>

                            )}


                            <button
                                type="button"
                                className={
                                    styles.controlButton
                                }
                                onClick={
                                    handleFullscreen
                                }
                                title={
                                    isFullscreen
                                        ? "Sair da tela cheia"
                                        : "Tela cheia"
                                }
                            >
                                {
                                    isFullscreen
                                        ? "↙"
                                        : "⛶"
                                }
                            </button>

                        </div>

                    </div>

                )}

            </div>

        </section>

    );

}


export default ScreenShare;