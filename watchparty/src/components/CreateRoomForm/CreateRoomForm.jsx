import { useState } from "react";

import {
    saveRoom,
    generateRoomId
} from "../../services/roomStorage";

import {
    useNavigate
} from "react-router-dom";

import styles from "./CreateRoomForm.module.css";


const MAX_NAME_LENGTH = 40;


function CreateRoomForm() {

    const navigate = useNavigate();


    const [roomName, setRoomName] = useState("");

    const [roomType, setRoomType] = useState("public");

    const [maxUsers, setMaxUsers] = useState(4);

    const [contentUrl, setContentUrl] = useState("");

    const [errors, setErrors] = useState({});

    const [isSubmitting, setIsSubmitting] = useState(false);


    const userLimits = [2, 3, 4, 5, 6];


    function handleNameChange(event) {

        const value = event.target.value;

        setRoomName(value);

        setErrors((previous) => ({
            ...previous,
            name: ""
        }));

    }


    function handleContentUrlChange(event) {

        const value = event.target.value;

        setContentUrl(value);

        setErrors((previous) => ({
            ...previous,
            contentUrl: ""
        }));

    }


    function handleSubmit(event) {

        event.preventDefault();


        const trimmedName = roomName.trim();

        const trimmedUrl = contentUrl.trim();

        const newErrors = {};


        // =========================
        // VALIDAÇÃO DO NOME
        // =========================

        if (!trimmedName) {

            newErrors.name =
                "Digite um nome para a sala.";

        } else if (trimmedName.length < 3) {

            newErrors.name =
                "O nome da sala deve ter pelo menos 3 caracteres.";

        }


        // =========================
        // VALIDAÇÃO DA URL
        // =========================

        if (!trimmedUrl) {

            newErrors.contentUrl =
                "Digite o link do conteúdo.";

        } else {

            try {

                const parsedUrl = new URL(trimmedUrl);


                if (
                    parsedUrl.protocol !== "http:" &&
                    parsedUrl.protocol !== "https:"
                ) {

                    newErrors.contentUrl =
                        "Use um link começando com http:// ou https://.";

                }

            } catch {

                newErrors.contentUrl =
                    "Digite um link válido.";

            }

        }


        // =========================
        // MOSTRAR ERROS
        // =========================

        setErrors(newErrors);


        if (Object.keys(newErrors).length > 0) {
            return;
        }


        // =========================
        // INICIAR CRIAÇÃO
        // =========================

        setIsSubmitting(true);


        // =========================
        // CRIAR OBJETO DA SALA
        // =========================

        const roomData = {

            id: generateRoomId(),

            name: trimmedName,

            type: roomType,

            maxUsers,

            contentUrl: trimmedUrl,

            createdAt: new Date().toISOString()

        };


        // =========================
        // SALVAR SALA
        // =========================

        saveRoom(roomData);


        console.log(
            "Sala criada:",
            roomData
        );


        // =========================
        // IR PARA A SALA
        // =========================

        navigate(
            `/watch/${roomData.id}`
        );

    }


    return (

        <form
            className={styles.form}
            onSubmit={handleSubmit}
        >

            {/* =========================
                NOME DA SALA
            ========================= */}

            <div className={styles.field}>

                <label htmlFor="room-name">
                    Nome da sala
                </label>


                <input
                    id="room-name"
                    type="text"
                    value={roomName}
                    onChange={handleNameChange}
                    placeholder="Ex: Noite de filmes"
                    maxLength={MAX_NAME_LENGTH}
                    autoComplete="off"
                    className={
                        errors.name
                            ? styles.inputError
                            : ""
                    }
                />


                <div className={styles.meta}>

                    <span className={styles.hint}>
                        Escolha um nome para sua sessão.
                    </span>


                    <span className={styles.counter}>
                        {roomName.length}/{MAX_NAME_LENGTH}
                    </span>

                </div>


                {errors.name && (

                    <span className={styles.error}>
                        {errors.name}
                    </span>

                )}

            </div>


            {/* =========================
                TIPO DE SALA
            ========================= */}

            <div className={styles.field}>

                <span className={styles.label}>
                    Tipo de sala
                </span>


                <div className={styles.roomTypes}>

                    {/* PÚBLICA */}

                    <button
                        type="button"
                        className={`${styles.roomType} ${
                            roomType === "public"
                                ? styles.active
                                : ""
                        }`}
                        onClick={() =>
                            setRoomType("public")
                        }
                    >

                        <span
                            className={styles.roomTypeIcon}
                        >
                            🌎
                        </span>


                        <span>

                            <strong>
                                Pública
                            </strong>


                            <small>
                                Qualquer pessoa pode encontrar
                            </small>

                        </span>

                    </button>


                    {/* PRIVADA */}

                    <button
                        type="button"
                        className={`${styles.roomType} ${
                            roomType === "private"
                                ? styles.active
                                : ""
                        }`}
                        onClick={() =>
                            setRoomType("private")
                        }
                    >

                        <span
                            className={styles.roomTypeIcon}
                        >
                            🔒
                        </span>


                        <span>

                            <strong>
                                Privada
                            </strong>


                            <small>
                                Acesso somente pelo convite
                            </small>

                        </span>

                    </button>

                </div>

            </div>


            {/* =========================
                LIMITE DE PARTICIPANTES
            ========================= */}

            <div className={styles.field}>

                <span className={styles.label}>
                    Limite de participantes
                </span>


                <div className={styles.userLimits}>

                    {userLimits.map((limit) => (

                        <button
                            key={limit}
                            type="button"
                            className={`${styles.userLimit} ${
                                maxUsers === limit
                                    ? styles.active
                                    : ""
                            }`}
                            onClick={() =>
                                setMaxUsers(limit)
                            }
                        >
                            {limit}
                        </button>

                    ))}

                </div>


                <span className={styles.hint}>
                    Você poderá ter até {maxUsers} participantes nesta sala.
                </span>

            </div>


            {/* =========================
                LINK DO CONTEÚDO
            ========================= */}

            <div className={styles.field}>

                <label htmlFor="content-url">
                    Link do conteúdo
                </label>


                <input
                    id="content-url"
                    type="url"
                    value={contentUrl}
                    onChange={handleContentUrlChange}
                    placeholder="https://exemplo.com/filme"
                    autoComplete="url"
                    inputMode="url"
                    className={
                        errors.contentUrl
                            ? styles.inputError
                            : ""
                    }
                />


                {errors.contentUrl && (

                    <span className={styles.error}>
                        {errors.contentUrl}
                    </span>

                )}


                <span className={styles.hint}>
                    Informe o endereço onde o conteúdo será reproduzido.
                </span>

            </div>


            {/* =========================
                BOTÃO
            ========================= */}

            <button
                type="submit"
                className={styles.submit}
                disabled={isSubmitting}
            >

                {isSubmitting
                    ? "Criando sala..."
                    : "Criar sala"
                }

            </button>

        </form>

    );

}


export default CreateRoomForm;