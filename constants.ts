

export const PROMPT_TEMPLATES = [
  {
    id: 'extracao-simples-com-rastreabilidade',
    title: 'Extração Simples com Rastreabilidade (Triplets)',
    content: `Você é um especialista em **Análise Crítica de Artigos Científicos** e Engenharia do Conhecimento, com foco em PNL Biomédica. O texto de entrada que você receberá foi pré-processado: cada linha é prefixada com um número (ex: "1: ...", "2: ...").

Sua tarefa é ler o texto fornecido e extrair as **principais** relações semânticas e causais **que representam os achados e conclusões DESTE ARTIGO**.

O formato da sua saída deve ser um único array JSON de fatos.
CADA fato deve ter a estrutura:
{
  "s": { "label": "Nome da Entidade", "type": "Tipo da Entade" },
  "p": "Relação (Predicado)",
  "o": { "label": "Nome da Entidade", "type": "Tipo da Entade" },
  "source_quote": "A sentença exata do texto original que justifica este fato, SEM o número da linha.",
  "source_lines": "Uma string indicando os números de linha exatos de onde a citação foi extraída (ex: 'Linhas: 42-45')."
}

---
### REGRAS DE EXTRAÇÃO E PRIORIZAÇÃO

1.  **RASTREABILIDADE É OBRIGATÓRIA:** Para cada fato, você DEVE incluir \`source_quote\` (a citação exata) E \`source_lines\` (os números de linha).
2.  **FOCO NOS ACHADOS:** Dê prioridade máxima aos fatos extraídos das seções de **Resultados**, **Discussão** e **Conclusões** do texto.
3.  **REGRA DA CONTRADIÇÃO:** Se a Introdução menciona um fato ("Droga X reduz risco") e os Resultados encontram o oposto ("Droga X aumenta risco"), **PRIORIZE E EXTRAIA O ACHADO DO ESTUDO ATUAL**.

---
### Tipos de Entidade Permitidos:
- "mainConcept", "riskFactor", "comorbidity", "mechanism", "insight", "comparison", "diagnostic", "detail", "treatment", "drug", "population", "statistic"

---
### EXEMPLO DE EXTRAÇÃO:

* **Texto de Entrada:**
  ...
  85: Em nosso estudo, a Droga A não melhorou a sobrevida na População Y (HR 1.05),
  86: o que contrasta com estudos prévios em outras populações.
  ...
* **Extração Correta:**
    \`\`\`json
    {
      "s": { "label": "Droga A", "type": "drug" },
      "p": "não melhorou",
      "o": { "label": "sobrevida na População Y (HR 1.05)", "type": "insight" },
      "source_quote": "Em nosso estudo, a Droga A não melhorou a sobrevida na População Y (HR 1.05), o que contrasta com estudos prévios em outras populações.",
      "source_lines": "Linhas: 85-86"
    }
    \`\`\`

---

Artigo:

{TEXTO_DE_ENTRADA}
`
  },
  {
    id: 'prompt-mestre-com-rastreabilidade',
    title: 'PROMPT MESTRE P/ GRAFO DE CONHECIMENTO (v5.1)',
    content: `# PROMPT MESTRE PARA EXTRAÇÃO DE GRAFO DE CONHECIMENTO CIENTÍFICO (v5.1)

## PERSONA
Você é um Engenheiro de Ontologias e Grafos de Conhecimento. Sua missão é modelar informações complexas de artigo científicos em uma estrutura de grafo JSON hierárquca, semanticamente rica e logicamente coesa, adequada para visualização de dados. O texto de entrada que você receberá foi pré-processado: cada linha é prefixada com um número (ex: "1: ...", "2: ...").

## TAREFA
Analise o artigo e modele seu conteúdo em um formato de grafo JSON. Siga rigorosamente os princípios de modelagem ontológicae as regras de formatação abaixo. Especial atenção deve ser dada à fidelidade factual, completude e riqueza semântica e causalidade das relações.

### PRINCÍPIOS DE MODELAGEM DO GRAFO

1.  **Rastreabilidade Obrigatória:** Para cada nó, você DEVE incluir \`source_quote\` (a citação exata, SEM o número da linha) E \`source_lines\` (os números de linha exatos de onde a citação foi extraída, ex: 'Linhas: 42-45').
2.  **Síntese Hierárquica Lógica:** Organize os nós extraídos em uma hierarquia clara que flua do geral para o específico.
3.  **Riqueza Semântica:** Classifique cada nó com um \`type\` que descreva sua função no grafo.

### REGRAS DE FORMATAÇÃO PARA A SAÍDA JSON

#### **Nós (\`nodes\`)**
Cada nó deve ser um objeto com:
*   \`id\`: String única em **kebab-case**.
*   \`label\`: Texto descritivo.
*   \`type\`: Classificação semântica (use estritamente um dos tipos abaixo).
*   \`source_quote\`: A sentença exata do texto original.
*   \`source_lines\`: A string com os números das linhas de referência.

#### **Tipos de Nós Permitidos:**
*   \`mainConcept\`, \`category\`, \`keyConcept\`, \`process\`, \`property\`, \`method\`, \`finding\`, \`implication\`, \`example\`, \`treatment\`, \`hypotheses\`, \`propedeutics\`, \`question\`, \`riskFactor\`, \`symptom\` 

#### **Arestas (\`edges\`)**
Cada aresta deve ser um objeto com:
*   \`id\`: String única.
*   \`source\`: O \`id\` do nó de origem.
*   \`target\`: O \`id\` do nó de destino.
*   \`label\`: **(Recomendado)** Uma string curta descrevendo a relação. São exemplos de descrição de relação: \`cause_of\`, \`caused_by\`, \`treats\`

## FORMATO DE SAÍDA
Responda **estritamente em um único bloco de código JSON**.

\`\`\`json
{
  "title": "Título Conciso do Grafo",
  "nodes": [
    {
      "id": "main",
      "label": "Tópico Central do Texto",
      "type": "mainConcept",
      "source_quote": "A citação completa que define o tópico central.",
      "source_lines": "Linhas: 1-3"
    },
    {
      "id": "resultados",
      "label": "Resultados Principais",
      "type": "category",
      "source_quote": "A citação que resume os resultados.",
      "source_lines": "Linhas: 80-82"
    },
    {
      "id": "reducao-significativa",
      "label": "Redução de 30% no Desfecho Primário (p<0.05)",
      "type": "finding",
      "source_quote": "Em nosso estudo, observamos uma Redução de 30% no Desfecho Primário (p<0.05).",
      "source_lines": "Linhas: 85-86"
    }
  ],
  "edges": [
    {
      "id": "e-main-resultados",
      "source": "main",
      "target": "resultados",
      "label": "apresenta"
    },
    {
      "id": "e-resultados-reducao",
      "source": "resultados",
      "target": "reducao-significativa",
      "label": "mostra"
    }
  ]
}
\`\`\`

---

Artigo:

{TEXTO_DE_ENTRADA}
`
  },
  {
    id: 'prompt-mestre-causal-v6',
    title: 'PROMPT MESTRE P/ GRAFO CAUSAL (v6)',
    content: `### Prompt Mestre para Extração de Grafo de Conhecimento Causal (v6)

**1. Persona e Missão:**

Você atuará como um **Especialista em Análise Crítica de Artigos Científicos** e **Modelagem Causal**. Sua missão é processar um artigo científico e extrair **prioritariamente** as **relações de causa e efeito, mecanismos de ação e conclusões principais** em uma estrutura de grafo JSON.

O texto de entrada que você receberá foi pré-processado: cada linha é prefixada com um número (ex: "1: ...", "2: ...").

**2. Tarefa:**

Analise o artigo e modele seu conteúdo em um formato de grafo JSON. Siga rigorosamente os princípios de modelagem e as regras de formatação abaixo.

### PRINCÍPIOS DE MODELAGEM DO GRAFO

1.  **FOCO CAUSAL PRIORITÁRIO (REGRA MESTRA):** Sua principal diretriz é identificar e extrair relações causais explícitas ou fortemente implícitas (ex: *causa*, *leva a*, *previne*, *inibe*, *resulta em*). Relações puramente hierárquicas ou descritivas (como 'é parte de' ou 'apresenta') devem ser usadas apenas para conectar ramos causais ao conceito principal.
2.  **RASTREABILIDADE OBRIGATÓRIA:** Para cada nó, você DEVE incluir \`source_quote\` (a citação exata, SEM o número da linha) E \`source_lines\` (os números de linha exatos, ex: 'Linhas: 42-45').
3.  **FIDELIDADE AOS ACHADOS (REGRA DE CONTRADIÇÃO):** Dê prioridade máxima a fatos das seções de **Resultados** e **Conclusões**. Se a Introdução/Background mencionar um fato (ex: "Droga X *reduz* risco na População A") que contradiz o achado principal do estudo (ex: "Droga X *aumenta* risco na População B"), **VOCÊ DEVE PRIORIZAR E EXTRAIR O ACHADO DO ESTUDO ATUAL** (o aumento do risco) e ignorar o fato do background.

### REGRAS DE FORMATAÇÃO PARA A SAÍDA JSON

#### **Nós (\`nodes\`)**

Cada nó deve ser um objeto com:

*   \`id\`: String única em **kebab-case**.
*   \`label\`: Texto descritivo (conclusões ou entidades).
*   \`type\`: Classificação semântica (use estritamente um dos tipos abaixo).
*   \`source_quote\`: A sentença exata do texto original.
*   \`source_lines\`: A string com os números das linhas de referência.

#### **Tipos de Nós Permitidos:**

*   \`mainConcept\`: O conceito central ou o problema sendo estudado.
*   \`mechanism\`: Um processo ou via fisiopatológica (ex: "Disinibição de Neurônios DA").
*   \`riskFactor\`: Um fator de risco (ex: "Hipertensão").
*   \`treatment\`: Uma intervenção ou classe de droga (ex: "Inibidores do SRA").
*   \`drug\`: Um medicamento específico (ex: "Digoxina").
*   \`population\`: Um grupo de estudo (ex: "Idosos com IC Diastólica e DRC").
*   \`finding\`: Um resultado ou dado quantitativo (ex: "HR 0.82 (0.70-0.97)").
*   \`insight\`: Uma conclusão qualitativa ou interpretação (ex: "Plasticidade foi abolida").
*   \`diagnostic\`: Um método de diagnóstico ou medida (ex: "Ecocardiografia").
*   \`symptom\`: Um sintoma clínico.
*   \`category\`: Um nó de agrupamento genérico (usar com moderação).
*   \`implication\`: Uma implicação futura ou clínica.

#### **Arestas (\`edges\`)**

Cada aresta deve ser um objeto com:

*   \`id\`: String única (ex: "e-1-2").
*   \`source\`: O \`id\` do nó de origem (a Causa).
*   \`target\`: O \`id\` do nó de destino (o Efeito).
*   \`label\`: **(OBRIGATÓRIO)** Uma string curta descrevendo a **relação causal**.
*   \`strength\`: **(OBRIGATÓRIO)** A força da relação. Use **estritamente** um dos seguintes valores: \`"forte"\`, \`"moderada"\`, \`"fraca"\`.
    *   **forte:** Relação causal direta, bem estabelecida ou principal achado do artigo (ex: "Droga X *causou* Y").
    *   **moderada:** Relação causal implicada ou secundária (ex: "Droga X *foi associada com* Y").
    *   **fraca:** Relação especulativa ou hipótese (ex: "Droga X *pode influenciar* Y").
*   \`nature\`: **(OBRIGATÓRIO)** A natureza da relação. Use **estritamente** um dos seguintes valores: \`"positiva"\`, \`"negativa"\`, \`"neutra"\`.
    *   **positiva:** A causa aumenta, ativa ou promove o efeito (ex: "\`aumenta\`", "\`ativa\`", "\`leva_a\`").
    *   **negativa:** A causa diminui, inibe ou previne o efeito (ex: "\`diminui\`", "\`inibe\`", "\`previne\`").
    *   **neutra:** A relação não tem uma valência positiva ou negativa clara (ex: "\`é_medido_por\`", "\`é_um_tipo_de\`").

#### **Rótulos de Arestas Recomendados (Foco Causal):**

*   "\`causa\`", "\`leva_a\`", "\`resulta_em\`", "\`inibe\`", "\`ativa\`", "\`aumenta\`", "\`diminui\`", "\`previne\`", "\`trata\`", "\`é_evidência_de\`", "\`é_medido_por\`", "\`é_um_tipo_de\`" (usar com moderação, apenas para hierarquia essencial)

-----

## FORMATO DE SAÍDA

Responda **estritamente em um único bloco de código JSON**.

\`\`\`json
{
  "title": "Título Conciso do Grafo Focado em Causalidade",
  "nodes": [
    {
      "id": "main",
      "label": "Efeito da Droga X na População Y",
      "type": "mainConcept",
      "source_quote": "A citação completa que define o problema ou o achado principal.",
      "source_lines": "Linhas: 10-12"
    },
    {
      "id": "mecanismo-chave",
      "label": "Inibição da via Z",
      "type": "mechanism",
      "source_quote": "O texto descrevendo que a Droga X inibe a via Z.",
      "source_lines": "Linhas: 45-47"
    },
    {
      "id": "resultado-chave",
      "label": "Droga X reduziu o risco de morte (HR 0.75)",
      "type": "finding",
      "source_quote": "No nosso estudo, a Droga X reduziu o risco de morte (HR 0.75, 0.60-0.94).",
      "source_lines": "Linhas: 80-82"
    }
  ],
  "edges": [
    {
      "id": "e-main-mecanismo",
      "source": "main",
      "target": "mecanismo-chave",
      "label": "opera_via",
      "strength": "forte",
      "nature": "neutra"
    },
    {
      "id": "e-mecanismo-resultado",
      "source": "mecanismo-chave",
      "target": "resultado-chave",
      "label": "resulta_em",
      "strength": "forte",
      "nature": "negativa"
    }
  ]
}
\`\`\`

-----

Artigo:

{TEXTO_DE_ENTRADA}
`
  },
  {
    id: 'prompt-causal-flexivel',
    title: 'PROMPT CAUSAL (Saída Flexível)',
    content: `## Persona
Você é um assistente de IA especializado, atuando como um consultor sênior e pesquisador na análise de dados, extração semântica e relações de causalidade.

## Missão
Sua meta é atuar como um especialista em extração de conhecimento biomédico. Suas responsabilidades incluem analisar artigos científicos para extrair relações de causalidade entre entidades. A análise pode ser contida em um único texto ou exigir a identificação de relações entre entidades presentes em textos distintos.

**Domínios de Expertise Essenciais:**
Você possui domínio profundo em ontologias, modelagem semântica, taxonomia e os fundamentos científicos de áreas da saúde (biomedicina, medicina, psicologia, estatística, saúde pública, epidemiologia).

## Analise o seguinte artigo científico. 
 {{article_text}}
 
## Seus objetivos específicos são:

1.  **Raciocínio Preliminar (Chain of Thought):** Antes de gerar o JSON, descreva brevemente em texto livre as principais cadeias causais que você identificou no artigo. Isso serve como seu "rascunho" de raciocínio.
    <!-- A adição de uma etapa de "Chain of Thought" comprovadamente melhora a qualidade do raciocínio em tarefas complexas. -->

2.  **Extração de Eventos Causais (Output JSON):** Identifique todas as instâncias de **cajal:CausalEvent** descritas no texto. Para cada evento, gere um objeto JSON dentro de uma lista, seguindo estritamente a estrutura abaixo:

\`\`\`json
[
  {
    "hasAgent": {
      "label": "A entidade que exerce a influência causal (ex: Benzodiazepines).",
      "normalizedLabel": "Um nome canônico e normalizado para a entidade (ex: Benzodiazepine).",
      "ontologyID": "Se possível, um ID de uma ontologia conhecida (ex: MESH:D001562)."
    },
    "hasAffectedEntity": {
      "label": "A entidade que sofre o efeito (ex: Firing of dopamine neurons).",
      "normalizedLabel": "Nome canônico (ex: Dopaminergic Neuron Firing Rate).",
      "ontologyID": "ID de ontologia, se aplicável."
    },
    
    "hasCausalRelationship": "Selecione a relação mais precisa da seguinte lista autorizada: 'cajal:directlyCauses', 'cajal:promotes', 'cajal:increasesLikelihoodOf', 'cajal:prevents', 'cajal:inhibits', 'cajal:decreasesLikelihoodOf'. Se nenhuma se aplicar perfeitamente, use a mais genérica 'cajal:causes'.",
    
    "relationQualifier": "Qualifique a certeza da relação com base no texto. Escolha uma das seguintes: 'explicitly causal', 'strongly implied causal', 'weakly implied causal', 'correlational'.",

    "CausalMechanism": "Se o texto descrever o mecanismo biológico, extraia-o aqui. Se não for descrito, preencha com 'Not described'.",
    
    "hasEvidence": "Identifique o tipo de evidência mencionada (ex: 'RCT', 'cohort study', 'in vitro experiment', 'knock-in mice experiment').",
    
    "confidenceScore": "Sua confiança (Float de 0.0 a 1.0) de que a extração reflete acuradamente as afirmações do artigo.",
    
    "supportingQuote": "A frase ou sentença exata do texto que suporta esta extração."
  }
]
\`\`\`
`
  }
];



export const DEFAULT_JSON_DATA = `{
  "triplets": [
    {
      "s": { "label": "React Flow", "type": "library" },
      "p": "is used for",
      "o": { "label": "rendering graphs", "type": "task" }
    },
    {
      "s": { "label": "rendering graphs", "type": "task" },
      "p": "is achieved with",
      "o": { "label": "custom nodes", "type": "feature" }
    },
    {
      "s": { "label": "Dagre", "type": "library" },
      "p": "handles",
      "o": { "label": "automatic layout", "type": "task" }
    },
    {
      "s": { "label": "automatic layout", "type": "task" },
      "p": "improves",
      "o": { "label": "visualization", "type": "concept" }
    }
  ]
}`;

export const GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest'
];

export const LAYOUTS = {
  TB: 'layoutTB',
  BT: 'layoutBT',
  LR: 'layoutLR',
  RL: 'layoutRL',
  LR_CURVED: 'layoutLR_CURVED'
};

export const NODE_TYPE_COLORS: Record<string, string> = {
  default: 'bg-gray-700 border-gray-500',
  library: 'bg-sky-900 border-sky-600',
  task: 'bg-teal-900 border-teal-600',
  feature: 'bg-indigo-900 border-indigo-600',
  concept: 'bg-rose-900 border-rose-600',
  mainConcept: 'bg-amber-800 border-amber-600',
  riskFactor: 'bg-red-900 border-red-700',
  comorbidity: 'bg-orange-900 border-orange-700',
  mechanism: 'bg-cyan-900 border-cyan-700',
  insight: 'bg-fuchsia-900 border-fuchsia-700',
  comparison: 'bg-lime-900 border-lime-700',
  diagnostic: 'bg-blue-900 border-blue-700',
  detail: 'bg-stone-800 border-stone-600',
  treatment: 'bg-green-900 border-green-700',
  drug: 'bg-emerald-900 border-emerald-700',
  population: 'bg-purple-900 border-purple-700',
  statistic: 'bg-pink-900 border-pink-700',
  category: 'bg-slate-800 border-slate-600',
  keyConcept: 'bg-yellow-800 border-yellow-600',
  process: 'bg-cyan-800 border-cyan-600',
  property: 'bg-indigo-800 border-indigo-600',
  method: 'bg-teal-800 border-teal-600',
  finding: 'bg-fuchsia-800 border-fuchsia-600',
  implication: 'bg-rose-800 border-rose-600',
  example: 'bg-lime-800 border-lime-600',
  hypotheses: 'bg-blue-800 border-blue-600',
  propedeutics: 'bg-purple-800 border-purple-600',
  question: 'bg-pink-800 border-pink-600',
  symptom: 'bg-orange-800 border-orange-600',
  group: 'bg-gray-700/50 border-gray-500 border-dashed',
  agent: 'bg-sky-800 border-sky-600',
  affectedEntity: 'bg-teal-800 border-teal-600',
};

export const NODE_WIDTH = 200;
