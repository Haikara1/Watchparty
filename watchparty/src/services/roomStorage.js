import realtimeService, {
    supabase
} from "./realtimeService";


const ROOMS_STORAGE_KEY = "watchparty_rooms";


/*
============================================================
COMPATIBILIDADE COM LOCALSTORAGE
============================================================

O localStorage permanece temporariamente como cache/legado.

O Supabase passa a ser a fonte principal dos dados das salas.
*/


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
            "Erro ao carregar salas do localStorage:",
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
            "Erro ao salvar salas no localStorage:",
            error
        );

    }

}


/*
============================================================
MAPEAR SALA DO SUPABASE
============================================================

Converte os nomes das colunas do banco para o formato
utilizado atualmente pelo React.
*/

function mapSupabaseRoom(room) {

    if (!room) {

        return null;

    }


    return {

        id:
            room.id,

        name:
            room.name,

        type:
            room.type,

        maxUsers:
            room.max_users,

        contentUrl:
            room.content_url,

        createdAt:
            room.created_at,

        ownerId:
            room.owner_id,

        playback: {

            isPlaying:
                room.is_playing === true,

            currentTime:
                Number(room.playback_time) || 0

        }

    };

}


/*
============================================================
SALVAR SALA
============================================================

A sala é criada no Supabase.

O localStorage continua sendo atualizado apenas para
compatibilidade temporária com partes antigas da aplicação.
*/

export async function saveRoom(room) {

    try {

        /*
        ====================================================
        GARANTIR SESSÃO ANÔNIMA
        ====================================================
        */

        const session =
            await realtimeService.ensureAnonymousSession();


        const user =
            session?.user;


        if (!user?.id) {

            throw new Error(
                "Não foi possível identificar o usuário anônimo."
            );

        }


        /*
        ====================================================
        INSERIR NO SUPABASE
        ====================================================
        */

        const {
            data,
            error
        } = await supabase

            .from("rooms")

            .insert({

                id:
                    room.id,

                name:
                    room.name,

                type:
                    room.type,

                max_users:
                    room.maxUsers,

                content_url:
                    room.contentUrl,

                created_at:
                    room.createdAt,

                owner_id:
                    user.id

            })

            .select()

            .single();


        if (error) {

            console.error(
                "[Supabase] Erro ao criar sala:",
                error
            );

            throw error;

        }


        /*
        ====================================================
        ATUALIZAR CACHE LOCAL
        ====================================================
        */

        const rooms =
            getRooms();


        const updatedRooms = [

            ...rooms,

            {

                ...room,

                ownerId:
                    user.id,

                playback: {

                    isPlaying:
                        false,

                    currentTime:
                        0

                }

            }

        ];


        saveRooms(
            updatedRooms
        );


        console.log(
            "[Supabase] Sala criada com sucesso:",
            data
        );


        return mapSupabaseRoom(data);

    } catch (error) {

        console.error(
            "Erro ao salvar sala:",
            error
        );


        throw error;

    }

}


/*
============================================================
GERAR ID
============================================================
*/

export function generateRoomId() {

    return crypto.randomUUID();

}


/*
============================================================
BUSCAR SALA POR ID
============================================================

O Supabase passa a ser a fonte principal.

O localStorage é utilizado somente como fallback caso
a consulta ao banco falhe.
*/

export async function getRoomById(
    roomId,
    {
        allowCacheFallback = true
    } = {}
) {

    if (!roomId) {

        return null;

    }


    try {

        const {
            data,
            error
        } = await supabase

            .from("rooms")

            .select(`
                id,
                name,
                type,
                max_users,
                content_url,
                created_at,
                playback_time,
                is_playing,
                owner_id
            `)

            .eq(
                "id",
                roomId
            )

            .maybeSingle();


        if (error) {

            console.error(
                "[Supabase] Erro ao buscar sala:",
                error
            );

            throw error;

        }


        if (!data) {

            console.warn(
                "[Supabase] Sala não encontrada:",
                roomId
            );


            return null;

        }


        const room =
            mapSupabaseRoom(data);


        /*
        ====================================================
        ATUALIZAR CACHE LOCAL
        ====================================================
        */

        const rooms =
            getRooms();


        const existingRoom =
            rooms.some(
                item =>
                    item.id === room.id
            );


        const updatedRooms =
            existingRoom

                ? rooms.map(
                    item =>
                        item.id === room.id
                            ? room
                            : item
                )

                : [
                    ...rooms,
                    room
                ];


        saveRooms(
            updatedRooms
        );


        console.log(
            "[Supabase] Sala carregada com sucesso:",
            room
        );


        return room;

    } catch (error) {

        if (!allowCacheFallback) {

            throw error;

        }

        /*
        ====================================================
        FALLBACK TEMPORÁRIO
        ====================================================
        */

        console.warn(
            "[Supabase] Utilizando cache local como fallback."
        );


        const rooms =
            getRooms();


        return rooms.find(
            room =>
                room.id === roomId
        ) || null;

    }

}


/*
============================================================
ATUALIZAR PLAYBACK
============================================================

Agora o playback é salvo diretamente no Supabase.

Colunas utilizadas:

playback_time
is_playing
*/

export async function updateRoomPlayback(
    roomId,
    playback
) {

    if (
        !roomId ||
        !playback
    ) {

        return null;

    }


    const currentTime =
        Number(
            playback.currentTime
        );


    if (
        !Number.isFinite(
            currentTime
        ) ||
        currentTime < 0
    ) {

        return null;

    }


    const isPlaying =
        Boolean(
            playback.isPlaying
        );


    try {

        /*
        ====================================================
        ATUALIZAR SUPABASE
        ====================================================
        */

        const {
            data,
            error
        } = await supabase

            .from("rooms")

            .update({

                playback_time:
                    currentTime,

                is_playing:
                    isPlaying

            })

            .eq(
                "id",
                roomId
            )

            .select(`
                id,
                name,
                type,
                max_users,
                content_url,
                created_at,
                playback_time,
                is_playing,
                owner_id
            `)

            .maybeSingle();


        if (error) {

            console.error(
                "[Supabase] Erro ao atualizar playback:",
                error
            );

            throw error;

        }


        if (!data) {

            console.warn(
                "[Supabase] Playback não atualizado: sala não encontrada ou sem permissão.",
                roomId
            );


            return null;

        }


        const updatedRoom =
            mapSupabaseRoom(data);


        /*
        ====================================================
        ATUALIZAR CACHE LOCAL
        ====================================================
        */

        const rooms =
            getRooms();


        const updatedRooms =
            rooms.map(
                room =>
                    room.id === roomId
                        ? updatedRoom
                        : room
            );


        saveRooms(
            updatedRooms
        );


        console.log(
            "[Supabase] Playback atualizado:",
            {
                roomId,
                currentTime,
                isPlaying
            }
        );


        return updatedRoom;

    } catch (error) {

        console.error(
            "[Supabase] Falha ao atualizar playback:",
            error
        );


        return null;

    }

}


/*
============================================================
EXCLUIR SALA
============================================================
*/

export async function deleteRoom(roomId) {

    if (!roomId) {
        throw new Error("roomId é obrigatório para excluir a sala.");
    }

    await realtimeService.ensureAnonymousSession();

    const {
        data,
        error
    } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomId)
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("[Supabase] Erro ao excluir sala:", error);
        throw error;
    }

    if (!data) {
        throw new Error(
            "A sala não foi encontrada ou você não possui permissão para excluí-la."
        );
    }

    return data;
}
