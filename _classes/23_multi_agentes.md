---
layout: "class"
course: "disruptive"
section:
    name: "IA: Visão & Agentes Autônomos"
    order: 7
class:
    title: "9. Colaboração Multi-Agente"
    order: 2
---

# Gestão de Estado & Colaboração Multi-Agente

Na aula anterior, desenvolvemos um agente individual baseado no padrão ReAct. No entanto, quando aplicamos IA em sistemas industriais ou prediais com dezenas de sensores transmitindo dados a cada segundo, **tentar fazer um único modelo executar todas as tarefas simultâneas causa gargalos graves**: a janela de contexto se polui rapidamente, a inferência fica lenta e o modelo começa a esquecer instruções.

Nesta aula, implementaremos a mais moderna abordagem de arquitetura distribuída: **Sistemas Multi-Agentes Especializados com Gestão de Estado Compartilhado**.

<pre class="mermaid">
flowchart TD
    SensorStream["📡 Telemetria Contínua de Sensores<br>(Vibração, Temperatura, Pressão)"] --> Agent1
    
    subgraph POLLING["1. Agente Monitor (Polling 24/7)"]
        Agent1["⚡ Monitor Agent<br>(Qwen 2.5 1.5B - Ultrarrápido & Leve)"]
        Agent1 --> AnomalyCheck{"⚠️ Anomalia Detectada?"}
    end
    
    AnomalyCheck -->|"Não (Status Normal)"| LogSilent["📝 Grava Log Silencioso / Descarta"]
    
    AnomalyCheck -->|"Sim (Vibração Crítica!)"| SharedState[("💾 Estado Compartilhado<br>{'alert': true, 'issue': 'Vibração 95Hz no Motor 1'}")]
    
    subgraph DISPATCH["2. Agente Despachante (Sob Demanda)"]
        SharedState --> Agent2["🧠 Dispatcher Agent<br>(Llama 3.2 3B - Alto Raciocínio)"]
        Agent2 --> ActionPlan["📋 1. Formula Plano de Contenção de Emergência"]
        Agent2 --> SMS["📱 2. Redige Mensagem Clara para Equipe de Manutenção"]
    end
    
    style POLLING fill:#f8fafc,stroke:#94a3b8,stroke-width:2px;
    style DISPATCH fill:#f0fdf4,stroke:#22c55e,stroke-width:2px;
    style SharedState fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style Agent1 fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style Agent2 fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
</pre>

---

# Teoria

## 1. Por que Agentes Únicos Falham em Aplicações IoT Contínuas?

1. **Poluição e Estouro de Contexto (*Context Drift*):** Colocar milhares de linhas de telemetria bruta na mesma janela de conversa de um único modelo esgota a memória RAM e dilui a capacidade de raciocínio.
2. **Desperdício Energético e Computacional:** Usar um modelo grande e pesado (ex: 8B ou 14B) para verificar a cada segundo se um sensor ultrapassou 30 graus é um enorme desperdício de bateria e processamento.
3. **Especialização de Papéis (*Separation of Concerns*):** Na engenharia de software, dividimos problemas complexos em microsserviços. Em IA, dividimos o sistema em **agentes especialistas** com papéis bem definidos.

---

## 2. A Estratégia de Hierarquia de Modelos na Borda

Para alcançar máxima eficiência energética e velocidade em hardware local, combinamos dois níveis de modelos:

| Nível do Agente | Modelo Recomendado | Papel Principal | Frequência de Execução |
| :--- | :--- | :--- | :--- |
| **Agente Monitor** | **`qwen2.5:1.5b`** (ou 0.5B) | Filtragem rápida de dados, classificação JSON e detecção de anomalias | **Alta Frequência (Executa a cada segundo)** |
| **Agente Despachante** | **`llama3.2:3b`** | Raciocínio contextual complexo, diagnóstico, elaboração de planos e redação de avisos | **Baixa Frequência (Desperta apenas sob alerta)** |

Essa divisão economiza mais de **80% do consumo de CPU** do nosso gateway inteligente!

---

## 3. Gestão de Estado Compartilhado (*The Blackboard Pattern*)

Para que dois ou mais agentes colaborem de forma assíncrona sem se bloquearem, utilizamos o padrão de arquitetura de software conhecido como **Blackboard (Quadro-Negro)**:
- O **Agente Monitor** escreve em um dicionário de estado em memória quando identifica uma anomalia.
- O **Agente Despachante** lê o estado, gera as ações de resposta e atualiza o quadro com as resoluções executadas.

---

# Prática

Vamos construir um sistema multi-agente em Python (`multi_agent_system.py`) combinando o modelo ultraleve `qwen2.5:1.5b` (Monitor) e o modelo `llama3.2:3b` (Despachante).

## Passo 1: Download dos Dois Modelos no Ollama

Certifique-se de que ambos os modelos estejam disponíveis:

```bash
ollama pull qwen2.5:1.5b
ollama pull llama3.2:3b
```

---

## Passo 2: Construindo o Sistema Multi-Agente

Crie o arquivo `multi_agent_system.py`:

```python
import json
import time
import ollama
from pydantic import BaseModel, Field


# 1. CONTRATO DE DADOS ENTRE OS AGENTES
class AnomalySignal(BaseModel):
    alert: bool = Field(
        ...,
        description="True se o dado representar uma anomalia ou perigo, False se normal.",
    )
    severity: str = Field(
        ..., description="BAIXA, MEDIA, ALTA ou CRITICA (ou NENHUMA se normal)."
    )
    issue_summary: str = Field(
        ...,
        description="Descrição concisa do problema detectado ou 'Operação normal'.",
    )


# 2. AGENTE 1: MONITOR (Rápido, Analítico, Baseado em JSON)
def agente_monitor_analisar_telemetria(
    telemetria_json: str,
) -> AnomalySignal | None:
    system_prompt = f"""Você é o Agente Monitor de Sensores de alta velocidade.
Sua única função é inspecionar o JSON de telemetria e emitir ESTRITAMENTE um payload JSON com o seguinte schema:
{AnomalySignal.model_json_schema()}

Seja ultra rigoroso: se temperatura > 80C ou vibracao == 'HIGH', emita alert: true com severidade ALTA ou CRITICA.
Responda apenas o JSON."""

    try:
        # Usamos o Qwen 2.5 1.5B pelo seu baixíssimo tempo de inferência
        response = ollama.chat(
            model="qwen2.5:1.5b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": telemetria_json},
            ],
            format="json",
            options={"temperature": 0.0},
        )

        resultado = AnomalySignal.model_validate_json(
            response["message"]["content"]
        )
        return resultado
    except Exception as e:
        print(f"❌ [MONITOR ERRO]: {e}")
        return None


# 3. AGENTE 2: DESPACHANTE (Especialista, Contextual, voltado para humanos)
def agente_despachante_tratar_emergencia(
    unidade_id: str, sinal: AnomalySignal, telemetria_completa: str
):
    print(f"\n🚨 [DESPACHANTE ACIONADO]: Iniciando protocolo de emergência...")

    prompt_despachante = f"""Você é o Agente Despachante de Engenharia e Segurança Operacional.
Um alerta crítico foi detectado pelo Agente Monitor na unidade '{unidade_id}'.

Dados do Alerta:
- Severidade: {sinal.severity}
- Descrição da Anomalia: {sinal.issue_summary}
- Telemetria Bruta: {telemetria_completa}

Suas Tarefas:
1. Elabore um plano de ação técnico imediato em 2 tópicos.
2. Redija uma mensagem de texto (SMS/WhatsApp) urgente e clara (máximo 2 linhas) para enviar ao técnico de plantão.

Formate a resposta de forma limpa e profissional."""

    # Usamos o Llama 3.2 3B para raciocínio elaborado e comunicação humana
    response = ollama.chat(
        model="llama3.2:3b",
        messages=[{"role": "user", "content": prompt_despachante}],
        options={"temperature": 0.1},
    )

    print("\n" + "=" * 65)
    print("📋 PLANO DE CONTENÇÃO & MENSAGEM DO DESPACHANTE:")
    print("=" * 65)
    print(response["message"]["content"].strip())
    print("=" * 65 + "\n")


# --- 4. LAÇO PRINCIPAL DE SIMULAÇÃO DE TELEMETRIA ---
stream_telemetria_sensores = [
    {
        "unit_id": "MOTOR-01",
        "temp": 42.1,
        "vibration": "NORMAL",
        "rpm": 1750,
        "current_amp": 4.2,
    },
    {
        "unit_id": "MOTOR-01",
        "temp": 43.5,
        "vibration": "NORMAL",
        "rpm": 1755,
        "current_amp": 4.3,
    },
    {
        "unit_id": "CALDEIRA-04",
        "temp": 94.8,
        "vibration": "HIGH",
        "rpm": 3200,
        "current_amp": 18.5,
    },  # <-- Anomalia Crítica!
    {
        "unit_id": "MOTOR-02",
        "temp": 39.0,
        "vibration": "LOW",
        "rpm": 1200,
        "current_amp": 3.1,
    },
]

print("=== INICIANDO SISTEMA MULTI-AGENTE DISTRIBUÍDO ===")

for evento in stream_telemetria_sensores:
    json_str = json.dumps(evento)
    uid = evento["unit_id"]
    print(f"\n📡 [TELEMETRIA RECEBIDA] Dispositivo: {uid} | Dados: {json_str}")

    inicio_t = time.time()
    # 1. Agente Monitor avalia o dado instantaneamente
    sinal = agente_monitor_analisar_telemetria(json_str)
    tempo_monitor = (time.time() - inicio_t) * 1000

    if sinal and not sinal.alert:
        print(
            f"   🟢 [MONITOR ({tempo_monitor:.1f}ms)]: Telemetria Normal. Despachante permanece em repouso."
        )
    elif sinal and sinal.alert:
        print(
            f"   🔴 [MONITOR ({tempo_monitor:.1f}ms)]: ANOMALIA DETECTADA! Severidade: {sinal.severity} | Motivo: {sinal.issue_summary}"
        )
        # 2. Desperta o Agente Despachante apenas se necessário
        agente_despachante_tratar_emergencia(uid, sinal, json_str)
```

---

## Passo 3: Executando e Observando a Eficiência

Execute o script:

```bash
python multi_agent_system.py
```

### Saída Típica do Sistema:
```text
=== INICIANDO SISTEMA MULTI-AGENTE DISTRIBUÍDO ===

📡 [TELEMETRIA RECEBIDA] Dispositivo: MOTOR-01 | Dados: {"unit_id": "MOTOR-01", "temp": 42.1, "vibration": "NORMAL", "rpm": 1750, "current_amp": 4.2}
   🟢 [MONITOR (145.2ms)]: Telemetria Normal. Despachante permanece em repouso.

📡 [TELEMETRIA RECEBIDA] Dispositivo: MOTOR-01 | Dados: {"unit_id": "MOTOR-01", "temp": 43.5, "vibration": "NORMAL", "rpm": 1755, "current_amp": 4.3}
   🟢 [MONITOR (141.8ms)]: Telemetria Normal. Despachante permanece em repouso.

📡 [TELEMETRIA RECEBIDA] Dispositivo: CALDEIRA-04 | Dados: {"unit_id": "CALDEIRA-04", "temp": 94.8, "vibration": "HIGH", "rpm": 3200, "current_amp": 18.5}
   🔴 [MONITOR (152.0ms)]: ANOMALIA DETECTADA! Severidade: CRITICA | Motivo: Temperatura de 94.8C e vibração ALTA na caldeira.

🚨 [DESPACHANTE ACIONADO]: Iniciando protocolo de emergência...

=================================================================
📋 PLANO DE CONTENÇÃO & MENSAGEM DO DESPACHANTE:
=================================================================
Plano de Ação Técnico:
1. Desarmar imediatamente o relé principal da CALDEIRA-04 para interromper o aquecimento e aliviar a pressão.
2. Inspecionar os rolamentos do rotor e o circuito de refrigeração para identificar a causa da vibração de 3200 RPM associada a 94.8°C.

Mensagem de Alerta (SMS/WhatsApp):
⚠️ ALERTA CRÍTICO: Caldeira 04 superaquecendo (94.8°C) com vibração alta e corrente de 18.5A. Desarme preventivo recomendado imediatamente!
=================================================================

📡 [TELEMETRIA RECEBIDA] Dispositivo: MOTOR-02 | Dados: {"unit_id": "MOTOR-02", "temp": 39.0, "vibration": "LOW", "rpm": 1200, "current_amp": 3.1}
   🟢 [MONITOR (139.4ms)]: Telemetria Normal. Despachante permanece em repouso.
```

---

# Questionário de Fixação

**1. Qual é a principal vantagem de adotar uma arquitetura Multi-Agente hierárquica em sistemas de monitoramento contínuo de IoT?**  
a) Aumentar o custo financeiro da solução com hardware mais potente.  
b) Permitir que um modelo leve e ultrarrápido (ex: 1.5B) filtre dados de alta frequência consumindo pouca CPU, acordando modelos mais pesados (ex: 3B+) apenas sob anomalias.  
c) Eliminar todos os cabos de rede do prédio.  
d) Substituir a linguagem Python por HTML estático.  
e) Apagar os registros de log para economizar disco.

**2. O que é o padrão de arquitetura *Blackboard* (Quadro-Negro) na coordenação de agentes autônomos?**  
a) Uma tela de pintura digital em LCD para desenhar gráficos.  
b) Um espaço de memória ou estado compartilhado onde múltiplos agentes independentes podem ler dados do ambiente e escrever ações ou alertas de forma desacoplada.  
c) Um método de criptografia de senhas para portas seriais.  
d) A carcaça de plástico preta usada na montagem do Raspberry Pi.  
e) Um comando do sistema operacional para desligar a tela do computador.

**3. Por que não é recomendado utilizar um modelo de grande porte (como 70B ou APIs de nuvem com alto custo) para cada leitura individual de sensor a cada 500 milissegundos?**  
a) Porque modelos grandes não sabem interpretar números.  
b) Porque geraria um custo financeiro proibitivo por token, consumo de banda massivo e saturação desnecessária de recursos de processamento.  
c) Porque o protocolo MQTT só aceita modelos com menos de 1 bilhão de parâmetros.  
d) Porque sensores analógicos param de funcionar se conectados à nuvem.  
e) Porque o Pydantic rejeita modelos com mais de 3B parâmetros.

**4. No código prático apresentado nesta aula, qual foi o papel específico desempenhado pelo *Agente Despachante*?**  
a) Ficar em loop lendo a porta serial a cada milissegundo.  
b) Analisar o contexto do alerta crítico enviado pelo Monitor, estruturar um plano de contenção técnica e redigir uma mensagem compreensível para os engenheiros de manutenção.  
c) Compilar o código C++ para a placa Arduino.  
d) Formatar a memória flash do gateway.  
e) Aumentar a temperatura do motor para 100°C.

**5. Como garantimos que o sinal transmitido entre o Agente Monitor e o Agente Despachante mantenha consistência e confiabilidade?**  
a) Enviando arquivos de áudio gravados por microfone.  
b) Definindo um contrato de dados estruturado e tipado com Pydantic (`AnomalySignal`), garantindo que o sinal contenha campos explícitos (`alert`, `severity`, `issue_summary`).  
c) Deixando o modelo gerar texto poético livre.  
d) Desativando a validação de tipos no Python.  
e) Reiniciando o Ollama a cada mensagem enviada.

---

### Gabarito Comentado

1. **b) Permitir que um modelo leve e ultrarrápido (ex: 1.5B) filtre dados de alta frequência...**  
   *Justificativa:* A especialização de papéis viabiliza alta taxa de amostragem de dados na borda com baixíssimo consumo de energia.
2. **b) Um espaço de memória ou estado compartilhado onde múltiplos agentes independentes podem ler e escrever...**  
   *Justificativa:* O padrão Blackboard centraliza o estado do sistema, permitindo que agentes especialistas atuem colaborativamente de forma assíncrona.
3. **b) Porque geraria um custo financeiro proibitivo por token, consumo de banda massivo...**  
   *Justificativa:* Mais de 99% dos dados de sensores em operação normal são rotineiros e podem ser descartados ou filtrados por modelos minúsculos na borda.
4. **b) Analisar o contexto do alerta crítico enviado pelo Monitor, estruturar um plano de contenção...**  
   *Justificativa:* O Despachante atua como o especialista de alta cognição responsável pela síntese, planejamento e interface humana.
5. **b) Definindo um contrato de dados estruturado e tipado com Pydantic (`AnomalySignal`)...**  
   *Justificativa:* Contratos tipados previnem ruídos e garantem interoperabilidade determinística entre diferentes agentes autônomos.
