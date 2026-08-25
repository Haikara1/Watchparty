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

O `vercel.json` mantém rotas SPA como `/watch/:roomId` em acessos diretos.

## Limitações da versão 1.0

Presence e o limite de participantes são best effort no cliente, sujeitos a uma corrida em entradas simultâneas. O chat é efêmero. A malha WebRTC depende da conectividade dos navegadores e dos servidores ICE configurados; não há SFU ou TURN próprio.
