# Rei do Peteleco

Jogo de peteleco de mesa para jogar no navegador (computador ou celular).

## Como jogar

- Puxe o boneco que está na linha tracejada para trás e solte. Quanto mais puxar, mais forte o peteleco.
- Toque em outro boneco da sua fila para usar ele no lugar.
- Toque perto da linha tracejada para mover o boneco para os lados antes de mirar.
- Derrubou bonecos do outro time? Eles passam para o seu time.
- Errou? Depende da regra escolhida: o boneco volta pra fila ou é perdido.
- Ganha quem deixar o outro sem nenhum boneco.

Modos: **Fases** (contra o computador, a mesa fica mais comprida e o computador mira melhor a cada fase)
e **Duelo** (duas pessoas no mesmo aparelho). O botão 2D/3D troca a visão a qualquer momento.

Vencer fases desbloqueia pacotes novos de personagens (fases 2, 4, 6, 8, 10 e 12).

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Para jogar no celular, entre em "Jogar no celular" e escaneie o QR code
(o celular precisa estar no mesmo Wi-Fi).

## Onde mexer

- `src/game/packs.ts`: personagens e pacotes (nome, cor, tamanho, peso, firmeza).
- `src/game/levels.ts`: fases (distância, time do computador, pontaria).
- `src/game/sim.ts`: regras e física.
- `src/render/`: desenho 2D e 3D.
