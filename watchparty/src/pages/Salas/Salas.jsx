import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    useLocation,
    useNavigate
} from "react-router-dom";

import {
    deleteRoom,
    getRooms,
    saveRooms
} from "../../services/roomStorage";

import realtimeService from "../../services/realtimeService";
import {
    getOrCreateConnectionId
} from "../../services/participantIdentity";

import styles from "./Salas.module.css";


function Salas() {

    const navigate = useNavigate();
    const location = useLocation();


    const [rooms, setRooms] = useState(
        () => getRooms()
    );

    const [roomToDelete, setRoomToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const cancelDeleteButtonRef = useRef(null);
    const deletionInProgressRef = useRef(false);
    const capacityCheckInProgressRef = useRef(false);

    const [roomBeingChecked, setRoomBeingChecked] = useState(null);
    const [roomAccessError, setRoomAccessError] = useState(
        () =>
            location.state?.roomAccessError === "room-full"
                ? "Não é possível entrar nesta sala, pois ela está cheia."
                : ""
    );


    /*
    ============================================================
    ENTRAR NA SALA
    ============================================================
    */

    async function handleEnterRoom(room) {

        if (capacityCheckInProgressRef.current) {
            return;
        }

        capacityCheckInProgressRef.current = true;
        setRoomBeingChecked(room.id);
        setRoomAccessError("");

        try {
            const roomIsFull =
                await realtimeService.checkRoomCapacity(
                    room.id,
                    room.maxUsers,
                    getOrCreateConnectionId()
                );

            if (roomIsFull) {
                setRoomAccessError(
                    "Não é possível entrar nesta sala, pois ela está cheia."
                );
                return;
            }

            navigate(`/watch/${room.id}`);
        } catch (error) {
            console.warn(
                "Não foi possível pré-validar a capacidade da sala:",
                error
            );

            navigate(`/watch/${room.id}`);
        } finally {
            capacityCheckInProgressRef.current = false;
            setRoomBeingChecked(null);
        }

    }


    useEffect(() => {
        if (location.state?.roomAccessError !== "room-full") {
            return;
        }

        navigate(
            location.pathname,
            {
                replace: true,
                state: null
            }
        );
    }, [location.pathname, location.state, navigate]);


    useEffect(() => {
        if (!roomAccessError) {
            return undefined;
        }

        const timeoutId = setTimeout(() => {
            setRoomAccessError("");
        }, 5000);

        return () => clearTimeout(timeoutId);
    }, [roomAccessError]);


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

    async function handleDeleteRoom(roomId) {

        await deleteRoom(roomId);

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


    function openDeleteModal(event, room) {

        event.stopPropagation();
        setDeleteError("");
        setRoomToDelete(room);

    }


    function closeDeleteModal() {

        if (deletionInProgressRef.current) {

            return;

        }

        setDeleteError("");
        setRoomToDelete(null);

    }


    async function confirmRoomDeletion() {

        if (!roomToDelete || deletionInProgressRef.current) {

            return;

        }

        deletionInProgressRef.current = true;
        setIsDeleting(true);
        setDeleteError("");

        try {

            await handleDeleteRoom(roomToDelete.id);
            setRoomToDelete(null);

        } catch (error) {

            console.error("Erro ao excluir sala:", error);
            setDeleteError(
                "Não foi possível excluir a sala. Tente novamente."
            );

        } finally {

            deletionInProgressRef.current = false;
            setIsDeleting(false);

        }

    }


    useEffect(() => {

        if (!roomToDelete) {

            return undefined;

        }

        cancelDeleteButtonRef.current?.focus();

        function handleKeyDown(event) {

            if (
                event.key === "Escape" &&
                !deletionInProgressRef.current
            ) {

                closeDeleteModal();

            }

        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {

            document.removeEventListener("keydown", handleKeyDown);

        };

    }, [roomToDelete]);


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


            {roomAccessError && (
                <div
                    className={styles.roomAccessError}
                    role="alert"
                >
                    <span aria-hidden="true">!</span>
                    {roomAccessError}
                </div>
            )}


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
                                        onClick={(event) =>
                                            openDeleteModal(
                                                event,
                                                room
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
                                            room
                                        )
                                    }
                                    disabled={roomBeingChecked !== null}
                                >

                                    <span>
                                        ▶
                                    </span>

                                    {roomBeingChecked === room.id
                                        ? "Verificando..."
                                        : "Entrar na sala"
                                    }

                                </button>

                            </article>

                        ))}

                    </div>

                )}

            </section>


            {roomToDelete && (

                <div
                    className={styles.modalBackdrop}
                    onMouseDown={(event) => {

                        if (event.target === event.currentTarget) {

                            closeDeleteModal();

                        }

                    }}
                >

                    <div
                        className={styles.deleteModal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-room-title"
                        aria-describedby="delete-room-description"
                    >

                        <button
                            type="button"
                            className={styles.modalCloseButton}
                            onClick={closeDeleteModal}
                            disabled={isDeleting}
                            aria-label="Fechar"
                        >
                            &times;
                        </button>


                        <div
                            className={styles.modalIcon}
                            aria-hidden="true"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                            >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v5M14 11v5" />
                            </svg>
                        </div>


                        <h2 id="delete-room-title">
                            Excluir sala?
                        </h2>


                        <p id="delete-room-description">
                            Tem certeza que deseja excluir{` `}
                            <strong>“{roomToDelete.name}”</strong>?
                        </p>


                        <p className={styles.modalWarning}>
                            Esta ação não poderá ser desfeita.
                        </p>


                        {deleteError && (

                            <p className={styles.modalError} role="alert">
                                {deleteError}
                            </p>

                        )}


                        <div className={styles.modalActions}>

                            <button
                                ref={cancelDeleteButtonRef}
                                type="button"
                                className={styles.cancelDeleteButton}
                                onClick={closeDeleteModal}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>


                            <button
                                type="button"
                                className={styles.confirmDeleteButton}
                                onClick={confirmRoomDeletion}
                                disabled={isDeleting}
                            >
                                {isDeleting
                                    ? "Excluindo..."
                                    : "Excluir sala"
                                }
                            </button>

                        </div>

                    </div>

                </div>

            )}

        </main>

    );

}


export default Salas;

