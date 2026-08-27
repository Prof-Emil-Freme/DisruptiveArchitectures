---
layout: "class"
course: "disruptive"
section:
    name: "IA: Visão & Agentes Autônomos"
    order: 7
class:
    title: "7. Visão Computacional & VLMs"
    order: 0
---

# IA Multimodal na Borda: Visão e Linguagem

Até aqui, trabalhamos com dados textuais e números de sensores. Mas e se o nosso sistema de automação precisar inspecionar um **mostrador analógico legado de um manômetro**, verificar se um **LED de alarme vermelho está aceso em um painel elétrico**, ou confirmar visualmente se uma válvula mecânica está aberta ou fechada?

Para essas tarefas, entramos no fascinante universo dos **Vision-Language Models (VLMs)**: modelos de inteligência artificial capazes de "enxergar" imagens, raciocinar sobre elas e emitir respostas em texto ou JSON estruturado na borda!

<pre class="mermaid">
flowchart LR
    ImgInput["📷 Imagem da Câmera / WebCam<br>(Foto de Mostrador ou Painel)"] --> ViT["👁️ Vision Encoder (ViT)<br>(Decompõe em Patches de 14x14 px)"]
    ViT --> LinearProj["📐 Camada de Projeção Linear<br>(Converte Patches em Tokens Visuais)"]
    LinearProj --> JointDecoder["🧠 Decodificador Multimodal<br>(Moondream2 / Llama 3.2 Vision)"]
    TextPrompt["💬 Prompt do Usuário:<br>'Qual é a pressão marcada no ponteiro?'"] --> JointDecoder
    JointDecoder --> JSONResult["📊 Resposta Estruturada:<br>{'pressao_psi': 45.0, 'ponteiro_visivel': true}"]
    style ViT fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style JointDecoder fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style JSONResult fill:#d1fae5,stroke:#10b981,stroke-width:2px;
</pre>

---

# Teoria

## 1. Como Imagens se Tornam Tokens? (Vision Transformers - ViT)

Um modelo de linguagem tradicional processa apenas tensores 1D de tokens textuais. Como fazemos para que ele compreenda uma imagem 2D composta por uma matriz de pixels RGB ($$H \times W \times 3$$)?

A arquitetura moderna de **VLMs** segue o padrão do **Vision Transformer (ViT)**:
1. **Decomposição em Patches:** A imagem de entrada é recortada em uma grade uniforme de pequenos blocos de pixels (por exemplo, blocos de $$14 \times 14$$ ou $$16 \times 16$$ pixels chamados *Patches*).
2. **Linear Embedding de Patches:** Cada bloco de pixels é achatado e projetado linearmente para um vetor de embedding de dimensão $$D$$.
3. **Positional Encoding:** Adiciona-se uma coordenada espacial para que o modelo saiba onde aquele pedaço da imagem está localizado (canto superior esquerdo, centro, etc.).
4. **Projeção Multimodal (*Cross-Attention Bridge*):** Os tokens visuais resultantes são alinhados ao mesmo espaço vetorial dos tokens de texto do LLM.

A partir desse momento, para o cérebro da rede neural, **uma imagem é tratada exatamente como se fosse uma sequência de palavras ricas em informações visuais**!

---

## Visualizador Interativo: Decomposição de Imagem em Patches ViT

Veja no simulador abaixo como uma imagem capturada pela câmera de inspeção é dividida em uma grade de *Patches* de visão e transformada em tokens vetoriais:

<div id="p5-vit-container" style="width: 100%; max-width: 650px; margin: 20px auto; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: #ffffff;"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<script>
new p5(function(p) {
    let gridCols = 6;
    let gridRows = 6;
    let patchSize = 35;
    let startX = 40;
    let startY = 60;
    let highlightedCol = 3, highlightedRow = 2;

    p.setup = function() {
        let canvas = p.createCanvas(600, 320);
        canvas.parent("p5-vit-container");
        p.textFont("sans-serif");
    };

    p.draw = function() {
        p.background(250);

        p.fill(33);
        p.textSize(14);
        p.textStyle(p.BOLD);
        p.text("Decomposição Vision Transformer (ViT) para Edge AI", 20, 25);
        p.textStyle(p.NORMAL);
        p.textSize(12);
        p.text("Passe o mouse sobre os blocos para inspecionar os Patches Visuais:", 20, 45);

        // Atualiza patch com base no mouse
        if (p.mouseX >= startX && p.mouseX < startX + gridCols * patchSize &&
            p.mouseY >= startY && p.mouseY < startY + gridRows * patchSize) {
            highlightedCol = Math.floor((p.mouseX - startX) / patchSize);
            highlightedRow = Math.floor((p.mouseY - startY) / patchSize);
        }

        // Desenha a imagem simulada dividida em Patches
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                let x = startX + c * patchSize;
                let y = startY + r * patchSize;
                let isHigh = (c === highlightedCol && r === highlightedRow);

                // Desenho simulado de mostrador/LED
                if (r >= 2 && r <= 3 && c >= 2 && c <= 3) {
                    p.fill(isHigh ? p.color(255, 100, 100) : p.color(220, 50, 50)); // LED vermelho central
                } else if (r === 0 || r === 5 || c === 0 || c === 5) {
                    p.fill(isHigh ? p.color(180, 200, 220) : p.color(210, 220, 230)); // Borda do painel
                } else {
                    p.fill(isHigh ? p.color(240, 240, 180) : p.color(245, 245, 245)); // Fundo do mostrador
                }

                p.stroke(isHigh ? p.color(66, 133, 244) : p.color(160));
                p.strokeWeight(isHigh ? 2.5 : 1);
                p.rect(x, y, patchSize, patchSize, 2);
            }
        }

        // Painel de Projeção Linear à Direita
        let targetX = 330;
        p.fill(240, 245, 255);
        p.stroke(66, 133, 244);
        p.strokeWeight(1.5);
        p.rect(targetX, 60, 240, 210, 6);

        p.fill(33);
        p.noStroke();
        p.textSize(12);
        p.textStyle(p.BOLD);
        p.text(`Patch Selecionado: [${highlightedRow}, ${highlightedCol}]`, targetX + 15, 85);
        p.textStyle(p.NORMAL);
        p.text("1. Dimensão dos Pixels: 14x14x3 = 588", targetX + 15, 110);
        p.text("2. Vetor de Projeção Linear (D=768):", targetX + 15, 130);
        
        p.fill(100);
        p.textSize(11);
        p.text(`[0.812, -0.341, 0.052, ..., 0.619]`, targetX + 15, 150);

        p.fill(16, 185, 129);
        p.textSize(12);
        p.textStyle(p.BOLD);
        p.text("➔ Emitido como Token Visual para o LLM", targetX + 15, 180);

        p.stroke(66, 133, 244);
        p.strokeWeight(2);
        let srcX = startX + highlightedCol * patchSize + patchSize / 2;
        let srcY = startY + highlightedRow * patchSize + patchSize / 2;
        p.line(srcX, srcY, targetX, 140);
    };
}, "p5-vit-container");
</script>

---

## 2. Modelos de Visão na Borda: Moondream2 vs. Llama 3.2 Vision

O processamento de imagens adiciona uma carga substancial de memória de vídeo (VRAM) e RAM:

| Modelo | Parâmetros | Consumo de RAM/VRAM | Ideal Para |
| :--- | :--- | :--- | :--- |
| **Moondream2** | **1.8 Bilhões** | **~1.8 GB a 2.5 GB** | **CPUs comuns, Laptops, SBCs (Raspberry Pi 5)** |
| **Llama 3.2 Vision** | **11 Bilhões** | **~8.0 GB a 12 GB** | GPUs dedicadas (RTX / Apple Silicon Metal) |

Para o nosso Gateway de IA local e de baixo custo, o **Moondream2** é a escolha perfeita: ele é leve o suficiente para rodar em tempo real em CPUs modestas e possui excelente precisão para inspeção de estados de LEDs, leitura de mostradores e detecção de anomalias visuais!

---

# Prática

Vamos instalar o modelo de visão `moondream` no Ollama e criar um script em Python (`vlm_inspector.py`) para inspecionar imagens de painéis de controle industriais e retornar o status visual diretamente em formato JSON estruturado.

## Passo 1: Download do Modelo Moondream

Execute no terminal:

```bash
ollama pull moondream
```

---

## Passo 2: Construindo o Script de Inspeção Visual com VLM

Crie o arquivo `vlm_inspector.py`:

```python
import base64
import os
import ollama
from pydantic import BaseModel, Field


# 1. Definindo o Modelo de Dados do Diagnóstico Visual
class VisualInspectionResult(BaseModel):
    warning_led_active: bool = Field(
        ...,
        description="True se o LED vermelho/amarelo de aviso estiver aceso, False se apagado.",
    )
    gauge_estimated_value: float = Field(
        ...,
        description="Valor numérico aproximado apontado pelo ponteiro do manômetro/mostrador (0 a 100).",
    )
    smoke_or_hazard_detected: bool = Field(
        ...,
        description="True se houver fumaça, fogo ou obstrução física no painel.",
    )
    overall_status: str = Field(
        ...,
        description="Resumo do estado visual do equipamento: NORMAL, ALERTA ou PERIGO.",
    )


# 2. Criando uma Imagem de Teste Sintética (Caso não tenha uma câmera no momento)
def criar_imagem_de_teste_se_nao_existir(caminho_imagem: str):
    """Cria uma imagem JPEG simples com um círculo vermelho (LED) para teste."""
    if not os.path.exists(caminho_imagem):
        try:
            from PIL import Image, ImageDraw

            img = Image.new("RGB", (300, 300), color=(40, 40, 40))
            draw = ImageDraw.Draw(img)
            # Desenha um mostrador com ponteiro
            draw.ellipse([30, 30, 270, 270], outline=(200, 200, 200), width=4)
            draw.line([150, 150, 220, 90], fill=(255, 50, 50), width=5)  # Ponteiro
            # Desenha um LED vermelho aceso
            draw.ellipse([135, 210, 165, 240], fill=(255, 0, 0))
            img.save(caminho_imagem)
            print(
                f"📸 Imagem sintética de teste criada em: '{caminho_imagem}'"
            )
        except ImportError:
            # Fallback se PIL não estiver instalado
            pass


# 3. Função de Inspeção Visual Local com Moondream
def inspecionar_painel_visual(caminho_imagem: str):
    print("=" * 65)
    print(f"👁️ Inspecionando visualmente o arquivo: '{caminho_imagem}'...")

    prompt_inspecao = f"""Analise a imagem deste painel industrial.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{VisualInspectionResult.model_json_schema()}

Responda apenas o JSON puro, sem explicações."""

    try:
        # Chamada multimodal passando a imagem no parâmetro 'images'
        response = ollama.chat(
            model="moondream",
            messages=[
                {
                    "role": "user",
                    "content": prompt_inspecao,
                    "images": [caminho_imagem],
                }
            ],
            format="json",
            options={"temperature": 0.0},
        )

        conteudo_json = response["message"]["content"]
        print(f"\n[PAYLOAD RETORNADO PELO VLM]:\n{conteudo_json}")

        # Validação com Pydantic
        resultado = VisualInspectionResult.model_validate_json(conteudo_json)
        return resultado

    except Exception as e:
        print(f"❌ Erro na inspeção visual: {e}")
        return None


# --- EXECUÇÃO DO TESTE ---
caminho_teste = "painel_industrial_teste.jpg"
criar_imagem_de_teste_se_nao_existir(caminho_teste)

if os.path.exists(caminho_teste):
    relatorio = inspecionar_painel_visual(caminho_teste)
    if relatorio:
        print("\n✅ [RELATÓRIO DE VISÃO COMPUTACIONAL VALIDADO]:")
        print(f"   -> LED de Aviso Ativo: {relatorio.warning_led_active}")
        print(f"   -> Leitura do Ponteiro: {relatorio.gauge_estimated_value}")
        print(f"   -> Risco Detectado: {relatorio.smoke_or_hazard_detected}")
        print(f"   -> Status Geral: {relatorio.overall_status}")
else:
    print(
        f"⚠️ Coloque uma imagem chamada '{caminho_teste}' na pasta para testar!"
    )
```

---

## Passo 3: Executando o VLM Localmente

Execute o script:

```bash
python vlm_inspector.py
```

### Saída Típica Observada:
```text
=================================================================
👁️ Inspecionando visualmente o arquivo: 'painel_industrial_teste.jpg'...

[PAYLOAD RETORNADO PELO VLM]:
{
  "warning_led_active": true,
  "gauge_estimated_value": 65.0,
  "smoke_or_hazard_detected": false,
  "overall_status": "ALERTA"
}

✅ [RELATÓRIO DE VISÃO COMPUTACIONAL VALIDADO]:
   -> LED de Aviso Ativo: True
   -> Leitura do Ponteiro: 65.0
   -> Risco Detectado: False
   -> Status Geral: ALERTA
```

---

# Questionário de Fixação

**1. O que é um *Vision-Language Model* (VLM)?**  
a) Um software para desenhar esquemas de circuitos em 3D.  
b) Um modelo de rede neural multimodal treinado conjuntamente para compreender imagens e texto, gerando respostas em linguagem natural.  
c) Um sensor de luz analógico baseado em fotorresistor LDR.  
d) Um compilador de código Python para sistemas operacionais antigos.  
e) Uma placa de captura de vídeo exclusiva para consoles de videogame.

**2. Na arquitetura de *Vision Transformers* (ViT), como uma imagem bidimensional de pixels é preparada para entrar no decodificador do modelo?**  
a) A imagem é impressa em papel térmico e digitalizada por um scanner serial.  
b) A imagem é recortada em uma grade de pequenos blocos (*Patches*) de pixels, achatados e projetados linearmente em vetores de tokens visuais.  
c) Todos os pixels da imagem são apagados e substituídos por números aleatórios.  
d) A imagem é convertida em um arquivo de áudio MP3.  
e) O modelo ignora a imagem e lê apenas o nome do arquivo.

**3. Por que o modelo *Moondream2* (~1.8B) é especialmente recomendado para aplicações de Edge AI e IoT em comparação com modelos como o Llama 3.2 Vision (11B)?**  
a) Porque o Moondream2 não precisa de energia elétrica para funcionar.  
b) Porque seu baixo consumo de memória RAM/VRAM (~2GB) permite execução rápida em CPUs comuns e computadores de placa única como a Raspberry Pi 5.  
c) Porque modelos maiores foram proibidos pela Anatel.  
d) Porque o Moondream2 funciona apenas em televisores antigos.  
e) Porque o Moondream2 só lê imagens em preto e branco.

**4. Em um cenário de automação predial, qual das seguintes tarefas é um caso de uso típico de um VLM na borda?**  
a) Medir a voltagem dos pinos de uma bateria com um multímetro analógico sem câmera.  
b) Inspecionar uma foto da câmera de segurança para verificar se uma luz de alerta de emergência está acesa no painel elétrico.  
c) Substituir o cabo de fibra ótica da operadora de internet.  
d) Aumentar a capacidade de armazenamento do cartão SD.  
e) Limpar a poeira física dos sensores com ar comprimido.

**5. Como o código Python envia uma imagem local para inferência no cliente Ollama?**  
a) Renomeando a imagem para `index.html`.  
b) Passando o caminho ou base64 da imagem dentro da lista do parâmetro `images` na estrutura de mensagens (`messages=[{"role": "user", "content": "...", "images": ["./foto.jpg"]}]`).  
c) Gravando a imagem na memória EEPROM do Arduino via barramento SPI.  
d) Enviando a foto por e-mail para a equipe de suporte do Ollama.  
e) Convertendo a foto em código Morse através do buzzer sonoro.

---

### Gabarito Comentado

1. **b) Um modelo de rede neural multimodal treinado conjuntamente para compreender imagens e texto...**  
   *Justificativa:* VLMs integram representações visuais e textuais no mesmo espaço latente, viabilizando o raciocínio sobre imagens.
2. **b) A imagem é recortada em uma grade de pequenos blocos (*Patches*) de pixels...**  
   *Justificativa:* O mecanismo de patching transforma matrizes 2D de pixels em sequências lineares de tokens visuais compatíveis com a arquitetura Transformer.
3. **b) Porque seu baixo consumo de memória RAM/VRAM (~2GB) permite execução rápida em CPUs comuns...**  
   *Justificativa:* Modelos ultracompactos viabilizam a inferência visual local em dispositivos com restrições térmicas e de memória.
4. **b) Inspecionar uma foto da câmera de segurança para verificar se uma luz de alerta está acesa...**  
   *Justificativa:* A inspeção visual de estados ópticos, mostradores e LEDs é uma das aplicações mais valiosas para retrofit de equipamentos legados em IoT.
5. **b) Passando o caminho ou base64 da imagem dentro da lista do parâmetro `images`...**  
   *Justificativa:* A API de chat do Ollama suporta a chave nativa `images` no payload de mensagens para modelos multimodais.
