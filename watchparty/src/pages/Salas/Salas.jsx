import { useState } from "react";

import {
    useNavigate
} from "react-router-dom";

import {
    getRooms,
    saveRooms
} from "../../services/roomStorage";

import styles from "./Salas.module.css";


function Salas() {

    const navigate = useNavigate();


    const [rooms, setRooms] = useState(
        () => getRooms()
    );


    /*
    ============================================================
    ENTRAR NA SALA
    ============================================================
    */

    function handleEnterRoom(roomId) {

        navigate(
            `/watch/${roomId}`
        );

    }


    /*
    ============================================================
    CRIAR NOVA SALA
    ============================================================
    */

    function handleCreateRoom() {

        navigate(
            "/salas/criar"
        );

    }


    /*
    ============================================================
    EXCLUIR SALA
    ============================================================
    */

    function handleDeleteRoom(roomId) {

        const confirmed =
            window.confirm(
                "Tem certeza que deseja excluir esta sala?"
            );


        if (!confirmed) {

            return;

        }


        const updatedRooms =
            rooms.filter(
                (room) =>
                    room.id !== roomId
            );


        saveRooms(
            updatedRooms
        );


        setRooms(
            updatedRooms
        );

    }


    /*
    ============================================================
    FORMATAR DATA
    ============================================================
    */

    function formatDate(date) {

        if (!date) {

            return "Data desconhecida";

        }


        const parsedDate =
            new Date(date);


        if (
            Number.isNaN(
                parsedDate.getTime()
            )
        ) {

            return "Data desconhecida";

        }


        return parsedDate.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    }


    /*
    ============================================================
    RENDER
    ============================================================
    */

    return (

        <main className={styles.page}>


            {/* ==================================================
                HEADER
            ================================================== */}

            <header className={styles.header}>

                <div>

                    <span
                        className={styles.eyebrow}
                    >
                        WATCHPARTY
                    </span>


                    <h1>
                        Suas salas
                    </h1>


                    <p>
                        Acesse suas salas e continue
                        assistindo com seus amigos.
                    </p>

                </div>


                {/* ==================================================
                    CRIAR SALA
                ================================================== */}

                <button
                    type="button"
                    className={styles.createButton}
                    onClick={handleCreateRoom}
                >
                    + Criar sala
                </button>

            </header>


            {/* ==================================================
                CONTEÚDO
            ================================================== */}

            <section className={styles.content}>


                {/* ==================================================
                    NENHUMA SALA
                ================================================== */}

                {rooms.length === 0 && (

                    <div className={styles.empty}>

                        <div
                            className={styles.emptyIcon}
                        >
                            🎬
                        </div>


                        <h2>
                            Nenhuma sala criada
                        </h2>


                        <p>
                            Crie sua primeira sala para
                            começar uma sessão WatchParty.
                        </p>


                        <button
                            type="button"
                            className={styles.emptyButton}
                            onClick={handleCreateRoom}
                        >
                            Criar minha primeira sala
                        </button>

                    </div>

                )}


                {/* ==================================================
                    LISTA DE SALAS
                ================================================== */}

                {rooms.length > 0 && (

                    <div className={styles.roomsGrid}>

                        {rooms.map((room) => (

                            <article
                                key={room.id}
                                className={styles.roomCard}
                            >


                                {/* ==================================================
                                    TOPO DO CARD
                                ================================================== */}

                                <div
                                    className={styles.cardTop}
                                >

                                    <span
                                        className={
                                            `${styles.roomType} ${
                                                room.type === "private"
                                                    ? styles.private
                                                    : styles.public
                                            }`
                                        }
                                    >

                                        {room.type === "private"
                                            ? "🔒 Privada"
                                            : "🌎 Pública"
                                        }

                                    </span>


                                    <button
                                        type="button"
                                        className={styles.deleteButton}
                                        onClick={() =>
                                            handleDeleteRoom(
                                                room.id
                                            )
                                        }
                                        aria-label={
                                            `Excluir sala ${room.name}`
                                        }
                                    >
                                        🗑️
                                    </button>

                                </div>


                                {/* ==================================================
                                    ÍCONE
                                ================================================== */}

                                <div
                                    className={styles.cardIcon}
                                >
                                    🎬
                                </div>


                                {/* ==================================================
                                    INFORMAÇÕES
                                ================================================== */}

                                <div
                                    className={styles.cardInfo}
                                >

                                    <h2>
                                        {room.name}
                                    </h2>


                                    <div
                                        className={styles.metadata}
                                    >

                                        <span>
                                            👥 Até {room.maxUsers}{" "}
                                            participantes
                                        </span>


                                        <span>
                                            📅{" "}
                                            {formatDate(
                                                room.createdAt
                                            )}
                                        </span>

                                    </div>

                                </div>


                                {/* ==================================================
                                    BOTÃO ENTRAR
                                ================================================== */}

                                <button
                                    type="button"
                                    className={styles.enterButton}
                                    onClick={() =>
                                        handleEnterRoom(
                                            room.id
                                        )
                                    }
                                >

                                    <span>
                                        ▶
                                    </span>

                                    Entrar na sala

                                </button>

                            </article>

                        ))}

                    </div>

                )}

            </section>

        </main>

    );

}


export default Salas;

