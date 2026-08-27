---
layout: "class"
course: "disruptive"
section:
    name: "IA: Protocolos IoT & Edge Gateway"
    order: 8
class:
    title: "10. IA com Protocolo MQTT"
    order: 0
---

# IA sobre MQTT & Gateways Orientados a Eventos

Nas primeiras aulas do semestre, exploramos os protocolos de comunicação essenciais para sistemas embarcados, incluindo UART, I2C, SPI e MQTT. Agora, faremos a grande ponte entre o mundo dos **protocolos assíncronos de Internet das Coisas (IoT)** e os **motores de inferência de inteligência artificial**.

Nesta aula, integraremos um agente de IA local ao protocolo **MQTT (Message Queuing Telemetry Transport)**, criando um gateway reativo capaz de escutar eventos de telemetria em tópicos distribuídos, tomar decisões inteligentes e publicar comandos para atuadores em tempo real!

<pre class="mermaid">
flowchart LR
    ESP32["📡 Dispositivo Remoto (ESP32)<br>Publica em: home/sensors/boiler"] -->|MQTT Pub| Broker[("🔄 Broker MQTT Local<br>(Eclipse Mosquitto :1883)")]
    
    subgraph GATEWAY["AI Smart Gateway (Python + Ollama)"]
        Broker -->|MQTT Sub| ThreadWorker["🧵 Fila Assíncrona & Worker Thread"]
        ThreadWorker --> LLM["🧠 Agente Local (Llama 3.2 1B)<br>Avalia Telemetria e Risco"]
        LLM --> Decision{"🚨 Decisão de Controle"}
    end
    
    Decision -->|"Publica Comando"| Broker
    Broker -->|MQTT Sub| RelayActuator["🔌 Módulo de Relé / Alarme<br>Inscrito em: home/actuators/alarm"]
    
    style Broker fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style GATEWAY fill:#f0fdf4,stroke:#22c55e,stroke-width:2px;
    style LLM fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style RelayActuator fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
</pre>

---

# Teoria

## 1. REST (HTTP) vs. MQTT: Qual a Melhor Escolha para IA em IoT?

| Critério | REST API (HTTP) | MQTT (Publish / Subscribe) |
| :--- | :--- | :--- |
| **Padrão de Comunicação** | Síncrono (*Request / Response*) | **Assíncrono (*Publish / Subscribe*)** |
| **Tamanho do Cabeçalho** | Pesado (centenas de bytes em headers) | **Ultraleve (a partir de 2 bytes)** |
| **Acoplamento de Rede** | Cliente precisa conhecer o IP do servidor | **Desacoplamento total** (mediado pelo Broker) |
| **Consumo de Bateria** | Alto (requer handshakes TCP frequentes) | **Mínimo** (mantém conexão TCP viva com Keep-Alive) |
| **Adequação para Sensores**| Ruim para fluxos contínuos de eventos | **Ideal para telemetria em tempo real** |

---

## 2. Tópicos Hierárquicos e Qualidade de Serviço (QoS)

No MQTT, as mensagens são roteadas através de **tópicos** organizados em barras `/`:
- `fabrica/setor_norte/prensa_01/temperatura`
- `fabrica/setor_norte/prensa_01/vibracao`
- Coringas (*Wildcards*): `fabrica/setor_norte/+/temperatura` (um nível) ou `fabrica/#` (todos os sub-tópicos recursivos).

### Níveis de Qualidade de Serviço (QoS):
- **QoS 0 (No máximo uma vez):** Disparo rápido sem confirmação de entrega (*Fire-and-forget*).
- **QoS 1 (Pelo menos uma vez):** Garante entrega com confirmação (*PUBACK*), mas pode duplicar pacotes.
- **QoS 2 (Exatamente uma vez):** Entrega garantida e sem duplicações com handshake de 4 vias (ideal para comandos de acionamento crítico).

---

## 3. O Desafio do Desacoplamento Temporal da IA

Um dos erros mais graves ao integrar IA com MQTT é executar a inferência do LLM diretamente dentro da função de callback `on_message(client, userdata, msg)`:

```python
# ❌ ERRO GRAVE: Bloqueia o loop de rede do MQTT!
def on_message(client, userdata, msg):
    # O LLM demora 1 a 2 segundos para responder!
    # Durante esse tempo, o cliente MQTT NÃO processa PINGs de rede,
    # fazendo o broker desconectar o cliente por Timeout!
    res = ollama.chat(...)
```

### A Solução Profissional: Filas Assíncronas (`queue.Queue` ou `asyncio`)
1. O callback `on_message` apenas extrai o payload e o insere instantaneamente em uma **Fila em Memória** (`Queue`), liberando o loop do MQTT em menos de **1 milissegundo**.
2. Uma **Thread de Processamento de IA dedicada** retira mensagens da fila em segundo plano, executa a inferência e publica a resposta de volta no Broker!

---

# Prática

Vamos configurar um broker **Eclipse Mosquitto** local e construir o nosso primeiro gateway assíncrono em Python (`mqtt_ai_gateway.py`) usando a biblioteca `paho-mqtt` e o modelo `llama3.2:1b`.

## Passo 1: Instalação do Mosquitto e Paho-MQTT

- **Windows:** Baixe e instale o [Eclipse Mosquitto para Windows](https://mosquitto.org/download/).
- **Linux / Raspberry Pi:**
  ```bash
  sudo apt update && sudo apt install -y mosquitto mosquitto-clients
  sudo systemctl enable mosquitto
  sudo systemctl start mosquitto
  ```
- **macOS:**
  ```bash
  brew install mosquitto
  brew services start mosquitto
  ```

Instale a biblioteca Python do MQTT:
```bash
pip install paho-mqtt
```

---

## Passo 2: Construindo o AI Smart Gateway sobre MQTT

Crie o arquivo `mqtt_ai_gateway.py`:

```python
import json
import queue
import threading
import time
import ollama
import paho.mqtt.client as mqtt
from pydantic import BaseModel, Field

# --- 1. CONFIGURAÇÕES DO BROKER MQTT ---
MQTT_BROKER_HOST = "localhost"
MQTT_BROKER_PORT = 1883
TOPICO_TELEMETRIA = "home/sensors/#"
TOPICO_COMANDOS = "home/actuators/alarm"

# Fila assíncrona para desacoplamento de rede e inferência
fila_eventos_ia = queue.Queue()


# --- 2. CONTRATO DE DECISÃO DA IA ---
class AIDecisionPayload(BaseModel):
    hazard_detected: bool = Field(
        ..., description="True se a telemetria indicar perigo, False se seguro."
    )
    action_command: str = Field(
        ...,
        description="Comando para o atuador: 'ALARM_ON', 'ALARM_OFF' ou 'NO_ACTION'.",
    )
    reasoning: str = Field(
        ..., description="Breve justificativa técnica da decisão."
    )


# --- 3. THREAD DEDICADA DE PROCESSAMENTO DE IA ---
def worker_processamento_ia(mqtt_client: mqtt.Client):
    print("🧠 [THREAD IA] Worker de inteligência artificial iniciado e ativo.")

    system_prompt = f"""Você é o cérebro autônomo de um Gateway de Segurança IoT.
Analise a telemetria recebida do tópico MQTT e decida se há perigo iminente.
Responda ESTRITAMENTE em JSON com o seguinte schema:
{AIDecisionPayload.model_json_schema()}

Regras de Segurança:
- Se temperatura > 75C, pressao > 80 psi ou fumaca == true -> Dispare hazard_detected: true e action_command: 'ALARM_ON'.
- Caso contrário -> hazard_detected: false e action_command: 'NO_ACTION'.
Responda apenas o JSON."""

    while True:
        try:
            # Aguarda uma mensagem chegar na fila (bloqueante com timeout de 1s)
            item = fila_eventos_ia.get(timeout=1.0)
            topico, payload_str = item["topic"], item["payload"]

            print(f"\n⚙️ [THREAD IA] Avaliando telemetria de '{topico}'...")
            inicio = time.time()

            response = ollama.chat(
                model="llama3.2:1b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Tópico: {topico}\nPayload: {payload_str}",
                    },
                ],
                format="json",
                options={"temperature": 0.0},
            )

            duracao = (time.time() - inicio) * 1000
            decisao = AIDecisionPayload.model_validate_json(
                response["message"]["content"]
            )

            print(f"📊 [DECISÃO DA IA ({duracao:.1f}ms)]:")
            print(f"   -> Risco Detectado: {decisao.hazard_detected}")
            print(f"   -> Ação Emitida: {decisao.action_command}")
            print(f"   -> Raciocínio: {decisao.reasoning}")

            # Se a IA decidiu acionar o atuador, publica no tópico de comando
            if decisao.action_command != "NO_ACTION":
                comando_payload = json.dumps(
                    {
                        "source": "AI_SMART_GATEWAY",
                        "command": decisao.action_command,
                        "reason": decisao.reasoning,
                        "timestamp": time.time(),
                    }
                )
                mqtt_client.publish(
                    TOPICO_COMANDOS, comando_payload, qos=1
                )
                print(
                    f"📢 [MQTT PUB] Comando publicado em '{TOPICO_COMANDOS}': {comando_payload}"
                )

            fila_eventos_ia.task_done()

        except queue.Empty:
            continue
        except Exception as e:
            print(f"❌ [ERRO NO WORKER DE IA]: {e}")


# --- 4. CALLBACKS DO CLIENTE MQTT ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(
            f"✅ [MQTT CONECTADO] Conexão estabelecida com sucesso no Broker '{MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}'"
        )
        # Inscreve-se em todos os tópicos de telemetria de sensores
        client.subscribe(TOPICO_TELEMETRIA, qos=0)
        print(f"📥 [MQTT SUB] Inscrito no padrão de tópicos: {TOPICO_TELEMETRIA}")
    else:
        print(f"❌ Falha de conexão com código de retorno: {rc}")


def on_message(client, userdata, msg):
    """Callback executado instantaneamente ao receber qualquer mensagem MQTT."""
    payload_str = msg.payload.decode("utf-8", errors="ignore")
    print(f"\n📩 [MQTT IN] Mensagem recebida em '{msg.topic}': {payload_str}")

    # Desacoplamento imediato: coloca o evento na fila sem bloquear a rede
    fila_eventos_ia.put({"topic": msg.topic, "payload": payload_str})


# --- 5. INICIALIZAÇÃO DA APLICAÇÃO ---
if __name__ == "__main__":
    client = mqtt.Client(client_id="AI_Edge_Gateway_Node")
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
    except Exception as e:
        print(
            f"❌ Não foi possível conectar ao Broker Mosquitto em {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}. Certifique-se de que o serviço está rodando!"
        )
        exit(1)

    # Inicia a Thread da IA em segundo plano (Daemon)
    t_ia = threading.Thread(
        target=worker_processamento_ia, args=(client,), daemon=True
    )
    t_ia.start()

    print("🚀 [GATEWAY PRONTO] Aguardando mensagens MQTT. Pressione Ctrl+C para encerrar.")
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n🛑 Encerrando Gateway de forma graciosa...")
        client.disconnect()
```

---

## Passo 3: Testando a Ingestão em Tempo Real com CLI

Abra dois novos terminais para simular os dispositivos de campo:

**Terminal 2: Escutando os Atuadores (Simulador de Relé/Alarme)**
```bash
mosquitto_sub -h localhost -t "home/actuators/#" -v
```

**Terminal 3: Publicando Telemetria Normal vs Crítica**
```bash
# Teste 1: Telemetria Normal (Temperatura Segura)
mosquitto_pub -h localhost -t "home/sensors/boiler" -m '{"temp": 24.5, "pressure_psi": 30.0}'

# Teste 2: Telemetria Crítica (Superaquecimento e Pressão Excessiva!)
mosquitto_pub -h localhost -t "home/sensors/boiler" -m '{"temp": 89.2, "pressure_psi": 95.0, "smoke": true}'
```

### Saída no Terminal do Gateway:
```text
📩 [MQTT IN] Mensagem recebida em 'home/sensors/boiler': {"temp": 89.2, "pressure_psi": 95.0, "smoke": true}

⚙️ [THREAD IA] Avaliando telemetria de 'home/sensors/boiler'...
📊 [DECISÃO DA IA (168.4ms)]:
   -> Risco Detectado: True
   -> Ação Emitida: ALARM_ON
   -> Raciocínio: Temperatura em 89.2C, pressão crítica de 95 psi e presença de fumaça detectada.
📢 [MQTT PUB] Comando publicado em 'home/actuators/alarm': {"source": "AI_SMART_GATEWAY", "command": "ALARM_ON", ...}
```

---

# Questionário de Fixação

**1. Qual é a principal característica do padrão arquitetural *Publish/Subscribe* utilizado pelo protocolo MQTT?**  
a) Comunicação síncrona ponto a ponto com bloqueio total do canal.  
b) Desacoplamento completo entre emissores (Publishers) e receptores (Subscribers), mediado por um Broker centralizador.  
c) Necessidade obrigatória de cabos coaxiais de alta tensão.  
d) Transmissão exclusiva de arquivos executáveis compilados em C.  
e) Exigência de autenticação por biometria facial a cada mensagem.

**2. Por que é considerado uma péssima prática de programação executar inferências de IA síncronas diretamente dentro do callback `on_message` do cliente MQTT?**  
a) Porque a biblioteca do Ollama apaga o broker da memória.  
b) Porque a inferência do LLM demora alguns segundos, bloqueando o loop de rede do MQTT e causando desconexão por timeout de Keep-Alive.  
c) Porque o Python não suporta o uso de strings dentro de callbacks.  
d) Porque os dados de telemetria são criptografados por hardware no microcontrolador.  
e) Porque o microcontrolador ESP32 desliga automaticamente se o computador demorar mais de 10 milissegundos.

**3. Qual é o papel da estrutura `queue.Queue` na arquitetura do nosso Gateway de IA com MQTT?**  
a) Aumentar a resolução das imagens recebidas pela câmera.  
b) Atuar como um buffer assíncrono desacoplado, permitindo que a rede MQTT receba mensagens instantaneamente enquanto uma thread de IA processa a fila no seu próprio ritmo.  
c) Compilar o código Python em bytecode para o chip ATmega328.  
d) Salvar os logs do sistema em um disquete magnético.  
e) Substituir a necessidade do broker Mosquitto.

**4. Em um esquema de tópicos hierárquicos MQTT, qual das seguintes opções representa uma inscrição com coringa (*wildcard*) válida para capturar todas as leituras de sensores de qualquer cômodo da residência?**  
a) `home/sensors/+/temp`  
b) `home/sensors/#`  
c) `SELECT * FROM home_sensors`  
d) `home.sensors.all`  
e) `HTTP GET /home/sensors`

**5. Qual nível de QoS (Quality of Service) do MQTT é mais indicado para comandos críticos de desligamento de emergência de atuadores emitidos pela IA?**  
a) QoS 0 (No máximo uma vez / *Fire-and-forget* sem confirmação).  
b) QoS 1 ou QoS 2 (Garantia de entrega com confirmação de recebimento no broker).  
c) QoS 5 (Modo quântico de alta velocidade).  
d) QoS -1 (Modo de broadcast analógico).  
e) O nível de QoS não interfere na confiabilidade da entrega.

---

### Gabarito Comentado

1. **b) Desacoplamento completo entre emissores (Publishers) e receptores (Subscribers)...**  
   *Justificativa:* O Broker atua como intermediário assíncrono, permitindo que múltiplos clientes troquem mensagens sem precisarem se conhecer diretamente.
2. **b) Porque a inferência do LLM demora alguns segundos, bloqueando o loop de rede...**  
   *Justificativa:* O loop de rede precisa enviar pacotes `PINGREQ` e processar mensagens recebidas continuamente; bloqueá-lo com computação pesada quebra o protocolo.
3. **b) Atuar como um buffer assíncrono desacoplado, permitindo que a rede MQTT receba...**  
   *Justificativa:* A fila em memória desacopla os tempos rápidos de rede (~1ms) dos tempos de inferência neural (~100-300ms).
4. **b) `home/sensors/#`**  
   *Justificativa:* O caractere `#` é o wildcard multi-nível do MQTT que casa com qualquer caminho de sub-tópico subsequente.
5. **b) QoS 1 ou QoS 2 (Garantia de entrega com confirmação de recebimento no broker).**  
   *Justificativa:* Comandos críticos de atuação física não podem ser perdidos silenciosamente na rede; níveis com confirmação (QoS 1 ou 2) são obrigatórios.
