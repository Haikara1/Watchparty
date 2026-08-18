import { Link } from "react-router-dom";

import styles from "./Header.module.css";


function Header() {

    return (

        <header className={styles.header}>

            <div
                className={`container ${styles.container}`}
            >


                {/* ==================================================
                    LOGO
                ================================================== */}

                <Link
                    to="/"
                    className={styles.logo}
                >

                    <span
                        className={styles.logoIcon}
                    >
                        ▶
                    </span>


                    <span>
                        WatchParty
                    </span>

                </Link>


                {/* ==================================================
                    NAVEGAÇÃO
                ================================================== */}

                <nav
                    className={styles.navigation}
                >

                    <Link to="/">
                        Início
                    </Link>


                    <Link to="/salas">
                        Salas
                    </Link>


                    <Link to="/">
                        Sobre
                    </Link>

                </nav>


                {/* ==================================================
                    AÇÕES
                ================================================== */}

                <div
                    className={styles.actions}
                >

                    <button
                        type="button"
                        className={styles.loginButton}
                    >
                        Entrar
                    </button>

                </div>

            </div>

        </header>

    );

}


export default Header;

