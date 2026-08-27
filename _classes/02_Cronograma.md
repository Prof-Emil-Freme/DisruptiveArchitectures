---
layout: "class"
course: "disruptive"
section:
    name: "Sobre a disciplina"
    order: 0
class:
    title: "Cronograma"
    order: 2
---

# Cronograma da Disciplina

## Módulo 1: Fundamentos de IoT & Sistemas Embarcados (1<sup>o</sup> Semestre)

| # | Conteúdo |
| -: | -------- |
| 01 | *Introdução:* Apresentação da disciplina, Avaliações, Cronograma, Definições de IoT |
| 02 | *Circuítos eletrônicos:* Leitura de diagrama e reconhecimento de componentes |
| 03 | *Arduino:* IDE, GPIO, PWM |
| 04 | *Comunicação M2M:* UART, I2C, SPI |
| 05 | *Dispositivos:* Sensores e Atuadores |
| 06 | *ESP32 & Webserver de Borda:* HTTP, APIs, endpoints |
| 08 | *APIs:* REST, JSON, Schema |
| 10 | *MQTT:* Broker, Pub/Sub |
| 11 | *IoT Gateways:* Node-Red, Python |
| 12 | *Persistência Local:* CSV/SQLite |
| 14 | *Plataformas:* AWS, Azure |
| 15 | *Edge Computing:* TinyML |

---

## Módulo 2: Inteligência Artificial Local & Edge Smart Gateway (PBL - 13 Encontros)

| Encontro | Tema & Conteúdo Principal | Entregável PBL / Foco Prático |
| :---: | :--- | :--- |
| **01 (Aula 15)** | **Demistificando GenAI & Modelos Locais:** Next-token prediction, Transformers, Tokens vs Palavras, Context Window, Temperatura, Edge AI vs Nuvem. | Benchmark de taxa de geração (tokens/s) e TTFT com Ollama (`llama3.2:1b` e `qwen2.5:1.5b`). |
| **02 (Aula 16)** | **System Prompts & Instruções Estritas:** Personas, Few-Shot, Guardrails determinísticos e defesas contra Prompt Injection. | Controlador `thermostat.py` blindado que responde exclusivamente enums estritos. |
| **03 (Aula 17)** | **Saídas Estruturadas & JSON Schemas:** Grammar-Guided Decoding (GBNF), máscara de logits e validação com Pydantic v2. | Extrator de comandos de climatização (`hvac_extractor.py`) com schema tipado e validação. |
| **04 (Aula 18)** | **Embeddings & Bancos Vetoriais:** Espaços latentes multidimensionais, Similaridade de Cosseno e busca semântica no ChromaDB. | Base vetorial de manuais de hardware de IoT com o modelo `nomic-embed-text`. |
| **05 (Aula 19)** | **RAG Local & Manuais Técnicos:** Arquitetura RAG (Chunking, Retrieval, Grounding), prevenção de alucinações e recusa explícita. | Assistente de suporte técnico `rag_manuals.py` ancorado em datasheets de IoT com `llama3.2:3b`. |
| **06 (Aula 20)** | **Function Calling & Tool Use:** Execution Handshake, definição de ferramentas tipadas em Python e acionamento de hardware. | Agente com invocação dinâmica de funções Python de sensores e relés (`tool_agent.py`). |
| **07 (Aula 21)** | **IA Multimodal na Borda (VLMs):** Vision Transformers, Patch Embeddings, inspeção de LEDs e mostradores analógicos. | Script `vlm_inspector.py` com o modelo ultraleve `moondream` gerando status visual em JSON. |
| **08 (Aula 22)** | **Agentes Autônomos de Loop Único (ReAct):** Ciclo Thought $\to$ Action $\to$ Observation em Python puro com `max_iterations`. | Agente de controle térmico autônomo com autocorreção em malha fechada (`react_agent.py`). |
| **09 (Aula 23)** | **Gestão de Estado & Multi-Agentes:** Padrão Blackboard, Agente Monitor (1.5B) de alta frequência e Despachante (3B) sob alerta. | Sistema distribuído de 2 agentes (`multi_agent_system.py`) com triagem rápida e alarme de emergência. |
| **10 (Aula 24)** | **IA sobre MQTT & Gateways de Eventos:** Pub/Sub assíncrono, tópicos hierárquicos, QoS e desacoplamento temporal com threads. | Gateway assíncrono `mqtt_ai_gateway.py` integrado ao broker Mosquitto e tópicos de telemetria. |
| **11 (Aula 25)** | **Otimização na Borda & Quantização:** Tensores FP16 vs INT4, K-quants, formato GGUF e dimensionamento de RAM para Raspberry Pi 5. | Relatório de benchmark de hardware comparando `qwen2.5:0.5b`, `llama3.2:1b` e `llama3.2:3b`. |
| **12 (Aula 26)** | **Projeto Integrador - AI Smart Gateway (Parte 1):** Arquitetura modular (`models.py`, `tools.py`, `rag_engine.py`, `gateway.py`). | Roteador central inteligente integrando telemetria, diagnóstico RAG e controle de relés. |
| **13 (Aula 27)** | **Capstone Showcase & Resiliência (Parte 2):** Human-in-the-Loop, Engenharia de Caos, Circuit Breaker e fallbacks de hardware. | Bateria de testes de caos (`chaos_test.py`) com injeção de falhas e defesa final do projeto. |



