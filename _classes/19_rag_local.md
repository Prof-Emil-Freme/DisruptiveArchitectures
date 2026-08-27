---
layout: "class"
course: "disruptive"
section:
    name: "IA: Conhecimento & Ferramentas"
    order: 6
class:
    title: "5. RAG Local & Manuais Técnicos"
    order: 1
---

# Retrieval-Augmented Generation (RAG) Local

Na aula anterior, aprendemos como transformar textos técnicos em vetores matemáticos e buscar trechos relevantes no **ChromaDB**. Agora, vamos fechar o ciclo cognitivo implementando uma das arquiteturas mais importantes da IA moderna: o **RAG (Retrieval-Augmented Generation / Geração Aumentada por Recuperação)**.

Com o RAG, nosso assistente de borda não inventará respostas nem sofrerá de **alucinações**: ele usará o LLM como um motor de raciocínio e síntese estritamente ancorado nos documentos técnicos recuperados em tempo real.

<pre class="mermaid">
flowchart TD
    subgraph INGESTAO["1. Ingestão Offline de Manuais"]
        Doc["📚 Manuais em PDF / Markdown"] --> Chunking["✂️ Chunking & Divisão"]
        Chunking --> Embed["🧮 nomic-embed-text"]
        Embed --> VectorDB[("🗄️ ChromaDB")]
    end

    subgraph RUNTIME["2. Consulta em Tempo de Execução (RAG Loop)"]
        UserQ["❓ 'O display está mostrando Erro E01, como conserto?'"] --> EmbedQuery["🧮 Embedding da Dúvida"]
        EmbedQuery --> SearchChroma{"🔍 Busca Semântica Top-k (k=1)"}
        VectorDB --> SearchChroma
        SearchChroma --> ContextRetrieved["📄 Contexto Recuperado:<br>'Erro E01: Sensor de temperatura desconectado no GPIO 4.'"]
        
        ContextRetrieved --> PromptAugment["📝 Prompt Aterrado (Grounding):<br>'Responda usando APENAS o contexto...'"]
        UserQ --> PromptAugment
        PromptAugment --> LLMLocal["🧠 LLM Local (Llama 3.2 3B)"]
        LLMLocal --> FinalAnswer["💡 Resposta Técnica Confiável:<br>'Verifique a fiação do sensor no pino GPIO 4.'"]
    end
    style INGESTAO fill:#f1f5f9,stroke:#64748b,stroke-width:2px;
    style RUNTIME fill:#f0fdf4,stroke:#22c55e,stroke-width:2px;
    style LLMLocal fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style FinalAnswer fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
</pre>

---

# Teoria

## 1. O Problema das Alucinações em Modelos de Linguagem

Modelos de linguagem treinados na internet possuem dois grandes problemas para o suporte a hardware e IoT:
1. **Falta de Conhecimento Específico:** Eles não conhecem o código de erro proprietário da sua placa personalizada criada no laboratório.
2. **Alucinação Confiável:** Quando não sabem uma resposta, os LLMs tendem a inventar explicações com tom professoral e convincente (por exemplo, inventando pinos inexistentes no microcontrolador que podem queimar o circuito!).

O **RAG** resolve isso aplicando a regra de **Aterramento (*Grounding*)**:
> *"Você não responderá com base na sua memória de treinamento genérica. Você responderá EXCLUSIVAMENTE com base no fragmento de texto oficial que acabei de colocar diante dos seus olhos."*

---

## 2. A Tríade do RAG: Chunking, Retrieval e Generation

### A. Chunking (Fragmentação Inteligente)
Documentos longos (como datasheets de 50 páginas) não devem ser inseridos inteiros no banco vetorial. Eles devem ser divididos em pequenos blocos (*Chunks*):
- **Tamanho do Chunk (*Chunk Size*):** Normalmente entre 200 e 500 caracteres para itens de erro e comandos de hardware.
- **Sobreposição (*Overlap*):** Margem de 10% a 15% entre chunks adjacentes para garantir que frases divididas na borda não percam o sentido semântico.

### B. Retrieval (Recuperação com Top-$$k$$)
Ao receber a pergunta do técnico, o sistema busca no ChromaDB os $$k$$ blocos mais relevantes:
- **Cuidado com Modelos Pequenos na Borda ($$<3B$$):** Injetar 5 a 10 chunks longos em um modelo pequeno causa o fenômeno de **Diluição de Atenção (*Lost in the Middle*)**, onde o modelo se confunde com excesso de texto e esquece a pergunta original.
- Para SLMs na borda, manter **$$k = 1$$ ou $$k = 2$$** garante foco absoluto e tempo de inferência instantâneo!

### C. Generation & Grounding Prompt
Injeta-se o contexto recuperado diretamente dentro do prompt enviado ao LLM com instruções de recusa explícita:

```text
Você é um assistente técnico de suporte a hardware.
Responda à pergunta do usuário utilizando ESTRITAMENTE as informações do Contexto abaixo.
Se a informação necessária para responder NÃO estiver presente no Contexto, responda apenas:
'ERRO DESCONHECIDO: Informação não encontrada nos manuais técnicos oficiais.'

--- CONTEXTO OFICIAL ---
{contexto_recuperado_do_chromadb}
------------------------

Pergunta: {pergunta_do_usuario}
```

---

# Prática

Vamos construir uma pipeline RAG completa em Python (`rag_manuals.py`), integrando o ChromaDB com o modelo local `llama3.2:3b` para suporte a falhas e diagnósticos de hardware.

## Passo 1: Download do Modelo de Raciocínio (3B)

Para tarefas que exigem sintetizar texto a partir de contexto e seguir instruções estritas de recusa, o modelo de 3 bilhões de parâmetros oferece excelente equilíbrio de qualidade e velocidade:

```bash
ollama pull llama3.2:3b
```

---

## Passo 2: Construindo a Pipeline RAG Completa

Crie o arquivo `rag_manuals.py`:

```python
import chromadb
import ollama

# 1. Configuração do Banco Vetorial e Coleção de Manuais
chroma_client = chromadb.Client()
collection = chroma_client.create_collection(name="manual_diagnosticos_iot")

# 2. Base de Conhecimento Oficial do Fabricante
manuais_hardware = [
    (
        "MAN-01",
        "Código de Falha E-01: Falha no sensor de temperatura DHT22. O pino de dados GPIO 4 não responde. Solução: Verifique o resistor de pull-up de 10k entre VCC e Dados.",
    ),
    (
        "MAN-02",
        "Código de Falha E-02: Subtensão na linha de 3.3V. A bateria LiPo está abaixo de 3.2V. Solução: Conecte o cabo USB-C para carga ou substitua a célula de bateria.",
    ),
    (
        "MAN-03",
        "Código de Falha E-03: Desconexão do Broker MQTT. O Gateway não consegue alcançar a porta 1883. Solução: Verifique as credenciais de rede Wi-Fi e se o serviço Mosquitto está ativo.",
    ),
    (
        "MAN-04",
        "Código de Falha E-04: Atuação de proteção de sobrecorrente do relé no pino 12. Solução: Desconecte a carga externa imediatamente e verifique curto-circuito na fiação.",
    ),
    (
        "MAN-05",
        "Procedimento de Calibração do Sensor de Solo: Mergulhe a sonda em água destilada, leia o pino A0 e ajuste o trimpot azul até a saída analógica registrar valor 512.",
    ),
]

print("=== 1. INDEXANDO MANUAIS TÉCNICOS NO CHROMADB ===")
for doc_id, texto in manuais_hardware:
    emb = ollama.embeddings(model="nomic-embed-text", prompt=texto)[
        "embedding"
    ]
    collection.add(
        ids=[doc_id],
        embeddings=[emb],
        documents=[texto],
        metadatas=[{"doc_id": doc_id}],
    )
print(f"✅ {len(manuais_hardware)} manuais indexados com sucesso!\n")


# 3. Função Central RAG: Recuperação + Aumento de Prompt + Geração Local
def diagnosticar_problema_rag(pergunta_usuario: str) -> str:
    print(f"❓ Pergunta do Técnico: \"{pergunta_usuario}\"")

    # A. Recuperação (Retrieval)
    q_emb = ollama.embeddings(model="nomic-embed-text", prompt=pergunta_usuario)[
        "embedding"
    ]
    busca = collection.query(query_embeddings=[q_emb], n_results=1)

    contexto = busca["documents"][0][0]
    doc_id = busca["metadatas"][0][0]["doc_id"]
    print(f"📖 Contexto Recuperado do Banco ({doc_id}): \"{contexto}\"")

    # B. Aumento de Prompt com Aterramento Rigoroso (Augmentation)
    prompt_aterrado = f"""Você é um engenheiro de suporte de hardware especialista em IoT.
Responda à pergunta do técnico utilizando EXCLUSIVAMENTE as informações fornecidas no Contexto abaixo.

Diretrizes Críticas:
1. Seja direto, técnico e cite a solução passo a passo.
2. Se a resposta NÃO estiver claramente descrita no Contexto, responda APENAS:
   'ERRO DESCONHECIDO: Falha não catalogada nos manuais oficiais do equipamento.'

--- CONTEXTO OFICIAL ---
{contexto}
------------------------

Pergunta do Técnico: {pergunta_usuario}
Resposta do Engenheiro:"""

    # C. Geração Ancorada no LLM (Generation)
    resposta = ollama.chat(
        model="llama3.2:3b",
        messages=[{"role": "user", "content": prompt_aterrado}],
        options={"temperature": 0.0},  # Máximo determinismo
    )

    return resposta["message"]["content"].strip()


# --- Bateria de Testes: Perguntas Reais vs Perguntas Inexistentes ---
print("=== 2. EXECUTANDO TESTES DE DIAGNÓSTICO COM RAG LOCAL ===")

perguntas_teste = [
    "O painel acusou Erro E-01 no sensor de temperatura, como devo proceder?",
    "A placa está acusando erro E-02 e o LED vermelho pisca. O que fazer?",
    "Como faço para calibrar o sensor de umidade de solo no pino analógico?",
    "Apareceu o Erro E-99 de superaquecimento quântico no processador, o que é?",  # Falha inexistente!
]

for p in perguntas_teste:
    print("-" * 65)
    solucao = diagnosticar_problema_rag(p)
    print(f"\n🤖 Resposta da IA:\n{solucao}\n")
```

---

## Passo 3: Executando e Verificando a Ausência de Alucinações

Execute o script:

```bash
python rag_manuals.py
```

### Saída Esperada no Terminal:
```text
=== 1. INDEXANDO MANUAIS TÉCNICOS NO CHROMADB ===
✅ 5 manuais indexados com sucesso!

=== 2. EXECUTANDO TESTES DE DIAGNÓSTICO COM RAG LOCAL ===
-----------------------------------------------------------------
❓ Pergunta do Técnico: "O painel acusou Erro E-01 no sensor de temperatura, como devo proceder?"
📖 Contexto Recuperado do Banco (MAN-01): "Código de Falha E-01: Falha no sensor de temperatura DHT22. O pino de dados GPIO 4 não responde. Solução: Verifique o resistor de pull-up de 10k entre VCC e Dados."

🤖 Resposta da IA:
Para solucionar o Erro E-01, verifique o resistor de pull-up de 10k ohms instalado entre os pinos VCC e Dados (GPIO 4) do sensor DHT22.

-----------------------------------------------------------------
❓ Pergunta do Técnico: "Apareceu o Erro E-99 de superaquecimento quântico no processador, o que é?"
📖 Contexto Recuperado do Banco (MAN-04): "Código de Falha E-04: Atuação de proteção de sobrecorrente do relé no pino 12..."

🤖 Resposta da IA:
ERRO DESCONHECIDO: Falha não catalogada nos manuais oficiais do equipamento.
```

> [!NOTE]
> **Vitória contra a Alucinação:** Repare que quando perguntamos sobre o código inexistente *"Erro E-99"*, o modelo recuperou o documento mais próximo, mas, graças ao prompt de aterramento rigoroso, **recusou-se a inventar uma resposta**, emitindo a mensagem padronizada de falha não catalogada!

---

# Questionário de Fixação

**1. Qual é o principal objetivo da arquitetura RAG (Retrieval-Augmented Generation)?**  
a) Treinar um modelo de linguagem do zero usando GPUs industriais.  
b) Fornecer documentos externos relevantes em tempo de execução para ancorar a geração do modelo, eliminando alucinações e expandindo seu conhecimento.  
c) Compactar arquivos de áudio para transmissão via rádio frequência.  
d) Substituir a necessidade de escrever código em Python.  
e) Apagar a memória de contexto do microcontrolador.

**2. Na arquitetura RAG, o que significa a etapa de *Retrieval* (Recuperação)?**  
a) A recuperação de arquivos excluídos da lixeira do sistema operacional.  
b) A busca no banco vetorial dos fragmentos de texto mais similares semanticamente à dúvida do usuário.  
c) A compilação do código binário para o Arduino.  
d) O envio de pacotes de telemetria por cabos seriais.  
e) A formatação do disco rígido local.

**3. Por que ao utilizar modelos de linguagem compactos na borda (SLMs de 1B a 3B) é recomendado manter um valor baixo de $k$ (ex: $k=1$ ou $k=2$)?**  
a) Porque o ChromaDB não suporta mais de dois documentos.  
b) Para evitar a diluição de atenção (*Lost in the Middle*), economizar memória RAM com o KV-Cache e garantir que o modelo foque no trecho exato.  
c) Porque o Python limita o número de variáveis a 2.  
d) Para diminuir o consumo elétrico dos sensores analógicos.  
e) Porque modelos compactos não sabem ler mais de 10 palavras por minuto.

**4. O que é o *Grounding* (Aterramento) de um modelo de linguagem?**  
a) A conexão física do pino GND do Arduino à carcaça metálica para evitar ruído elétrico.  
b) A instrução estrita dada ao modelo para que ele formule sua resposta baseando-se unicamente nas evidências do contexto fornecido, recusando-se a inventar fatos.  
c) O desligamento do computador em caso de superaquecimento.  
d) A gravação permanente do modelo na memória flash do microcontrolador.  
e) A conversão de tensores em matrizes esparsas.

**5. Se um usuário fizer uma pergunta sobre um problema que não existe na documentação indexada no ChromaDB, qual é o comportamento esperado de uma pipeline RAG bem projetada?**  
a) O modelo deve inventar uma solução criativa para não deixar o usuário sem resposta.  
b) O modelo deve travar e encerrar a execução do sistema operacional.  
c) O modelo deve identificar que o contexto recuperado não contém a resposta e emitir uma mensagem explícita de recusa ou erro desconhecido.  
d) O modelo deve apagar a coleção do banco vetorial.  
e) O modelo deve enviar um e-mail de socorro para a OpenAI.

---

### Gabarito Comentado

1. **b) Fornecer documentos externos relevantes em tempo de execução para ancorar a geração...**  
   *Justificativa:* O RAG conecta o raciocínio linguístico do LLM a repositórios dinâmicos de dados reais e privados sem a necessidade de dispendiosos re-treinamentos.
2. **b) A busca no banco vetorial dos fragmentos de texto mais similares semanticamente...**  
   *Justificativa:* A etapa de Retrieval consulta a base vetorial utilizando o embedding da dúvida para encontrar os chunks de maior relevância.
3. **b) Para evitar a diluição de atenção (*Lost in the Middle*), economizar memória RAM...**  
   *Justificativa:* SLMs possuem menor capacidade de filtrar ruídos em contextos excessivamente longos; blocos precisos e concisos ($k \le 2$) produzem respostas mais precisas.
4. **b) A instrução estrita dada ao modelo para que ele formule sua resposta baseando-se unicamente nas evidências...**  
   *Justificativa:* Grounding é o processo de atrelar a resposta gerada a fontes verificáveis de verdade.
5. **c) O modelo deve identificar que o contexto recuperado não contém a resposta e emitir uma mensagem explícita...**  
   *Justificativa:* Em ambientes técnicos e industriais, um "Não sei / Erro não catalogado" é infinitamente superior e mais seguro do que uma alucinação plausível que possa causar danos materiais.
