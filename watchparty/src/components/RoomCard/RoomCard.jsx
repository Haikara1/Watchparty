import styles from "./RoomCard.module.css";

function RoomCard({
    title,
    movie,
    users,
    maxUsers,
    image
}) {
    return (
        <article className={styles.card}>

            <div className={styles.imageContainer}>

                <img
                    src={image}
                    alt={`Capa de ${movie}`}
                    className={styles.image}
                />

                <div className={styles.overlay}></div>

                <span className={styles.status}>
                    AO VIVO
                </span>

            </div>


            <div className={styles.content}>

                <span className={styles.movie}>
                    {movie}
                </span>

                <h3>
                    {title}
                </h3>


                <div className={styles.footer}>

                    <span className={styles.users}>
                        👥 {users}/{maxUsers}
                    </span>

                    <button className={styles.button}>
                        Entrar
                    </button>

                </div>

            </div>

        </article>
    );
}

export default RoomCard;