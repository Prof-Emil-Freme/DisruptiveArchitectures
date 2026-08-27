---
layout: "class"
course: "disruptive"
section:
    name: "IA: Fundamentos & Estruturação"
    order: 5
class:
    title: "3. Saídas Estruturadas & JSON"
    order: 2
---

# Saídas Estruturadas & JSON Schemas

Nas aulas anteriores, aprendemos a orientar modelos locais para responder palavras específicas. Contudo, no mundo real da engenharia de software e da Internet das Coisas (IoT), os sistemas não se comunicam por texto livre ou strings soltas: **eles se comunicam por contratos de dados bem definidos, tipados e serializados em JSON**.

Nesta aula, aprenderemos a técnica mais avançada para garantir que um modelo de linguagem não-determinístico emita **100% de payloads JSON estruturados e garantidos matematicamente**, utilizando **Grammar-Guided Decoding** e validação com **Pydantic v2**.

<pre class="mermaid">
flowchart LR
    Input["🗣️ Linguagem Natural<br>('Estou derretendo de calor! Ajuste para 19 graus!')"] --> LLM["🧠 LLM Local + GBNF Grammar<br>(Ollama JSON Mode)"]
    LLM --> JSONRaw["📄 String JSON Bruta<br>{'action': 'COOL', 'target_temp': 19}"]
    JSONRaw --> Pydantic["🛡️ Validador Pydantic<br>(Verifica Tipos & Limites Térmicos)"]
    Pydantic --> PythonObj["🐍 Objeto Python Tipado<br>cmd.target_temp = 19"]
    PythonObj --> Actuator["🔌 Atuador / Microcontrolador"]
    style LLM fill:#e0e7ff,stroke:#6366f1,stroke-width:2px;
    style Pydantic fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    style PythonObj fill:#d1fae5,stroke:#10b981,stroke-width:2px;
</pre>

---

# Teoria

## 1. Por que Texto Livre Quebra Sistemas de IoT?

Imagine que seu microcontrolador ESP32 ou seu script Python esteja aguardando um comando para acionar um atuador. Se o LLM responder:

> *"Com certeza! Entendi que você está com calor, então estou ajustando o ar-condicionado para 19°C agora mesmo."*

Seu parser de software falhará (`JSONDecodeError` ou `ValueError`), porque uma máquina espera um dado estruturado como:
```json
{
  "action": "COOL",
  "target_temp": 19
}
```

Tradicionalmente, desenvolvedores tentavam resolver isso pedindo no prompt *"Responda apenas em JSON"*. No entanto, o modelo frequentemente incluía blocos de markdown (````json ... ````), comentários ou chaves ausentes, causando falhas graves em tempo de execução.

---

## 2. Decodificação Guiada por Gramática (GBNF & Logit Masking)

Para resolver esse problema de forma definitiva, os motores modernos de inferência local (como `llama.cpp` e `Ollama`) utilizam uma técnica chamada **Grammar-Constrained Decoding** (Decodificação Guiada por Gramática) baseada no formato **GBNF** (*GGML BNF*).

Como funciona o Mascaramento de Logits (*Logit Masking*)?
1. Quando o modelo vai gerar o primeiro token da resposta, o motor de inferência verifica a gramática JSON.
2. O motor **mascara** (atribui probabilidade $$-\infty$$) a todos os tokens do vocabulário que não sejam `{`. O modelo é forçado a começar com `{`.
3. Após a chave `{`, os únicos tokens permitidos pela gramática são as aspas duplas `"` de abertura de uma chave.
4. Se o esquema define que o campo `"target_temp"` é um número inteiro, o motor impede fisicamente a emissão de letras enquanto o valor daquele campo estiver sendo gerado.

$$
\text{Logit}_{\text{mascarado}}(token) = \begin{cases} \text{Logit}(token), & \text{se } token \in \text{Gramática\_Válida} \\ -\infty, & \text{caso contrário} \end{cases}
$$

Dessa forma, o modelo **nunca gerará um JSON com sintaxe inválida**, pois os tokens sintaticamente incorretos são eliminados antes da amostragem!

---

## 3. Validação de Contratos com Pydantic v2

Enquanto a gramática garante a sintaxe JSON, a biblioteca **Pydantic** garante a **semântica e os limites de negócio** dos dados dentro da aplicação Python.

Com o Pydantic, definimos:
- **Tipagem estrita:** `int`, `float`, `str`, `bool`.
- **Enums e Literais:** `Literal["HEAT", "COOL", "OFF"]`.
- **Restrições Numéricas:** `ge` (*greater than or equal* / maior ou igual), `le` (*less than or equal* / menor ou igual).
- **Exportação automática de JSON Schema:** `Model.model_json_schema()`, permitindo alimentar diretamente o prompt do LLM com o esquema oficial.

---

# Prática

Vamos construir um conversor inteligente de intenções que recebe mensagens livres de usuários e as transforma em payloads de comando rigorosamente validados para um sistema de climatização predial (HVAC).

## Passo 1: Instalação das Dependências

Instale o Pydantic v2 e o cliente Ollama no seu ambiente Python:

```bash
pip install pydantic ollama
```

---

## Passo 2: Construindo o Script de Extração com Validação

Crie o arquivo `hvac_extractor.py`:

```python
import json
from typing import Literal
import ollama
from pydantic import BaseModel, Field, ValidationError


# 1. Definindo o Contrato de Dados (Schema)
class HVACCommand(BaseModel):
    action: Literal["HEAT", "COOL", "FAN_ONLY", "OFF"] = Field(
        ...,
        description="Ação principal a ser tomada no equipamento de climatização.",
    )
    target_temp: int = Field(
        ...,
        ge=16,
        le=30,
        description="Temperatura alvo em graus Celsius (permitido apenas entre 16°C e 30°C).",
    )
    fan_speed: Literal["LOW", "MEDIUM", "HIGH", "AUTO"] = Field(
        default="AUTO",
        description="Velocidade da ventilação do sistema.",
    )
    user_sentiment: Literal["HOT", "COLD", "NEUTRAL"] = Field(
        ...,
        description="Sensação térmica percebida do usuário.",
    )
    justification: str = Field(
        ...,
        description="Breve explicação (1 frase) do porquê esses parâmetros foram escolhidos.",
    )


# 2. Função de Processamento com Modo JSON Nativo do Ollama
def parse_user_request_to_hvac(user_prompt: str) -> HVACCommand | None:
    # Geramos o schema JSON padronizado do Pydantic para instruir o modelo
    schema_definition = json.dumps(HVACCommand.model_json_schema(), indent=2)

    system_instruction = f"""Você é uma API de automação predial.
Sua função é converter solicitações de usuários em comandos JSON estritos para atuadores.
Você DEVE responder exclusivamente com um objeto JSON válido correspondente ao seguinte JSON Schema:

{schema_definition}

Não inclua nenhuma palavra antes ou depois do JSON.
"""

    try:
        # Chamada com format="json" ativa o Grammar-Guided Decoding no Ollama
        response = ollama.chat(
            model="llama3.2:1b",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
            format="json",
            options={"temperature": 0.0},
        )

        raw_json_str = response["message"]["content"]
        print(f"\n[RAW JSON DO MODELO]:\n{raw_json_str}")

        # 3. Validação e Parsing com Pydantic v2
        validated_command = HVACCommand.model_validate_json(raw_json_str)
        return validated_command

    except ValidationError as val_err:
        print(f"\n❌ [ERRO DE VALIDAÇÃO DE SCHEMA]:\n{val_err.json(indent=2)}")
        return None
    except Exception as e:
        print(f"\n❌ [ERRO INESPERADO]: {e}")
        return None


# --- Bateria de Testes com Linguagem Natural ---
exemplos_usuarios = [
    "Socorro, estou derretendo aqui dentro! Coloca esse ar no gelo máximo a 17 graus!",
    "Tá muito frio na sala de reuniões, sobe para 25 graus por favor.",
    "Desliga tudo, já acabou o expediente.",
    "Apenas faça circular o ar, está um pouco abafado mas não quero frio.",
]

print("=== INICIANDO PARSER INTELIGENTE DE COMANDOS HVAC ===")
for msg in exemplos_usuarios:
    print("-" * 60)
    print(f"🗣️ Mensagem do Usuário: \"{msg}\"")
    cmd = parse_user_request_to_hvac(msg)

    if cmd:
        print("\n✅ [COMANDO VALIDADO COM SUCESSO]:")
        print(f"   -> Ação: {cmd.action}")
        print(f"   -> Temperatura Alvo: {cmd.target_temp}°C")
        print(f"   -> Velocidade do Fan: {cmd.fan_speed}")
        print(f"   -> Sentimento: {cmd.user_sentiment}")
        print(f"   -> Justificativa: {cmd.justification}")
    else:
        print("⚠️ Comando descartado pelo sistema de segurança.")
```

---

## Passo 3: Execução e Análise dos Resultados

Execute o script:

```bash
python hvac_extractor.py
```

### Saída Típica Observada:
```text
=== INICIANDO PARSER INTELIGENTE DE COMANDOS HVAC ===
------------------------------------------------------------
🗣️ Mensagem do Usuário: "Socorro, estou derretendo aqui dentro! Coloca esse ar no gelo máximo a 17 graus!"

[RAW JSON DO MODELO]:
{
  "action": "COOL",
  "target_temp": 17,
  "fan_speed": "HIGH",
  "user_sentiment": "HOT",
  "justification": "O usuário relatou muito calor e pediu resfriamento com temperatura baixa e ventilação alta."
}

✅ [COMANDO VALIDADO COM SUCESSO]:
   -> Ação: COOL
   -> Temperatura Alvo: 17°C
   -> Velocidade do Fan: HIGH
   -> Sentimento: HOT
   -> Justificativa: O usuário relatou muito calor...
```

> [!NOTE]
> **Tratamento de Exceções:** Observe que se o modelo tentar emitir um valor de temperatura fora da faixa permitida (ex: `target_temp: 12`, sendo que a restrição era `ge=16`), o método `model_validate_json()` do Pydantic dispara imediatamente um erro do tipo `ValidationError`, impedindo que um comando inseguro chegue ao atuador físico!

---

# Questionário de Fixação

**1. Por que o uso de saídas estruturadas em JSON é preferível a texto livre em sistemas de automação e IoT?**  
a) Porque o formato JSON ocupa mais espaço em disco, facilitando o armazenamento.  
b) Porque o formato JSON permite que programas e microcontroladores realizem o parsing direto de chaves e valores tipados sem ambiguidade.  
c) Porque modelos de linguagem não são capazes de gerar palavras comuns em língua portuguesa.  
d) Porque o protocolo MQTT não aceita mensagens com mais de duas letras.  
e) Porque o JSON substitui o compilador C++ no microcontrolador.

**2. Como a técnica de *Grammar-Guided Decoding* (Decodificação Guiada por Gramática) garante a sintaxe de um JSON emitido por um LLM?**  
a) Ela reescreve todo o código-fonte da rede neural após a geração.  
b) Ela aplica uma máscara de probabilidades ($-\infty$) sobre os tokens do vocabulário que violariam as regras formais da gramática a cada etapa da geração.  
c) Ela traduz o texto gerado para a língua inglesa antes de salvar.  
d) Ela força a reinicialização do microcontrolador sempre que houver erro de digitação.  
e) Ela envia a requisição para um validador na nuvem da OpenAI.

**3. No ecossistema Pydantic em Python, qual é o papel do parâmetro `ge=16` na definição de um campo numérico (`Field`)?**  
a) Indicar que o valor gerado deve ser menor que 16.  
b) Indicar que o valor deve ser maior ou igual a 16 (*greater than or equal*).  
c) Definir que o valor deve ser convertido em formato hexadecimal.  
d) Forçar a geração de números aleatórios entre 0 e 16.  
e) Desabilitar a validação daquele campo específico.

**4. O que acontece quando o método `HVACCommand.model_validate_json(raw_json)` recebe um payload JSON que não atende às regras do modelo Pydantic?**  
a) O computador trava e precisa ser reiniciado.  
b) O Pydantic altera os tipos de dados do sistema operacional silenciosamente.  
c) Uma exceção do tipo `pydantic.ValidationError` é lançada, permitindo ao código tratar o erro de forma segura.  
d) O Ollama apaga o modelo de linguagem do disco.  
e) O comando inválido é executado no hardware com valor zero.

**5. Qual é a vantagem de utilizar `HVACCommand.model_json_schema()` na montagem do System Prompt?**  
a) Acelerar a velocidade da conexão de rede Wi-Fi.  
b) Fornecer ao modelo a definição exata dos campos, tipos e descrições esperadas diretamente a partir do código Python, evitando discrepâncias manuais.  
c) Economizar 100% da memória RAM do computador.  
d) Transformar o modelo de linguagem em um banco de dados relacional SQLite.  
e) Eliminar a necessidade de instalar o Python no computador.

---

### Gabarito Comentado

1. **b) Porque o formato JSON permite que programas e microcontroladores realizem o parsing direto...**  
   *Justificativa:* Protocolos de comunicação de software exigem contratos estruturados determinísticos para extração de variáveis numéricas e estados operacionais.
2. **b) Ela aplica uma máscara de probabilidades ($-\infty$) sobre os tokens do vocabulário que violariam as regras formais...**  
   *Justificativa:* Ao alterar a distribuição de probabilidade dos logits em tempo real para permitir apenas tokens gramaticalmente válidos segundo o esquema BNF, a geração sintaticamente inválida torna-se impossível.
3. **b) Indicar que o valor deve ser maior ou igual a 16 (*greater than or equal*).**  
   *Justificativa:* No Pydantic e JSON Schema, `ge` é a abreviação de *Greater than or Equal to*, estabelecendo o limite numérico inferior permitido.
4. **c) Uma exceção do tipo `pydantic.ValidationError` é lançada, permitindo ao código tratar o erro de forma segura.**  
   *Justificativa:* O Pydantic valida os tipos e restrições e, caso algum dado viole o contrato, dispara a exceção para que o software tome uma ação de contingência (fallback).
5. **b) Fornecer ao modelo a definição exata dos campos, tipos e descrições esperadas diretamente a partir do código...**  
   *Justificativa:* A geração dinâmica do JSON Schema a partir do modelo Pydantic mantém o prompt e o código perfeitamente sincronizados com uma única fonte de verdade (*Single Source of Truth*).
