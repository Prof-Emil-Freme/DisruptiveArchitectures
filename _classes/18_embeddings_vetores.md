---
layout: "class"
course: "disruptive"
section:
    name: "IA: Conhecimento & Ferramentas"
    order: 6
class:
    title: "4. Embeddings & Vector DBs"
    order: 0
---

# Embeddings & Bancos de Dados Vetoriais

Até este momento, nossos modelos de linguagem dependiam exclusivamente das informações contidas em seus parâmetros pré-treinados ou no texto imediato do prompt. Mas como fazemos para que nossa IA de borda consulte **manuais técnicos de centenas de páginas, catálogos de componentes eletrônicos ou registros históricos de telemetria** sem ultrapassar a janela de contexto ou exigir o re-treinamento do modelo?

A resposta para essa pergunta começa com dois conceitos fundamentais: **Embeddings Vetoriais** e **Bancos de Dados Vetoriais (Vector Databases)**.

<pre class="mermaid">
flowchart LR
    TextDoc["📄 Trecho do Manual Técnico<br>'Erro E02: Tensão da bateria baixa. Troque a célula 3.3V.'"] --> EmbedModel["🧮 Modelo de Embedding<br>(nomic-embed-text)"]
    EmbedModel --> Vector["📐 Vetor Numérico (768D)<br>[-0.042, 0.812, 0.155, ..., -0.320]"]
    Vector --> ChromaDB[("🗄️ ChromaDB<br>(Índice HNSW Local)")]
    
    Query["🔍 Pergunta do Técnico<br>'Por que o equipamento está sem energia?'"] --> EmbedModel2["🧮 Modelo de Embedding"]
    EmbedModel2 --> QueryVector["📐 Vetor da Pergunta (768D)"]
    QueryVector --> Search{"⚡ Busca Semântica<br>(Similaridade de Cosseno)"}
    ChromaDB --> Search
    Search --> Result["✅ Trecho Mais Próximo Encontrado!"]
    style EmbedModel fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style ChromaDB fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style Result fill:#d1fae5,stroke:#10b981,stroke-width:2px;
</pre>

---

# Teoria

## 1. O que é um Vetor de Embedding?

Um **Embedding** é uma representação numérica densa do significado semântico de um texto em um espaço geométrico de alta dimensão (normalmente entre 384 e 1536 dimensões).

Diferente de uma simples contagem de palavras (como a antiga abordagem *Bag-of-Words* ou busca por `LIKE '%palavra%'` em SQL), um modelo de embedding (como o `nomic-embed-text` ou `bge-small`) foi treinado para posicionar **conceitos com significados similares em regiões geométricas próximas do espaço vetorial**.

- As frases *"A caldeira está pegando fogo"* e *"Superaquecimento crítico no reservatório de vapor"* não compartilham quase nenhuma palavra idêntica.
- Contudo, seus vetores de embedding terão uma distância angular extremamente pequena, permitindo a busca por **significado e contexto**, e não por correspondência exata de caracteres!

---

## 2. Medindo a Proximidade Semântica: Similaridade de Cosseno

Para comparar dois vetores $$\mathbf{u}$$ e $$\mathbf{v}$$ no espaço multidimensional, a métrica mais utilizada no mercado é a **Similaridade de Cosseno** (*Cosine Similarity*), que avalia o cosseno do ângulo $$\theta$$ formado entre os dois vetores:

$$
\text{Similaridade}(\mathbf{u}, \mathbf{v}) = \cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|} = \frac{\sum_{i=1}^{n} u_i v_i}{\sqrt{\sum_{i=1}^{n} u_i^2} \sqrt{\sum_{i=1}^{n} v_i^2}}
$$

- $$\cos(\theta) = 1.0$$: Vetores apontam exatamente na mesma direção ($$\theta = 0^\circ$$), indicando **máxima equivalência semântica**.
- $$\cos(\theta) = 0.0$$: Vetores são ortogonais ($$\theta = 90^\circ$$), indicando **independência semântica**.
- $$\cos(\theta) = -1.0$$: Vetores apontam em direções opostas ($$\theta = 180^\circ$$).

---

## Visualizador Interativo: Similaridade de Cosseno em 2D

Mova o ponto do vetor azul no simulador abaixo para alterar o ângulo em relação ao vetor de referência (verde) e acompanhe o cálculo ao vivo da Similaridade de Cosseno:

<div id="p5-cosine-container" style="width: 100%; max-width: 650px; margin: 20px auto; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: #ffffff;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<script>
new p5(function(p) {
    let originX = 300;
    let originY = 160;
    let refX = 460, refY = 160; // Vetor Referência (0 graus)
    let queryX = 420, queryY = 70; // Vetor Consulta (arrastável)
    let isDragging = false;

    p.setup = function() {
        let canvas = p.createCanvas(600, 320);
        canvas.parent("p5-cosine-container");
        p.textFont("sans-serif");
    };

    p.draw = function() {
        p.background(250);

        // Eixos
        p.stroke(220);
        p.strokeWeight(1);
        p.line(50, originY, 550, originY);
        p.line(originX, 30, originX, 290);

        // Vetor Referência (u): "Problema na Bateria"
        let uX = refX - originX;
        let uY = -(refY - originY);
        p.stroke(16, 185, 129);
        p.strokeWeight(3);
        p.line(originX, originY, refX, refY);
        p.fill(16, 185, 129);
        p.noStroke();
        p.circle(refX, refY, 10);
        p.textSize(12);
        p.text("Vetor Base: 'Falha de Bateria'", refX - 40, refY + 25);

        // Se estiver arrastando com mouse
        if (p.mouseIsPressed && p.dist(p.mouseX, p.mouseY, originX, originY) < 180 && p.mouseX > 50 && p.mouseX < 550) {
            queryX = p.mouseX;
            queryY = p.mouseY;
        }

        // Vetor Consulta (v)
        let vX = queryX - originX;
        let vY = -(queryY - originY);
        p.stroke(66, 133, 244);
        p.strokeWeight(3);
        p.line(originX, originY, queryX, queryY);
        p.fill(66, 133, 244);
        p.noStroke();
        p.circle(queryX, queryY, 12);
        p.text("Vetor Consulta: 'Sem Energia' (Arraste-me)", queryX - 50, queryY - 15);

        // Cálculo de Similaridade de Cosseno
        let dot = uX * vX + uY * vY;
        let magU = Math.sqrt(uX * uX + uY * uY);
        let magV = Math.sqrt(vX * vX + vY * vY);
        let cosSim = magU * magV > 0 ? (dot / (magU * magV)) : 0;
        let angleDeg = Math.acos(Math.max(-1, Math.min(1, cosSim))) * (180 / Math.PI);

        // Painel Superior de Métricas
        p.fill(33);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.text("Simulação Geométrica de Similaridade Semântica", 20, 25);
        p.textStyle(p.NORMAL);
        p.textSize(12);
        p.text(`Ângulo θ: ${angleDeg.toFixed(1)}° | Similaridade de Cosseno: ${cosSim.toFixed(4)}`, 20, 45);

        let statusText = cosSim > 0.8 ? "🟢 Alta Afinidade Semântica (Match Rápido)" : cosSim > 0.4 ? "🟡 Moderadamente Relevante" : "🔴 Não Relacionado / Distante";
        p.fill(cosSim > 0.8 ? p.color(16, 185, 129) : cosSim > 0.4 ? p.color(245, 158, 11) : p.color(239, 68, 68));
        p.text(statusText, 20, 65);
    };
}, "p5-cosine-container");
</script>

---

## 3. O que é um Banco de Dados Vetorial (Vector DB)?

Enquanto um banco SQL tradicional indexa colunas usando árvores B-Tree para buscas exatas (`id = 123`), um **Banco Vetorial** como o **ChromaDB** indexa vetores de alta dimensão usando algoritmos de **Busca Aproximada pelos Vizinhos Mais Próximos (ANN - Approximate Nearest Neighbors)**, como o algoritmo **HNSW** (*Hierarchical Navigable Small World*).

Vantagens do ChromaDB para Edge AI:
- **100% Local e Gratuito:** Roda embutido no processo Python sem necessidade de servidores externos.
- **Armazenamento em Disco ou Memória:** Persistência em SQLite local com busca vetorial acelerada.
- **Metadados Anexados:** Permite associar metadados a cada documento (ex: `{"modulo": "sensor_temperatura", "versao": "2.1"}`).

---

# Prática

Nesta aula prática, vamos instalar o ChromaDB, baixar o modelo de embeddings ultrarrápido `nomic-embed-text` no Ollama e construir nosso primeiro banco de conhecimento vetorial para documentação de hardware IoT.

## Passo 1: Instalação e Download do Modelo de Embedding

Instale a biblioteca `chromadb`:

```bash
pip install chromadb
```

Baixe o modelo especializado de embeddings através do terminal do Ollama:

```bash
ollama pull nomic-embed-text
```

---

## Passo 2: Construindo o Banco de Manuais de Hardware

Crie o arquivo `vector_store.py`:

```python
import chromadb
import ollama

# 1. Inicializa o cliente do ChromaDB (em memória para o laboratório)
# Para salvar em disco permanente, use: chromadb.PersistentClient(path="./iot_db")
client = chromadb.Client()

# Criação da coleção de manuais de IoT
collection = client.create_collection(name="iot_hardware_manuals")

# 2. Documentação Técnica Simulada do Gateway IoT
documentos_tecnicos = [
    "Erro E01: Sensor de temperatura desconectado ou rompido. Verifique a fiação e o pino GPIO 4.",
    "Erro E02: Tensão da bateria do nó remoto muito baixa (abaixo de 3.0V). Substitua a célula de lítio 3.3V.",
    "Erro E03: Perda de sinal de rede Wi-Fi. Reinicie o roteador ou ajuste a antena externa de 2.4GHz.",
    "Erro E04: Sobrecarga de corrente no relé principal. Desarme preventivo disparado no pino 12.",
    "Procedimento de Reset: Mantenha pressionado o botão físico por 10 segundos até o LED piscar em azul.",
    "Especificação Elétrica: A tensão de alimentação nominal de entrada do Gateway é de 5V DC com corrente mínima de 2A.",
]

print("=== GERANDO EMBEDDINGS E INDEXANDO MANUAIS TÉCNICOS ===")

for idx, doc in enumerate(documentos_tecnicos):
    # Geramos o vetor de embedding através do nomic-embed-text
    response = ollama.embeddings(model="nomic-embed-text", prompt=doc)
    vetor = response["embedding"]

    # Adicionamos ao banco vetorial com ID e metadados
    collection.add(
        ids=[f"doc_{idx+1}"],
        embeddings=[vetor],
        documents=[doc],
        metadatas=[{"categoria": "hardware_manual", "origem": "doc_v1.0"}],
    )
    print(f"Indexado [Doc {idx+1}] - Vetor de dimensão: {len(vetor)}")

print("\n✅ Todos os documentos foram indexados no ChromaDB com sucesso!\n")


# 3. Função de Busca Semântica
def buscar_solucao_no_manual(pergunta_usuario: str, n_resultados: int = 1):
    print(f"🔍 Pergunta do Técnico: \"{pergunta_usuario}\"")

    # Vetorizamos a pergunta com o mesmo modelo
    q_emb = ollama.embeddings(model="nomic-embed-text", prompt=pergunta_usuario)[
        "embedding"
    ]

    # Consulta no ChromaDB por proximidade de cosseno
    busca = collection.query(
        query_embeddings=[q_emb],
        n_results=n_resultados,
        include=["documents", "distances", "metadatas"],
    )

    doc_encontrado = busca["documents"][0][0]
    distancia = busca["distances"][0][0]

    print(f"📖 Trecho Mais Relevante Encontrado (Distância L2: {distancia:.4f}):")
    print(f"   --> \"{doc_encontrado}\"\n")


# --- Testes de Busca Semântica com Termos Sinônimos (Sem correspondência exata de palavras) ---
buscar_solucao_no_manual("Meu aparelho está sem energia e desligando sozinho.")
buscar_solucao_no_manual("Como restaurar o equipamento para as configurações de fábrica?")
buscar_solucao_no_manual("A leitura de calor ambiente parou de funcionar.")
```

---

## Passo 3: Executando o Banco Vetorial

Execute o script:

```bash
python vector_store.py
```

### Saída Esperada:
```text
=== GERANDO EMBEDDINGS E INDEXANDO MANUAIS TÉCNICOS ===
Indexado [Doc 1] - Vetor de dimensão: 768
Indexado [Doc 2] - Vetor de dimensão: 768
Indexado [Doc 3] - Vetor de dimensão: 768
Indexado [Doc 4] - Vetor de dimensão: 768
Indexado [Doc 5] - Vetor de dimensão: 768
Indexado [Doc 6] - Vetor de dimensão: 768

✅ Todos os documentos foram indexados no ChromaDB com sucesso!

🔍 Pergunta do Técnico: "Meu aparelho está sem energia e desligando sozinho."
📖 Trecho Mais Relevante Encontrado (Distância L2: 0.4281):
   --> "Erro E02: Tensão da bateria do nó remoto muito baixa (abaixo de 3.0V). Substitua a célula de lítio 3.3V."

🔍 Pergunta do Técnico: "Como restaurar o equipamento para as configurações de fábrica?"
📖 Trecho Mais Relevante Encontrado (Distância L2: 0.3850):
   --> "Procedimento de Reset: Mantenha pressionado o botão físico por 10 segundos até o LED piscar em azul."

🔍 Pergunta do Técnico: "A leitura de calor ambiente parou de funcionar."
📖 Trecho Mais Relevante Encontrado (Distância L2: 0.4120):
   --> "Erro E01: Sensor de temperatura desconectado ou rompido. Verifique a fiação e o pino GPIO 4."
```

> [!TIP]
> **Destaque Pedagógico:** Observe que a pergunta *"Meu aparelho está sem energia"* não continha a palavra *"bateria"*, *"tensão"* nem *"3.3V"*, mas o sistema localizou perfeitamente o **Erro E02**. Uma busca tradicional com SQL ou Regex teria falhado completamente!

---

# Questionário de Fixação

**1. O que representa um vetor de *Embedding* gerado por um modelo de linguagem?**  
a) A contagem exata do número de caracteres de um texto.  
b) Uma representação numérica de alta dimensão que captura o significado e as relações semânticas do texto.  
c) Um código criptográfico irreversível para ocultar senhas de banco de dados.  
d) Uma compilação de código Python em linguagem de máquina.  
e) Um endereço IP exclusivo do dispositivo na rede local.

**2. Na fórmula da Similaridade de Cosseno, o que indica um resultado igual a $1.0$?**  
a) Que os dois textos possuem exatamente o mesmo tamanho em bytes.  
b) Que os vetores são ortogonais e não possuem nenhuma relação semântica.  
c) Que os vetores apontam exatamente na mesma direção ($\theta = 0^\circ$), indicando máxima afinidade semântica.  
d) Que o banco de dados vetorial está corrompido.  
e) Que a temperatura do microcontrolador atingiu 100°C.

**3. Por que a busca semântica em bancos vetoriais supera a busca tradicional por palavras-chave (SQL `LIKE` ou Regex) em manuais técnicos?**  
a) Porque a busca semântica é capaz de encontrar documentos relevantes mesmo quando o usuário utiliza sinônimos ou termos diferentes dos originais do manual.  
b) Porque a busca vetorial só aceita arquivos binários compilados em C.  
c) Porque os bancos relacionais foram descontinuados pelo IEEE.  
d) Porque a busca por palavra-chave exige acesso obrigatório à internet.  
e) Porque vetores eliminam a necessidade de processador no computador.

**4. Qual é a principal característica do banco de dados vetorial *ChromaDB*?**  
a) É um banco de dados proprietário que exige pagamento mensal em dólares.  
b) É uma biblioteca open-source e local que pode ser executada embutida no Python para indexar e consultar vetores sem servidores externos.  
c) É um driver de aceleração gráfica exclusivo para placas de vídeo Nvidia.  
d) É uma linguagem de programação para microcontroladores PIC.  
e) É um protocolo de comunicação sem fio para substituição do Wi-Fi.

**5. Por que é mandatório utilizar o MESMO modelo de embedding (ex: `nomic-embed-text`) tanto na indexação dos documentos quanto na consulta da pergunta do usuário?**  
a) Porque modelos diferentes possuem formatos de arquivo incompatíveis no sistema operacional.  
b) Porque cada modelo de embedding projeta os textos em um espaço latente com dimensões e geometrias semânticas próprias; comparar vetores de modelos distintos geraria resultados incoerentes.  
c) Porque o Python não permite carregar duas bibliotecas ao mesmo tempo.  
d) Porque o modelo de embedding substitui a rede neural LLM principal.  
e) Por uma mera exigência de licença comercial do software.

---

### Gabarito Comentado

1. **b) Uma representação numérica de alta dimensão que captura o significado...**  
   *Justificativa:* Embeddings transformam texto em coordenadas geométricas contínuas onde a proximidade espacial reflete a proximidade de significado.
2. **c) Que os vetores apontam exatamente na mesma direção ($\theta = 0^\circ$), indicando máxima afinidade...**  
   *Justificativa:* O cosseno de $0^\circ$ é $1.0$, indicando alinhamento angular total entre os dois vetores no espaço vetorial.
3. **a) Porque a busca semântica é capaz de encontrar documentos relevantes mesmo quando o usuário utiliza sinônimos...**  
   *Justificativa:* A busca semântica compreende o significado conceitual (ex: "sem energia" $\approx$ "tensão de bateria baixa"), superando as limitações do casamento exato de strings.
4. **b) É uma biblioteca open-source e local que pode ser executada embutida no Python...**  
   *Justificativa:* O ChromaDB é a ferramenta ideal para sistemas de borda e privacidade local, pois opera sem custos e sem infraestrutura de servidores complexa.
5. **b) Porque cada modelo de embedding projeta os textos em um espaço latente com dimensões e geometrias próprias...**  
   *Justificativa:* Vetores só podem ser comparados por produto escalar/cosseno se pertencerem ao mesmo espaço vetorial gerado pelo mesmo codificador.
