

export interface S_O_Node {
  label: string;
  type?: string;
}

export interface Triplet {
  s: S_O_Node;
  p: string;
  o?: S_O_Node | null;
  source_quote?: string;
  source_lines?: string;
}

export interface TripletJsonData {
  triplets: Triplet[];
}

export interface RelatedConcept {
  typ: 'prerequisite' | 'co-requisite' | 'application';
  c_id: string;
}

export interface KnowledgeNugget {
  nug: string;
  s_quo: string;
}

export interface KnowledgeBaseConcept {
  c_id: string;
  s_doc: string;
  c_con: string;
  k_nug: KnowledgeNugget[];
  p_misc: string[];
  b_lvl: string[];
  c_cplx?: 'Baixa' | 'Média' | 'Alta';
  c_rel?: 'Fundamental' | 'Importante' | 'Especializado';
  k_stab?: 'Estável' | 'Emergente';
  r_con: RelatedConcept[];
  m_prmpt: string[];
}

export interface KnowledgeBaseJsonData {
  kb: KnowledgeBaseConcept[];
}


export interface HistoryItem {
  id: string;
  filename: string;
  prompt: string;
  jsonString: string;
  timestamp: string;
}

export interface GraphNode {
    id: string;
    label: string;
    type: string;
    source_quote?: string;
    source_lines?: string;
    // Added to pass down to CustomNode for UI logic
    hasChildren?: boolean; 
    layoutDirection?: string;
    isCollapsed?: boolean;
    onToggle?: (id: string) => void;
    onTrace?: (nodeData: GraphNode) => void;
    onUngroup?: (id: string) => void;
    ungroupLabel?: string;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    strength?: 'forte' | 'moderada' | 'fraca';
    nature?: 'positiva' | 'negativa' | 'neutra';
}

export interface GraphResult {
    title?: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface GraphJsonData {
    result: GraphResult;
}


// Types for flexible causal event schema
export interface CajalEntity {
  label: string;
  normalizedLabel: string;
  ontologyID?: string;
}

export interface CajalEvent {
  hasAgent: CajalEntity;
  hasAffectedEntity: CajalEntity;
  hasCausalRelationship: string;
  relationQualifier: 'explicitly causal' | 'strongly implied causal' | 'weakly implied causal' | 'correlational';
  CausalMechanism: string;
  hasEvidence: string;
  confidenceScore: number;
  supportingQuote: string;
  source_lines?: string;
}

export type CajalData = CajalEvent[];
