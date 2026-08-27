---
layout: "class"
course: "disruptive"
section:
    name: "IA: Fundamentos & Estruturação"
    order: 5
class:
    title: "1. Demistificando GenAI & Modelos Locais"
    order: 0
---

# Demistificando GenAI & A Revolução dos Modelos Locais

Bem-vindo à fase de Inteligência Artificial da nossa disciplina! Até aqui, exploramos como os microcontroladores e microprocessadores sentem o mundo por meio de sensores e atuam em motores, relés e displays. Agora, vamos adicionar uma nova camada cognitiva aos nossos sistemas embarcados: **Modelos de Linguagem de Grande Escala (LLMs - Large Language Models) e Pequena Escala (SLMs - Small Language Models) executados localmente na borda (Edge AI)**.

Ao longo desta jornada de 13 encontros práticos no formato *Problem-Based Learning* (PBL), construiremos juntos um **Local AI Smart Gateway Agent**: um gateway inteligente, 100% privado e autônomo, capaz de interpretar sensores, tomar decisões lógicas, raciocinar sobre manuais de hardware e controlar dispositivos físicos via MQTT.

<pre class="mermaid">
graph LR
    subgraph Edge_Gateway["Hardware Local (Edge Gateway / PC / SBC)"]
        Sensors["📡 Telemetria de Sensores"] --> Engine["⚙️ Motor Local (Ollama / Llama.cpp)"]
        Engine --> Model["🧠 SLM Local (Llama 3.2 / Qwen 2.5)"]
        Model --> Decision["⚡ Decisão Lógica / Ação"]
        Decision --> Actuators["🔌 Atuadores & Relés"]
    end
    style Edge_Gateway fill:#f8f9fa,stroke:#333,stroke-width:2px;
    style Model fill:#e8f0fe,stroke:#4285f4,stroke-width:2px;
</pre>

---

# Teoria

## 1. O que acontece "por baixo do capô" de um LLM?

Diferente de um código tradicional em C++ ou Python, onde declaramos regras determinísticas (`if temp > 30: liga_cooler()`), um LLM é essencialmente uma **máquina estatística de predição de próximo token** (*Next-Token Prediction*) treinada sobre uma arquitetura de rede neural chamada **Transformer**.

Quando fornecemos um texto de entrada (*prompt*), o modelo:
1. **Tokeniza o texto**: Converte caracteres e palavras em identificadores numéricos (*Tokens*).
2. **Gera Embeddings**: Mapeia esses tokens para um espaço vetorial contínuo de alta dimensão.
3. **Aplica Camadas de Atenção (*Self-Attention*)**: Calcula o relacionamento semântico e a importância relativa entre todos os tokens da frase.
4. **Calcula a Distribuição de Probabilidades (*Logits*)**: Atribui uma probabilidade estatística para cada palavra/token possível no vocabulário como o sucessor mais plausível.
5. **Amostra o próximo token**: Escolhe o próximo token com base em hiperparâmetros de amostragem (*Temperature, Top-P, Min-P*) e repete o ciclo iterativamente até emitir o token de fim de sequência (`<|end_of_text|>`).

$$
\text{P}(w_t \mid w_1, w_2, \dots, w_{t-1}) = \text{Softmax}\left(\frac{z_t}{T}\right)
$$

Onde $$z_t$$ representa o vetor de *logits* brutos gerados pela última camada e $$T$$ é a **Temperatura**.

---

## 2. Conceitos Fundamentais de Engenharia de Modelos

### Tokens vs. Palavras
Um modelo não lê letras nem palavras inteiras diretamente. Ele utiliza algoritmos de sub-palavras (como *Byte-Pair Encoding - BPE*). 
- Em média, no idioma inglês, **1 token $$\approx$$ 0.75 palavras** (ou 100 tokens $$\approx$$ 75 palavras).
- Em português ou em códigos técnicos/JSON, a fragmentação pode ser ligeiramente maior. Pontuações, quebras de linha e espaços também contam como tokens!

### Janela de Contexto (*Context Window*)
A janela de contexto é a memória de trabalho máxima que o modelo consegue processar em uma única chamada (entrada + saída).
- Modelos modernos como `Llama 3.2` possuem suporte a até **128k tokens** de contexto.
- Em sistemas embarcados e edge devices, janelas de contexto muito longas consomem proporcionalmente mais memória RAM para o armazenamento do **KV-Cache** (*Key-Value Cache*). Por isso, no edge, otimizamos o contexto para ser conciso e objetivo!

### Hiperparâmetros de Amostragem (*Sampling*)
- **Temperatura ($$T$$):** Controla a aleatoriedade da distribuição de probabilidades gerada pelo Softmax.
  - $$T = 0.0$$ (*Greedy Decoding*): O modelo sempre escolhe o token com a maior probabilidade absoluta. Indispensável para código, comandos de sensores e JSON.
  - $$T = 0.7 - 1.0$$: O modelo introduz variabilidade e criatividade na geração.
- **Top-P (*Nucleus Sampling*):** Restringe as opções aos $$N$$ tokens cujas probabilidades somadas atingem o limiar $$P$$ (ex: $$P=0.9$$).
- **Min-P:** Nova técnica de amostragem moderna que descarta qualquer token cuja probabilidade seja inferior a uma fração proporcional do token principal (ex: $$\text{Min-P} = 0.05$$).

---

## Visualizador Interativo: Amostragem por Temperatura

Experimente ajustar a temperatura no simulador abaixo para observar como a curva de probabilidades de escolha do próximo token varia entre determinística ($$T \to 0$$) e aleatória ($$T \to 1.5$$):

<div id="p5-temperature-container" style="width: 100%; max-width: 650px; margin: 20px auto; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: #ffffff;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<script>
new p5(function(p) {
    let tempSlider;
    const tokens = [
        { word: "LIGAR", logit: 4.5 },
        { word: "DESLIGAR", logit: 3.2 },
        { word: "MANTER", logit: 2.1 },
        { word: "ERRO", logit: 0.8 },
        { word: "REINICIAR", logit: 0.3 }
    ];

    p.setup = function() {
        let canvas = p.createCanvas(600, 320);
        canvas.parent("p5-temperature-container");
        p.textFont("sans-serif");
        
        p.createSpan("Temperatura (T): ").parent("p5-temperature-container").style("margin-left", "15px");
        tempSlider = p.createSlider(0.1, 1.5, 0.2, 0.05);
        tempSlider.parent("p5-temperature-container");
        tempSlider.style("width", "180px");
    };

    p.draw = function() {
        p.background(250);
        let T = tempSlider.value();
        
        p.fill(33);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.text("Distribuição de Probabilidade Softmax (Próximo Token)", 20, 25);
        p.textStyle(p.NORMAL);
        p.textSize(12);
        p.text(`Valor de T = ${T.toFixed(2)} (${T <= 0.3 ? "Modo Determinístico / Lógico" : T <= 0.8 ? "Balanceado" : "Alta Criatividade / Caos"})`, 20, 45);

        // Softmax calculation
        let expValues = tokens.map(t => Math.exp(t.logit / T));
        let sumExp = expValues.reduce((a, b) => a + b, 0);
        let probs = expValues.map(v => v / sumExp);

        let startY = 70;
        let barHeight = 35;
        let maxBarWidth = 360;

        for (let i = 0; i < tokens.length; i++) {
            let y = startY + i * (barHeight + 12);
            let prob = probs[i];
            let barW = prob * maxBarWidth;

            p.fill(60);
            p.textAlign(p.RIGHT, p.CENTER);
            p.text(tokens[i].word, 110, y + barHeight / 2);

            // Barra de probabilidade
            p.fill(i === 0 ? p.color(66, 133, 244) : p.color(150, 180, 240));
            p.noStroke();
            p.rect(120, y + 4, barW, barHeight - 8, 4);

            // Rótulo numérico
            p.fill(30);
            p.textAlign(p.LEFT, p.CENTER);
            p.text(`${(prob * 100).toFixed(1)}%`, 130 + barW, y + barHeight / 2);
        }
    };
}, "p5-temperature-container");
</script>

---

## 3. Por que Execução Local (Edge AI) para IoT?

Quando pensamos em aplicar IA para automação predial, veículos autônomos ou monitoramento industrial, enviar cada dado de sensor para APIs de nuvem (como OpenAI ou Google Cloud) traz desvantagens críticas:

| Fator | IA em Nuvem (Cloud APIs) | IA Local na Borda (Edge AI) |
| :--- | :--- | :--- |
| **Latência** | 500ms a 3.000ms (depende do link de rede) | **50ms a 200ms** (execução local direta em barramento) |
| **Privacidade & Segurança** | Dados de telemetria e áudio trafegam na WAN | **100% dos dados permanecem na rede local** |
| **Custo Recorrente** | Cobrança por milhão de tokens consumidos | **Custo Zero** de licença ou API após aquisição do hardware |
| **Disponibilidade / Offline**| Falha total em caso de queda de link de internet | **Resiliência total** (opera 24/7 sem conexão externa) |
| **Consumo de Banda** | Alto tráfego de dados contínuo | **Zero tráfego externo** na WAN |

Com o surgimento de modelos compactos de alta densidade como o **Llama 3.2 (1B e 3B)** e a família **Qwen 2.5 (0.5B a 3B)**, agora é perfeitamente viável executar modelos inteligentes diretamente na CPU de computadores comuns, Mini-PCs ou SBCs como a Raspberry Pi 5!

---

# Prática

Nesta sessão de laboratório, vamos instalar o ecossistema de inferência local **Ollama**, carregar os modelos ultraleves recomendados e realizar nosso primeiro *benchmark* de taxa de geração de tokens em hardware padrão.

## Passo 1: Instalação do Ollama

O **Ollama** empacota o motor C++ `llama.cpp`, drivers de aceleração gráfica (CUDA, Metal, ROCm, Vulkan) e o gerenciador de modelos em um único serviço local de alta performance.

- **Windows:** Baixe e execute o instalador oficial em [ollama.com/download/windows](https://ollama.com/download/windows).
- **Linux:** Execute no terminal:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
- **macOS:** Baixe a aplicação oficial ou instale via Homebrew:
  ```bash
  brew install ollama
  ```

Verifique se o serviço está ativo executando no terminal ou PowerShell:
```bash
ollama --version
```

---

## Passo 2: Download dos Modelos Compactos (SLMs)

Vamos baixar dois dos modelos abertos mais eficientes do mundo para dispositivos com recursos moderados:

```bash
# Llama 3.2 (1 Bilhão de parâmetros - Meta) -> ~1.3 GB de RAM
ollama pull llama3.2:1b

# Qwen 2.5 (1.5 Bilhões de parâmetros - Alibaba) -> ~1.8 GB de RAM
ollama pull qwen2.5:1.5b
```

---

## Passo 3: Benchmarking de Inferência e Taxa de Tokens

Para avaliar se o seu hardware é capaz de atender aos requisitos de tempo de resposta da sua aplicação IoT, podemos executar o Ollama no modo verboso (`--verbose`). Esse modo exibe métricas precisas de:
1. **Total duration:** Tempo total decorrido.
2. **Load duration:** Tempo gasto para carregar os tensores do modelo na memória.
3. **Prompt eval rate:** Taxa de processamento dos tokens de entrada (tokens/segundo).
4. **Eval rate:** Taxa real de geração dos tokens de saída (tokens/segundo).

Execute o teste com o modelo de 1B:

```bash
ollama run llama3.2:1b --verbose "Explique em um único parágrafo o que é o protocolo MQTT e por que ele é ideal para IoT."
```

Observe o relatório final retornado no terminal:
```text
total duration:       1.42s
load duration:        21.3ms
prompt eval count:    28 token(s)
prompt eval duration: 112ms
prompt eval rate:     250.00 tokens/s
eval count:           85 token(s)
eval duration:        1.28s
eval rate:            66.40 tokens/s
```

> [!NOTE]
> Uma taxa de geração (`eval rate`) acima de **15 a 20 tokens/segundo** já é mais rápida que a velocidade média de leitura humana e perfeitamente adequada para automação em tempo real!

---

## Passo 4: Comparando o Comportamento da Temperatura no CLI

Inicie uma sessão interativa no Ollama e alterne os parâmetros em tempo de execução para observar a variação entre respostas determinísticas e criativas:

```bash
ollama run llama3.2:1b
```

Dentro da sessão interativa do Ollama:
```text
>>> /set parameter temperature 0.0
>>> Classifique o status do sensor: "temperatura de 98 graus detectada na caldeira". Responda apenas com: NORMAL, ALERTA ou CRITICO.
CRITICO

>>> /set parameter temperature 1.2
>>> Crie uma mensagem poética para avisar que a caldeira superaqueceu.
O fogo dança perigoso além do limite, o aço clama por alívio nas sombras do vapor...
>>> /bye
```

---

# Questionário de Fixação

**1. O que significa afirmar que um LLM realiza *Next-Token Prediction*?**  
a) O modelo procura respostas pré-programadas em uma base de dados relacional SQL.  
b) O modelo calcula estatisticamente a probabilidade de cada token do vocabulário ser o sucessor do texto já fornecido.  
c) O modelo executa compilação estática de código binário em C++.  
d) O modelo realiza busca booleana por palavras-chave em arquivos locais de texto.  
e) O modelo envia os dados brutos de entrada para um servidor de busca na web.

**2. Para aplicações de controle de atuadores e conversão de comandos em sistemas embarcados (onde não toleramos respostas inconsistentes), qual configuração de Temperatura ($T$) é recomendada?**  
a) $T = 1.5$ (Alta aleatoriedade para explorar novos comandos).  
b) $T = 1.0$ (Modo conversacional padrão).  
c) $T = 0.0$ (Decodificação gulosa / *Greedy Decoding* determinística).  
d) $T = -1.0$ (Modo invertido de probabilidade).  
e) A temperatura não afeta o resultado em modelos de linguagem.

**3. Qual das seguintes alternativas apresenta uma vantagem direta do uso de *Edge AI* (modelos locais) em comparação com APIs de nuvem para projetos de IoT?**  
a) Redução a zero da necessidade de memória RAM no dispositivo local.  
b) Garantia de funcionamento offline, privacidade dos dados de sensores e latência previsível.  
c) Eliminação da necessidade de sensores e atuadores físicos.  
d) Possibilidade de rodar modelos de 400 bilhões de parâmetros em um Arduino Uno.  
e) Substituição integral de todos os protocolos de rede por sinal de rádio analógico.

**4. Em relação aos *Tokens* em LLMs, é correto afirmar:**  
a) Um token sempre equivale exatamente a um byte de memória.  
b) Um token representa necessariamente uma palavra inteira e nunca pontuações ou sub-palavras.  
c) Modelos processam texto dividindo-o em fragmentos chamados tokens através de algoritmos de tokenização como o BPE.  
d) A contagem de tokens independe do idioma ou da sintaxe utilizada.  
e) Os tokens de saída não consomem tempo de processamento nem janela de contexto.

**5. Ao realizar o benchmark de um modelo via `ollama run ... --verbose`, qual métrica indica a velocidade em que o modelo escreve a resposta gerada?**  
a) `load duration`  
b) `prompt eval count`  
c) `eval rate` (tokens/s)  
d) `temperature coefficient`  
e) `context overflow index`

---

### Gabarito Comentado

1. **b) O modelo calcula estatisticamente a probabilidade de cada token...**  
   *Justificativa:* Os LLMs baseados em Transformers geram texto amostrando recursivamente a distribuição de probabilidade condicional do próximo token calculada na camada final (Softmax sobre os logits).
2. **c) $T = 0.0$ (Decodificação gulosa / *Greedy Decoding* determinística).**  
   *Justificativa:* Em sistemas de controle e IoT, queremos que a mesma entrada de sensor sempre resulte na mesma decisão ou código de controle previsível, o que é garantido por $T=0.0$.
3. **b) Garantia de funcionamento offline, privacidade dos dados de sensores e latência previsível.**  
   *Justificativa:* O processamento na borda mantém os dados dentro da rede local, elimina custos recorrentes de API por token e não depende de conectividade com a internet para manter o sistema operacional.
4. **c) Modelos processam texto dividindo-o em fragmentos chamados tokens através de algoritmos de tokenização como o BPE.**  
   *Justificativa:* A tokenização decompõe palavras, números, códigos e pontuações em IDs numéricos que alimentam as camadas de embedding do modelo.
5. **c) `eval rate` (tokens/s)**  
   *Justificativa:* O parâmetro `eval rate` mede a quantidade de tokens de resposta que o motor de inferência gera por segundo na fase de decodificação.
