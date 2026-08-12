import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

function Footer() {
    return (
        <footer className={styles.footer}>

            <div className={`container ${styles.container}`}>

                <div className={styles.brand}>

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

                    <p>
                        Assista junto.
                        Conecte-se.
                        Divirta-se.
                    </p>

                </div>


                <div className={styles.links}>

                    <div>
                        <h3>
                            Navegação
                        </h3>

                        <Link to="/">
                            Início
                        </Link>

                        <Link to="/">
                            Salas
                        </Link>

                        <Link to="/">
                            Sobre
                        </Link>
                    </div>


                    <div>
                        <h3>
                            Projeto
                        </h3>

                        <Link to="/">
                            Como funciona
                        </Link>

                        <Link to="/">
                            Termos
                        </Link>

                        <Link to="/">
                            Privacidade
                        </Link>
                    </div>

                </div>

            </div>


            <div className={`container ${styles.bottom}`}>

                <span>
                    © {new Date().getFullYear()} WatchParty
                </span>

                <span>
                    &nbsp;Desenvolvido por Daniel Lima.
                </span>

            </div>

        </footer>
    );
}

export default Footer;