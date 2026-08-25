# WatchParty

WatchParty é uma sala colaborativa em tempo real para conversar e acompanhar até três compartilhamentos de tela simultâneos no navegador.

## Funcionalidades

- Criação e entrada em salas
- Auth anônimo e identidade visual persistente
- Supabase Realtime, Presence e chat efêmero
- WebRTC com múltiplos compartilhamentos, recovery e qualidade adaptativa
- Controles de host e interface responsiva

## Stack

- React
- Vite
- Supabase
- WebRTC

## Como executar

```bash
npm install
npm run dev
```

Crie `.env.local` (não versionado) com chaves públicas:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua-chave-publica-ou-anon
```

Habilite Auth anônimo no Supabase. Nunca use `service_role` no frontend.

## Build

```bash
npm run build
```

## Deploy na Vercel

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` no ambiente do projeto e publique o diretório desta aplicação. O `vercel.json` mantém rotas SPA como `/watch/:roomId` funcionando em acessos diretos e após refresh.

## Limitações da versão 1.0

- Brave ↔ Brave na mesma máquina ainda precisa ser validado usando máquinas separadas.
- O chat é efêmero.
- Não há TURN próprio; redes restritivas podem impedir a conexão P2P.
- A topologia WebRTC é mesh e não é destinada a salas grandes.
- Presence e o limite de participantes são best effort e sujeitos a corrida em entradas simultâneas.
- Moderação, force-stop e limites de compartilhamento são controles client-side via Realtime, não autorização server-side contra clientes adulterados.
