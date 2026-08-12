import styles from "./Hero.module.css";
import CreateRoom from "../CreateRoom/CreateRoom";

function Hero() {
    return (
        <section className={styles.hero}>

            <video
                className={styles.hero__video}
                autoPlay
                muted
                loop
                playsInline
            >
                <source
                    src="/videos/hero.mp4"
                    type="video/mp4"
                />
            </video>


            <div className={styles.hero__overlay}></div>


            <div className={`container ${styles.hero__content}`}>

                <span className={styles.hero__badge}>
                    WATCH PARTY
                </span>

                <h1>
                    Assista junto.
                    <br />
                    <span>Conecte-se.</span>
                </h1>

                <p>
                    Crie uma sala, convide seus amigos e
                    assista filmes e séries juntos em tempo real.
                </p>

                <div className={styles.hero__actions}>

                    <CreateRoom
                        className={`${styles.hero__button} ${styles["hero__button--primary"]}`}
                    />

                    <button
                        className={`${styles.hero__button} ${styles["hero__button--secondary"]}`}
                    >
                        Entrar em uma sala
                    </button>

                </div>

            </div>


            <div className={styles.hero__scroll}>

                <span></span>

                <p>
                    Explore
                </p>

            </div>

        </section>
    );
}

export default Hero;