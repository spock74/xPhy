# Xphy: Knowledge Graph Visualization & Causal Extraction Engine

**Xphy** (pronuncia-se _ex-phy_) é uma plataforma de desenvolvimento e visualização para a engenharia de conhecimento guiada por IA. A ferramenta foi projetada para transformar documentos não estruturados, como artigos científicos, em Grafos de Conhecimento (KGs) auditáveis e semanticamente ricos.

A aplicação integra um back-end de IA de ponta, construído com o SDK dos modelos da família **Gemini**, com uma interface interativa que permite a extração, visualização, validação e curação de relações causais e outras entidades semânticas.

_(**Nota:** Substitua este link de imagem pelo link real de uma captura de tela de alta qualidade da sua aplicação)._

## Visão Geral da Arquitetura

O Xphy não é apenas um "wrapper" para um LLM. É um ambiente de desenvolvimento integrado (IDE) para um fluxo de trabalho de IA Centrada em Dados (_Data-Centric AI_), baseado nos seguintes princípios:

1.  **Extração Guiada por Ontologia:** Em vez de confiar em prompts abertos e não estruturados, a extração de conhecimento é governada por um **prompt mestre** que é derivado de uma ontologia formal (neste caso, uma ontologia de relações causais). Isso força o LLM a operar dentro de um schema definido, garantindo consistência, reduzindo a ambiguidade e minimizando o risco de alucinações.

2.  **Saída Estruturada e Validável:** O sistema força o LLM a gerar sua saída em um formato JSON estrito, alinhado com a ontologia. Cada fato extraído (`CausalEvent`) é um objeto rico que contém não apenas a tríade (Agente, Relação, Entidade Afetada), mas também metadados cruciais como o mecanismo, o tipo de evidência e a citação textual que o suporta.

3.  **Rastreabilidade e Auditabilidade Interativa:** Acreditamos que a confiança em um sistema de IA não é negociável. O Xphy implementa a rastreabilidade como uma funcionalidade central: cada nó e aresta no grafo de conhecimento visualizado é diretamente vinculado à sua sentença de origem no documento fonte. Um clique em qualquer entidade no grafo leva o usuário instantaneamente à evidência textual, permitindo a validação e a curação humana em segundos.

4.  **Criação de um Ciclo Virtuoso (Flywheel):** A plataforma é projetada para ser mais do que uma ferramenta de extração; é um ambiente de curação. Ao permitir a verificação e correção dos KGs gerados pela IA, o Xphy se torna uma fábrica para a criação de "golden datasets", que podem ser usados para o fine-tuning de modelos de linguagem especializados, melhorando continuamente a precisão e a automação do sistema.

## Funcionalidades Principais

- **Motor de Extração com Genkit:** Utiliza ainda Gemini SDK js-genai. Porém, em breve estará usanso o framework [Genkit](https://github.com/firebase/genkit) do Google para orquestrar `Flows` de IA, garantindo observabilidade e escalabilidade.
- **Prompting Estruturado:** Suporte para modelos de prompt que forçam a saída em JSON, com base em ontologias e schemas Zod.
- **Visualização de Grafos Interativa:** Renderização em tempo real do JSON extraído como um grafo de conhecimento, com controles de layout e filtros.
- **Rastreabilidade "Click-to-Source":** Link direto entre cada entidade do grafo e sua citação no documento original, com destaque de texto.
- **Suporte a Múltiplos Modelos:** Facilmente configurável para usar os modelos mais recentes da família Gemini (e outros, via plugins do Genkit).

## Roadmap de Desenvolvimento

O Xphy é um projeto em evolução ativa. Nosso roadmap está focado em aprofundar as capacidades de curação e escalar a plataforma para aplicações de nível empresarial.

- [ ] **Fase 1: Aprimoramento da Curação e UX**

  - [ ] **Edição In-Grafo:** Implementar um overlay de edição contextual para nós e arestas, permitindo que curadores humanos corrijam extrações diretamente na interface visual.
  - [ ] **Versionamento de Correções:** Desenvolver um sistema de back-end que salva as correções como `diffs`, criando um histórico de auditoria completo para cada grafo de conhecimento.
  - [ ] **Visualização de Metadados:** Renderizar o `confidenceScore` visualmente no grafo (ex: através da cor da borda do nó) para guiar a atenção do revisor.
  - [ ] **Rótulos Inteligentes:** Usar o campo `normalizedLabel` para a exibição principal no grafo, mostrando o `label` completo em um tooltip para uma interface mais limpa.

- [ ] **Fase 2: Escalabilidade e Pipeline de Dados**

  - [ ] **Processamento em Lote:** Desenvolver uma funcionalidade para processar múltiplos documentos em uma única execução.
  - [ ] **Persistência em Banco de Dados de Grafos:** Criar conectores para inserir os KGs extraídos e curados em bancos de dados como Neo4j ou TigerGraph.
  - [ ] **API de Consulta de Grafos:** Expor uma API GraphQL ou REST para permitir que outras aplicações consultem o conhecimento persistido.

- [ ] **Fase 3: Inteligência Ativa e Graph RAG**
  - [ ] **Pipeline de Fine-Tuning:** Criar scripts para formatar os "golden datasets" (extrações corrigidas) para o fine-tuning de modelos Gemini.
  - [ ] **Mecanismo de Graph RAG:** Implementar um `Flow` que traduz uma pergunta em linguagem natural para uma consulta no grafo, recupera os fatos relevantes (incluindo as citações de suporte) e usa um LLM para sintetizar uma resposta auditável.
  - [ ] **Detecção de Anomalias:** Integrar um pipeline de embedding e clusterização para sinalizar extrações que são outliers estatísticos, servindo como um "sistema de alerta de novidade" para os curadores.

## Como Contribuir

Estamos abertos a contribuições da comunidade! Se você é um engenheiro de IA, desenvolvedor de front-end, ou um especialista de domínio interessado em engenharia de conhecimento, sua ajuda é bem-vinda.

1.  **Fork** este repositório.
2.  **Crie** uma nova branch para sua feature (`git checkout -b feature/minha-feature`).
3.  **Faça o commit** de suas mudanças (`git commit -m 'Adiciona minha-feature'`).
4.  **Faça o push** para a branch (`git push origin feature/minha-feature`).
5.  **Abra** um Pull Request.

Por favor, abra uma _issue_ para discutir mudanças significativas antes de iniciar o trabalho.

---

### Licença

Este projeto é licenciado sob a **Licença MIT**. Veja o arquivo `LICENSE` para mais detalhes.
