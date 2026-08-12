import { Link } from "react-router-dom";
import styles from "./Header.module.css";

function Header() {
    return (
        <header className={styles.header}>

            <div className={`container ${styles.container}`}>

                <Link
                    to="/"
                    className={styles.logo}
                >
                    <span className={styles.logoIcon}>
                        ▶
                    </span>

                    <span>
                        WatchParty
                    </span>
                </Link>


                <nav className={styles.navigation}>

                    <Link to="/">
                        Início
                    </Link>

                    <Link to="/">
                        Salas
                    </Link>

                    <Link to="/">
                        Sobre
                    </Link>

                </nav>


                <div className={styles.actions}>

                    <button className={styles.loginButton}>
                        Entrar
                    </button>

                </div>

            </div>

        </header>
    );
}

export default Header;