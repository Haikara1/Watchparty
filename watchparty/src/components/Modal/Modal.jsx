import { useEffect } from "react";
import styles from "./Modal.module.css";

function Modal({ isOpen, onClose, title, children }) {

    useEffect(() => {

        if (!isOpen) {
            return;
        }

        function handleKeyDown(event) {

            if (event.key === "Escape") {
                onClose();
            }

        }

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };

    }, [isOpen, onClose]);


    if (!isOpen) {
        return null;
    }


    function handleOverlayClick(event) {

        if (event.target === event.currentTarget) {
            onClose();
        }

    }


    return (
        <div
            className={styles.overlay}
            onMouseDown={handleOverlayClick}
        >

            <div className={styles.modal}>

                <div className={styles.header}>

                    <h2>
                        {title}
                    </h2>

                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Fechar modal"
                    >
                        ×
                    </button>

                </div>


                <div className={styles.content}>
                    {children}
                </div>

            </div>

        </div>
    );
}

export default Modal;