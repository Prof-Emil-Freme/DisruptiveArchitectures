---
layout: "class"
course: "disruptive"
section:
    name: "IA: Conhecimento & Ferramentas"
    order: 6
class:
    title: "6. Function Calling & Tools"
    order: 2
---

# Function Calling & Uso de Ferramentas (Tool Use)

Até este momento, nossos modelos de linguagem podiam classificar textos, gerar JSONs e consultar manuais. No entanto, eles ainda eram "cérebros em uma redoma de vidro": não podiam ler um sensor físico em tempo real nem acionar um relé no mundo exterior.

Nesta aula, quebraremos essa barreira ensinando nossos modelos a utilizar **Function Calling (Chamada de Funções)** e **Tool Use**. Aprenderemos como o modelo decide autonomamente *quando*, *qual* e *com quais argumentos* invocar funções reais escritas em Python para interagir diretamente com o hardware!

<pre class="mermaid">
sequenceDiagram
    autonumber
    actor Usuario as 👤 Usuário / Operador
    participant App as 🐍 Aplicação Python
    participant LLM as 🧠 LLM Local (Llama 3.2 3B)
    participant HW as 🔌 Hardware / Sensores

    Usuario->>App: "Qual a temperatura na estufa e o solo precisa de água?"
    App->>LLM: Envia Prompt + Esquema das Ferramentas (tools=[read_temp, read_soil])
    Note over LLM: O modelo analisa a intenção<br/>e decide quais funções chamar
    LLM-->>App: Retorna Tool Calls:<br/>1. read_temp(zone='greenhouse')<br/>2. read_soil(zone='greenhouse')
    
    App->>HW: Executa read_temp() no sensor real/simulado
    HW-->>App: Retorna 32.5°C
    App->>HW: Executa read_soil() no sensor real/simulado
    HW-->>App: Retorna 18% (Seco!)
    
    App->>LLM: Envia Resultados (role='tool', content='temp: 32.5C, soil: 18%')
    Note over LLM: O modelo sintetiza os dados reais<br/>em linguagem natural
    LLM-->>App: "A estufa está a 32.5°C e o solo está muito seco (18%). Recomendo ligar a irrigação!"
    App-->>Usuario: Exibe resposta final ao usuário
</pre>

---

# Teoria

## 1. O Conceito Fundamental: Quem Executa o Código?

Um dos erros conceituais mais comuns é imaginar que o modelo de linguagem "executa" código em sua própria rede neural.

> [!IMPORTANT]
> **O LLM NUNCA executa código diretamente.**  
> O modelo apenas analisa a solicitação do usuário e, se identificar a necessidade de uma ferramenta externa, **emite um payload estruturado com o nome da função e os argumentos tipados**. É o nosso programa em **Python** que intercepta essa recomendação, executa a função real no sistema operacional ou no barramento serial do microcontrolador e devolve a resposta para o modelo!

---

## 2. O Ciclo de Aperto de Mãos (*The Execution Handshake*)

O fluxo completo de Function Calling consiste em 4 passos obrigatórios:

1. **Registro das Ferramentas (*Tool Registration*):** O Python envia ao LLM o prompt do usuário acompanhado da assinatura das funções disponíveis (nome, docstring descritiva e tipos de parâmetros).
2. **Decisão e Emissão da Chamada (*Tool Recommendation*):** O LLM avalia a frase. Se for uma pergunta teórica genérica (*"O que é fotossíntese?"*), ele responde direto. Se for algo dinâmico que depende do mundo real (*"Como está a umidade agora?"*), ele interrompe a geração de texto e emite um objeto `tool_calls`.
3. **Execução Nativa no Python (*Native Execution*):** O Python lê o nome da função indicada pelo modelo, converte os argumentos JSON e faz a chamada real (ex: `le_porta_serial()`, `consulta_api_tempo()`, `ativa_rele(pin=5)`).
4. **Alimentação e Síntese Final (*Final Grounded Answer*):** O Python envia uma nova mensagem para o modelo com o papel `role: "tool"` contendo a saída da função. O LLM lê esses dados reais e formula uma resposta natural clara e contextualizada para o usuário.

---

## 3. Modelos com Suporte Nativo a Ferramentas

Nem todos os modelos suportam Function Calling de forma confiável. Para esta prática, utilizaremos modelos que foram expressamente treinados com tokens especiais de chamada de ferramentas:
- **`llama3.2:3b`** (Meta): Excelente suporte nativo a múltiplas ferramentas em paralelo.
- **`qwen2.5:1.5b` / `qwen2.5:3b`** (Alibaba): Um dos modelos compactos mais precisos do mundo para seguir assinaturas estritas de ferramentas.

---

# Prática

Vamos construir um sistema inteligente em Python (`tool_agent.py`) que conecta funções reais de sensores e atuadores de uma estufa automatizada ao modelo local `llama3.2:3b`.

## Passo 1: Definindo Funções Python com Type Hints e Docstrings

O Ollama inspeciona automaticamente os **Type Hints** (`str`, `int`, `bool`) e as **Docstrings** das funções Python para gerar o JSON Schema que instrui o modelo. Portanto, docstrings claras são essenciais!

Crie o arquivo `tool_agent.py`:

```python
import json
import ollama

# --- 1. BANCO DE DADOS E HARDWARE SIMULADO ---
ESTADO_ESTUFA = {
    "temperatura": 31.8,
    "umidade_solo": 18.0,  # 18% (Solo Crítico)
    "rele_irrigacao": False,
    "rele_ventilador": False,
}


# --- 2. FERRAMENTAS REAIS (FUNÇÕES PYTHON) ---
def ler_sensores_ambiente(setor: str) -> str:
    """Lê a temperatura atual e a umidade do solo de um setor específico da estufa.

    Args:
        setor: O nome do setor a ser medido (ex: 'principal', 'berçario',
          'flores').
    """
    print(
        f"\n[HARDWARE EXEC] 📡 Lendo sensores analógicos do setor '{setor}'..."
    )
    dados = {
        "setor": setor,
        "temperatura_celsius": ESTADO_ESTUFA["temperatura"],
        "umidade_solo_percentual": ESTADO_ESTUFA["umidade_solo"],
        "status_solo": (
            "MUITO SECO (Necessita Irrigação)"
            if ESTADO_ESTUFA["umidade_solo"] < 25
            else "ADEQUADO"
        ),
    }
    return json.dumps(dados)


def acionar_atuador(dispositivo: str, ligar: bool) -> str:
    """Liga ou desliga um atuador físico (bomba de irrigação ou exaustor/ventilador).

    Args:
        dispositivo: Qual equipamento acionar ('irrigacao' ou 'ventilador').
        ligar: True para ligar o equipamento, False para desligar.
    """
    print(
        f"\n[HARDWARE EXEC] 🔌 Acionando Relé: {dispositivo.upper()} -> {'LIGADO (HIGH)' if ligar else 'DESLIGADO (LOW)'}"
    )

    if dispositivo == "irrigacao":
        ESTADO_ESTUFA["rele_irrigacao"] = ligar
        if ligar:
            ESTADO_ESTUFA[
                "umidade_solo"
            ] = 65.0  # Simula a elevação da umidade após regar
    elif dispositivo == "ventilador":
        ESTADO_ESTUFA["rele_ventilador"] = ligar
        if ligar:
            ESTADO_ESTUFA["temperatura"] = 24.0  # Simula resfriamento

    return f"Status do atuador '{dispositivo}' atualizado com sucesso para: {'LIGADO' if ligar else 'DESLIGADO'}."


# Mapeamento das funções para invocação dinâmica pelo Python
MAPA_FUNCOES = {
    "ler_sensores_ambiente": ler_sensores_ambiente,
    "acionar_atuador": acionar_atuador,
}

# Lista de ferramentas registradas no Ollama
FERRAMENTAS_DISPONIVEIS = [ler_sensores_ambiente, acionar_atuador]


# --- 3. MOTOR DO AGENTE COM EXECUTION HANDSHAKE ---
def executar_assistente_com_tools(comando_usuario: str):
    print("=" * 70)
    print(f"👤 Usuário: \"{comando_usuario}\"")

    # Histórico da conversa
    mensagens = [
        {
            "role": "system",
            "content": (
                "Você é o assistente autônomo de automação da estufa inteligente. "
                "Use as ferramentas disponíveis para inspecionar sensores e controlar atuadores conforme solicitado. "
                "Após obter o resultado das ferramentas, apresente um resumo amigável e claro ao operador."
            ),
        },
        {"role": "user", "content": comando_usuario},
    ]

    # Chamada 1: O modelo avalia a necessidade de ferramentas
    resposta_inicial = ollama.chat(
        model="llama3.2:3b",
        messages=mensagens,
        tools=FERRAMENTAS_DISPONIVEIS,
        options={"temperature": 0.0},
    )

    msg_modelo = resposta_inicial["message"]
    mensagens.append(msg_modelo)

    # Verifica se o modelo solicitou a chamada de funções
    tool_calls = msg_modelo.get("tool_calls")

    if not tool_calls:
        print(f"\n🤖 Assistente (Sem Tools): {msg_modelo['content']}")
        return

    # Processa cada tool call solicitada pelo modelo
    for chamada in tool_calls:
        nome_funcao = chamada["function"]["name"]
        argumentos = chamada["function"]["arguments"]

        print(
            f"\n🧠 Decisão da IA: Invocar função '{nome_funcao}' com argumentos: {argumentos}"
        )

        if nome_funcao in MAPA_FUNCOES:
            funcao_real = MAPA_FUNCOES[nome_funcao]
            # Execução real em Python
            resultado_execucao = funcao_real(**argumentos)
            print(f"📋 Retorno do Hardware: {resultado_execucao}")

            # Adiciona o resultado no histórico com o papel 'tool'
            mensagens.append(
                {"role": "tool", "content": str(resultado_execucao)}
            )

    # Chamada 2: O modelo lê os retornos das tools e formula a resposta final
    resposta_final = ollama.chat(
        model="llama3.2:3b",
        messages=mensagens,
        tools=FERRAMENTAS_DISPONIVEIS,
        options={"temperature": 0.0},
    )

    print(f"\n🤖 Resposta Final da IA:\n{resposta_final['message']['content']}")


# --- BATERIA DE TESTES PRÁTICOS ---
print("=== INICIANDO AGENTE LOCAL COM SUPORTE A TOOL CALLING ===")

# Teste 1: Leitura de Sensores
executar_assistente_com_tools(
    "Como estão as condições climáticas no setor principal da estufa?"
)

# Teste 2: Acionamento de Hardware baseado no estado anterior
executar_assistente_com_tools(
    "O solo está muito seco! Ligue a irrigação imediatamente por favor."
)

# Teste 3: Pergunta Teórica (Não deve disparar tools desnecessárias)
executar_assistente_com_tools(
    "Qual é a temperatura ideal média para o cultivo de tomates?"
)
```

---

## Passo 2: Executando e Testando a Interação com o Hardware

Execute o script:

```bash
python tool_agent.py
```

### Saída Esperada:
```text
=== INICIANDO AGENTE LOCAL COM SUPORTE A TOOL CALLING ===
======================================================================
👤 Usuário: "Como estão as condições climáticas no setor principal da estufa?"

🧠 Decisão da IA: Invocar função 'ler_sensores_ambiente' com argumentos: {'setor': 'principal'}

[HARDWARE EXEC] 📡 Lendo sensores analógicos do setor 'principal'...
📋 Retorno do Hardware: {"setor": "principal", "temperatura_celsius": 31.8, "umidade_solo_percentual": 18.0, "status_solo": "MUITO SECO (Necessita Irrigação)"}

🤖 Resposta Final da IA:
No setor principal, a temperatura atual é de 31.8°C e a umidade do solo está em apenas 18.0%, o que é considerado muito seco. Recomendo ligar o sistema de irrigação para proteger o plantio!

======================================================================
👤 Usuário: "O solo está muito seco! Ligue a irrigação imediatamente por favor."

🧠 Decisão da IA: Invocar função 'acionar_atuador' com argumentos: {'dispositivo': 'irrigacao', 'ligar': True}

[HARDWARE EXEC] 🔌 Acionando Relé: IRRIGACAO -> LIGADO (HIGH)
📋 Retorno do Hardware: Status do atuador 'irrigacao' atualizado com sucesso para: LIGADO.

🤖 Resposta Final da IA:
O sistema de irrigação foi ativado com sucesso! A umidade do solo já está sendo normalizada.

======================================================================
👤 Usuário: "Qual é a temperatura ideal média para o cultivo de tomates?"

🤖 Assistente (Sem Tools): A temperatura ideal para o cultivo de tomates varia entre 20°C e 26°C durante o dia...
```

---

# Questionário de Fixação

**1. Em uma arquitetura de IA com suporte a *Function Calling / Tool Use*, quem é o responsável por executar fisicamente o código da função no sistema?**  
a) A própria rede neural do LLM compila e executa o código binário internamente.  
b) O interpretador Python da aplicação nativa, que intercepta o payload estruturado emitido pelo LLM com o nome da função e argumentos.  
c) O servidor do Google Cloud.  
d) A placa de vídeo através do driver CUDA sem passar pela CPU.  
e) O navegador web através de código JavaScript não compilado.

**2. Como o motor do Ollama descobre quais parâmetros e descrições uma função Python aceita ao registrá-la como ferramenta?**  
a) Ele descompila o sistema operacional do computador.  
b) Ele analisa as anotações de tipo (*Type Hints*) e a documentação (*Docstrings*) da função em Python para criar automaticamente a assinatura JSON Schema da ferramenta.  
c) O desenvolvedor é obrigado a criar um arquivo XML separado para cada função.  
d) Ele envia o código-fonte para análise na internet.  
e) O Ollama adivinha os parâmetros por tentativa e erro durante a execução.

**3. No ciclo de aperto de mãos (*Execution Handshake*), qual papel (*Role*) de mensagem é utilizado para enviar ao LLM o resultado gerado pela execução da função no hardware?**  
a) `role: "system"`  
b) `role: "admin"`  
c) `role: "tool"`  
d) `role: "sensor_raw"`  
e) `role: "interrupt"`

**4. O que acontece quando o usuário faz uma pergunta conceitual (ex: *"O que é fotossíntese?"*) para um modelo configurado com ferramentas de acionamento de relés?**  
a) O modelo trava porque é obrigado a acionar um relé em todas as respostas.  
b) O modelo avalia que nenhuma das ferramentas disponíveis é necessária para responder e gera uma resposta de texto direta normalmente.  
c) O modelo liga todos os atuadores simultaneamente por segurança.  
d) O Python lança uma exceção `FunctionNotFoundException`.  
e) O banco de dados vetorial é reiniciado.

**5. Qual das seguintes opções apresenta uma grande vantagem do Tool Use em sistemas IoT de borda?**  
a) Permite que a IA atue em tempo real sobre o hardware físico com base na intenção expressa em linguagem natural, mantendo a execução sob controle seguro do software local.  
b) Aumenta a velocidade do clock do microcontrolador de 16MHz para 5GHz.  
c) Elimina a necessidade de alimentação elétrica nos motores.  
d) Substitui todos os sensores físicos por simulações puramente teóricas.  
e) Permite rodar o Windows 11 dentro de um Arduino Uno.

---

### Gabarito Comentado

1. **b) O interpretador Python da aplicação nativa, que intercepta o payload estruturado...**  
   *Justificativa:* O LLM funciona como o orquestrador lógico que emite intenções estruturadas; a execução em hardware real é sempre responsabilidade do código da aplicação hospedeira.
2. **b) Ele analisa as anotações de tipo (*Type Hints*) e a documentação (*Docstrings*)...**  
   *Justificativa:* Boas práticas de documentação em Python geram automaticamente esquemas legíveis pela IA com os tipos e objetivos de cada parâmetro.
3. **c) `role: "tool"`**  
   *Justificativa:* O padrão de chat com suporte a ferramentas reserva a tag de papel `tool` para indicar que a mensagem em questão é o retorno de uma chamada de função prévia.
4. **b) O modelo avalia que nenhuma das ferramentas disponíveis é necessária...**  
   *Justificativa:* Modelos modernos com capacidade de ferramentas realizam roteamento contextual dinâmico, invocando funções apenas quando estritamente relevante.
5. **a) Permite que a IA atue em tempo real sobre o hardware físico com base na intenção...**  
   *Justificativa:* Function Calling fecha o elo entre a compreensão semântica da linguagem humana e a automação de sistemas físicos no mundo real.
