import { useEffect, useRef, useState } from "react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import {
    getRoomById
} from "../../services/roomStorage";

import realtimeService from "../../services/realtimeService";

import styles from "./WatchRoom.module.css";


function WatchRoom() {

    const { roomId } = useParams();

    const navigate = useNavigate();

    const channelRef = useRef(null);

    const isConnectingRef = useRef(false);


    /*
    ============================================================
    SALA
    ============================================================
    */

    const [room, setRoom] =
        useState(null);


    const [isLoading, setIsLoading] =
        useState(true);


    /*
    ============================================================
    COMPARTILHAMENTO
    ============================================================
    */

    const [copyStatus, setCopyStatus] =
        useState("idle");


    const [canNativeShare] =
        useState(
            () =>
                typeof navigator !== "undefined" &&
                typeof navigator.share === "function"
        );


    const shareFeedbackTimeoutRef =
        useRef(null);


    function getShareUrl() {

        return `${window.location.origin}/watch/${roomId}`;

    }


    function showCopyStatus(status) {

        if (
            shareFeedbackTimeoutRef.current
        ) {

            clearTimeout(
                shareFeedbackTimeoutRef.current
            );

        }


        setCopyStatus(
            status
        );


        shareFeedbackTimeoutRef.current =
            setTimeout(
                () => {

                    setCopyStatus(
                        "idle"
                    );

                },
                3000
            );

    }


    async function handleCopyRoomLink() {

        try {

            if (
                !navigator.clipboard?.writeText
            ) {

                throw new Error(
                    "Clipboard API indisponível."
                );

            }


            await navigator.clipboard.writeText(
                getShareUrl()
            );


            showCopyStatus(
                "success"
            );

        } catch (error) {

            console.error(
                "[Compartilhamento] Não foi possível copiar o link:",
                error
            );


            showCopyStatus(
                "error"
            );

        }

    }


    async function handleNativeShare() {

        try {

            await navigator.share({

                title:
                    "WatchParty",

                text:
                    `Venha assistir comigo na sala "${room.name}".`,

                url:
                    getShareUrl()

            });

        } catch (error) {

            if (
                error?.name !== "AbortError"
            ) {

                console.error(
                    "[Compartilhamento] Não foi possível compartilhar a sala:",
                    error
                );

            }

        }

    }


    useEffect(
        () => {

            return () => {

                if (
                    shareFeedbackTimeoutRef.current
                ) {

                    clearTimeout(
                        shareFeedbackTimeoutRef.current
                    );

                }

            };

        },
        []
    );


    /*
    ============================================================
    CHAT
    ============================================================
    */

    const [messages, setMessages] =
        useState([]);


    const [chatMessage, setChatMessage] =
        useState("");


    /*
    ============================================================
    PRESENCE
    ============================================================
    */

    const [participants, setParticipants] =
        useState([]);


    /*
    ============================================================
    CONTROLE DO CABEÇALHO DO CHAT
    ============================================================
    */

    const [showParticipants, setShowParticipants] =
        useState(false);


    /*
    ============================================================
    IDENTIDADE TEMPORÁRIA DO USUÁRIO
    ============================================================
    */

    const userIdRef =
        useRef(
            crypto.randomUUID()
        );


    const usernameRef =
        useRef(
            `Usuário ${Math.floor(
                Math.random() * 1000
            )}`
        );


    /*
    ============================================================
    CARREGAR SALA
    ============================================================
    */

    useEffect(
        () => {

            let isActive = true;


            async function loadRoom() {

                setIsLoading(
                    true
                );


                try {

                    console.log(
                        "[Supabase] Carregando sala:",
                        roomId
                    );


                    const foundRoom =
                        await getRoomById(
                            roomId
                        );


                    if (!isActive) {

                        return;

                    }


                    if (foundRoom) {

                        console.log(
                            "[Supabase] Sala carregada:",
                            foundRoom
                        );


                        setRoom(
                            foundRoom
                        );

                    } else {

                        console.warn(
                            "[Supabase] Sala não encontrada:",
                            roomId
                        );


                        setRoom(
                            null
                        );

                    }

                } catch (error) {

                    console.error(
                        "[Supabase] Erro ao carregar sala:",
                        error
                    );


                    if (isActive) {

                        setRoom(
                            null
                        );

                    }

                } finally {

                    if (isActive) {

                        setIsLoading(
                            false
                        );

                    }

                }

            }


            if (roomId) {

                loadRoom();

            } else {

                setRoom(
                    null
                );

                setIsLoading(
                    false
                );

            }


            return () => {

                isActive = false;

            };

        },
        [roomId]
    );


    /*
    ============================================================
    SUPABASE REALTIME
    ============================================================
    */

    useEffect(
        () => {

            if (!roomId) {

                return;

            }


            /*
            ====================================================
            EVITAR DUPLICAR CONEXÃO
            ====================================================
            */

            if (
                isConnectingRef.current
            ) {

                console.log(
                    "[Realtime] Conexão já está em andamento."
                );


                return;

            }


            let isActive = true;


            isConnectingRef.current =
                true;


            console.log(
                "[Realtime] Iniciando conexão da sala:",
                roomId
            );


            const channel =
                realtimeService.createRoomChannel(
                    roomId
                );


            channelRef.current =
                channel;


            /*
            ====================================================
            CHAT
            ====================================================
            */

            realtimeService.onChatMessage(
                channel,
                message => {

                    if (!isActive) {

                        return;

                    }


                    if (!message) {

                        return;

                    }


                    console.log(
                        "[Realtime] Chat recebido:",
                        message
                    );


                    setMessages(
                        previous => {

                            const alreadyExists =
                                previous.some(
                                    item =>
                                        item.id ===
                                        message.id
                                );


                            if (
                                alreadyExists
                            ) {

                                return previous;

                            }


                            return [

                                ...previous,

                                message

                            ];

                        }
                    );

                }
            );


            /*
            ====================================================
            PRESENCE
            ====================================================
            */

            realtimeService.onPresenceChange(
                channel,
                state => {

                    if (!isActive) {

                        return;

                    }


                    console.log(
                        "[Presence] Estado recebido:",
                        state
                    );


                    const users = [];


                    Object.entries(
                        state || {}
                    ).forEach(
                        ([key, entries]) => {

                            if (
                                !Array.isArray(
                                    entries
                                )
                            ) {

                                return;

                            }


                            entries.forEach(
                                user => {

                                    if (!user) {

                                        return;

                                    }


                                    users.push({

                                        ...user,

                                        presenceKey:
                                            key

                                    });

                                }
                            );

                        }
                    );


                    /*
                    ==============================================
                    REMOVER DUPLICADOS
                    ==============================================
                    */

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


                    console.log(
                        "[Presence] Participantes:",
                        uniqueUsers
                    );


                    setParticipants(
                        uniqueUsers
                    );

                }
            );


            /*
            ====================================================
            CONECTAR
            ====================================================
            */

            realtimeService
                .connect(
                    channel
                )

                .then(
                    async () => {

                        if (!isActive) {

                            return;

                        }


                        console.log(
                            "[Realtime] Canal conectado:",
                            roomId
                        );


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


                            console.log(
                                "[Presence] Usuário entrou na sala:",
                                currentUser
                            );

                        } catch (error) {

                            console.error(
                                "[Presence] Erro ao registrar usuário:",
                                error
                            );

                        }

                    }
                )

                .catch(
                    error => {

                        if (!isActive) {

                            return;

                        }


                        console.error(
                            "[Realtime] Erro ao conectar:",
                            error
                        );

                    }
                )

                .finally(
                    () => {

                        if (isActive) {

                            isConnectingRef.current =
                                false;

                        }

                    }
                );


            /*
            ====================================================
            CLEANUP
            ====================================================
            */

            return () => {

                isActive = false;


                isConnectingRef.current =
                    false;


                setParticipants(
                    []
                );


                setShowParticipants(
                    false
                );


                if (
                    channelRef.current ===
                    channel
                ) {

                    console.log(
                        "[Realtime] Desconectando canal:",
                        roomId
                    );


                    realtimeService.disconnect(
                        channel
                    );


                    channelRef.current =
                        null;

                }

            };

        },
        [roomId]
    );


    /*
    ============================================================
    ENVIAR MENSAGEM
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

            console.warn(
                "[Realtime] Canal ainda não está disponível."
            );


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


        console.log(
            "[Realtime] Enviando chat:",
            message
        );


        try {

            const result =
                await realtimeService.sendChatMessage(
                    activeChannel,
                    message
                );


            console.log(
                "[Realtime] Chat enviado:",
                result
            );


            setMessages(
                previous => {

                    const alreadyExists =
                        previous.some(
                            item =>
                                item.id ===
                                message.id
                        );


                    if (
                        alreadyExists
                    ) {

                        return previous;

                    }


                    return [

                        ...previous,

                        message

                    ];

                }
            );


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
    VOLTAR PARA HOME
    ============================================================
    */

    function handleGoHome() {

        navigate(
            "/"
        );

    }


    /*
    ============================================================
    LOADING
    ============================================================
    */

    if (isLoading) {

        return (

            <main
                className={
                    styles.page
                }
            >

                <div
                    className={
                        styles.loading
                    }
                >

                    <span
                        className={
                            styles.spinner
                        }
                    >
                        ◌
                    </span>


                    <p>
                        Carregando sala...
                    </p>

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

            <main
                className={
                    styles.page
                }
            >

                <div
                    className={
                        styles.notFound
                    }
                >

                    <span
                        className={
                            styles.notFoundIcon
                        }
                    >
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
                        className={
                            styles.primaryButton
                        }
                        onClick={
                            handleGoHome
                        }
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

    return (

        <main
            className={
                styles.page
            }
        >

            {/* ==================================================
                HEADER
            ================================================== */}

            <header
                className={
                    styles.header
                }
            >

                <div
                    className={
                        styles.brand
                    }
                >

                    <span
                        className={
                            styles.brandIcon
                        }
                    >
                        🎬
                    </span>


                    <span>
                        WatchParty
                    </span>

                </div>


                <div
                    className={
                        styles.roomInfo
                    }
                >

                    <span
                        className={
                            styles.roomName
                        }
                    >
                        {room.name}
                    </span>


                    <span
                        className={
                            styles.roomMembers
                        }
                    >
                        👥 {participants.length}/{room.maxUsers}
                    </span>

                </div>


                <div
                    className={
                        styles.roomActions
                    }
                >

                    <button
                        type="button"
                        className={`${styles.shareButton} ${
                            copyStatus === "success"
                                ? styles.copySuccess
                                : copyStatus === "error"
                                    ? styles.copyError
                                    : ""
                        }`}
                        onClick={
                            handleCopyRoomLink
                        }
                        aria-live="polite"
                    >

                        <span
                            aria-hidden="true"
                        >
                            {
                                copyStatus === "success"
                                    ? "✓"
                                    : copyStatus === "error"
                                        ? "!"
                                        : "🔗"
                            }
                        </span>


                        <span
                            className={
                                styles.shareButtonText
                            }
                        >
                            {
                                copyStatus === "success"
                                    ? "Link copiado!"
                                    : copyStatus === "error"
                                        ? "Não foi possível copiar"
                                        : "Copiar link"
                            }
                        </span>

                    </button>


                    {canNativeShare && (

                        <button
                            type="button"
                            className={
                                styles.shareButton
                            }
                            onClick={
                                handleNativeShare
                            }
                        >

                            <span
                                aria-hidden="true"
                            >
                                📤
                            </span>


                            <span
                                className={
                                    styles.shareButtonText
                                }
                            >
                                Compartilhar
                            </span>

                        </button>

                    )}


                    <button
                        type="button"
                        className={
                            styles.headerButton
                        }
                        aria-label="Configurações da sala"
                    >
                        ⚙
                    </button>

                </div>

            </header>


            {/* ==================================================
                WORKSPACE
            ================================================== */}

            <div
                className={
                    styles.workspace
                }
            >

                {/* ==================================================
                    ÁREA DE CONTEÚDO
                ================================================== */}

                <section
                    className={
                        styles.playerSection
                    }
                >

                    <div
                        className={
                            styles.videoComingSoon
                        }
                    >

                        <div
                            className={
                                styles.videoComingSoonIcon
                            }
                        >
                            🎬
                        </div>


                        <div
                            className={
                                styles.videoComingSoonContent
                            }
                        >

                            <span
                                className={
                                    styles.videoComingSoonBadge
                                }
                            >
                                EM DESENVOLVIMENTO
                            </span>


                            <h1>
                                Reprodução de vídeo
                            </h1>


                            <p>
                                Este recurso está sendo desenvolvido
                                e chegará em breve ao WatchParty.
                            </p>


                            <span
                                className={
                                    styles.videoComingSoonDescription
                                }
                            >
                                A reprodução por link externo está
                                temporariamente desativada. Estamos
                                preparando uma nova experiência para
                                assistir juntos.
                            </span>

                        </div>

                    </div>

                </section>


                {/* ==================================================
                    CHAT
                ================================================== */}

                <aside
                    className={
                        styles.chat
                    }
                >

                    {/* ==================================================
                        HEADER DO CHAT
                    ================================================== */}

                    <div
                        className={
                            styles.chatHeader
                        }
                    >

                        {!showParticipants ? (

                            <div
                                className={
                                    styles.chatHeaderInfo
                                }
                            >

                                <strong>
                                    Chat
                                </strong>


                                <button
                                    type="button"
                                    className={
                                        styles.chatParticipantsButton
                                    }
                                    onClick={() =>
                                        setShowParticipants(
                                            true
                                        )
                                    }
                                    aria-label="Ver participantes"
                                >

                                    <span>
                                        {
                                            participants.length
                                        }{" "}

                                        {
                                            participants.length === 1
                                                ? "participante"
                                                : "participantes"
                                        }
                                    </span>


                                    <span
                                        className={
                                            styles.chatHeaderArrow
                                        }
                                    >
                                        →
                                    </span>

                                </button>

                            </div>

                        ) : (

                            <div
                                className={
                                    styles.participantsHeader
                                }
                            >

                                <button
                                    type="button"
                                    className={
                                        styles.participantsBackButton
                                    }
                                    onClick={() =>
                                        setShowParticipants(
                                            false
                                        )
                                    }
                                    aria-label="Voltar para o chat"
                                >
                                    ←
                                </button>


                                <div
                                    className={
                                        styles.participantsTitle
                                    }
                                >

                                    <strong>
                                        Participantes
                                    </strong>


                                    <span>

                                        {
                                            participants.length
                                        }{" "}

                                        {
                                            participants.length === 1
                                                ? "pessoa"
                                                : "pessoas"
                                        }

                                    </span>

                                </div>

                            </div>

                        )}

                    </div>


                    {/* ==================================================
                        CONTEÚDO
                    ================================================== */}

                    {showParticipants ? (

                        <div
                            className={
                                styles.participantsList
                            }
                        >

                            {participants.length === 0 ? (

                                <div
                                    className={
                                        styles.emptyParticipants
                                    }
                                >

                                    <span>
                                        👥
                                    </span>


                                    <p>
                                        Nenhum participante encontrado.
                                    </p>

                                </div>

                            ) : (

                                participants.map(
                                    participant => {

                                        const isCurrentUser =
                                            participant.userId ===
                                            userIdRef.current;


                                        return (

                                            <div
                                                key={
                                                    participant.userId
                                                }
                                                className={
                                                    styles.participantItem
                                                }
                                            >

                                                <div
                                                    className={
                                                        styles.participantAvatar
                                                    }
                                                >

                                                    {
                                                        participant.username
                                                            ?.charAt(0)
                                                            ?.toUpperCase()
                                                        || "U"
                                                    }

                                                </div>


                                                <div
                                                    className={
                                                        styles.participantInfo
                                                    }
                                                >

                                                    <strong>

                                                        {
                                                            participant.username
                                                        }


                                                        {isCurrentUser && (

                                                            <span
                                                                className={
                                                                    styles.youLabel
                                                                }
                                                            >
                                                                Você
                                                            </span>

                                                        )}

                                                    </strong>


                                                    <span>
                                                        ● Online
                                                    </span>

                                                </div>

                                            </div>

                                        );

                                    }
                                )

                            )}

                        </div>

                    ) : (

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

                            ) : (

                                messages.map(
                                    message => {

                                        const isOwnMessage =
                                            message.userId ===
                                            userIdRef.current;


                                        return (

                                            <div
                                                key={
                                                    message.id
                                                }
                                                className={`
                                                    ${styles.chatMessage}
                                                    ${
                                                        isOwnMessage
                                                            ? styles.chatMessageOwn
                                                            : ""
                                                    }
                                                `}
                                            >

                                                <div
                                                    className={
                                                        styles.chatMessageHeader
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


                                                <p
                                                    className={
                                                        styles.chatMessageText
                                                    }
                                                >
                                                    {
                                                        message.message
                                                    }
                                                </p>

                                            </div>

                                        );

                                    }
                                )

                            )}

                        </div>

                    )}


                    {/* ==================================================
                        FORMULÁRIO DO CHAT
                    ================================================== */}

                    {!showParticipants && (

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
                                placeholder="Digite uma mensagem..."
                                aria-label="Mensagem"
                                value={chatMessage}
                                onChange={
                                    event =>
                                        setChatMessage(
                                            event.target.value
                                        )
                                }
                                maxLength={500}
                            />


                            <button
                                type="submit"
                                aria-label="Enviar mensagem"
                                disabled={
                                    !chatMessage.trim()
                                }
                            >
                                ➤
                            </button>

                        </form>

                    )}

                </aside>

            </div>

        </main>

    );

}


/*
============================================================
FORMATAR HORÁRIO DA MENSAGEM
============================================================
*/

function formatMessageTime(timestamp) {

    if (!timestamp) {

        return "";

    }


    return new Date(
        timestamp
    ).toLocaleTimeString(
        "pt-BR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


export default WatchRoom;