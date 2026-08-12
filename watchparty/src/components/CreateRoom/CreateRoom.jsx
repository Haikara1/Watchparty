import { useState } from "react";

import Modal from "../Modal/Modal";
import CreateRoomForm from "../CreateRoomForm/CreateRoomForm";

import styles from "./CreateRoom.module.css";

function CreateRoom({ className = "" }) {

    const [isOpen, setIsOpen] = useState(false);


    function openModal() {
        setIsOpen(true);
    }


    function closeModal() {
        setIsOpen(false);
    }


    return (
        <>
            <button
                type="button"
                className={`${styles.button} ${className}`}
                onClick={openModal}
            >
                Criar sala
            </button>


            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                title="Criar nova sala"
            >

                <CreateRoomForm />

            </Modal>
        </>
    );
}

export default CreateRoom;