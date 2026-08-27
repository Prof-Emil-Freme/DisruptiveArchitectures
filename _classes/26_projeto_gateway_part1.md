---
layout: "class"
course: "disruptive"
section:
    name: "IA: Protocolos IoT & Edge Gateway"
    order: 8
class:
    title: "12. Projeto Gateway: Arquitetura"
    order: 2
---

# Projeto Integrador: O AI Smart Gateway (Parte 1)

Chegamos à reta final da nossa disciplina! Ao longo das aulas anteriores, dominamos individualmente:
1. **Modelos Locais & Inferência Rápida** (`llama3.2:1b`, `qwen2.5:1.5b`)
2. **System Prompts & Guardrails** (Determinismo e segurança)
3. **Saídas Estruturadas** (JSON com Pydantic v2)
4. **Bancos Vetoriais & RAG** (ChromaDB + `nomic-embed-text`)
5. **Function Calling & Tool Use** (Acionamento de relés e atuadores)
6. **Visão Computacional Multimodal** (`moondream` VLM)
7. **Protocolo MQTT** (Mosquitto assíncrono com filas)

Nesta aula e na próxima, uniremos todas essas peças em uma **arquitetura de software de nível industrial**: o **Local AI Smart Gateway**.

<pre class="mermaid">
flowchart TD
    subgraph INPUTS["1. Ingestão de Eventos (MQTT / Câmera / Usuário)"]
        MQTT_IN["📡 Telemetria MQTT<br>(home/sensors/#)"]
        IMG_IN["📷 Feed de Imagens<br>(home/camera/snapshot)"]
        USER_IN["💬 Comando de Usuário<br>(home/commands/chat)"]
    end

    subgraph ROUTER["2. Roteador Central Inteligente (gateway.py)"]
        RouterCheck{"🧭 Tipo de Evento?"}
    end

    subgraph MODULES["3. Módulos Especializados da Aplicação"]
        ToolsMod["🔌 tools.py<br>(Acionamento de Relés & Sensores)"]
        RAGMod["📚 rag_engine.py<br>(ChromaDB + Manuais de Erro)"]
        VisionMod["👁️ vlm_engine.py<br>(Moondream2 Inspeção de Painel)"]
    end

    subgraph OUTPUTS["4. Saídas & Atuadores"]
        MQTT_PUB["📢 Publicação MQTT em home/actuators/"]
        AUDIT_LOG["📝 Logs Estruturados de Auditoria"]
    end

    MQTT_IN --> RouterCheck
    IMG_IN --> RouterCheck
    USER_IN --> RouterCheck

    RouterCheck -->|"Comando de Atuação"| ToolsMod
    RouterCheck -->|"Código de Falha (E01-E04)"| RAGMod
    RouterCheck -->|"Payload com Imagem"| VisionMod

    ToolsMod --> MQTT_PUB
    RAGMod --> MQTT_PUB
    VisionMod --> MQTT_PUB
    MQTT_PUB --> AUDIT_LOG

    style INPUTS fill:#f8fafc,stroke:#94a3b8,stroke-width:2px;
    style ROUTER fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style MODULES fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style OUTPUTS fill:#d1fae5,stroke:#10b981,stroke-width:2px;
</pre>

---

# Teoria

## 1. Princípios de Engenharia de Software para Edge AI

Em projetos reais de engenharia, **nunca escrevemos toda a aplicação em um único arquivo de 500 linhas**. Uma arquitetura de borda profissional deve seguir três princípios:

1. **Separação de Preocupações (*Separation of Concerns*):** Cada módulo deve ter uma única responsabilidade (esquemas de dados, ferramentas de hardware, motor RAG, motor de mensageria).
2. **Roteamento Inteligente (*Smart Intent Routing*):** Em vez de acionar todas as IAs para qualquer mensagem, o roteador analisa a natureza da entrada e dispara apenas o módulo estritamente necessário.
3. **Auditabilidade & Logs Estruturados:** Toda decisão da IA, tempo de inferência e ação executada em atuador físico deve ser registrada em formato JSON para rastreamento.

---

## 2. A Estrutura do Projeto Capstone

Nosso repositório do Gateway será organizado da seguinte forma:

```text
ai_smart_gateway/
├── models.py         # Contratos de dados e esquemas Pydantic v2
├── tools.py          # Funções de hardware (leitura de GPIO, acionamento de relés)
├── rag_engine.py     # Base de conhecimento vetorial e diagnóstico de manuais
└── gateway.py        # Ponto de entrada (Main), cliente MQTT assíncrono e roteador
```

---

# Prática

Vamos construir os três primeiros módulos do nosso Gateway e integrá-los no módulo principal `gateway.py`.

## Passo 1: Construindo os Modelos de Dados (`models.py`)

Crie o arquivo `models.py`:

```python
from typing import Literal
from pydantic import BaseModel, Field


# Contrato de Telemetria recebida dos Sensores
class SensorTelemetry(BaseModel):
    device_id: str = Field(..., description="Identificador único do dispositivo")
    temperature: float = Field(..., description="Temperatura em Celsius")
    humidity: float = Field(..., description="Umidade relativa do ar (0-100%)")
    error_code: str | None = Field(
        default=None, description="Código de erro técnico, se houver"
    )
    camera_snapshot: str | None = Field(
        default=None, description="Caminho da imagem capturada, se houver"
    )


# Contrato de Ação de Saída do Gateway
class GatewayAction(BaseModel):
    target_actuator: str = Field(
        ..., description="Nome do atuador a ser acionado"
    )
    command: Literal["ON", "OFF", "SET_VALUE", "ALERT_ONLY", "NO_ACTION"] = (
        Field(..., description="Comando para o atuador")
    )
    parameter_value: float | None = Field(
        default=None, description="Valor numérico adicional (ex: setpoint)"
    )
    diagnostic_report: str = Field(
        ..., description="Explicação técnica da decisão tomada pelo Gateway"
    )
```

---

## Passo 2: Construindo as Ferramentas de Hardware (`tools.py`)

Crie o arquivo `tools.py`:

```python
import json

# Estado simulado dos relés e atuadores conectados
ESTADO_HARDWARE = {
    "rele_bomba_irrigacao": False,
    "rele_exaustor_clima": False,
    "alarme_sonoro": False,
}


def acionar_rele(nome_rele: str, estado: bool) -> str:
    """Aciona um relé físico no hardware do Gateway.

    Args:
        nome_rele: 'bomba_irrigacao', 'exaustor_clima' ou 'alarme_sonoro'.
        estado: True para ligar (HIGH), False para desligar (LOW).
    """
    chave = f"rele_{nome_rele}" if not nome_rele.startswith("rele_") else nome_rele
    if chave in ESTADO_HARDWARE:
        ESTADO_HARDWARE[chave] = estado
        msg = f"Relé '{chave}' atualizado para: {'LIGADO (HIGH)' if estado else 'DESLIGADO (LOW)'}."
        print(f"   [HARDWARE GPIO] ⚡ {msg}")
        return json.dumps({"status": "SUCCESS", "message": msg})
    else:
        return json.dumps(
            {"status": "ERROR", "message": f"Relé '{nome_rele}' inexistente."}
        )


def consultar_status_dispositivos() -> str:
    """Retorna o estado atual de todos os relés e atuadores conectados."""
    return json.dumps(ESTADO_HARDWARE)
```

---

## Passo 3: Construindo o Motor RAG de Diagnósticos (`rag_engine.py`)

Crie o arquivo `rag_engine.py`:

```python
import chromadb
import ollama

client = chromadb.Client()
collection = client.create_collection(name="gateway_troubleshooting_docs")

# Ingestão de Manuais Técnicos Oficiais de Diagnóstico
MANUAIS_DE_FALHA = [
    (
        "ERR-E01",
        "Código E01: Falha de comunicação no barramento I2C do sensor de temperatura. Solução: Reiniciar o barramento e verificar resistores de pull-up.",
    ),
    (
        "ERR-E02",
        "Código E02: Nível crítico de subtensão (bateria < 3.3V). Solução: Desligar cargas não essenciais e iniciar recarga.",
    ),
    (
        "ERR-E03",
        "Código E03: Obstrução de fluxo no ventilador de exaustão. Solução: Desarmar o relé do motor para evitar queima por sobrecarga.",
    ),
]

for doc_id, txt in MANUAIS_DE_FALHA:
    emb = ollama.embeddings(model="nomic-embed-text", prompt=txt)["embedding"]
    collection.add(
        ids=[doc_id],
        embeddings=[emb],
        documents=[txt],
        metadatas=[{"id": doc_id}],
    )


def consultar_diagnostico_rag(codigo_erro: str) -> str:
    """Busca a resolução oficial nos manuais técnicos para um código de falha."""
    q_emb = ollama.embeddings(model="nomic-embed-text", prompt=codigo_erro)[
        "embedding"
    ]
    busca = collection.query(query_embeddings=[q_emb], n_results=1)

    contexto = busca["documents"][0][0]

    prompt = f"""Você é o engenheiro especialista do Gateway. Responda em 1 frase direta com a ação de reparo.
Contexto Oficial: {contexto}
Código de Erro: {codigo_erro}"""

    res = ollama.chat(
        model="llama3.2:1b",
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0.0},
    )

    return res["message"]["content"].strip()
```

---

## Passo 4: O Roteador Central do Gateway (`gateway.py`)

Crie o arquivo `gateway.py`:

```python
import json
import time
from models import GatewayAction, SensorTelemetry
from rag_engine import consultar_diagnostico_rag
import tools


def processar_evento_gateway(payload_json: str) -> GatewayAction:
    print("=" * 65)
    print(f"📥 [EVENTO INGESTADO]: {payload_json}")

    # 1. Validação do Contrato de Entrada com Pydantic
    telemetria = SensorTelemetry.model_validate_json(payload_json)

    # 2. ROTEADOR INTELIGENTE (Smart Intent Router)

    # CENÁRIO A: Código de Erro Detectado ➔ Dispara RAG
    if telemetria.error_code:
        print(
            f"🧭 [ROTA RAG]: Código de erro '{telemetria.error_code}' identificado."
        )
        diagnostico = consultar_diagnostico_rag(telemetria.error_code)
        tools.acionar_rele("alarme_sonoro", True)
        return GatewayAction(
            target_actuator="alarme_sonoro",
            command="ON",
            diagnostic_report=f"Diagnóstico RAG: {diagnostico}",
        )

    # CENÁRIO B: Superaquecimento Térmico ➔ Dispara Acionamento de Exaustor
    elif telemetria.temperature > 35.0:
        print("🧭 [ROTA CONTROLE]: Temperatura crítica detectada (>35°C).")
        tools.acionar_rele("exaustor_clima", True)
        return GatewayAction(
            target_actuator="exaustor_clima",
            command="ON",
            parameter_value=telemetria.temperature,
            diagnostic_report=f"Exaustor ativado preventivamente para mitigar temperatura de {telemetria.temperature}°C.",
        )

    # CENÁRIO C: Operação Normal
    else:
        print("🧭 [ROTA MONITOR]: Telemetria dentro dos parâmetros nominais.")
        return GatewayAction(
            target_actuator="none",
            command="NO_ACTION",
            diagnostic_report="Sistema operando dentro dos parâmetros de segurança.",
        )


# --- EXECUÇÃO DE TESTES INTEGRADOS ---
if __name__ == "__main__":
    print("=== INICIANDO AI SMART GATEWAY (PARTE 1) ===")

    testes_telemetria = [
        '{"device_id": "NODE-01", "temperature": 23.4, "humidity": 55.0}',
        '{"device_id": "NODE-02", "temperature": 41.2, "humidity": 30.0}',
        '{"device_id": "NODE-03", "temperature": 25.0, "humidity": 60.0, "error_code": "Erro E03"}',
    ]

    for t in testes_telemetria:
        acao = processar_evento_gateway(t)
        print(f"\n📊 [AÇÃO EXECUTADA PELO GATEWAY]:")
        print(f"   -> Atuador Alvo: {acao.target_actuator}")
        print(f"   -> Comando: {acao.command}")
        print(f"   -> Relatório: {acao.diagnostic_report}\n")
```

---

## Passo 5: Executando o Gateway Integrado

Execute o script:

```bash
python gateway.py
```

### Saída Esperada no Terminal:
```text
=== INICIANDO AI SMART GATEWAY (PARTE 1) ===
=================================================================
📥 [EVENTO INGESTADO]: {"device_id": "NODE-01", "temperature": 23.4, "humidity": 55.0}
🧭 [ROTA MONITOR]: Telemetria dentro dos parâmetros nominais.

📊 [AÇÃO EXECUTADA PELO GATEWAY]:
   -> Atuador Alvo: none
   -> Comando: NO_ACTION
   -> Relatório: Sistema operando dentro dos parâmetros de segurança.

=================================================================
📥 [EVENTO INGESTADO]: {"device_id": "NODE-02", "temperature": 41.2, "humidity": 30.0}
🧭 [ROTA CONTROLE]: Temperatura crítica detectada (>35°C).
   [HARDWARE GPIO] ⚡ Relé 'rele_exaustor_clima' atualizado para: LIGADO (HIGH).

📊 [AÇÃO EXECUTADA PELO GATEWAY]:
   -> Atuador Alvo: exaustor_clima
   -> Comando: ON
   -> Relatório: Exaustor ativado preventivamente para mitigar temperatura de 41.2°C.

=================================================================
📥 [EVENTO INGESTADO]: {"device_id": "NODE-03", "temperature": 25.0, "humidity": 60.0, "error_code": "Erro E03"}
🧭 [ROTA RAG]: Código de erro 'Erro E03' identificado.
   [HARDWARE GPIO] ⚡ Relé 'rele_alarme_sonoro' atualizado para: LIGADO (HIGH).

📊 [AÇÃO EXECUTADA PELO GATEWAY]:
   -> Atuador Alvo: alarme_sonoro
   -> Comando: ON
   -> Relatório: Diagnóstico RAG: Desarme o relé do motor de exaustão para evitar queima por sobrecarga.
```

---

# Questionário de Fixação

**1. Qual é o objetivo de modularizar a aplicação do Gateway em arquivos separados (`models.py`, `tools.py`, `rag_engine.py`, `gateway.py`)?**  
a) Aumentar o tamanho do arquivo ZIP para entrega.  
b) Aplicar o princípio de Separação de Preocupações (*Separation of Concerns*), facilitando a manutenção, testes unitários independentes e escalabilidade do software.  
c) Forçar o sistema operacional a usar 100% da CPU.  
d) Substituir a necessidade de instalar o Python.  
e) Exigir que o usuário compre quatro computadores diferentes.

**2. Qual é a responsabilidade do componente *Roteador Inteligente (Smart Router)* no `gateway.py`?**  
a) Conectar cabos de rede azul nos conectores RJ45.  
b) Inspecionar a carga útil (*payload*) recebida e direcionar o processamento para o módulo adequado (RAG, Controle de Relés ou Visão), evitando processamento computacional desnecessário.  
c) Aumentar a temperatura do microcontrolador.  
d) Apagar os arquivos de banco de dados do sistema.  
e) Desligar o roteador Wi-Fi da sala.

**3. No módulo `models.py`, qual é a função das classes baseadas em `pydantic.BaseModel`?**  
a) Desenhar gráficos em 3D para a interface com o usuário.  
b) Definir contratos de dados estritos com validação automática de tipos e limites numéricos para entradas de telemetria e saídas de comando do Gateway.  
c) Compilar o firmware C++ para a placa de circuito impresso.  
d) Criptografar senhas com chaves de 4096 bits.  
e) Substituir a necessidade de usar memória RAM.

**4. O que acontece quando o Gateway recebe uma telemetria que inclui o campo `"error_code": "Erro E03"`?**  
a) O sistema trava imediatamente.  
b) O roteador direciona o evento para o módulo `rag_engine.py`, que consulta o ChromaDB e formula a instrução de reparo correta ancorada nos manuais oficiais de hardware.  
c) O Gateway formata o disco rígido.  
d) O Gateway ignora o erro e desliga a energia do prédio.  
e) O modelo de visão Moondream2 é desinstalado.

**5. Por que os logs gerados pelo Gateway devem ser estruturados (ex: via JSON ou objetos Pydantic serializados)?**  
a) Porque arquivos de texto desestruturados não podem ser lidos por humanos.  
b) Para permitir que sistemas centrais de telemetria e auditoria analisem, filtrem e monitorem as decisões autônomas tomadas pela IA ao longo do tempo.  
c) Para diminuir o consumo elétrico dos sensores analógicos.  
d) Para obrigar o uso de telas de alta resolução.  
e) Para impedir a conexão de novos dispositivos na rede MQTT.

---

### Gabarito Comentado

1. **b) Aplicar o princípio de Separação de Preocupações (*Separation of Concerns*)...**  
   *Justificativa:* A modularização permite testar componentes individualmente (como o motor RAG sem depender do hardware real) e melhora a organização do projeto.
2. **b) Inspecionar a carga útil (*payload*) recebida e direcionar o processamento para o módulo adequado...**  
   *Justificativa:* O roteamento inteligente evita invocar modelos pesados para telemetria rotineira, otimizando o uso de recursos de borda.
3. **b) Definir contratos de dados estritos com validação automática de tipos e limites...**  
   *Justificativa:* Modelos Pydantic garantem a integridade dos dados e rejeitam mensagens corrompidas antes que atinjam os atuadores.
4. **b) O roteador direciona o evento para o módulo `rag_engine.py`, que consulta o ChromaDB...**  
   *Justificativa:* A integração entre roteamento e RAG automatiza o suporte técnico de primeiro nível em sistemas industriais.
5. **b) Para permitir que sistemas centrais de telemetria e auditoria analisem, filtrem e monitorem...**  
   *Justificativa:* Logs estruturados são indispensáveis para observabilidade, rastreabilidade e auditoria de segurança em sistemas autônomos.
