import styles from "./HowItWorks.module.css";

const steps = [
    {
        number: "01",
        icon: "🎬",
        title: "Crie uma sala",
        description:
            "Escolha o nome da sala, defina o limite de participantes e adicione o conteúdo que deseja assistir."
    },
    {
        number: "02",
        icon: "🔗",
        title: "Convide seus amigos",
        description:
            "Compartilhe o link da sala e convide outras pessoas para participar da sessão."
    },
    {
        number: "03",
        icon: "🍿",
        title: "Assista junto",
        description:
            "Assista ao conteúdo sincronizado e converse com todos através do chat da sala."
    }
];

function HowItWorks() {
    return (
        <section className={styles.section}>

            <div className="container">

                <div className={styles.heading}>

                    <span className={styles.label}>
                        COMO FUNCIONA
                    </span>

                    <h2>
                        Uma nova forma de assistir juntos.
                    </h2>

                    <p>
                        Crie uma sessão, convide seus amigos
                        e aproveite o conteúdo em perfeita
                        sincronia.
                    </p>

                </div>


                <div className={styles.steps}>

                    {steps.map((step) => (
                        <article
                            key={step.number}
                            className={styles.step}
                        >

                            <div className={styles.top}>

                                <span className={styles.number}>
                                    {step.number}
                                </span>

                                <span className={styles.icon}>
                                    {step.icon}
                                </span>

                            </div>


                            <h3>
                                {step.title}
                            </h3>


                            <p>
                                {step.description}
                            </p>

                        </article>
                    ))}

                </div>

            </div>

        </section>
    );
}

export default HowItWorks;