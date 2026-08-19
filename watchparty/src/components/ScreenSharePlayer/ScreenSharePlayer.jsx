import {
    useEffect,
    useRef,
    useState
} from "react";

import styles from "./ScreenSharePlayer.module.css";


function ScreenSharePlayer({
    stream,
    sharerName = "Participante",
    onStop
}) {

    const videoRef =
        useRef(null);


    const containerRef =
        useRef(null);


    /*
    ============================================================
    ESTADOS DO PLAYER
    ============================================================
    */

    const [isMuted, setIsMuted] =
        useState(false);


    const [volume, setVolume] =
        useState(1);


    const [isFullscreen, setIsFullscreen] =
        useState(false);


    const [isPictureInPicture, setIsPictureInPicture] =
        useState(false);


    const [showControls, setShowControls] =
        useState(true);


    const [audioBlocked, setAudioBlocked] =
        useState(false);


    const [isPlaying, setIsPlaying] =
        useState(true);


    const controlsTimeoutRef =
        useRef(null);


    /*
    ============================================================
    CONECTAR STREAM AO VIDEO
    ============================================================
    */

    useEffect(
        () => {

            const video =
                videoRef.current;


            if (
                !video ||
                !stream
            ) {

                return;

            }


            if (
                video.srcObject !==
                stream
            ) {

                video.srcObject =
                    stream;

            }


            video.volume =
                volume;


            video.muted =
                isMuted;


            /*
            ====================================================
            TENTAR REPRODUZIR
            ====================================================
            */

            const playVideo =
                async () => {

                    try {

                        await video.play();

                        setIsPlaying(
                            true
                        );

                        setAudioBlocked(
                            false
                        );

                    } catch (error) {

                        console.warn(
                            "[ScreenSharePlayer] Reprodução automática bloqueada:",
                            error
                        );


                        setAudioBlocked(
                            true
                        );

                        setIsPlaying(
                            false
                        );

                    }

                };


            playVideo();


            return () => {

                if (
                    video.srcObject ===
                    stream
                ) {

                    video.srcObject =
                        null;

                }

            };

        },
        [stream]
    );


    /*
    ============================================================
    ATUALIZAR VOLUME
    ============================================================
    */

    useEffect(
        () => {

            const video =
                videoRef.current;


            if (!video) {

                return;

            }


            video.volume =
                volume;


            video.muted =
                isMuted;

        },
        [
            volume,
            isMuted
        ]
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
    LIMPAR TIMEOUT DOS CONTROLES
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
    MOSTRAR HUD
    ============================================================
    */

    function showPlayerControls() {

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


    /*
    ============================================================
    PLAY / PAUSE
    ============================================================
    */

    async function handlePlayPause() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        try {

            if (
                video.paused
            ) {

                await video.play();

                setIsPlaying(
                    true
                );

                setAudioBlocked(
                    false
                );

            } else {

                video.pause();

                setIsPlaying(
                    false
                );

            }

        } catch (error) {

            console.error(
                "[ScreenSharePlayer] Erro ao reproduzir vídeo:",
                error
            );

        }


        showPlayerControls();

    }


    /*
    ============================================================
    MUTAR
    ============================================================
    */

    async function handleToggleMute() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        const nextMuted =
            !video.muted;


        video.muted =
            nextMuted;


        setIsMuted(
            nextMuted
        );


        if (
            !nextMuted &&
            video.paused
        ) {

            try {

                await video.play();

                setIsPlaying(
                    true
                );

                setAudioBlocked(
                    false
                );

            } catch (error) {

                console.warn(
                    "[ScreenSharePlayer] Não foi possível ativar o áudio:",
                    error
                );

            }

        }


        showPlayerControls();

    }


    /*
    ============================================================
    ALTERAR VOLUME
    ============================================================
    */

    function handleVolumeChange(event) {

        const nextVolume =
            Number(
                event.target.value
            );


        const video =
            videoRef.current;


        if (video) {

            video.volume =
                nextVolume;


            if (
                nextVolume > 0
            ) {

                video.muted =
                    false;

                setIsMuted(
                    false
                );

            }

        }


        setVolume(
            nextVolume
        );


        showPlayerControls();

    }


    /*
    ============================================================
    FULLSCREEN
    ============================================================
    */

    async function handleFullscreen() {

        const container =
            containerRef.current;


        if (!container) {

            return;

        }


        try {

            if (
                document.fullscreenElement
            ) {

                await document.exitFullscreen();

            } else {

                await container.requestFullscreen();

            }

        } catch (error) {

            console.error(
                "[ScreenSharePlayer] Erro no fullscreen:",
                error
            );

        }


        showPlayerControls();

    }


    /*
    ============================================================
    PICTURE IN PICTURE
    ============================================================
    */

    async function handlePictureInPicture() {

        const video =
            videoRef.current;


        if (
            !video
        ) {

            return;

        }


        if (
            !document.pictureInPictureEnabled
        ) {

            console.warn(
                "[ScreenSharePlayer] Picture-in-Picture não disponível."
            );


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


            await video.requestPictureInPicture();

            setIsPictureInPicture(
                true
            );

        } catch (error) {

            console.error(
                "[ScreenSharePlayer] Erro no Picture-in-Picture:",
                error
            );

        }


        showPlayerControls();

    }


    /*
    ============================================================
    DETECTAR SAÍDA DO PICTURE-IN-PICTURE
    ============================================================
    */

    useEffect(
        () => {

            const video =
                videoRef.current;


            if (!video) {

                return;

            }


            function handleEnterPictureInPicture() {

                setIsPictureInPicture(
                    true
                );

            }


            function handleLeavePictureInPicture() {

                setIsPictureInPicture(
                    false
                );

            }


            video.addEventListener(
                "enterpictureinpicture",
                handleEnterPictureInPicture
            );


            video.addEventListener(
                "leavepictureinpicture",
                handleLeavePictureInPicture
            );


            return () => {

                video.removeEventListener(
                    "enterpictureinpicture",
                    handleEnterPictureInPicture
                );


                video.removeEventListener(
                    "leavepictureinpicture",
                    handleLeavePictureInPicture
                );

            };

        },
        []
    );


    /*
    ============================================================
    ATIVAR ÁUDIO
    ============================================================
    */

    async function handleEnableAudio() {

        const video =
            videoRef.current;


        if (!video) {

            return;

        }


        try {

            video.muted =
                false;


            video.volume =
                volume > 0
                    ? volume
                    : 1;


            setVolume(
                volume > 0
                    ? volume
                    : 1
            );


            setIsMuted(
                false
            );


            await video.play();


            setIsPlaying(
                true
            );


            setAudioBlocked(
                false
            );

        } catch (error) {

            console.error(
                "[ScreenSharePlayer] Não foi possível ativar o áudio:",
                error
            );

        }


        showPlayerControls();

    }


    /*
    ============================================================
    CLIQUE NO VÍDEO
    ============================================================
    */

    function handleVideoClick() {

        handlePlayPause();

    }


    /*
    ============================================================
    ÍCONE DE VOLUME
    ============================================================
    */

    function getVolumeIcon() {

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
    RENDER
    ============================================================
    */

    return (

        <div
            ref={
                containerRef
            }
            className={
                `${styles.player} ${
                    isFullscreen
                        ? styles.fullscreen
                        : ""
                }`
            }
            onMouseMove={
                showPlayerControls
            }
            onMouseEnter={
                showPlayerControls
            }
        >

            {/* ==================================================
                VÍDEO
            ================================================== */}

            <video
                ref={
                    videoRef
                }
                className={
                    styles.video
                }
                autoPlay
                playsInline
                onClick={
                    handleVideoClick
                }
                onPlay={() =>
                    setIsPlaying(
                        true
                    )
                }
                onPause={() =>
                    setIsPlaying(
                        false
                    )
                }
            />


            {/* ==================================================
                IDENTIFICAÇÃO DO STREAM
            ================================================== */}

            <div
                className={
                    styles.streamBadge
                }
            >

                <span
                    className={
                        styles.liveDot
                    }
                />


                <span>
                    {sharerName} está compartilhando a tela
                </span>

            </div>


            {/* ==================================================
                AVISO DE ÁUDIO
            ================================================== */}

            {audioBlocked && (

                <button
                    type="button"
                    className={
                        styles.enableAudio
                    }
                    onClick={
                        handleEnableAudio
                    }
                >

                    <span>
                        🔊
                    </span>


                    <span>
                        Clique para ativar o áudio
                    </span>

                </button>

            )}


            {/* ==================================================
                HUD
            ================================================== */}

            <div
                className={
                    `${styles.controls} ${
                        showControls
                            ? styles.controlsVisible
                            : styles.controlsHidden
                    }`
                }
            >

                <div
                    className={
                        styles.controlsLeft
                    }
                >

                    {/* PLAY / PAUSE */}

                    <button
                        type="button"
                        className={
                            styles.controlButton
                        }
                        onClick={
                            handlePlayPause
                        }
                        aria-label={
                            isPlaying
                                ? "Pausar"
                                : "Reproduzir"
                        }
                    >

                        {
                            isPlaying
                                ? "⏸"
                                : "▶"
                        }

                    </button>


                    {/* VOLUME */}

                    <div
                        className={
                            styles.volumeControl
                        }
                    >

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
                                    ? "Ativar áudio"
                                    : "Silenciar"
                            }
                        >

                            {
                                getVolumeIcon()
                            }

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

                    </div>

                </div>


                <div
                    className={
                        styles.controlsRight
                    }
                >

                    {/* PICTURE-IN-PICTURE */}

                    {document.pictureInPictureEnabled && (

                        <button
                            type="button"
                            className={
                                styles.controlButton
                            }
                            onClick={
                                handlePictureInPicture
                            }
                            aria-label="Picture-in-Picture"
                        >

                            {
                                isPictureInPicture
                                    ? "▣"
                                    : "▣"
                            }

                        </button>

                    )}


                    {/* FULLSCREEN */}

                    <button
                        type="button"
                        className={
                            styles.controlButton
                        }
                        onClick={
                            handleFullscreen
                        }
                        aria-label={
                            isFullscreen
                                ? "Sair da tela cheia"
                                : "Tela cheia"
                        }
                    >

                        {
                            isFullscreen
                                ? "⛶"
                                : "⛶"
                        }

                    </button>


                    {/* PARAR */}

                    {onStop && (

                        <button
                            type="button"
                            className={
                                `${styles.stopButton}`
                            }
                            onClick={
                                onStop
                            }
                        >

                            ⏹

                            <span>
                                Parar compartilhamento
                            </span>

                        </button>

                    )}

                </div>

            </div>

        </div>

    );

}


export default ScreenSharePlayer;