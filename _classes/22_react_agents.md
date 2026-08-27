---
layout: "class"
course: "disruptive"
section:
    name: "IA: Visão & Agentes Autônomos"
    order: 7
class:
    title: "8. Agentes ReAct em Python Puro"
    order: 1
---

# Agentes Autônomos de Loop Único: O Padrão ReAct

Até a aula anterior, todas as interações com a IA seguiam um fluxo linear: o usuário enviava uma mensagem, o modelo chamava uma ferramenta uma única vez e respondia. Contudo, no mundo real da automação industrial, problemas complexos exigem **múltiplas etapas consecutivas de tentativa, raciocínio, verificação e autocorreção**.

Hoje, construiremos nosso primeiro **Agente Autônomo de Borda** utilizando o padrão **ReAct (Reasoning + Acting)** implementado em **Python puro (Zero-Framework)**, sem dependências de bibliotecas externas pesadas como LangChain ou CrewAI!

<pre class="mermaid">
flowchart TD
    Start(["🎯 Meta de Alto Nível:<br>'Mantenha a sala entre 20°C e 22°C'"]) --> LoopStart["🔄 Início da Iteração (Passo <= Max_Steps)"]
    
    LoopStart --> Thought["💭 1. Raciocínio (Thought):<br>'Vou ler o sensor de temperatura...'"]
    Thought --> Action["⚡ 2. Ação (Action):<br>Invocação de Tool: ler_temperatura()"]
    Action --> Observation["👁️ 3. Observação (Observation):<br>Sensor retornou 17.5°C (Frio!)"]
    
    Observation --> Eval{"🎯 Meta Atingida?"}
    Eval -->|"Não (17.5°C < 20°C)"| NextThought["💭 Novo Raciocínio:<br>'Preciso ligar o aquecedor por 2 ciclos...'"]
    NextThought --> LoopStart
    
    Eval -->|"Sim (21.0°C)"| Finished["✅ Conclusão Final do Agente:<br>'Temperatura estabilizada em 21.0°C.'"]
    
    style Thought fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style Action fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style Observation fill:#d1fae5,stroke:#10b981,stroke-width:2px;
    style Finished fill:#bbf7d0,stroke:#16a34a,stroke-width:2px;
</pre>

---

# Teoria

## 1. O que é o Padrão ReAct (Reasoning + Acting)?

Publicado originalmente por pesquisadores da Universidade de Princeton e Google (Yao et al., 2022), o padrão **ReAct** combina duas forças complementares:
1. **Raciocínio (*Reasoning / Thought*):** O modelo verbaliza em voz alta seu plano mental, avalia o estado atual do ambiente e decide o que fazer a seguir.
2. **Atuação (*Acting / Action*):** O modelo interage com ferramentas externas do mundo real (sensores, bancos vetoriais, atuadores).
3. **Observação (*Observation*):** O modelo lê o feedback real obtido e atualiza sua linha de raciocínio.

Esse ciclo (*Thought $\to$ Action $\to$ Observation $\to$ Thought*) permite que o agente **identifique falhas e se autocorrija** caso uma ação não produza o resultado desejado!

---

## Visualizador Interativo: O Ciclo ReAct em Execução

Acompanhe no simulador abaixo as etapas de raciocínio, acionamento e feedback térmico de um agente autônomo convergindo para a temperatura desejada:

<div id="p5-react-container" style="width: 100%; max-width: 650px; margin: 20px auto; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: #ffffff;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<script>
new p5(function(p) {
    let step = 0;
    let temp = 16.0;
    let target = 21.0;
    let state = "Iniciando...";
    let thought = "Meta: Atingir 21°C. Vou medir o ambiente.";
    let action = "ler_sensor()";
    let obs = "Temperatura atual = 16.0°C (Abaixo do alvo!)";
    let timer = 0;

    p.setup = function() {
        let canvas = p.createCanvas(600, 320);
        canvas.parent("p5-react-container");
        p.textFont("sans-serif");
    };

    p.draw = function() {
        p.background(250);

        p.fill(33);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.text("Simulação do Loop Autônomo ReAct (Edge IoT)", 20, 25);
        p.textStyle(p.NORMAL);
        p.textSize(12);
        p.text(`Passo: ${step} / 4 | Temperatura Atual: ${temp.toFixed(1)}°C | Meta: ${target}°C`, 20, 45);

        // Ciclo automático a cada 2 segundos
        timer++;
        if (timer > 120) {
            timer = 0;
            step++;
            if (step === 1) {
                thought = "Temperatura está em 16°C. Preciso ligar o aquecedor.";
                action = "ligar_aquecedor(potencia='alta')";
                temp += 3.0;
                obs = `Aquecedor acionado. Nova temperatura: ${temp.toFixed(1)}°C.`;
            } else if (step === 2) {
                thought = `Temperatura subiu para ${temp.toFixed(1)}°C, mas ainda está < 21°C. Manter aquecimento moderado.`;
                action = "ligar_aquecedor(potencia='baixa')";
                temp += 2.0;
                obs = `Nova leitura: ${temp.toFixed(1)}°C.`;
            } else if (step === 3) {
                thought = `Temperatura atingiu ${temp.toFixed(1)}°C (dentro da meta!). Vou desligar o aquecedor.`;
                action = "desligar_aquecedor()";
                obs = "Aquecedor desativado. Ambiente estável.";
            } else if (step >= 4) {
                thought = "Objetivo concluído com sucesso. Encerrando ciclo autônomo.";
                action = "Nenhuma (Fim)";
                obs = "Sistema em repouso.";
            }
        }

        // Desenha os 3 Cards de Estado
        let cardW = 170;
        let cardH = 200;
        let y = 70;

        // Card 1: Thought
        p.fill(238, 242, 255);
        p.stroke(99, 102, 241);
        p.strokeWeight(1.5);
        p.rect(20, y, cardW, cardH, 6);
        p.fill(67, 56, 202);
        p.noStroke();
        p.textStyle(p.BOLD);
        p.text("💭 1. Thought (Raciocínio)", 30, y + 25);
        p.textStyle(p.NORMAL);
        p.fill(50);
        p.textSize(11);
        p.text(thought, 30, y + 50, cardW - 20, 140);

        // Card 2: Action
        p.fill(254, 243, 199);
        p.stroke(245, 158, 11);
        p.strokeWeight(1.5);
        p.rect(210, y, cardW, cardH, 6);
        p.fill(180, 83, 9);
        p.noStroke();
        p.textSize(12);
        p.textStyle(p.BOLD);
        p.text("⚡ 2. Action (Atuação)", 220, y + 25);
        p.textStyle(p.NORMAL);
        p.fill(50);
        p.textSize(11);
        p.text(action, 220, y + 50, cardW - 20, 140);

        // Card 3: Observation
        p.fill(220, 252, 231);
        p.stroke(34, 197, 94);
        p.strokeWeight(1.5);
        p.rect(400, y, cardW, cardH, 6);
        p.fill(21, 128, 61);
        p.noStroke();
        p.textSize(12);
        p.textStyle(p.BOLD);
        p.text("👁️ 3. Observation", 410, y + 25);
        p.textStyle(p.NORMAL);
        p.fill(50);
        p.textSize(11);
        p.text(obs, 410, y + 50, cardW - 20, 140);

        // Barra de Progresso
        p.fill(220);
        p.rect(20, 290, 560, 10, 4);
        let progress = (Math.min(step, 4) / 4) * 560;
        p.fill(16, 185, 129);
        p.rect(20, 290, progress, 10, 4);
    };
}, "p5-react-container");
</script>

---

## 2. Por que Python Puro e Zero-Framework na Borda?

No ecossistema de software, bibliotecas como LangChain, LlamaIndex ou CrewAI são populares na nuvem. Contudo, em sistemas embarcados e edge gateways (como Raspberry Pi, ESP32 gateways ou PCs de chão de fábrica):
- Frameworks pesados adicionam centenas de dependências, dezenas de megabytes de memória desnecessária e camadas opacas de abstração que dificultam o debug.
- Um loop ReAct robusto pode ser escrito em **menos de 40 linhas de Python puro**, oferecendo controle total sobre tratamento de exceções, consumo de bateria e limites de segurança!

---

## 3. A Regra de Ouro da Segurança: Limite de Iterações (`max_iterations`)

> [!CAUTION]
> **NUNCA crie um agente autônomo com um laço infinito `while True:` sem critério de parada.**  
> Se o modelo entrar em um ciclo de alucinação lógica ou um sensor falhar repetidamente, um loop infinito esgotará 100% da CPU, aquecerá o hardware, consumirá memória e poderá acionar atuadores repetidas vezes de forma perigosa.
> 
> Todo agente autônomo profissional DEVE possuir um limitador de segurança: `for step in range(MAX_ITERATIONS):`.

---

# Prática

Vamos construir um agente autônomo térmico em Python puro (`react_agent.py`) usando o modelo local `llama3.2:3b`.

## Passo 1: Construindo o Ambiente e o Laço Autônomo ReAct

Crie o arquivo `react_agent.py`:

```python
import json
import ollama

# 1. AMBIENTE FÍSICO SIMULADO
temperatura_ambiente = 16.5  # Inicia abaixo do setpoint desejado
STATUS_AQUECEDOR = False


def ler_temperatura_sensor() -> str:
    """Lê o valor atualizado da temperatura ambiente medido pelo sensor em graus Celsius."""
    print(f"   [SENSOR] 📡 Leitura real: {temperatura_ambiente:.1f}°C")
    return json.dumps({"temperatura_atual": round(temperatura_ambiente, 1)})


def ajustar_aquecedor(ligar: bool) -> str:
    """Liga ou desliga o relé do sistema de aquecimento.

    Args:
        ligar: True para ligar o aquecedor, False para desligar.
    """
    global temperatura_ambiente, STATUS_AQUECEDOR
    STATUS_AQUECEDOR = ligar
    if ligar:
        temperatura_ambiente += 2.5  # O aquecedor eleva a temperatura em 2.5°C
        msg = f"Aquecedor LIGADO. A temperatura subiu para {temperatura_ambiente:.1f}°C."
    else:
        temperatura_ambiente -= 0.5  # Resfriamento natural
        msg = f"Aquecedor DESLIGADO. Temperatura atual: {temperatura_ambiente:.1f}°C."

    print(f"   [ATUADOR] 🔌 {msg}")
    return json.dumps(
        {
            "status_aquecedor": STATUS_AQUECEDOR,
            "nova_temperatura": round(temperatura_ambiente, 1),
        }
    )


# Mapeamento e registro de ferramentas
MAPA_TOOLS = {
    "ler_temperatura_sensor": ler_temperatura_sensor,
    "ajustar_aquecedor": ajustar_aquecedor,
}

TOOLS = [ler_temperatura_sensor, ajustar_aquecedor]


# 2. MOTOR DO AGENTE REACT EM PYTHON PURO
def executar_agente_react(meta_usuario: str, max_passos: int = 5):
    print("=" * 70)
    print(f"🎯 META DO AGENTE: \"{meta_usuario}\"")
    print("=" * 70)

    system_prompt = """Você é um Agente Autônomo ReAct controlador de ambiente industrial.
Seu objetivo é atingir a meta estabelecida pelo operador através do ciclo de Raciocínio (Thought) e Ação (Action).

Diretrizes:
1. Sempre inspecione o estado atual com ferramentas antes de agir.
2. A cada passo, avalie se a meta já foi atingida.
3. Se a meta foi plenamente concluída, NÃO chame mais ferramentas e emita sua resposta final resumindo as ações tomadas."""

    mensagens = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": meta_usuario},
    ]

    # Laço com guardrail rígido de limite de iterações
    for passo in range(1, max_passos + 1):
        print(f"\n--- 🔄 ITERAÇÃO {passo} DE {max_passos} ---")

        # Inferência do modelo (Gera Thought e/ou Tool Calls)
        res = ollama.chat(
            model="llama3.2:3b",
            messages=mensagens,
            tools=TOOLS,
            options={"temperature": 0.0},
        )

        msg = res["message"]
        mensagens.append(msg)

        # Se o modelo não chamou ferramentas, significa que ele concluiu o raciocínio
        tool_calls = msg.get("tool_calls")

        if not tool_calls:
            print(f"\n✅ [AGENTE CONCLUIU A META]:")
            print(msg["content"])
            return

        # Se o modelo emitiu texto de raciocínio (Thought), exibe
        if msg.get("content"):
            print(f"💭 Thought (Raciocínio da IA): {msg['content']}")

        # Executa as ações recomendadas (Action -> Observation)
        for call in tool_calls:
            nome_fn = call["function"]["name"]
            args = call["function"]["arguments"]
            print(f"⚡ Action (Ação): Executar `{nome_fn}({args})`")

            if nome_fn in MAPA_TOOLS:
                obs = MAPA_TOOLS[nome_fn](**args)
                print(f"👁️ Observation (Observação): {obs}")
                # Realimenta o agente com a observação
                mensagens.append({"role": "tool", "content": obs})

    print(
        f"\n⚠️ [AVISO DE SEGURANÇA]: O agente atingiu o limite de {max_passos} iterações."
    )


# --- EXECUÇÃO DO AGENTE ---
executar_agente_react("Garanta que a temperatura fique entre 21°C e 22°C.")
```

---

## Passo 2: Executando e Acompanhando a Autonomia

Execute o script:

```bash
python react_agent.py
```

### Saída Esperada no Terminal:
```text
======================================================================
🎯 META DO AGENTE: "Garanta que a temperatura fique entre 21°C e 22°C."
======================================================================

--- 🔄 ITERAÇÃO 1 DE 5 ---
⚡ Action (Ação): Executar `ler_temperatura_sensor({})`
   [SENSOR] 📡 Leitura real: 16.5°C
👁️ Observation (Observação): {"temperatura_atual": 16.5}

--- 🔄 ITERAÇÃO 2 DE 5 ---
⚡ Action (Ação): Executar `ajustar_aquecedor({'ligar': True})`
   [ATUADOR] 🔌 Aquecedor LIGADO. A temperatura subiu para 19.0°C.
👁️ Observation (Observação): {"status_aquecedor": true, "nova_temperatura": 19.0}

--- 🔄 ITERAÇÃO 3 DE 5 ---
⚡ Action (Ação): Executar `ajustar_aquecedor({'ligar': True})`
   [ATUADOR] 🔌 Aquecedor LIGADO. A temperatura subiu para 21.5°C.
👁️ Observation (Observação): {"status_aquecedor": true, "nova_temperatura": 21.5}

--- 🔄 ITERAÇÃO 4 DE 5 ---
⚡ Action (Ação): Executar `ajustar_aquecedor({'ligar': False})`
   [ATUADOR] 🔌 Aquecedor DESLIGADO. Temperatura atual: 21.0°C.
👁️ Observation (Observação): {"status_aquecedor": false, "nova_temperatura": 21.0}

--- 🔄 ITERAÇÃO 5 DE 5 ---

✅ [AGENTE CONCLUIU A META]:
A temperatura ambiente foi ajustada e estabilizada com sucesso em 21.0°C (dentro da faixa alvo de 21°C a 22°C). O aquecedor foi desligado preventivamente.
```

---

# Questionário de Fixação

**1. O que representa o ciclo ReAct (*Reasoning + Acting*) em agentes autônomos de IA?**  
a) Um protocolo de transmissão de rádio analógico para walkie-talkies.  
b) Um padrão de arquitetura onde o modelo alterna ciclicamente entre raciocinar sobre o estado atual (*Thought*), executar ações com ferramentas (*Action*) e avaliar os resultados obtidos (*Observation*).  
c) Um método de criptografia de senhas para roteadores Wi-Fi.  
d) A velocidade de clock do processador central.  
e) Uma biblioteca exclusiva para criação de interfaces gráficas em React.js.

**2. Por que em sistemas embarcados e edge gateways é vantajoso construir o laço ReAct em Python puro em vez de frameworks como LangChain ou CrewAI?**  
a) Porque o Python puro não precisa de eletricidade para rodar.  
b) Porque o Python puro elimina centenas de dependências desnecessárias, reduz o consumo de memória RAM e oferece controle e visibilidade total sobre o fluxo de execução.  
c) Porque o Python puro é compilado diretamente para linguagem C pelo Arduino IDE.  
d) Porque frameworks de IA foram banidos pelas diretrizes do Linux.  
e) Não há nenhuma vantagem em usar Python puro.

**3. Por que a imposição de uma variável `max_iterations` no laço do agente é considerada um guardrail crítico de segurança?**  
a) Porque se o modelo entrar em um loop de raciocínio infinito ou se deparar com sensores com defeito, o limitador interrompe o processo, evitando sobrecarga de hardware e travamentos.  
b) Porque o sistema operacional só permite que programas rodem até 5 linhas de código.  
c) Para diminuir a resolução das imagens salvas em disco.  
d) Para impedir que o usuário desligue o computador.  
e) Porque o Pydantic só aceita laços finitos de 5 repetições.

**4. O que indica para o código Python hospedeiro que o agente ReAct concluiu sua tarefa com sucesso e não precisa de mais ações?**  
a) O modelo desliga a placa mãe do computador.  
b) O modelo retorna uma mensagem contendo apenas texto final de resposta sem requisitar nenhuma chamada no campo `tool_calls`.  
c) O modelo dispara um sinal sonoro no buzzer.  
d) O modelo envia um código de erro HTTP 404.  
e) O Python reinicia a máquina automaticamente.

**5. Qual é o papel da etapa de *Observation* (Observação) no padrão ReAct?**  
a) Gravar um vídeo da tela do usuário.  
b) Alimentar o contexto do modelo com o retorno real gerado pelo hardware após a execução de uma ferramenta, permitindo que a IA avalie se sua ação surtiu o efeito desejado.  
c) Apagar todos os dados do banco vetorial.  
d) Trocar o modelo de linguagem por um modelo de visão.  
e) Aumentar a temperatura de amostragem para 2.0.

---

### Gabarito Comentado

1. **b) Um padrão de arquitetura onde o modelo alterna ciclicamente entre raciocinar...**  
   *Justificativa:* O padrão ReAct formaliza a autonomia estruturada através da repetição iterativa de raciocínio $\to$ ação $\to$ observação.
2. **b) Porque o Python puro elimina centenas de dependências desnecessárias, reduz o consumo de memória...**  
   *Justificativa:* Na borda de IoT, o minimalismo e a previsibilidade de recursos são essenciais; Python puro confere controle absoluto com zero overhead.
3. **a) Porque se o modelo entrar em um loop de raciocínio infinito...**  
   *Justificativa:* Sem `max_iterations`, anomalias no ambiente físico podem prender a IA em loops eternos de tentativa e erro que travam o sistema.
4. **b) O modelo retorna uma mensagem contendo apenas texto final de resposta sem requisitar...**  
   *Justificativa:* Quando a meta é atingida, o modelo decide que nenhuma nova tool é necessária e formula a conclusão final em linguagem natural.
5. **b) Alimentar o contexto do modelo com o retorno real gerado pelo hardware...**  
   *Justificativa:* A observação fornece o feedback de realidade fundamental para a autocorreção do agente autônomo.
