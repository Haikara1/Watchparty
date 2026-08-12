import { useEffect, useRef, useState } from "react";

import styles from "./VideoPlayer.module.css";


function VideoPlayer({ src }) {

    const playerRef = useRef(null);

    const videoRef = useRef(null);


    // =========================
    // ESTADO DO PLAYER
    // =========================

    const [isPlaying, setIsPlaying] = useState(false);

    const [currentTime, setCurrentTime] = useState(0);

    const [duration, setDuration] = useState(0);

    const [volume, setVolume] = useState(1);

    const [isMuted, setIsMuted] = useState(false);

    const [isFullscreen, setIsFullscreen] = useState(false);

    const [hasError, setHasError] = useState(false);


    // =========================
    // PLAY
    // =========================

    function handlePlay() {

        const video = videoRef.current;

        if (!video) {
            return;
        }


        video
            .play()
            .catch((error) => {

                console.error(
                    "Não foi possível reproduzir o vídeo:",
                    error
                );

            });

    }


    // =========================
    // PAUSE
    // =========================

    function handlePause() {

        const video = videoRef.current;

        if (!video) {
            return;
        }


        video.pause();

    }


    // =========================
    // PLAY / PAUSE
    // =========================

    function handleTogglePlay() {

        const video = videoRef.current;

        if (!video) {
            return;
        }


        if (video.paused) {

            handlePlay();

        } else {

            handlePause();

        }

    }


    // =========================
    // PLAY EVENT
    // =========================

    function handleVideoPlay() {

        setIsPlaying(true);

        console.log(
            "[PLAYER] Play"
        );

    }


    // =========================
    // PAUSE EVENT
    // =========================

    function handleVideoPause() {

        setIsPlaying(false);

        console.log(
            "[PLAYER] Pause",
            "Tempo:",
            videoRef.current?.currentTime
        );

    }


    // =========================
    // TIME UPDATE
    // =========================

    function handleTimeUpdate() {

        const video = videoRef.current;

        if (!video) {
            return;
        }


        setCurrentTime(
            video.currentTime
        );

    }


    // =========================
    // METADATA
    // =========================

    function handleLoadedMetadata() {

        const video = videoRef.current;

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


        console.log(
            "[PLAYER] Duração:",
            video.duration
        );

    }


    // =========================
    // SEEK
    // =========================

    function handleSeek(event) {

        const video = videoRef.current;

        if (!video) {
            return;
        }


        const newTime =
            Number(event.target.value);


        video.currentTime =
            newTime;


        setCurrentTime(
            newTime
        );

    }


    // =========================
    // VOLUME
    // =========================

    function handleVolumeChange(event) {

        const video = videoRef.current;

        if (!video) {
            return;
        }


        const newVolume =
            Number(event.target.value);


        video.volume =
            newVolume;


        setVolume(
            newVolume
        );


        if (newVolume === 0) {

            video.muted = true;

            setIsMuted(true);

        } else {

            video.muted = false;

            setIsMuted(false);

        }

    }


    // =========================
    // MUTE
    // =========================

    function handleToggleMute() {

        const video = videoRef.current;

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

    }


    // =========================
    // FULLSCREEN
    // =========================

    async function handleToggleFullscreen() {

        const player = playerRef.current;

        if (!player) {
            return;
        }


        try {

            if (!document.fullscreenElement) {

                if (player.requestFullscreen) {

                    await player.requestFullscreen();

                } else if (player.webkitRequestFullscreen) {

                    player.webkitRequestFullscreen();

                }


            } else {

                if (document.exitFullscreen) {

                    await document.exitFullscreen();

                } else if (document.webkitExitFullscreen) {

                    document.webkitExitFullscreen();

                }

            }

        } catch (error) {

            console.error(
                "Não foi possível alterar o modo fullscreen:",
                error
            );

        }

    }


    // =========================
    // DETECTAR FULLSCREEN
    // =========================

    useEffect(() => {

        function handleFullscreenChange() {

            const isActive =
                Boolean(document.fullscreenElement);


            setIsFullscreen(
                isActive
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


    // =========================
    // ERRO
    // =========================

    function handleVideoError() {

        console.error(
            "[PLAYER] Não foi possível carregar:",
            src
        );


        setHasError(true);

    }


    // =========================
    // DEBUG
    // =========================

    useEffect(() => {

        console.log(
            "[PLAYER STATE]",
            {
                isPlaying,
                currentTime,
                duration,
                volume,
                isMuted,
                isFullscreen
            }
        );

    }, [
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isFullscreen
    ]);


    return (

        <div
            ref={playerRef}
            className={`${styles.player} ${
                isFullscreen
                    ? styles.fullscreen
                    : ""
            }`}
        >

            {/* =========================
                VIDEO
            ========================= */}

            <video
                ref={videoRef}

                className={styles.video}

                src={src}

                playsInline

                preload="metadata"

                onPlay={handleVideoPlay}

                onPause={handleVideoPause}

                onTimeUpdate={handleTimeUpdate}

                onLoadedMetadata={handleLoadedMetadata}

                onError={handleVideoError}
            />


            {/* =========================
                ERRO
            ========================= */}

            {hasError && (

                <div className={styles.errorOverlay}>

                    <span className={styles.errorIcon}>
                        ⚠️
                    </span>


                    <strong>
                        Não foi possível reproduzir este conteúdo.
                    </strong>


                    <p>
                        Verifique se o link aponta diretamente
                        para um arquivo de vídeo compatível.
                    </p>

                </div>

            )}


            {!hasError && (

                <>

                    {/* =========================
                        BOTÃO CENTRAL
                    ========================= */}

                    <button
                        type="button"

                        className={styles.playButton}

                        onClick={handleTogglePlay}

                        aria-label={
                            isPlaying
                                ? "Pausar vídeo"
                                : "Reproduzir vídeo"
                        }
                    >

                        {isPlaying
                            ? "❚❚"
                            : "▶"
                        }

                    </button>


                    {/* =========================
                        CONTROLES
                    ========================= */}

                    <div className={styles.controls}>


                        {/* PLAY / PAUSE */}

                        <button
                            type="button"

                            className={styles.controlButton}

                            onClick={handleTogglePlay}

                            aria-label={
                                isPlaying
                                    ? "Pausar vídeo"
                                    : "Reproduzir vídeo"
                            }
                        >

                            {isPlaying
                                ? "❚❚"
                                : "▶"
                            }

                        </button>


                        {/* TEMPO */}

                        <span className={styles.time}>
                            {formatTime(currentTime)}
                        </span>


                        {/* PROGRESSO */}

                        <input
                            type="range"

                            className={styles.progress}

                            min="0"

                            max={duration || 0}

                            step="0.1"

                            value={currentTime}

                            onChange={handleSeek}

                            aria-label="Progresso do vídeo"
                        />


                        {/* DURAÇÃO */}

                        <span className={styles.time}>
                            {formatTime(duration)}
                        </span>


                        {/* MUTE */}

                        <button
                            type="button"

                            className={styles.controlButton}

                            onClick={handleToggleMute}

                            aria-label={
                                isMuted
                                    ? "Ativar som"
                                    : "Silenciar vídeo"
                            }
                        >

                            {getVolumeIcon(
                                volume,
                                isMuted
                            )}

                        </button>


                        {/* VOLUME */}

                        <input
                            type="range"

                            className={styles.volume}

                            min="0"

                            max="1"

                            step="0.01"

                            value={
                                isMuted
                                    ? 0
                                    : volume
                            }

                            onChange={handleVolumeChange}

                            aria-label="Volume"
                        />


                        {/* FULLSCREEN */}

                        <button
                            type="button"

                            className={styles.controlButton}

                            onClick={handleToggleFullscreen}

                            aria-label={
                                isFullscreen
                                    ? "Sair da tela cheia"
                                    : "Entrar em tela cheia"
                            }
                        >

                            {isFullscreen
                                ? "⛶"
                                : "⛶"
                            }

                        </button>

                    </div>

                </>

            )}


            {/* =========================
                DEBUG
            ========================= */}

            <div className={styles.debug}>

                <span>
                    {isPlaying
                        ? "▶ Reproduzindo"
                        : "⏸ Pausado"
                    }
                </span>


                <span>
                    {formatTime(currentTime)}
                    {" / "}
                    {formatTime(duration)}
                </span>


                <span>
                    🔊 {Math.round(volume * 100)}%
                </span>


                <span>
                    {isFullscreen
                        ? "⛶ Fullscreen"
                        : "▣ Normal"
                    }
                </span>

            </div>

        </div>

    );

}


// =========================
// ÍCONE DE VOLUME
// =========================

function getVolumeIcon(volume, isMuted) {

    if (isMuted || volume === 0) {

        return "🔇";

    }


    if (volume < 0.5) {

        return "🔉";

    }


    return "🔊";

}


// =========================
// FORMATAR TEMPO
// =========================

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        return "00:00";

    }


    const hours =
        Math.floor(seconds / 3600);


    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );


    const remainingSeconds =
        Math.floor(seconds % 60);


    if (hours > 0) {

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

    }


    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;

}


export default VideoPlayer;