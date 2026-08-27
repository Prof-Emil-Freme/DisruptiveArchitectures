---
layout: "class"
course: "disruptive"
section:
    name: "Desafio"
    order: 7
class:
    title: "Genius + MQTT + Dashboard"
    order: 1
---

# Desafio: Genius IoT - Global Leaderboard

### Objetivo
Transformar o jogo "Genius" que fizemos nas aulas anteriores em um dispositivo
IoT conectado, capaz de identificar o jogador, aumentar a dificuldade
progressivamente e registrar as pontuações em um ranking global em tempo real.

### Fase 1: Interface e Identificação (Hardware & Código) O jogo não deve
começar imediatamente. O sistema deve aguardar a identificação do jogador.
* **Tag do Jogador:** Implemente um estado inicial no código onde o jogador
utiliza botões (ou um encoder) para selecionar **3 caracteres** (ex:
"ABC", "JOE") que servirão como sua "TAG".
* **Display LCD I2C:** Utilize um display LCD 16x2 com módulo I2C para
exibir:
    * Mensagem de boas-vindas.
    * Seleção da Tag em tempo real.
    * Pontuação atual durante o jogo.
    * Mensagem de "Game Over" com a pontuação final.

### Fase 2: Gameplay Dinâmico (Lógica de Programação) O jogo precisa ser
mais desafiador e duradouro do que a versão básica.
* **Limite Estendido:** Altere as variáveis de controle e arrays para que o
jogo suporte sequências de **pelo menos 100 rodadas** (ou até o jogador
errar), removendo o limite fixo de 10.
* **Dificuldade Adaptativa:** Implemente uma lógica de tempo dinâmico. A
cada rodada vencida, o tempo de acendimento dos LEDs e o intervalo entre
as cores deve diminuir (ex: reduzindo 10% a cada nível), tornando o jogo
mais frenético conforme o jogador avança.

### Fase 3: Conectividade (MQTT) O dispositivo deve reportar os resultados
para a nuvem.
* **Publicação de Resultados:** Assim que o jogador errar a sequência, o
microcontrolador deve formatar uma mensagem (preferencialmente em JSON)
contendo: `{"tag": "ABC", "score": 15}`.
* **Tópico:** Publique esta informação em um tópico exclusivo no broker
público (ex: `disruptive/genius/rank`).

### Fase 4: Inteligência e Visualização (Node-RED) O Node-RED atuará como o
"Cérebro" do ranking.
* **Processamento de Dados:** Crie um fluxo que escuta o tópico MQTT. Ao
receber uma nova pontuação, o Node-RED deve comparar com os resultados
anteriores.
* **Dashboard de Líderes:**
    * Utilize o nó `ui_table` ou `ui_text` do pacote
    **node-red-dashboard**.
    * O dashboard deve exibir uma **lista dos 10 melhores jogadores**
    (Top 10), ordenada da maior para a menor pontuação.
    * A lista deve ser persistente (dica: utilize variáveis de
    `context` ou `global` no Node-RED para armazenar o ranking enquanto o
    servidor estiver rodando).

### Requisitos Técnicos de Entrega:
1.  **Código-fonte:** Comentado, destacando as funções de redução de tempo
e a lógica da Tag.
2.  **Esquema Elétrico:** Diagrama atualizado incluindo o LCD I2C e os
botões de controle.
3.  **Fluxo Node-RED:** Exportação do JSON do fluxo ou print do dashboard
funcionando com as 10 melhores pontuações.

