import realtimeService, {
    supabase
} from "./realtimeService";


export async function runRoomsRlsInsertTest() {

    try {

        await realtimeService.ensureAnonymousSession();


        const {
            data: sessionData,
            error: sessionError
        } = await supabase.auth.getSession();


        const session =
            sessionData.session;


        if (sessionError || !session?.user) {

            console.error(
                "[RLS Test] Não foi possível obter a sessão anônima.",
                sessionError?.message
            );


            return null;

        }


        const {
            data,
            error
        } = await supabase
            .from("rooms")
            .insert({
                id: crypto.randomUUID(),
                name: "RLS TEST",
                type: "private",
                max_users: 2,
                content_url: "https://example.com/test",
                playback_time: 0,
                is_playing: false,
                owner_id: session.user.id
            })
            .select("id")
            .single();


        if (error) {

            console.error(
                "[RLS Test] INSERT falhou:",
                {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                }
            );


            return null;

        }


        console.log(
            "[RLS Test] INSERT bem-sucedido. ID da sala:",
            data.id
        );


        return data.id;

    } catch (error) {

        console.error(
            "[RLS Test] Erro ao executar INSERT:",
            error?.message
        );


        return null;

    }

}
