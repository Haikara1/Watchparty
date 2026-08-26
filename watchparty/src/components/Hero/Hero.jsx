import styles from "./Hero.module.css";
import CreateRoom from "../CreateRoom/CreateRoom";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function Hero() {
    const navigate = useNavigate();
    const [useStaticBackground, setUseStaticBackground] = useState(
        () => window.matchMedia("(max-width: 1023px)").matches
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 1023px)");
        const handleChange = event => setUseStaticBackground(event.matches);

        mediaQuery.addEventListener("change", handleChange);

        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, []);

    return (
        <section className={styles.hero}>

            {useStaticBackground ? (
                <img
                    className={styles.hero__image}
                    src="/bakcground.jfif"
                    alt=""
                />
            ) : (
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
            )}


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
                        onClick={() => navigate("/salas")}
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
