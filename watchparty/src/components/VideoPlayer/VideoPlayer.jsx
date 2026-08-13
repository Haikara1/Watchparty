import { useEffect, useRef, useState } from "react";

import styles from "./VideoPlayer.module.css";


function VideoPlayer({
    src,
    playback,
    onPlay,
    onPause,
    onSeek
}) {

    const playerRef = useRef(null);

    const videoRef = useRef(null);

    const controlsTimeoutRef = useRef(null);

    const playbackAppliedRef = useRef(false);

    /*
    ============================================================
    CONTROLE DE EVENTOS REMOTOS
    ============================================================
    */

    const remoteActionRef = useRef(null);


    /*
    ============================================================
    PLAYER STATE
    ============================================================
    */

    const [isPlaying, setIsPlaying] =
        useState(false);


    const [currentTime, setCurrentTime] =
        useState(0);


    const [duration, setDuration] =
        useState(0);


    const [volume, setVolume] =
        useState(1);


    const [isMuted, setIsMuted] =
        useState(false);


    const [isFullscreen, setIsFullscreen] =
        useState(false);


    const [hasError, setHasError] =
        useState(false);


    const [showControls, setShowControls] =
        useState(true);


    /*
    ============================================================
    AUTOPLAY BLOQUEADO
    ============================================================
    */

    const [autoplayBlocked, setAutoplayBlocked] =
        useState(false);


    /*
    ============================================================
    DETECTAR MOBILE / TOUCH
    ============================================================
    */

    const [isTouchDevice, setIsTouchDevice] =
        useState(false);


    useEffect(() => {

        const mediaQuery =
            window.matchMedia(
                "(pointer: coarse)"
            );


        function updateTouchDevice() {

            setIsTouchDevice(
                mediaQuery.matches
            );

        }


        updateTouchDevice();


        mediaQuery.addEventListener(
            "change",
            updateTouchDevice
        );


        return () => {

            mediaQuery.removeEventListener(
                "change",
                updateTouchDevice
            );

        };

    }, []);


    /*
    ============================================================
    LIMPAR TIMER
    ============================================================
    */

    function clearControlsTimeout() {

        if (
            controlsTimeoutRef.current
        ) {

            clearTimeout(
                controlsTimeoutRef.current
            );


            controlsTimeoutRef.current =
                null;

        }

    }


    /*
    ============================================================
    ESCONDER CONTROLES
    ============================================================
    */

    function scheduleControlsHide() {

        clearControlsTimeout();


        if (isTouchDevice) {

            return;

        }


        if (!isPlaying) {

            return;

        }


        controlsTimeoutRef.current =
            setTimeout(() => {

                setShowControls(false);

            }, 3000);

    }


    /*
    ============================================================
    MOSTRAR CONTROLES
    ============================================================
    */

    function showPlayerControls() {

        setShowControls(true);

        scheduleControlsHide();

    }


    /*
    ============================================================
    INTERAÇÃO DO PLAYER
    ============================================================
    */

    function handlePlayerInteraction() {

        setShowControls(true);

        scheduleControlsHide();

    }


    /*
    ============================================================
    PLAY
    ============================================================
    */

    function handlePlay() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        video
            .play()
            .then(() => {

                setAutoplayBlocked(false);

            })
            .catch((error) => {

                console.error(
                    "[VideoPlayer] Não foi possível reproduzir:",
                    error
                );

            });

    }


    /*
    ============================================================
    PAUSE
    ============================================================
    */

    function handlePause() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        video.pause();

    }


    /*
    ============================================================
    PLAY / PAUSE
    ============================================================
    */

    function handleTogglePlay() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        /*
        ========================================================
        ESTA INTERAÇÃO LIBERA O AUTOPLAY
        ========================================================
        */

        setAutoplayBlocked(false);


        if (video.paused) {

            handlePlay();

        } else {

            handlePause();

        }


        setShowControls(true);

    }


    /*
    ============================================================
    BOTÃO DE SINCRONIZAÇÃO
    ============================================================
    */

    function handleAutoplaySync() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        /*
        ========================================================
        MARCAR COMO PLAY REMOTO
        ========================================================
        */

        remoteActionRef.current =
            "play";


        /*
        ========================================================
        APLICAR TEMPO RECEBIDO
        ========================================================
        */

        const remoteTime =
            Number(
                playback?.currentTime
            );


        if (
            Number.isFinite(remoteTime) &&
            remoteTime >= 0
        ) {

            video.currentTime =
                remoteTime;


            setCurrentTime(
                remoteTime
            );

        }


        /*
        ========================================================
        TENTAR REPRODUZIR
        ========================================================
        */

        video
            .play()
            .then(() => {

                console.log(
                    "[VideoPlayer] Autoplay liberado pelo usuário."
                );


                setAutoplayBlocked(
                    false
                );

            })
            .catch((error) => {

                console.error(
                    "[VideoPlayer] Não foi possível sincronizar:",
                    error
                );


                remoteActionRef.current =
                    null;

            });


        setShowControls(true);

    }


    /*
    ============================================================
    EVENTO PLAY DO VÍDEO
    ============================================================
    */

    function handleVideoPlay() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        setIsPlaying(true);

        setShowControls(true);

        setAutoplayBlocked(false);


        /*
        ========================================================
        PLAY REMOTO
        ========================================================
        */

        if (
            remoteActionRef.current ===
            "play"
        ) {

            console.log(
                "[VideoPlayer] ▶ PLAY remoto aplicado."
            );


            remoteActionRef.current =
                null;


            return;

        }


        /*
        ========================================================
        PLAY LOCAL
        ========================================================
        */

        console.log(
            "[VideoPlayer] ▶ PLAY local:",
            video.currentTime
        );


        if (onPlay) {

            onPlay({

                currentTime:
                    video.currentTime

            });

        }

    }


    /*
    ============================================================
    EVENTO PAUSE DO VÍDEO
    ============================================================
    */

    function handleVideoPause() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        setIsPlaying(false);

        setShowControls(true);

        clearControlsTimeout();


        /*
        ========================================================
        PAUSE REMOTO
        ========================================================
        */

        if (
            remoteActionRef.current ===
            "pause"
        ) {

            console.log(
                "[VideoPlayer] ⏸ PAUSE remoto aplicado."
            );


            remoteActionRef.current =
                null;


            return;

        }


        /*
        ========================================================
        PAUSE LOCAL
        ========================================================
        */

        console.log(
            "[VideoPlayer] ⏸ PAUSE local:",
            video.currentTime
        );


        if (onPause) {

            onPause({

                currentTime:
                    video.currentTime

            });

        }

    }


    /*
    ============================================================
    TIME UPDATE
    ============================================================
    */

    function handleTimeUpdate() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        setCurrentTime(
            video.currentTime
        );

    }


    /*
    ============================================================
    METADATA
    ============================================================
    */

    function handleLoadedMetadata() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        setDuration(
            video.duration
        );


        setVolume(
            video.volume
        );


        setIsMuted(
            video.muted
        );


        /*
        ========================================================
        PLAYBACK INICIAL
        ========================================================
        */

        if (
            playbackAppliedRef.current
        ) {

            return;

        }


        const savedTime =
            Number(
                playback?.currentTime
            );


        const savedIsPlaying =
            Boolean(
                playback?.isPlaying
            );


        if (
            Number.isFinite(savedTime) &&
            savedTime >= 0 &&
            savedTime <= video.duration
        ) {

            video.currentTime =
                savedTime;


            setCurrentTime(
                savedTime
            );

        }


        playbackAppliedRef.current =
            true;


        /*
        ========================================================
        RESTAURAR PLAYBACK
        ========================================================
        */

        if (savedIsPlaying) {

            remoteActionRef.current =
                "play";


            video
                .play()
                .then(() => {

                    setAutoplayBlocked(
                        false
                    );

                })
                .catch((error) => {

                    console.warn(
                        "[VideoPlayer] Autoplay inicial bloqueado:",
                        error
                    );


                    remoteActionRef.current =
                        null;


                    setAutoplayBlocked(
                        true
                    );

                });

        }

    }


    /*
    ============================================================
    RESETAR PLAYBACK AO TROCAR SRC
    ============================================================
    */

    useEffect(() => {

        playbackAppliedRef.current =
            false;


        remoteActionRef.current =
            null;


        setHasError(false);

        setAutoplayBlocked(false);

    }, [src]);


    /*
    ============================================================
    ⭐ SINCRONIZAÇÃO REALTIME
    ============================================================
    */

    useEffect(() => {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        if (!playback) {

            return;

        }


        const remoteTime =
            Number(
                playback.currentTime
            );


        /*
        ========================================================
        SINCRONIZAR TEMPO
        ========================================================
        */

        if (
            Number.isFinite(remoteTime) &&
            remoteTime >= 0
        ) {

            const difference =
                Math.abs(
                    video.currentTime -
                    remoteTime
                );


            if (
                difference > 0.5
            ) {

                console.log(
                    "[VideoPlayer] ⏩ SEEK remoto:",
                    remoteTime
                );


                video.currentTime =
                    remoteTime;


                setCurrentTime(
                    remoteTime
                );

            }

        }


        /*
        ========================================================
        PLAY REMOTO
        ========================================================
        */

        if (
            playback.isPlaying === true
        ) {

            if (
                video.paused
            ) {

                console.log(
                    "[VideoPlayer] ▶ Aplicando PLAY remoto"
                );


                remoteActionRef.current =
                    "play";


                video
                    .play()
                    .then(() => {

                        console.log(
                            "[VideoPlayer] ▶ PLAY remoto executado."
                        );


                        setAutoplayBlocked(
                            false
                        );

                    })
                    .catch((error) => {

                        console.warn(
                            "[VideoPlayer] PLAY remoto bloqueado:",
                            error
                        );


                        remoteActionRef.current =
                            null;


                        /*
                        ========================================
                        MOSTRAR BOTÃO DE SINCRONIZAÇÃO
                        ========================================
                        */

                        if (
                            error?.name ===
                            "NotAllowedError"
                        ) {

                            setAutoplayBlocked(
                                true
                            );

                        }

                    });

            }

        }


        /*
        ========================================================
        PAUSE REMOTO
        ========================================================
        */

        if (
            playback.isPlaying === false
        ) {

            if (
                !video.paused
            ) {

                console.log(
                    "[VideoPlayer] ⏸ Aplicando PAUSE remoto"
                );


                remoteActionRef.current =
                    "pause";


                video.pause();

            }

        }

    }, [
        playback?.isPlaying,
        playback?.currentTime
    ]);


    /*
    ============================================================
    SEEK
    ============================================================
    */

    function handleSeek(event) {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        const newTime =
            Number(
                event.target.value
            );


        video.currentTime =
            newTime;


        setCurrentTime(
            newTime
        );


        if (onSeek) {

            onSeek({

                currentTime:
                    newTime

            });

        }


        handlePlayerInteraction();

    }


    /*
    ============================================================
    VOLUME
    ============================================================
    */

    function handleVolumeChange(event) {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        const newVolume =
            Number(
                event.target.value
            );


        video.volume =
            newVolume;


        setVolume(
            newVolume
        );


        if (
            newVolume === 0
        ) {

            video.muted =
                true;


            setIsMuted(
                true
            );

        } else {

            video.muted =
                false;


            setIsMuted(
                false
            );

        }


        handlePlayerInteraction();

    }


    /*
    ============================================================
    MUTE
    ============================================================
    */

    function handleToggleMute() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        const newMutedState =
            !video.muted;


        video.muted =
            newMutedState;


        setIsMuted(
            newMutedState
        );


        handlePlayerInteraction();

    }


    /*
    ============================================================
    FULLSCREEN
    ============================================================
    */

    async function handleToggleFullscreen() {

        const player =
            playerRef.current;


        if (!player) {

            return;

        }


        try {

            if (
                !document.fullscreenElement
            ) {

                if (
                    player.requestFullscreen
                ) {

                    await player.requestFullscreen();

                } else if (
                    player.webkitRequestFullscreen
                ) {

                    player.webkitRequestFullscreen();

                }

            } else {

                if (
                    document.exitFullscreen
                ) {

                    await document.exitFullscreen();

                } else if (
                    document.webkitExitFullscreen
                ) {

                    await document.webkitExitFullscreen();

                }

            }

        } catch (error) {

            console.error(
                "[VideoPlayer] Erro no fullscreen:",
                error
            );

        }


        setShowControls(true);

    }


    /*
    ============================================================
    FULLSCREEN CHANGE
    ============================================================
    */

    useEffect(() => {

        function handleFullscreenChange() {

            const active =
                Boolean(
                    document.fullscreenElement
                );


            setIsFullscreen(
                active
            );


            setShowControls(true);

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
    CONTROLES AUTOMÁTICOS
    ============================================================
    */

    useEffect(() => {

        if (isPlaying) {

            scheduleControlsHide();

        } else {

            clearControlsTimeout();

            setShowControls(true);

        }


        return () => {

            clearControlsTimeout();

        };

    }, [
        isPlaying,
        isTouchDevice
    ]);


    /*
    ============================================================
    CLEANUP
    ============================================================
    */

    useEffect(() => {

        return () => {

            clearControlsTimeout();

        };

    }, []);


    /*
    ============================================================
    ERRO
    ============================================================
    */

    function handleVideoError() {

        console.error(
            "[PLAYER] Não foi possível carregar:",
            src
        );


        setHasError(true);

        setShowControls(true);

    }


    /*
    ============================================================
    CLICK NO PLAYER
    ============================================================
    */

    function handlePlayerClick(event) {

        if (
            event.target.closest(
                "button, input"
            )
        ) {

            return;

        }


        handleTogglePlay();

    }


    /*
    ============================================================
    RENDER
    ============================================================
    */

    return (

        <div

            ref={playerRef}

            className={`
                ${styles.player}
                ${
                    isFullscreen
                        ? styles.fullscreen
                        : ""
                }
                ${
                    showControls
                        ? styles.controlsVisible
                        : styles.controlsHidden
                }
            `}

            onMouseMove={
                showPlayerControls
            }

            onMouseEnter={
                showPlayerControls
            }

            onMouseLeave={
                scheduleControlsHide
            }

            onClick={
                handlePlayerClick
            }

        >

            {/* ==================================================
                VIDEO
            ================================================== */}

            <video

                ref={videoRef}

                className={
                    styles.video
                }

                src={src}

                playsInline

                preload="metadata"

                onPlay={
                    handleVideoPlay
                }

                onPause={
                    handleVideoPause
                }

                onTimeUpdate={
                    handleTimeUpdate
                }

                onLoadedMetadata={
                    handleLoadedMetadata
                }

                onError={
                    handleVideoError
                }

            />


            {/* ==================================================
                ERRO
            ================================================== */}

            {hasError && (

                <div
                    className={
                        styles.errorOverlay
                    }
                >

                    <span
                        className={
                            styles.errorIcon
                        }
                    >
                        ⚠️
                    </span>


                    <strong>
                        Não foi possível reproduzir este conteúdo.
                    </strong>


                    <p>
                        Verifique se o link aponta
                        diretamente para um arquivo
                        de vídeo compatível.
                    </p>

                </div>

            )}


            {!hasError && (

                <>

                    {/* ==================================================
                        GRADIENTE
                    ================================================== */}

                    <div
                        className={
                            styles.bottomGradient
                        }
                    />


                    {/* ==================================================
                        AVISO DE AUTOPLAY
                    ================================================== */}

                    {autoplayBlocked && (

                        <div
                            className={
                                styles.autoplayOverlay
                            }
                        >

                            <div
                                className={
                                    styles.autoplayMessage
                                }
                            >

                                <span>
                                    ▶
                                </span>


                                <strong>
                                    O vídeo está aguardando sincronização
                                </strong>


                                <small>
                                    O navegador bloqueou a reprodução automática.
                                </small>


                                <button

                                    type="button"

                                    onClick={(event) => {

                                        event.stopPropagation();

                                        handleAutoplaySync();

                                    }}

                                >

                                    ▶ Sincronizar vídeo

                                </button>

                            </div>

                        </div>

                    )}


                    {/* ==================================================
                        BOTÃO CENTRAL
                    ================================================== */}

                    <button

                        type="button"

                        className={
                            styles.playButton
                        }

                        onClick={(event) => {

                            event.stopPropagation();

                            handleTogglePlay();

                        }}

                        aria-label={
                            isPlaying
                                ? "Pausar vídeo"
                                : "Reproduzir vídeo"
                        }

                    >

                        {
                            isPlaying
                                ? "❚❚"
                                : "▶"
                        }

                    </button>


                    {/* ==================================================
                        CONTROLES
                    ================================================== */}

                    <div

                        className={
                            styles.controls
                        }

                        onClick={(event) => {

                            event.stopPropagation();

                        }}

                    >

                        {/* PLAY / PAUSE */}

                        <button

                            type="button"

                            className={
                                styles.controlButton
                            }

                            onClick={
                                handleTogglePlay
                            }

                            aria-label={
                                isPlaying
                                    ? "Pausar vídeo"
                                    : "Reproduzir vídeo"
                            }

                        >

                            {
                                isPlaying
                                    ? "❚❚"
                                    : "▶"
                            }

                        </button>


                        {/* TEMPO */}

                        <span
                            className={
                                styles.time
                            }
                        >

                            {
                                formatTime(
                                    currentTime
                                )
                            }

                        </span>


                        {/* PROGRESSO */}

                        <input

                            type="range"

                            className={
                                styles.progress
                            }

                            min="0"

                            max={
                                duration || 0
                            }

                            step="0.1"

                            value={
                                currentTime
                            }

                            onChange={
                                handleSeek
                            }

                            aria-label="Progresso do vídeo"

                        />


                        {/* DURAÇÃO */}

                        <span
                            className={
                                styles.time
                            }
                        >

                            {
                                formatTime(
                                    duration
                                )
                            }

                        </span>


                        {/* MUTE */}

                        <button

                            type="button"

                            className={
                                styles.controlButton
                            }

                            onClick={
                                handleToggleMute
                            }

                            aria-label={
                                isMuted
                                    ? "Ativar som"
                                    : "Silenciar vídeo"
                            }

                        >

                            {
                                getVolumeIcon(
                                    volume,
                                    isMuted
                                )
                            }

                        </button>


                        {/* VOLUME */}

                        <input

                            type="range"

                            className={
                                styles.volume
                            }

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


                        {/* FULLSCREEN */}

                        <button

                            type="button"

                            className={
                                styles.controlButton
                            }

                            onClick={
                                handleToggleFullscreen
                            }

                            aria-label={
                                isFullscreen
                                    ? "Sair da tela cheia"
                                    : "Entrar na tela cheia"
                            }

                        >

                            ⛶

                        </button>

                    </div>

                </>

            )}

        </div>

    );

}


/*
============================================================
ÍCONE DE VOLUME
============================================================
*/

function getVolumeIcon(
    volume,
    isMuted
) {

    if (
        isMuted ||
        volume === 0
    ) {

        return "🔇";

    }


    if (
        volume < 0.5
    ) {

        return "🔉";

    }


    return "🔊";

}


/*
============================================================
FORMATAR TEMPO
============================================================
*/

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        return "00:00";

    }


    const hours =
        Math.floor(
            seconds / 3600
        );


    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );


    const remainingSeconds =
        Math.floor(
            seconds % 60
        );


    if (
        hours > 0
    ) {

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

    }


    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

}


export default VideoPlayer;