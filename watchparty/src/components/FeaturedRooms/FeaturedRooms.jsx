import RoomCard from "../RoomCard/RoomCard";
import styles from "./FeaturedRooms.module.css";

const rooms = [
    {
        id: 1,
        title: "Noite de filmes",
        movie: "Interstellar",
        users: 4,
        maxUsers: 6,
        image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba"
    },
    {
        id: 2,
        title: "Sessão Terror",
        movie: "The Conjuring",
        users: 3,
        maxUsers: 6,
        image: "https://images.unsplash.com/photo-1505635552518-3448ff116af3"
    },
    {
        id: 3,
        title: "Ficção científica",
        movie: "Blade Runner",
        users: 5,
        maxUsers: 6,
        image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23"
    }
];

function FeaturedRooms() {
    return (
        <section className={styles.section}>

            <div className="container">

                <div className={styles.heading}>

                    <div>

                        <span className={styles.label}>
                            COMUNIDADE
                        </span>

                        <h2>
                            Salas em destaque
                        </h2>

                        <p>
                            Veja o que a comunidade está assistindo.
                        </p>

                    </div>

                </div>


                <div className={styles.grid}>

                    {rooms.map((room) => (
                        <RoomCard
                            key={room.id}
                            {...room}
                        />
                    ))}

                </div>

            </div>

        </section>
    );
}

export default FeaturedRooms;