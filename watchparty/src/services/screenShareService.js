import realtimeService from "./realtimeService";


/*
============================================================
CONFIGURAÇÃO WEBRTC
============================================================
*/

const ICE_SERVERS = [

    {
        urls:
            "stun:stun.l.google.com:19302"
    },

    {
        urls:
            "stun:stun1.l.google.com:19302"
    }

];


/*
============================================================
SERVIÇO DE COMPARTILHAMENTO DE TELA
============================================================
*/

const screenShareService = {


    /*
    ========================================================
    CRIAR PEER CONNECTION
    ========================================================
    */

    createPeerConnection() {

        const peerConnection =
            new RTCPeerConnection({

                iceServers:
                    ICE_SERVERS

            });


        console.log(
            "[ScreenShare] RTCPeerConnection criada."
        );


        return peerConnection;

    },


    /*
    ========================================================
    INICIAR COMPARTILHAMENTO DE TELA
    ========================================================
    */

    async startScreenShare() {

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices?.getDisplayMedia
        ) {

            throw new Error(
                "O navegador não suporta compartilhamento de tela."
            );

        }


        console.log(
            "[ScreenShare] Solicitando captura de tela..."
        );


        /*
        ----------------------------------------------------
        CAPTURA DE TELA + ÁUDIO
        ----------------------------------------------------
        */

        const stream =
            await navigator.mediaDevices.getDisplayMedia({

                video: {
                    cursor: "always"
                },

                audio: {

                    echoCancellation:
                        false,

                    noiseSuppression:
                        false,

                    autoGainControl:
                        false

                }

            });


        const videoTracks =
            stream.getVideoTracks();


        const audioTracks =
            stream.getAudioTracks();


        console.log(
            "[ScreenShare] Captura de tela iniciada."
        );


        console.log(
            "[ScreenShare] Tracks de vídeo:",
            videoTracks.length
        );


        console.log(
            "[ScreenShare] Tracks de áudio:",
            audioTracks.length
        );


        /*
        ----------------------------------------------------
        AVISO SOBRE ÁUDIO
        ----------------------------------------------------

        Alguns navegadores/sistemas não entregam áudio
        dependendo da fonte escolhida no compartilhamento.

        Exemplo:
        - Aba do Chrome → normalmente permite áudio
        - Janela → depende do navegador/sistema
        - Tela inteira → depende do navegador/sistema
        */

        if (
            audioTracks.length === 0
        ) {

            console.warn(
                "[ScreenShare] Nenhum track de áudio foi disponibilizado pelo navegador."
            );

        } else {

            console.log(
                "[ScreenShare] Áudio da tela disponível."
            );

        }


        /*
        ----------------------------------------------------
        MONITORAR ENCERRAMENTO DA CAPTURA
        ----------------------------------------------------
        */

        const videoTrack =
            videoTracks[0];


        if (videoTrack) {

            videoTrack.addEventListener(
                "ended",
                () => {

                    console.log(
                        "[ScreenShare] Track de vídeo encerrada."
                    );

                }
            );

        }


        return stream;

    },


    /*
    ========================================================
    PARAR COMPARTILHAMENTO
    ========================================================
    */

    stopScreenShare(
        stream
    ) {

        if (!stream) {

            return;

        }


        console.log(
            "[ScreenShare] Encerrando compartilhamento..."
        );


        stream.getTracks().forEach(
            track => {

                try {

                    track.stop();

                } catch (error) {

                    console.error(
                        "[ScreenShare] Erro ao encerrar track:",
                        error
                    );

                }

            }
        );


        console.log(
            "[ScreenShare] Compartilhamento encerrado."
        );

    },


    /*
    ========================================================
    ADICIONAR STREAM À CONEXÃO
    ========================================================
    */

    addStreamToPeer(
        peerConnection,
        stream
    ) {

        if (
            !peerConnection ||
            !stream
        ) {

            return;

        }


        const tracks =
            stream.getTracks();


        console.log(
            "[ScreenShare] Adicionando tracks:",
            tracks.map(
                track => ({
                    kind:
                        track.kind,

                    label:
                        track.label,

                    enabled:
                        track.enabled
                })
            )
        );


        tracks.forEach(
            track => {

                peerConnection.addTrack(
                    track,
                    stream
                );

            }
        );


        console.log(
            "[ScreenShare] Stream adicionada à conexão."
        );

    },


    /*
    ========================================================
    CRIAR OFFER
    ========================================================
    */

    async createOffer(
        peerConnection,
        options = {}
    ) {

        if (!peerConnection) {

            throw new Error(
                "PeerConnection é obrigatória."
            );

        }


        console.log(
            "[ScreenShare] Criando SDP Offer..."
        );


        if (
            peerConnection.signalingState === "closed" ||
            peerConnection.connectionState === "closed"
        ) {
            throw new Error("PeerConnection fechada ao criar offer.");
        }

        const offer =
            await peerConnection.createOffer({

                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true,

                ...options

            });


        await peerConnection.setLocalDescription(
            offer
        );


        console.log(
            "[ScreenShare] SDP Offer criada."
        );


        return offer;

    },


    /*
    ========================================================
    CRIAR ANSWER
    ========================================================
    */

    async createAnswer(
        peerConnection,
        offer
    ) {

        if (
            !peerConnection ||
            !offer
        ) {

            throw new Error(
                "PeerConnection e Offer são obrigatórias."
            );

        }

        if (
            peerConnection.signalingState === "closed" ||
            peerConnection.connectionState === "closed"
        ) {
            throw new Error("PeerConnection fechada ao criar answer.");
        }


        console.log(
            "[ScreenShare] Aplicando SDP Offer..."
        );


        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
                offer
            )
        );


        console.log(
            "[ScreenShare] SDP Offer aplicada."
        );


        console.log(
            "[ScreenShare] Criando SDP Answer..."
        );


        const answer =
            await peerConnection.createAnswer({

                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true

            });


        await peerConnection.setLocalDescription(
            answer
        );


        console.log(
            "[ScreenShare] SDP Answer criada."
        );


        return answer;

    },


    /*
    ========================================================
    APLICAR ANSWER
    ========================================================
    */

    async setRemoteAnswer(
        peerConnection,
        answer
    ) {

        if (
            !peerConnection ||
            !answer
        ) {

            throw new Error(
                "PeerConnection e Answer são obrigatórias."
            );

        }

        if (
            peerConnection.signalingState === "closed" ||
            peerConnection.connectionState === "closed"
        ) {
            return;
        }

        if (peerConnection.signalingState !== "have-local-offer") {
            console.warn(
                "[ScreenShare] Answer ignorada em signalingState:",
                peerConnection.signalingState
            );
            return;
        }


        console.log(
            "[ScreenShare] Aplicando SDP Answer..."
        );


        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
                answer
            )
        );


        console.log(
            "[ScreenShare] SDP Answer aplicada."
        );

    },


    /*
    ========================================================
    ADICIONAR ICE CANDIDATE
    ========================================================
    */

    async addIceCandidate(
        peerConnection,
        candidate
    ) {

        if (
            !peerConnection ||
            !candidate
        ) {

            return;

        }

        if (
            peerConnection.signalingState === "closed" ||
            peerConnection.connectionState === "closed"
        ) {
            return;
        }


        try {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );


        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao adicionar ICE Candidate:",
                error
            );

        }

    },


    /*
    ========================================================
    REGISTRAR EVENTO DE ICE
    ========================================================
    */

    onIceCandidate(
        peerConnection,
        callback
    ) {

        if (
            !peerConnection ||
            !callback
        ) {

            return;

        }


        peerConnection.onicecandidate =
            event => {

                if (
                    !event.candidate
                ) {

                    return;

                }


                callback(
                    event.candidate
                );

            };

    },


    /*
    ========================================================
    OUVIR STREAM REMOTA
    ========================================================
    */

    onRemoteStream(
        peerConnection,
        callback
    ) {

        if (
            !peerConnection ||
            !callback
        ) {

            return;

        }


        const fallbackStream = new MediaStream();

        peerConnection.ontrack =
            event => {

                console.log(
                    "[ScreenShare] Track remota recebida:",
                    event.track.kind,
                    event.track.label
                );


                /*
                ------------------------------------------------
                PRIORIDADE PARA event.streams
                ------------------------------------------------
                */

                const remoteStream =
                    event.streams?.[0];


                if (remoteStream) {

                    console.log(
                        "[ScreenShare] Stream remota recebida:",
                        {
                            videoTracks:
                                remoteStream.getVideoTracks().length,

                            audioTracks:
                                remoteStream.getAudioTracks().length
                        }
                    );


                    callback(
                        remoteStream
                    );


                    return;

                }


                /*
                ------------------------------------------------
                FALLBACK

                Alguns ambientes podem entregar o track
                sem associá-lo a uma MediaStream.
                ------------------------------------------------
                */

                console.warn(
                    "[ScreenShare] Track recebida sem MediaStream."
                );


                if (
                    !fallbackStream.getTracks().includes(event.track)
                ) {
                    fallbackStream.addTrack(event.track);
                }


                callback(
                    fallbackStream
                );

            };

    },


    /*
    ========================================================
    OUVIR MUDANÇA DE CONEXÃO
    ========================================================
    */

    onConnectionStateChange(
        peerConnection,
        callback
    ) {

        if (
            !peerConnection ||
            !callback
        ) {

            return;

        }


        peerConnection.onconnectionstatechange =
            () => {

                const state =
                    peerConnection.connectionState;


                console.log(
                    "[ScreenShare] Estado WebRTC:",
                    state
                );


                callback(
                    state
                );

            };

    },


    onIceConnectionStateChange(
        peerConnection,
        callback
    ) {

        if (!peerConnection || !callback) {
            return;
        }

        peerConnection.oniceconnectionstatechange = () => {
            callback(peerConnection.iceConnectionState);
        };
    },


    getVideoSender(peerConnection) {
        return peerConnection?.getSenders?.().find(
            sender => sender.track?.kind === "video"
        ) || null;
    },


    async getPeerStats(peerConnection) {
        if (
            !peerConnection ||
            peerConnection.signalingState === "closed"
        ) {
            return null;
        }

        return peerConnection.getStats();
    },


    async setVideoSenderParameters(peerConnection, profile) {
        const sender = this.getVideoSender(peerConnection);

        if (
            !sender ||
            typeof sender.getParameters !== "function" ||
            typeof sender.setParameters !== "function"
        ) {
            throw new Error("RTCRtpSender.setParameters não suportado.");
        }

        const apply = async includeScale => {
            const parameters = sender.getParameters();
            parameters.encodings = parameters.encodings?.length
                ? parameters.encodings
                : [{}];

            parameters.encodings = parameters.encodings.map(encoding => {
                const next = {
                    ...encoding,
                    maxBitrate: profile.maxBitrate,
                    maxFramerate: profile.maxFramerate
                };

                if (includeScale) {
                    next.scaleResolutionDownBy =
                        profile.scaleResolutionDownBy;
                } else {
                    delete next.scaleResolutionDownBy;
                }

                return next;
            });

            await sender.setParameters(parameters);
        };

        try {
            await apply(true);
        } catch (error) {
            console.warn(
                "[ScreenShare][Adaptive] scaleResolutionDownBy não aplicado:",
                error
            );
            await apply(false);
        }
    },


    /*
    ========================================================
    FECHAR PEER CONNECTION
    ========================================================
    */

    closePeerConnection(
        peerConnection
    ) {

        if (!peerConnection) {

            return;

        }


        console.log(
            "[ScreenShare] Fechando PeerConnection."
        );


        try {

            peerConnection.close();

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao fechar PeerConnection:",
                error
            );

        }

    },


    /*
    ========================================================
    ENVIAR SINALIZAÇÃO
    ========================================================
    */

    async sendSignal(
        channel,
        signal
    ) {

        if (
            !channel ||
            !signal
        ) {

            console.warn(
                "[ScreenShare] Canal ou sinal inválido."
            );


            return null;

        }


        if (
            !realtimeService.isChannelReady(
                channel
            )
        ) {

            console.warn(
                "[ScreenShare] Canal Realtime não está conectado."
            );


            return null;

        }


        try {

            const result =
                await channel.send({

                    type:
                        "broadcast",

                    event:
                        "screen-share",

                    payload:
                        signal

                });


            return result;

        } catch (error) {

            console.error(
                "[ScreenShare] Erro ao enviar sinal:",
                error
            );


            return null;

        }

    },


    /*
    ========================================================
    OUVIR SINALIZAÇÃO
    ========================================================
    */

    onSignal(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            console.warn(
                "[ScreenShare] Canal ou callback inválido."
            );


            return null;

        }


        const listener =
            channel.on(

                "broadcast",

                {
                    event:
                        "screen-share"

                },

                payload => {

                    const signal =
                        payload?.payload;


                    if (!signal) {

                        console.warn(
                            "[ScreenShare] Sinal sem payload."
                        );


                        return;

                    }


                    callback(
                        signal
                    );

                }

            );


        return listener;

    }

};


/*
============================================================
EXPORT
============================================================
*/

export default screenShareService;
