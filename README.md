# Rei do Peteleco

Jogo de peteleco de mesa para jogar no navegador (computador ou celular).

## Como jogar

- Puxe o boneco que está na linha tracejada para trás e solte. Quanto mais puxar, mais forte o peteleco.
- Toque em outro boneco da sua fila para usar ele no lugar.
- Toque perto da linha tracejada para mover o boneco para os lados antes de mirar.
- Derrubou bonecos do outro time? Eles passam para o seu time.
- Errou? Depende da regra escolhida: o boneco volta pra fila ou é perdido.
- Ganha quem deixar o outro sem nenhum boneco.

Cada fase acontece num lugar diferente, no 2D e no 3D: Mesa da Cozinha, Mesa da Sala, Chão da Rua,
Pátio da Escola, Mesa do Shopping, Praça de Alimentação, Pista de Gelo, Tabuleiro Gigante, Estádio,
Areia da Praia, Vulcão e Trono do Rei. O chão muda o jogo: no gelo os bonecos escorregam mais,
na areia e no asfalto param antes. No Duelo dá para escolher o lugar.

Modos: **Fases** (contra o computador, a mesa fica mais comprida e o computador mira melhor a cada fase)
e **Duelo** (duas pessoas no mesmo aparelho). O botão 2D/3D troca a visão a qualquer momento.

Vencer fases desbloqueia pacotes novos de personagens (fases 1, 2, 3, 4, 6, 8, 10 e 12).

Os bonecos capotam e quicam ao serem petelecados: cada um tem **Peso**, **Firmeza**, **Pulo**,
**Controle** e **Deslize**, e isso muda a distância, o desvio e a força da batida. Cada boneco
ganha experiência quando derruba alguém e sobe de nível (até o 5), ficando mais firme e mais
fácil de controlar. Antes de jogar, escolha quais bonecos do pacote entram no time.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Para jogar no celular, entre em "Jogar no celular" e escaneie o QR code
(o celular precisa estar no mesmo Wi-Fi).

## Onde mexer

- `src/game/packs.ts`: personagens e pacotes (nome, visual, tamanho, peso, firmeza).
  Cada boneco é montado por peças: estilo (`vinyl`, `jelly`, `metal`, `gloss`), corpo, olhos, boca,
  enfeites na cabeça e extras. Veja as opções em `src/figures/build.ts`.
- Com `npm run dev` rodando, abra http://localhost:5173/figures.html para ver todos os bonecos de frente e de costas.
- `src/game/levels.ts`: fases (distância, time do computador, pontaria).
- `src/game/sim.ts`: regras e física.
- `src/scenes/`: cenários de cada fase (objetos, chão, luz e céu).
- `src/render/`: desenho 2D e 3D.
