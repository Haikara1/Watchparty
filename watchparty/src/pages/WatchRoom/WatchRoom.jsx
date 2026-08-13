import { useEffect, useState } from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    getRoomById,
    updateRoomPlayback
} from "../../services/roomStorage";

import playbackService from "../../services/playbackService";

import realtimeService from "../../services/realtimeService";


import styles from "./WatchRoom.module.css";
import VideoPlayer from "../../components/VideoPlayer/VideoPlayer";


function WatchRoom() {

    const { roomId } = useParams();

    const navigate = useNavigate();


    const [room, setRoom] = useState(null);

    const [isLoading, setIsLoading] = useState(true);

    const [playbackState, setPlaybackState] = useState({
        isPlaying: false,
        currentTime: 0
    });


    useEffect(() => {

        const foundRoom =
            getRoomById(roomId);


        if (foundRoom) {

            setRoom(
                foundRoom
            );


            setPlaybackState({

                isPlaying:
                    foundRoom.playback
                        ?.isPlaying
                    ?? false,

                currentTime:
                    foundRoom.playback
                        ?.currentTime
                    ?? 0

            });

        } else {

            setRoom(null);

        }


        setIsLoading(false);

    }, [roomId]);

    useEffect(() => {

        if (!roomId) {

            return;

        }


        const channel =
            realtimeService.createRoomChannel(
                roomId
            );


        realtimeService
            .connect(channel)
            .then(() => {

                console.log(
                    "[Realtime] Canal conectado:",
                    roomId
                );

            })
            .catch((error) => {

                console.error(
                    "[Realtime] Erro ao conectar:",
                    error
                );

            });


        return () => {

            realtimeService.disconnect(
                channel
            );

        };

    }, [roomId]);

    function handlePlaybackPlay(state) {

        const event =
            playbackService.createPlayEvent(
                state.currentTime
            );


        const newPlaybackState = {

            isPlaying: true,

            currentTime:
                state.currentTime

        };


        setPlaybackState(
            newPlaybackState
        );


        updateRoomPlayback(
            roomId,
            newPlaybackState
        );


        console.log(
            "Playback salvo:",
            event
        );

    }

    function handlePlaybackPause(state) {

        const event =
            playbackService.createPauseEvent(
                state.currentTime
            );


        const newPlaybackState = {

            isPlaying: false,

            currentTime:
                state.currentTime

        };


        setPlaybackState(
            newPlaybackState
        );


        updateRoomPlayback(
            roomId,
            newPlaybackState
        );


        console.log(
            "Playback salvo:",
            event
        );

    }

    function handlePlaybackSeek(state) {

        const event =
            playbackService.createSeekEvent(
                state.currentTime
            );


        const newPlaybackState = {

            ...playbackState,

            currentTime:
                state.currentTime

        };


        setPlaybackState(
            newPlaybackState
        );


        updateRoomPlayback(
            roomId,
            newPlaybackState
        );


        console.log(
            "Playback salvo:",
            event
        );

    }


    function handleGoHome() {

        navigate("/");

    }


    if (isLoading) {

        return (

            <main className={styles.page}>

                <div className={styles.loading}>

                    <span className={styles.spinner}>
                        ◌
                    </span>

                    <p>
                        Carregando sala...
                    </p>

                </div>

            </main>

        );

    }


    if (!room) {

        return (

            <main className={styles.page}>

                <div className={styles.notFound}>

                    <span className={styles.notFoundIcon}>
                        🎬
                    </span>


                    <h1>
                        Sala não encontrada
                    </h1>


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


    return (

        <main className={styles.page}>

            {/* =========================
                HEADER DA SALA
            ========================= */}

            <header className={styles.header}>

                <div className={styles.brand}>

                    <span className={styles.brandIcon}>
                        🎬
                    </span>

                    <span>
                        WatchParty
                    </span>

                </div>


                <div className={styles.roomInfo}>

                    <span className={styles.roomName}>
                        {room.name}
                    </span>


                    <span className={styles.roomMembers}>
                        👥 0/{room.maxUsers}
                    </span>

                </div>


                <button
                    type="button"
                    className={styles.headerButton}
                    aria-label="Configurações da sala"
                >
                    ⚙
                </button>

            </header>


            {/* =========================
                ÁREA PRINCIPAL
            ========================= */}

            <div className={styles.workspace}>


                {/* =========================
                    PLAYER
                ========================= */}

                <section className={styles.playerSection}>

                    <VideoPlayer
                        src={room.contentUrl}

                        playback={playbackState}

                        onPlay={handlePlaybackPlay}

                        onPause={handlePlaybackPause}

                        onSeek={handlePlaybackSeek}
                    />

                    <div
                        style={{
                            position: "absolute",
                            left: "12px",
                            top: "12px",
                            zIndex: 20,
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: "rgba(0, 0, 0, 0.7)",
                            color: "#fff",
                            fontSize: "11px",
                            pointerEvents: "none"
                        }}
                    >
                        {playbackState.isPlaying
                            ? "▶ Reproduzindo"
                            : "⏸ Pausado"
                        }

                        {" • "}

                        {Math.floor(
                            playbackState.currentTime
                        )}s
                    </div>


                </section>


                {/* =========================
                    CHAT
                ========================= */}

                <aside className={styles.chat}>

                    <div className={styles.chatHeader}>

                        <div>

                            <strong>
                                Chat
                            </strong>

                            <span>
                                0 participantes
                            </span>

                        </div>

                    </div>


                    <div className={styles.chatMessages}>

                        <div className={styles.emptyChat}>

                            <span>
                                💬
                            </span>


                            <p>
                                Nenhuma mensagem ainda.
                            </p>


                            <small>
                                Comece a conversa!
                            </small>

                        </div>

                    </div>


                    <form className={styles.chatForm}>

                        <input
                            type="text"
                            placeholder="Digite uma mensagem..."
                            aria-label="Mensagem"
                        />


                        <button
                            type="submit"
                            aria-label="Enviar mensagem"
                        >
                            ➤
                        </button>

                    </form>

                </aside>

            </div>

        </main>

    );

}


export default WatchRoom;