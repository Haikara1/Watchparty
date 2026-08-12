import { useEffect, useState } from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    getRoomById
} from "../../services/roomStorage";

import styles from "./WatchRoom.module.css";
import VideoPlayer from "../../components/VideoPlayer/VideoPlayer";


function WatchRoom() {

    const { roomId } = useParams();

    const navigate = useNavigate();


    const [room, setRoom] = useState(null);

    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {

        const foundRoom =
            getRoomById(roomId);


        setRoom(foundRoom);

        setIsLoading(false);

    }, [roomId]);


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
                    />


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