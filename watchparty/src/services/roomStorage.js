const ROOMS_STORAGE_KEY = "watchparty_rooms";


export function getRooms() {

    try {

        const storedRooms =
            localStorage.getItem(ROOMS_STORAGE_KEY);


        if (!storedRooms) {

            return [];

        }


        const rooms =
            JSON.parse(storedRooms);


        return Array.isArray(rooms)
            ? rooms
            : [];

    } catch (error) {

        console.error(
            "Erro ao carregar salas:",
            error
        );

        return [];

    }

}


export function saveRooms(rooms) {

    try {

        localStorage.setItem(
            ROOMS_STORAGE_KEY,
            JSON.stringify(rooms)
        );

    } catch (error) {

        console.error(
            "Erro ao salvar salas:",
            error
        );

    }

}


export function saveRoom(room) {

    const rooms =
        getRooms();


    const updatedRooms = [
        ...rooms,
        room
    ];


    saveRooms(
        updatedRooms
    );


    return room;

}


export function generateRoomId() {

    return crypto.randomUUID();

}


export function getRoomById(roomId) {

    const rooms =
        getRooms();


    return rooms.find(
        (room) => room.id === roomId
    ) || null;

}


export function updateRoomPlayback(
    roomId,
    playback
) {

    const rooms =
        getRooms();


    const roomExists =
        rooms.some(
            (room) =>
                room.id === roomId
        );


    if (!roomExists) {

        return null;

    }


    const updatedRooms =
        rooms.map(
            (room) => {

                if (
                    room.id !== roomId
                ) {

                    return room;

                }


                return {

                    ...room,

                    playback: {

                        isPlaying:
                            Boolean(
                                playback.isPlaying
                            ),

                        currentTime:
                            Number(
                                playback.currentTime
                            ) || 0

                    }

                };

            }
        );


    saveRooms(
        updatedRooms
    );


    return updatedRooms.find(
        (room) =>
            room.id === roomId
    );

}