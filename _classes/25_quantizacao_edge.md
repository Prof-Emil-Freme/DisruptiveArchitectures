---
layout: "class"
course: "disruptive"
section:
    name: "IA: Protocolos IoT & Edge Gateway"
    order: 8
class:
    title: "11. Quantização & Otimização Edge"
    order: 1
---

# Otimização na Borda & Quantização de Modelos

Até o momento, vimos como executar e orquestrar modelos de linguagem para controle e diagnóstico. No entanto, quando passamos do ambiente de testes no notebook para o **desdobramento real em computadores de placa única (SBCs)** como a Raspberry Pi 5, Orange Pi ou Mini-PCs industriais, nos deparamos com limitações físicas severas de **Memória RAM (4GB a 8GB), Dissipação Térmica e Largura de Banda de Memória**.

Nesta aula, desvendaremos a técnica que tornou possível a revolução da IA local: a **Quantização de Tensores** e o formato **GGUF**.

<pre class="mermaid">
flowchart TD
    subgraph MODEL_FP16["1. Modelo Original em Precisão Total (FP16)"]
        W1["Tensor Peso: 16 bits por parâmetro<br>0 10001 0110101100 (Float16)"]
        Size1["Tamanho em Disco/RAM (3B params):<br>~6.0 Gigabytes"]
        BW1["Largura de Banda de Memória Exigida:<br>Extremamente Alta 🔴"]
    end

    subgraph QUANTIZATION["2. Processo de Quantização (K-Quants)"]
        Algo["🧮 Mapeamento Linear com Escala (Scale) & Ponto Zero (Zero-Point)<br>16 bits ➔ 4 bits (INT4)"]
    end

    subgraph MODEL_GGUF["3. Modelo Otimizado GGUF (Q4_K_M)"]
        W2["Tensor Peso: 4 bits por parâmetro<br>1011 (INT4)"]
        Size2["Tamanho em Disco/RAM (3B params):<br>~1.9 Gigabytes (-68% de RAM!)"]
        BW2["Velocidade de Geração em CPU ARM:<br>Até 3x mais rápido! 🟢"]
    end

    MODEL_FP16 --> QUANTIZATION --> MODEL_GGUF
    style MODEL_FP16 fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    style QUANTIZATION fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style MODEL_GGUF fill:#d1fae5,stroke:#10b981,stroke-width:2px;
</pre>

---

# Teoria

## 1. O que é Quantização de Tensores?

Uma rede neural é composta por bilhões de números decimais chamados **pesos sinápticos** (*Weights*).
- Originalmente, durante o treinamento em supercomputadores, esses pesos são armazenados em ponto flutuante de 32 bits (**FP32**) ou 16 bits (**FP16 / BF16**).
- Cada parâmetro em FP16 consome **2 bytes de memória**. Um modelo de 3 bilhões de parâmetros precisa de $$3 \times 10^9 \times 2 = 6.0 \text{ GB}$$ de memória apenas para carregar os pesos na RAM!

A **Quantização** é a técnica matemática de reduzir a precisão desses números de 16 bits para inteiros de 8 bits (**INT8**), 5 bits (**INT5**) ou 4 bits (**INT4**), através de uma fórmula de escalonamento linear:

$$
W_{\text{quantizado}} = \text{Round}\left(\frac{W_{\text{original}}}{\text{Scale}}\right) + \text{ZeroPoint}
$$

Ao aplicar quantização em 4 bits (**INT4**):
- Cada peso consome apenas **0.5 byte (4 bits)**.
- O mesmo modelo de 3 bilhões de parâmetros cai de **6.0 GB para apenas ~1.9 GB de RAM**, preservando mais de 98% da capacidade cognitiva original do modelo!

---

## Visualizador Interativo: Compressão de Precisão Numérica (FP16 para INT4)

Veja no simulador interativo abaixo como os valores contínuos em ponto flutuante de alta precisão são mapeados para valores discretos inteiros em 4 bits:

<div id="p5-quant-container" style="width: 100%; max-width: 650px; margin: 20px auto; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: #ffffff;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<script>
new p5(function(p) {
    let fpVal = 0.6342;
    let slider;

    p.setup = function() {
        let canvas = p.createCanvas(600, 300);
        canvas.parent("p5-quant-container");
        p.textFont("sans-serif");
        
        p.createSpan("Valor do Peso Real: ").parent("p5-quant-container").style("margin-left", "15px");
        slider = p.createSlider(-1.0, 1.0, 0.6342, 0.01);
        slider.parent("p5-quant-container");
        slider.style("width", "200px");
    };

    p.draw = function() {
        p.background(250);
        fpVal = slider.value();

        p.fill(33);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.text("Mapeamento de Tensores: FP16 (16-bit) ➔ INT4 (4-bit)", 20, 25);
        p.textStyle(p.NORMAL);
        p.textSize(12);
        p.text("Arraste o controle abaixo para inspecionar a quantização linear:", 20, 45);

        // Caixa FP16 (Esquerda)
        p.fill(254, 242, 242);
        p.stroke(239, 68, 68);
        p.strokeWeight(1.5);
        p.rect(30, 70, 240, 190, 6);
        p.fill(185, 28, 28);
        p.noStroke();
        p.textStyle(p.BOLD);
        p.text("🔴 Original: Float16 (16 bits)", 45, 95);
        p.textStyle(p.NORMAL);
        p.fill(40);
        p.text(`Valor Decimal: ${fpVal.toFixed(6)}`, 45, 125);
        p.text("Bits Consumidos: 16 bits (2 bytes)", 45, 150);
        p.text("Tamanho p/ 3B Params: ~6.0 GB", 45, 175);
        p.text("Uso em CPU de Borda: LENTO ⚠️", 45, 200);

        // Cálculo INT4 (-8 a +7, total de 16 níveis)
        let scale = 1.0 / 7.0;
        let int4Val = Math.max(-8, Math.min(7, Math.round(fpVal / scale)));
        let dequantVal = int4Val * scale;
        let erro = Math.abs(fpVal - dequantVal);

        // Caixa INT4 (Direita)
        p.fill(240, 253, 244);
        p.stroke(34, 197, 94);
        p.strokeWeight(1.5);
        p.rect(330, 70, 240, 190, 6);
        p.fill(21, 128, 61);
        p.noStroke();
        p.textStyle(p.BOLD);
        p.text("🟢 Quantizado: INT4 (4 bits)", 345, 95);
        p.textStyle(p.NORMAL);
        p.fill(40);
        p.text(`Nível Inteiro INT4: ${int4Val} (4 bits)`, 345, 125);
        p.text(`Valor Reconstruído: ${dequantVal.toFixed(4)}`, 345, 150);
        p.text(`Erro de Precisão: ${erro.toFixed(4)}`, 345, 175);
        p.text("Tamanho p/ 3B Params: ~1.9 GB 🚀", 345, 200);

        // Seta central
        p.stroke(99, 102, 241);
        p.strokeWeight(2);
        p.line(275, 160, 320, 160);
        p.fill(99, 102, 241);
        p.triangle(325, 160, 315, 155, 315, 165);
    };
}, "p5-quant-container");
</script>

---

## 2. O Ecossistema GGUF & K-Quants (`llama.cpp`)

O formato binário **GGUF** (*GPT-Generated Unified Format*) foi criado por Georgi Gerganov no projeto open-source `llama.cpp`. Ele empacota tensores quantizados, metadados de tokenização e parâmetros em um único arquivo de alta performance.

### Principais Tipos de Quantização K-Quants:
- **`Q8_0` (8-bit):** Perda de precisão praticamente imperceptível ($$<0.1\%$$). Ocupa cerca de metade do tamanho de FP16.
- **`Q5_K_M` (5-bit Medium):** Equilíbrio ideal de precisão para raciocínio complexo.
- **`Q4_K_M` (4-bit Medium):** **O padrão da indústria para Edge AI**. Excelente taxa de tokens/segundo com consumo mínimo de RAM.
- **`Q2_K` (2-bit):** Extrema compressão, mas sofre com perda perceptível de coerência gramatical.

---

## 3. O Gargalo Real da Borda: *Memory Bandwidth*

Por que um modelo de IA roda mais rápido em uma GPU dedicada do que na CPU de uma Raspberry Pi?

> [!IMPORTANT]
> **A inferência de LLMs é limitada pela largura de banda de memória (*Memory Bandwidth Bound*), e não pelo poder de cálculo de clock da CPU.**  
> A cada token gerado, a CPU precisa transferir todos os bilhões de pesos do modelo da memória RAM para o cache da CPU.
> - Se o modelo pesa **6 GB (FP16)** e a RAM transfere a **15 GB/s**, a taxa teórica máxima é de apenas $$\frac{15}{6} \approx 2.5 \text{ tokens/s}$$.
> - Se o modelo for quantizado para **1.9 GB (Q4_K_M)**, a taxa sobe para $$\frac{15}{1.9} \approx 7.9 \text{ tokens/s}$$ — um salto de mais de **300% de velocidade** sem trocar de processador!

---

# Prática

Vamos realizar um experimento prático em Python (`quant_benchmark.py`) para medir em tempo real o **consumo de memória RAM** e a **velocidade de geração de tokens** entre modelos de diferentes portes.

## Passo 1: Construindo o Script de Benchmark de Recursos

Crie o arquivo `quant_benchmark.py`:

```python
import time
import ollama
import psutil

# Lista de modelos para comparação na borda
MODELOS_BENCHMARK = [
    ("qwen2.5:0.5b", "Ultraleve (0.5B)"),
    ("llama3.2:1b", "Compacto (1B)"),
    ("llama3.2:3b", "Raciocínio Médio (3B)"),
]

PROMPT_TESTE = "Explique a importância da eficiência energética em sistemas embarcados de automação industrial em dois parágrafos."


def benchmark_modelo(model_name: str, rotulo: str):
    print("=" * 65)
    print(f"🔬 Testando Modelo: {model_name} [{rotulo}]")

    # Medição de RAM antes da carga
    mem_antes = psutil.virtual_memory().used / (1024 * 1024)  # em MB

    t_inicio = time.time()
    try:
        res = ollama.chat(
            model=model_name,
            messages=[{"role": "user", "content": PROMPT_TESTE}],
            options={"temperature": 0.0},
        )
    except Exception as e:
        print(f"❌ Falha ao carregar modelo '{model_name}': {e}")
        return None

    t_total = time.time() - t_inicio
    mem_depois = psutil.virtual_memory().used / (1024 * 1024)  # em MB

    # Extração de métricas de tokens retornadas pelo Ollama
    eval_count = res.get("eval_count", len(res["message"]["content"].split()))
    eval_duration = res.get("eval_duration", t_total * 1e9) / 1e9  # em segundos
    tokens_por_segundo = (
        eval_count / eval_duration if eval_duration > 0 else 0
    )

    delta_ram = max(0, mem_depois - mem_antes)

    print(f"✅ Geração Concluída em {t_total:.2f}s")
    print(f"   -> Tokens Gerados: {eval_count} tokens")
    print(f"   -> Taxa de Geração (TPS): {tokens_por_segundo:.2f} tokens/s")
    print(f"   -> Consumo Estimado de RAM: ~{delta_ram:.1f} MB")

    return {
        "modelo": model_name,
        "rotulo": rotulo,
        "tps": tokens_por_segundo,
        "tokens": eval_count,
        "tempo_total": t_total,
    }


# --- EXECUÇÃO DO BENCHMARK ---
print("=== INICIANDO BENCHMARK DE DESEMPENHO E SIZING DE HARDWARE ===")
resultados = []

for mod, rot in MODELOS_BENCHMARK:
    r = benchmark_modelo(mod, rot)
    if r:
        resultados.append(r)
    time.sleep(1.0)  # Pausa térmica

# Tabela Final de Dimensionamento
print("\n" + "=" * 65)
print("📊 TABELA DE SIZING PARA DEPLOYMENT NA BORDA (EDGE AI)")
print("=" * 65)
print(f"{'Modelo':<16} | {'Porte':<18} | {'Taxa (t/s)':<12} | {'Tempo Total'}")
print("-" * 65)
for res in resultados:
    print(
        f"{res['modelo']:<16} | {res['rotulo']:<18} | {res['tps']:<12.1f} | {res['tempo_total']:.2f}s"
    )
print("=" * 65)
```

---

## Passo 2: Executando o Benchmark

Execute o script:

```bash
python quant_benchmark.py
```

### Saída Típica Observada:
```text
=== INICIANDO BENCHMARK DE DESEMPENHO E SIZING DE HARDWARE ===
=================================================================
🔬 Testando Modelo: qwen2.5:0.5b [Ultraleve (0.5B)]
✅ Geração Concluída em 1.15s
   -> Tokens Gerados: 68 tokens
   -> Taxa de Geração (TPS): 59.13 tokens/s
   -> Consumo Estimado de RAM: ~550.0 MB
=================================================================
🔬 Testando Modelo: llama3.2:1b [Compacto (1B)]
✅ Geração Concluída em 2.45s
   -> Tokens Gerados: 74 tokens
   -> Taxa de Geração (TPS): 30.20 tokens/s
   -> Consumo Estimado de RAM: ~1300.0 MB
=================================================================
🔬 Testando Modelo: llama3.2:3b [Raciocínio Médio (3B)]
✅ Geração Concluída em 5.80s
   -> Tokens Gerados: 78 tokens
   -> Taxa de Geração (TPS): 13.45 tokens/s
   -> Consumo Estimado de RAM: ~2100.0 MB

=================================================================
📊 TABELA DE SIZING PARA DEPLOYMENT NA BORDA (EDGE AI)
=================================================================
Modelo           | Porte              | Taxa (t/s)   | Tempo Total
-----------------------------------------------------------------
qwen2.5:0.5b     | Ultraleve (0.5B)   | 59.1         | 1.15s
llama3.2:1b      | Compacto (1B)      | 30.2         | 2.45s
llama3.2:3b      | Raciocínio Médio   | 13.5         | 5.80s
=================================================================
```

> [!TIP]
> **Recomendação de Hardware para Raspberry Pi 5 (4GB RAM):**
> - O sistema operacional consome cerca de **1.2 GB**.
> - Rodar o `llama3.2:1b` (1.3 GB) ou `qwen2.5:1.5b` deixa uma margem segura de **1.5 GB de RAM livre**, garantindo que a placa nunca entre em partição *Swap* (o que degradaria a velocidade para menos de 1 token/s!).

---

# Questionário de Fixação

**1. O que é o processo de *Quantização* em redes neurais e modelos de linguagem?**  
a) A contagem física do número de transistores na placa de circuito impresso.  
b) A conversão da representação numérica dos pesos de alta precisão (FP32/FP16) para inteiros de menor precisão (INT8/INT4), reduzindo drasticamente o consumo de memória RAM e disco.  
c) O aumento da voltagem da fonte de alimentação para acelerar o clock da CPU.  
d) A tradução do código Python para linguagem C++.  
e) A exclusão de 90% dos dados dos usuários para liberar espaço.

**2. Qual é a principal vantagem do formato binário GGUF utilizado pelo motor `llama.cpp` e pelo Ollama?**  
a) O GGUF permite que modelos de linguagem sejam executados diretamente em tocadores de DVD.  
b) O GGUF unifica tensores quantizados de alta performance com metadados em um arquivo único otimizado para carregamento instantâneo em CPU e GPU via `mmap`.  
c) O GGUF exige que o computador esteja conectado à internet o tempo todo.  
d) O GGUF substitui o sistema operacional Linux pelo Windows 95.  
e) O GGUF desabilita o suporte a modelos multimodais.

**3. Por que a velocidade de geração de tokens de um LLM em uma CPU é limitada principalmente pela *Largura de Banda de Memória (Memory Bandwidth)*?**  
a) Porque a CPU precisa transferir todos os bilhões de parâmetros do modelo da memória RAM para os registradores a cada token gerado.  
b) Porque o microcontrolador Arduino bloqueia o barramento USB.  
c) Porque o protocolo MQTT limita a velocidade a 10 bits por segundo.  
d) Porque a tela do computador consome 90% dos dados da rede.  
e) Porque o Pydantic recalcula as fórmulas matemáticas a cada segundo.

**4. Em um computador de placa única (SBC) como a Raspberry Pi 5 com 4GB de RAM total, qual das seguintes escolhas de modelo é a mais adequada para evitar esgotamento de memória (*Out of Memory - OOM*)?**  
a) Um modelo de 70 bilhões de parâmetros em precisão FP32 (280 GB de RAM).  
b) Um modelo de 1B a 3B quantizado em `Q4_K_M` (1.3 GB a 2.0 GB de RAM).  
c) Um modelo de 405 bilhões de parâmetros.  
d) Um modelo sem quantização rodando em resolução 4K.  
e) Nenhum modelo pode rodar em uma Raspberry Pi.

**5. O que mede a métrica *TPS (Tokens per Second)* durante a inferência de um modelo de linguagem?**  
a) O número de caracteres apagados pelo usuário por minuto.  
b) A velocidade de geração de tokens de saída por segundo na etapa de decodificação da rede neural.  
c) A quantidade de pacotes de rede perdidos pelo roteador Wi-Fi.  
d) A voltagem média aplicada nos pinos do motor de passo.  
e) O tempo de inicialização do sistema operacional.

---

### Gabarito Comentado

1. **b) A conversão da representação numérica dos pesos de alta precisão (FP32/FP16) para inteiros...**  
   *Justificativa:* A quantização compacta tensores contínuos em faixas inteiras discretas com perda mínima de qualidade, viabilizando a IA em hardware de borda.
2. **b) O GGUF unifica tensores quantizados de alta performance com metadados em um arquivo único...**  
   *Justificativa:* Criado para o `llama.cpp`, o formato GGUF é o padrão universal para inferência local rápida e eficiente em CPUs e GPUs.
3. **a) Porque a CPU precisa transferir todos os bilhões de parâmetros do modelo da memória RAM...**  
   *Justificativa:* A decodificação sequencial de tokens exige ler a matriz completa de pesos da RAM repetidas vezes; quanto menor o tamanho do modelo quantizado, menor a quantidade de bytes transferidos.
4. **b) Um modelo de 1B a 3B quantizado em `Q4_K_M` (1.3 GB a 2.0 GB de RAM).**  
   *Justificativa:* Deixa mais de 1.5 GB livres para o sistema operacional Linux e os daemons do Gateway MQTT, garantindo estabilidade e fluidez.
5. **b) A velocidade de geração de tokens de saída por segundo na etapa de decodificação...**  
   *Justificativa:* Tokens por segundo (TPS) é a métrica padrão de taxa de geração em modelos de linguagem generativos.
