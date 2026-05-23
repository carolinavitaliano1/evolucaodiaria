---
name: Persistent Telehealth Call
description: Daily.co video call survives route changes via global context + PiP floating mini window
type: feature
---
A chamada de teleatendimento é montada uma única vez via PersistentTelehealthRoom no App (dentro de TelehealthCallProvider), fora das rotas. Em /teleatendimento/sala/:id renderiza fullscreen; em qualquer outra rota vira mini janela PiP (bottom-right) com botões ⤢ (voltar à sala) e 📵 (encerrar). TelehealthRoomPage apenas chama startCall() e renderiza um placeholder. Isso permite ao terapeuta navegar para o prontuário/anotações sem cair da chamada.
