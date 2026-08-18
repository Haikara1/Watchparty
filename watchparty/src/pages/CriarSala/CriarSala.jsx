import {
    useNavigate
} from "react-router-dom";

import CreateRoomForm from "../../components/CreateRoomForm/CreateRoomForm";

import styles from "./CriarSala.module.css";


function CriarSala() {

    const navigate = useNavigate();


    function handleBack() {

        navigate("/salas");

    }


    return (

        <main className={styles.page}>

            <div className={styles.container}>


                {/* ==================================================
                    VOLTAR
                ================================================== */}

                <button
                    type="button"
                    className={styles.backButton}
                    onClick={handleBack}
                >
                    ← Voltar para salas
                </button>


                {/* ==================================================
                    CABEÇALHO
                ================================================== */}

                <header className={styles.header}>

                    <span className={styles.eyebrow}>
                        WATCHPARTY
                    </span>


                    <h1>
                        Criar nova sala
                    </h1>


                    <p>
                        Configure sua sala e comece uma
                        sessão com seus amigos.
                    </p>

                </header>


                {/* ==================================================
                    FORMULÁRIO
                ================================================== */}

                <section className={styles.formWrapper}>

                    <CreateRoomForm />

                </section>

            </div>

        </main>

    );

}


export default CriarSala;

