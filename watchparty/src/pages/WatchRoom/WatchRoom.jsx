import { useEffect, useRef, useState } from "react";

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

    const channelRef = useRef(null);


    /*
    ============================================================
    SALA
    ============================================================
    */

    const [room, setRoom] = useState(null);

    const [isLoading, setIsLoading] = useState(true);

    const [copyStatus, setCopyStatus] = useState("idle");

    const [canNativeShare] = useState(
        () => typeof navigator !== "undefined" &&
            typeof navigator.share === "function"
    );

    const shareFeedbackTimeoutRef = useRef(null);


    /*
    ============================================================
    PLAYBACK
    ============================================================
    */

    const [playbackState, setPlaybackState] = useState({

        isPlaying: false,

        currentTime: 0

    });


    /*
    ============================================================
    REFERÊNCIA DO PLAYBACK
    ============================================================
    */

    const playbackStateRef = useRef({

        isPlaying: false,

        currentTime: 0

    });


    /*
    ============================================================
    ATUALIZAR PLAYBACK
    ============================================================
    */

    function updatePlaybackState(newState) {

        playbackStateRef.current =
            newState;

        setPlaybackState(
            newState
        );

    }

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
                "[Compartilhamento] Não foi possível copiar o link:",
                error
            );
            showCopyStatus("error");
        }
    }

    async function handleNativeShare() {
        try {
            await navigator.share({
                title: "WatchParty",
                text: `Venha assistir comigo na sala "${room.name}".`,
                url: getShareUrl()
            });
        } catch (error) {
            if (error?.name !== "AbortError") {
                console.error(
                    "[Compartilhamento] Não foi possível compartilhar a sala:",
                    error
                );
            }
        }
    }

    useEffect(() => () => {
        if (shareFeedbackTimeoutRef.current) {
            clearTimeout(shareFeedbackTimeoutRef.current);
        }
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

    const userIdRef = useRef(
        crypto.randomUUID()
    );


    const usernameRef = useRef(
        `Usuário ${Math.floor(
            Math.random() * 1000
        )}`
    );


    /*
    ============================================================
    CARREGAR SALA
    ============================================================
    */

    useEffect(() => {

        setIsLoading(true);


        const foundRoom =
            getRoomById(roomId);


        if (foundRoom) {

            setRoom(foundRoom);


            /*
            ====================================================
            RECUPERAR PLAYBACK SALVO
            ====================================================
            */

            const savedPlayback =
                foundRoom.playback;


            const savedCurrentTime =
                Number(
                    savedPlayback?.currentTime
                );


            const initialPlayback = {

                isPlaying:
                    savedPlayback?.isPlaying === true,

                currentTime:
                    Number.isFinite(
                        savedCurrentTime
                    ) &&
                    savedCurrentTime >= 0
                        ? savedCurrentTime
                        : 0

            };


            updatePlaybackState(
                initialPlayback
            );

        } else {

            setRoom(null);


            updatePlaybackState({

                isPlaying: false,

                currentTime: 0

            });

        }


        setIsLoading(false);

    }, [roomId]);


    /*
    ============================================================
    SUPABASE REALTIME
    ============================================================
    */

    useEffect(() => {

        if (!roomId) {

            return;

        }


        let isActive = true;


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
        ========================================================
        OUVIR PLAYBACK
        ========================================================
        */

        realtimeService.onPlaybackEvent(
            channel,
            (event) => {

                if (!isActive) {

                    return;

                }


                if (!event) {

                    return;

                }


                console.log(
                    "[Realtime] Playback recebido:",
                    event
                );


                const currentTime =
                    Number(
                        event.currentTime
                    );


                if (
                    !Number.isFinite(
                        currentTime
                    ) ||
                    currentTime < 0
                ) {

                    console.warn(
                        "[Realtime] currentTime inválido:",
                        event.currentTime
                    );


                    return;

                }


                /*
                ==================================================
                PLAY
                ==================================================
                */

                if (
                    event.action === "play"
                ) {

                    console.log(
                        "[Realtime] Aplicando PLAY remoto:",
                        currentTime
                    );


                    updatePlaybackState({

                        isPlaying: true,

                        currentTime

                    });


                    return;

                }


                /*
                ==================================================
                PAUSE
                ==================================================
                */

                if (
                    event.action === "pause"
                ) {

                    console.log(
                        "[Realtime] Aplicando PAUSE remoto:",
                        currentTime
                    );


                    updatePlaybackState({

                        isPlaying: false,

                        currentTime

                    });


                    return;

                }


                /*
                ==================================================
                SEEK
                ==================================================
                */

                if (
                    event.action === "seek"
                ) {

                    console.log(
                        "[Realtime] Aplicando SEEK remoto:",
                        currentTime
                    );


                    updatePlaybackState({

                        ...playbackStateRef.current,

                        currentTime

                    });


                    return;

                }


                console.warn(
                    "[Realtime] Ação de playback desconhecida:",
                    event.action
                );

            }
        );


        /*
        ========================================================
        OUVIR CHAT
        ========================================================
        */

        realtimeService.onChatMessage(
            channel,
            (message) => {

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


                        if (alreadyExists) {

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
        ========================================================
        OUVIR PRESENCE
        ========================================================
        */

        realtimeService.onPresenceChange(
            channel,
            (state) => {

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
                            (user) => {

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
                ==================================================
                REMOVER DUPLICADOS
                ==================================================
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
        ========================================================
        CONECTAR
        ========================================================
        */

        realtimeService
            .connect(channel)

            .then(
                async () => {

                    if (!isActive) {

                        return;

                    }


                    console.log(
                        "[Realtime] Canal conectado:",
                        roomId
                    );


                    /*
                    ==============================================
                    REGISTRAR USUÁRIO NA SALA
                    ==============================================
                    */

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
                (error) => {

                    if (!isActive) {

                        return;

                    }


                    console.error(
                        "[Realtime] Erro ao conectar:",
                        error
                    );

                }
            );


        /*
        ========================================================
        CLEANUP
        ========================================================
        */

        return () => {

            isActive = false;


            setParticipants([]);

            setShowParticipants(false);


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

    }, [roomId]);


    /*
    ============================================================
    PLAY
    ============================================================
    */

    async function handlePlaybackPlay(state) {

        const currentTime =
            Number(
                state?.currentTime
            );


        if (
            !Number.isFinite(
                currentTime
            ) ||
            currentTime < 0
        ) {

            return;

        }


        const event =
            playbackService.createPlayEvent(
                currentTime
            );


        const newPlaybackState = {

            isPlaying: true,

            currentTime

        };


        /*
        ========================================================
        ATUALIZAR ESTADO LOCAL
        ========================================================
        */

        updatePlaybackState(
            newPlaybackState
        );


        /*
        ========================================================
        SALVAR NO LOCALSTORAGE
        ========================================================
        */

        updateRoomPlayback(
            roomId,
            newPlaybackState
        );


        console.log(
            "[Playback] Play salvo:",
            event
        );


        /*
        ========================================================
        ENVIAR PARA REALTIME
        ========================================================
        */

        const activeChannel =
            channelRef.current;


        console.log(
            "[Realtime] Channel disponível:",
            !!activeChannel
        );


        if (!activeChannel) {

            console.warn(
                "[Realtime] Canal ainda não está disponível."
            );


            return;

        }


        try {

            const result =
                await realtimeService.sendPlaybackEvent(
                    activeChannel,
                    event
                );


            console.log(
                "[Realtime] Playback enviado:",
                event
            );


            console.log(
                "[Realtime] Resultado do envio:",
                result
            );

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar playback:",
                error
            );

        }

    }


    /*
    ============================================================
    PAUSE
    ============================================================
    */

    async function handlePlaybackPause(state) {

        const currentTime =
            Number(
                state?.currentTime
            );


        if (
            !Number.isFinite(
                currentTime
            ) ||
            currentTime < 0
        ) {

            return;

        }


        const event =
            playbackService.createPauseEvent(
                currentTime
            );


        const newPlaybackState = {

            isPlaying: false,

            currentTime

        };


        /*
        ========================================================
        ATUALIZAR ESTADO LOCAL
        ========================================================
        */

        updatePlaybackState(
            newPlaybackState
        );


        /*
        ========================================================
        SALVAR NO LOCALSTORAGE
        ========================================================
        */

        updateRoomPlayback(
            roomId,
            newPlaybackState
        );


        console.log(
            "[Playback] Pause salvo:",
            event
        );


        /*
        ========================================================
        ENVIAR PARA REALTIME
        ========================================================
        */

        const activeChannel =
            channelRef.current;


        if (!activeChannel) {

            console.warn(
                "[Realtime] Canal ainda não está disponível."
            );


            return;

        }


        try {

            const result =
                await realtimeService.sendPlaybackEvent(
                    activeChannel,
                    event
                );


            console.log(
                "[Realtime] Pause enviado:",
                event
            );


            console.log(
                "[Realtime] Resultado do envio:",
                result
            );

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar pause:",
                error
            );

        }

    }


    /*
    ============================================================
    SEEK
    ============================================================
    */

    async function handlePlaybackSeek(state) {

        const currentTime =
            Number(
                state?.currentTime
            );


        if (
            !Number.isFinite(
                currentTime
            ) ||
            currentTime < 0
        ) {

            return;

        }


        const event =
            playbackService.createSeekEvent(
                currentTime
            );


        /*
        ========================================================
        PEGAR ESTADO MAIS RECENTE
        ========================================================
        */

        const currentPlayback =
            playbackStateRef.current;


        const newPlaybackState = {

            ...currentPlayback,

            currentTime

        };


        /*
        ========================================================
        ATUALIZAR ESTADO LOCAL
        ========================================================
        */

        updatePlaybackState(
            newPlaybackState
        );


        /*
        ========================================================
        SALVAR PLAYBACK
        ========================================================
        */

        updateRoomPlayback(
            roomId,
            newPlaybackState
        );


        console.log(
            "[Playback] Seek salvo:",
            event
        );


        /*
        ========================================================
        ENVIAR PARA REALTIME
        ========================================================
        */

        const activeChannel =
            channelRef.current;


        if (!activeChannel) {

            console.warn(
                "[Realtime] Canal ainda não está disponível."
            );


            return;

        }


        try {

            const result =
                await realtimeService.sendPlaybackEvent(
                    activeChannel,
                    event
                );


            console.log(
                "[Realtime] Seek enviado:",
                event
            );


            console.log(
                "[Realtime] Resultado do envio:",
                result
            );

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar seek:",
                error
            );

        }

    }


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


        /*
        ========================================================
        CRIAR MENSAGEM
        ========================================================
        */

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

            /*
            ====================================================
            ENVIAR PARA SUPABASE
            ====================================================
            */

            const result =
                await realtimeService.sendChatMessage(
                    activeChannel,
                    message
                );


            console.log(
                "[Realtime] Chat enviado:",
                result
            );


            /*
            ====================================================
            ADICIONAR NA PRÓPRIA ABA
            ====================================================
            */

            setMessages(
                previous => {

                    const alreadyExists =
                        previous.some(
                            item =>
                                item.id ===
                                message.id
                        );


                    if (alreadyExists) {

                        return previous;

                    }


                    return [
                        ...previous,
                        message
                    ];

                }
            );


            /*
            ====================================================
            LIMPAR INPUT
            ====================================================
            */

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

                    <span
                        className={styles.spinner}
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

            <main className={styles.page}>

                <div className={styles.notFound}>

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

        <main className={styles.page}>


            {/* ==================================================
                HEADER
            ================================================== */}

            <header className={styles.header}>

                <div className={styles.brand}>

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


                <div className={styles.roomInfo}>

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


                <div className={styles.roomActions}>
                    <button
                        type="button"
                        className={`${styles.shareButton} ${
                            copyStatus === "success"
                                ? styles.copySuccess
                                : copyStatus === "error"
                                    ? styles.copyError
                                    : ""
                        }`}
                        onClick={handleCopyRoomLink}
                        aria-live="polite"
                    >
                        <span aria-hidden="true">
                            {copyStatus === "success"
                                ? "✓"
                                : copyStatus === "error"
                                    ? "!"
                                    : "🔗"}
                        </span>
                        <span className={styles.shareButtonText}>
                            {copyStatus === "success"
                                ? "Link copiado!"
                                : copyStatus === "error"
                                    ? "Não foi possível copiar"
                                    : "Copiar link"}
                        </span>
                    </button>

                    {canNativeShare && (
                        <button
                            type="button"
                            className={styles.shareButton}
                            onClick={handleNativeShare}
                        >
                            <span aria-hidden="true">📤</span>
                            <span className={styles.shareButtonText}>
                                Compartilhar
                            </span>
                        </button>
                    )}

                    <button
                        type="button"
                        className={styles.headerButton}
                        aria-label="Configurações da sala"
                    >
                        ⚙
                    </button>
                </div>

            </header>


            {/* ==================================================
                WORKSPACE
            ================================================== */}

            <div className={styles.workspace}>


                {/* ==================================================
                    PLAYER
                ================================================== */}

                <section
                    className={
                        styles.playerSection
                    }
                >

                    <VideoPlayer

                        src={
                            room.contentUrl
                        }

                        playback={
                            playbackState
                        }

                        onPlay={
                            handlePlaybackPlay
                        }

                        onPause={
                            handlePlaybackPause
                        }

                        onSeek={
                            handlePlaybackSeek
                        }

                    />


                    {/* DEBUG PLAYBACK */}

                    <div
                        className={
                            styles.playbackDebug
                        }
                    >

                        {
                            playbackState.isPlaying
                                ? "▶ Reproduzindo"
                                : "⏸ Pausado"
                        }

                        {" • "}

                        {
                            Math.floor(
                                playbackState.currentTime
                            )
                        }

                        s

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
                                        {participants.length}{" "}
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
                                        {participants.length}{" "}
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
                        CONTEÚDO DO CHAT / PARTICIPANTES
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
                                    (participant) => {

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
                                    (message) => {

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

                                placeholder={
                                    "Digite uma mensagem..."
                                }

                                aria-label="Mensagem"

                                value={
                                    chatMessage
                                }

                                onChange={
                                    (event) =>
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

