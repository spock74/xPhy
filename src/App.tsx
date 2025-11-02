import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  Position,
  NodeMouseHandler,
  ReactFlowInstance,
} from 'reactflow';
import { ZodError } from 'zod';
import { pdfjs } from 'react-pdf';

// import * as pdfjsLib from 'pdfjs-dist';
// The worker is configured globally in index.tsx. No setup is needed here.

import { getLayoutedElements } from './utils/layout';
import { TripletJsonDataSchema, KnowledgeBaseJsonDataSchema, GraphJsonDataSchema, CajalDataSchema } from './utils/schema';
import { TripletJsonData, KnowledgeBaseJsonData, Triplet, HistoryItem, KnowledgeBaseConcept, GraphJsonData, GraphNode, GraphEdge, CajalEvent } from './types';
import { DEFAULT_JSON_DATA, GEMINI_MODELS, NODE_TYPE_COLORS, LAYOUTS, PROMPT_TEMPLATES, NODE_WIDTH } from './constants';
import { CustomNode } from './components/CustomNode';
// Fix: The PdfViewer component was not imported, causing a reference error. This has been fixed by uncommenting the import statement.
import { PdfViewer } from './components/PdfViewer';
import { useI18n } from './i18n';
import { breakCycles } from './utils/graph';
import { preprocessText, parseLineNumbers } from './utils/text';
import { extractJsonFromString } from './utils/json';


const readFileContent = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (!event.target?.result) {
          return reject(new Error("Failed to read file."));
        }
        if (file.type === 'application/pdf') {
          // Use o 'pdfjs' importado de 'react-pdf', não o 'pdfjsLib'
          const pdf = await pdfjs.getDocument(event.target.result as ArrayBuffer).promise;
          let textContent = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map((s: any) => s.str).join(' ');
          }
          resolve(textContent);
        } else {
          resolve(event.target.result as string);
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);

    if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
};

const transformKbToTriplets = (data: KnowledgeBaseJsonData): TripletJsonData => {
    const triplets: Triplet[] = [];
    const conceptMap = new Map<string, KnowledgeBaseConcept>(data.kb.map(c => [c.c_id, c]));

    for (const concept of data.kb) {
        if (concept.r_con) {
            for (const relation of concept.r_con) {
                const targetConcept = conceptMap.get(relation.c_id);
                if (targetConcept) {
                    const newTriplet: Triplet = {
                        s: {
                            label: concept.c_con,
                            type: concept.c_rel,
                        },
                        p: relation.typ,
                        o: {
                            label: targetConcept.c_con,
                            type: targetConcept.c_rel,
                        },
                        source_quote: concept.k_nug?.[0]?.s_quo || 'Source from KB', 
                        source_lines: 'Linhas: N/A',
                    };
                    triplets.push(newTriplet);
                }
            }
        }
    }
    return { triplets };
};

const nodeTypes = {
  custom: CustomNode,
};

const HamburgerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);


const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const getEdgeStyle = (edge: Partial<GraphEdge>) => {
    const styles: React.CSSProperties = {
        stroke: '#A0AEC0',
        strokeWidth: 2,
        strokeDasharray: 'none',
    };

    // Color based on nature
    if (edge.nature === 'positiva') {
        styles.stroke = '#48BB78'; // green
    } else if (edge.nature === 'negativa') {
        styles.stroke = '#F56565'; // red
    }

    // Thickness and style based on strength
    if (edge.strength === 'forte') {
        styles.strokeWidth = 3;
    } else if (edge.strength === 'fraca') {
        styles.strokeWidth = 1;
        styles.strokeDasharray = '5 5';
    }
    
    return styles;
};

const EdgeLegend: React.FC = () => {
    const { t } = useI18n();

    const legendItems = [
        { label: t('positiveStrong'), color: '#48BB78', width: 3, dash: 'none' },
        { label: t('positiveModerate'), color: '#48BB78', width: 2, dash: 'none' },
        { label: t('positiveWeak'), color: '#48BB78', width: 1, dash: '5 5' },
        { label: t('negativeStrong'), color: '#F56565', width: 3, dash: 'none' },
        { label: t('negativeModerate'), color: '#F56565', width: 2, dash: 'none' },
        { label: t('negativeWeak'), color: '#F56565', width: 1, dash: '5 5' },
        { label: t('neutral'), color: '#A0AEC0', width: 2, dash: 'none' },
    ];

    return (
        <div className="absolute bottom-4 right-4 bg-gray-900/80 p-3 rounded-lg border border-gray-700 text-white text-xs z-10 w-48">
            <h3 className="font-bold mb-2 text-center text-gray-300">{t('edgeLegendTitle')}</h3>
            <div className="space-y-2">
                {legendItems.map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                        <svg width="30" height="10" viewBox="0 0 30 10">
                            <line
                                x1="0"
                                y1="5"
                                x2="30"
                                y2="5"
                                stroke={item.color}
                                strokeWidth={item.width}
                                strokeDasharray={item.dash}
                            />
                        </svg>
                        <span className="text-gray-400">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ScaffoldedControlPanel: React.FC<{ tabName: string }> = ({ tabName }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'generate' | 'manual' | 'history'>('generate');
  const availablePrompts = useMemo(() => PROMPT_TEMPLATES, []);
  
  const handleScaffoldAction = (action: string) => {
    console.log(`Action triggered in '${tabName}' tab: ${action}`);
  };

  return (
    <>
      <div className="flex border-b border-gray-700 mb-4 sticky top-0 bg-gray-900">
          { (['generate', 'manual', 'history'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`capitalize text-sm font-medium py-2 px-4 border-b-2 transition-colors duration-200 ${activeTab === tab ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
                  {t(`${tab}Tab`)}
              </button>
          ))}
      </div>

      <div className="flex-grow flex flex-col min-h-0">
        {activeTab === 'generate' && (
           <div className="flex flex-col gap-4 flex-grow">
              <div>
                <label htmlFor="model-select-scaffold" className="text-sm font-medium text-gray-300 mb-2 block">
                  {t('modelLabel')}
                </label>
                <select id="model-select-scaffold" value={GEMINI_MODELS[1]} disabled className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 disabled:opacity-50">
                  {GEMINI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-not-allowed opacity-50" title={t('flexibleSchemaDescription')}>
                  <input type="checkbox" disabled className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 rounded text-cyan-500 focus:ring-cyan-600 transition-colors" />
                  {t('flexibleSchemaLabel')}
                </label>
              </div>

              <div>
                <label htmlFor="max-concepts-input-scaffold" className="text-sm font-medium text-gray-300 mb-2 block">
                  {t('maxConceptsLabel')}
                </label>
                <input id="max-concepts-input-scaffold" type="number" value={10} disabled className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 disabled:opacity-50" />
              </div>
            
              <div>
                  <label htmlFor="file-upload-scaffold" className="text-sm font-medium text-gray-300 mb-2 block">
                      {t('uploadLabel')}
                  </label>
                  <button disabled className="w-full text-sm p-3 bg-gray-800 border border-dashed border-gray-600 rounded-md text-gray-400 disabled:opacity-50 cursor-not-allowed">
                      {t('selectFileButton')}
                  </button>
              </div>

              <div>
                  <label htmlFor="prompt-select-scaffold" className="text-sm font-medium text-gray-300 mb-2 block">
                      {t('selectPromptLabel')}
                  </label>
                  <select id="prompt-select-scaffold" defaultValue="" disabled className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 disabled:opacity-50">
                      <option value="">{t('selectPromptPlaceholder')}</option>
                      {availablePrompts.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                  </select>
              </div>

              <div className="flex flex-col flex-grow">
                  <label htmlFor="prompt-input-scaffold" className="text-sm font-medium text-gray-300 mb-2">
                      {t('promptLabel')}
                  </label>
                  <textarea id="prompt-input-scaffold" disabled className="w-full flex-grow p-3 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 disabled:opacity-50" placeholder={t('promptPlaceholder')} />
              </div>
              
              <button onClick={() => handleScaffoldAction('Generate with AI')} className="mt-auto w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                  {t('generateWithAIButton')}
              </button>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="flex flex-col gap-4 flex-grow">
              <div className="flex-grow flex flex-col">
                  <label htmlFor="json-input-scaffold" className="text-sm font-medium text-gray-300 mb-2">
                      {t('pasteJsonLabel')}
                  </label>
                  <textarea id="json-input-scaffold" disabled className="w-full flex-grow p-3 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 disabled:opacity-50" placeholder="Enter JSON data..." />
              </div>
              <button onClick={() => handleScaffoldAction('Generate Graph')} className="mt-auto w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                  {t('generateGraphButton')}
              </button>
          </div>
        )}
          
        {activeTab === 'history' && (
           <div className="flex flex-col gap-2 flex-grow">
              <p className="text-gray-500 text-sm text-center mt-4">{t('historyEmpty')}</p>
          </div>
        )}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-700">
          <h2 className="text-sm font-medium text-gray-300 mb-3">{t('layoutDirectionTitle')}</h2>
          <div className="grid grid-cols-2 gap-2">
              {(Object.keys(LAYOUTS) as Array<keyof typeof LAYOUTS>).map((dir) => (
                  <button
                      key={dir}
                      onClick={() => handleScaffoldAction(`Set layout to ${dir}`)}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors duration-200 bg-gray-700 hover:bg-gray-600 text-gray-300`}
                  >
                      {t(LAYOUTS[dir])}
                  </button>
              ))}
          </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-700">
          <h2 className="text-sm font-medium text-gray-300 mb-3">{t('filtersTitle')}</h2>
          <div className="flex flex-col gap-4">
              <input type="text" placeholder={t('filterByLabelPlaceholder')} disabled className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm disabled:opacity-50" />
              <input type="text" placeholder={t('filterByEdgeLabelPlaceholder')} disabled className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm disabled:opacity-50" />
              <div className="grid grid-cols-2 gap-2 text-sm opacity-50">
                  <label className="flex items-center gap-2 text-gray-300 cursor-not-allowed">
                      <input type="checkbox" disabled className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 rounded text-cyan-500" />
                      <span className="capitalize">riskFactor</span>
                  </label>
                  <label className="flex items-center gap-2 text-gray-300 cursor-not-allowed">
                      <input type="checkbox" disabled className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 rounded text-cyan-500" />
                      <span className="capitalize">treatment</span>
                  </label>
              </div>
              <button
                  onClick={() => handleScaffoldAction('Clear Filters')}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                  {t('clearFiltersButton')}
              </button>
          </div>
      </div>
    </>
  );
};

const BrazilFlagIcon: React.FC = () => (
    <svg width="24" height="18" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="22" height="15" rx="2" fill="#009B3A"/>
        <path d="M11 2L20 7.5L11 13L2 7.5L11 2Z" fill="#FFCC29"/>
        <circle cx="11" cy="7.5" r="3" fill="#002776"/>
    </svg>
);

const USFlagIcon: React.FC = () => (
    <svg width="24" height="18" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="22" height="15" rx="2" fill="#FFFFFF"/>
        <path d="M0 2C0 0.895431 0.895431 0 2 0H20C21.1046 0 22 0.895431 22 2V13C22 14.1046 21.1046 15 20 15H2C0.895431 15 0 14.1046 0 13V2Z" fill="#B31942"/>
        <path d="M0 2.5H22V4.5H0V2.5Z" fill="#FFFFFF"/>
        <path d="M0 7.5H22V9.5H0V7.5Z" fill="#FFFFFF"/>
        <path d="M0 12.5H22V14.5H0V12.5Z" fill="#FFFFFF"/>
        <path d="M0 2C0 0.895431 0.895431 0 2 0H10V7.5H0V2Z" fill="#0A3161"/>
    </svg>
);

const ChevronDownIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);


const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);
const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);

const PDF_DRAWER_WIDTH = '60vw';

function App() {
  const { t, language, setLanguage } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layout, setLayout] = useState<string>('LR_CURVED');

  const [jsonInput, setJsonInput] = useState<string>(DEFAULT_JSON_DATA);
  const [aiJsonOutput, setAiJsonOutput] = useState<string>('');
  const [graphElements, setGraphElements] = useState<{ nodes: Node<GraphNode>[], edges: Edge[] } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'manual' | 'history'>('generate');
  const [mainTab, setMainTab] = useState<'graph' | 'causal' | 'testes'>('graph');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  const [labelFilter, setLabelFilter] = useState<string>('');
  const [edgeLabelFilter, setEdgeLabelFilter] = useState<string>('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [selectedNodeIdsForActions, setSelectedNodeIdsForActions] = useState<string[]>([]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [activeTrace, setActiveTrace] = useState<GraphNode | null>(null);
  const [preprocessedText, setPreprocessedText] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  
  const [isControlDrawerOpen, setIsControlDrawerOpen] = useState(true);
  const [isPdfDrawerOpen, setIsPdfDrawerOpen] = useState(false);
  
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isTraceInfoPanelOpen, setIsTraceInfoPanelOpen] = useState(false);

  const pdfDrawerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({ isDragging: false, startX: 0, startTranslateX: 0 });

  const handlePdfDrawerDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      dragInfo.current = {
          isDragging: true,
          startX: e.clientX,
          startTranslateX: 0, // We assume it starts fully open (translateX=0)
      };
      if (pdfDrawerRef.current) {
          pdfDrawerRef.current.style.transition = 'none'; // Disable transition for smooth dragging
      }
      window.addEventListener('mousemove', handlePdfDrawerDragMove);
      window.addEventListener('mouseup', handlePdfDrawerDragEnd);
  }, []);

  const handlePdfDrawerDragMove = useCallback((e: MouseEvent) => {
      if (!dragInfo.current.isDragging || !pdfDrawerRef.current) return;
      
      const deltaX = e.clientX - dragInfo.current.startX;
      const newTranslateX = Math.max(0, dragInfo.current.startTranslateX + deltaX); // Only allow dragging to the right (to close)
      
      pdfDrawerRef.current.style.transform = `translateX(${newTranslateX}px)`;
  }, []);

  const handlePdfDrawerDragEnd = useCallback((e: MouseEvent) => {
      if (!dragInfo.current.isDragging || !pdfDrawerRef.current) return;

      dragInfo.current.isDragging = false;
      window.removeEventListener('mousemove', handlePdfDrawerDragMove);
      window.removeEventListener('mouseup', handlePdfDrawerDragEnd);

      const drawerWidth = pdfDrawerRef.current.offsetWidth;
      const currentTranslateX = new DOMMatrix(getComputedStyle(pdfDrawerRef.current).transform).m41;
      
      pdfDrawerRef.current.style.transition = 'transform 0.3s ease-in-out';

      // If dragged more than 1/3 of the way, close it. Otherwise, snap back open.
      if (currentTranslateX > drawerWidth / 3) {
          setIsPdfDrawerOpen(false);
      } else {
          pdfDrawerRef.current.style.transform = `translateX(0px)`;
      }
  }, []);


  const availableTypes = useMemo(() => {
    if (!graphElements?.nodes) return [];
    const types = new Set<string>();
    graphElements.nodes.forEach(node => {
        if (node.data.type) {
            types.add(node.data.type);
        }
    });
    return Array.from(types).sort();
  }, [graphElements]);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [model, setModel] = useState<string>(GEMINI_MODELS[1]);
  const [maxConcepts, setMaxConcepts] = useState<number>(10);
  const generationCancelledRef = useRef<boolean>(false);
  const availablePrompts = useMemo(() => PROMPT_TEMPLATES, []);
  const [useFlexibleSchema, setUseFlexibleSchema] = useState<boolean>(false);
  
  const toggleLanguage = () => setLanguage(language === 'pt' ? 'en' : 'pt');

  const generateJsonFromText = useCallback(async (finalPrompt: string, selectedModel: string, isFlexible: boolean): Promise<string> => {
    if (!import.meta.env.VITE_API_KEY) {
        throw new Error("API key is missing. Please ensure it is set as VITE_API_KEY in your environment variables.");
    }
    
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

    const config = isFlexible ? {} : { responseMimeType: "application/json" as const };

    const response = await ai.models.generateContent({
        model: selectedModel,
        contents: finalPrompt,
        config: config,
    });

    if (response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
        throw new Error(`Generation stopped for reason: ${response.candidates[0].finishReason}. Prompt feedback: ${JSON.stringify(response.promptFeedback)}`);
    }

    if (!response.text) {
        throw new Error("The AI returned an empty response. This could be due to a content safety filter. Check the prompt feedback in the error details.");
    }

    return response.text;
  }, []);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('graphHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to parse history from localStorage", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('graphHistory', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  }, [history]);
  
  const getAllDescendants = useCallback((nodeId: string, allEdges: Edge[]): Set<string> => {
    const descendants = new Set<string>();
    const queue: string[] = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const children = allEdges.filter(edge => edge.source === currentId).map(edge => edge.target);
      
      for (const childId of children) {
        if (!descendants.has(childId)) {
          descendants.add(childId);
          queue.push(childId);
        }
      }
    }
    return descendants;
  }, []);

  const baseGraphElements = useMemo(() => {
    if (!graphElements) {
        return { nodes: [], edges: [] };
    }

    const hasActiveFilters = labelFilter.trim() !== '' || typeFilters.size > 0 || edgeLabelFilter.trim() !== '';

    const filteredNodesSource = hasActiveFilters
        ? graphElements.nodes.filter(node => {
            const labelMatch = labelFilter.trim() === '' || node.data.label.toLowerCase().includes(labelFilter.trim().toLowerCase());
            const typeMatch = typeFilters.size === 0 || typeFilters.has(node.data.type);
            return labelMatch && typeMatch;
        })
        : graphElements.nodes;

    const visibleNodeIds = new Set(filteredNodesSource.map(n => n.id));

    const filteredEdgesSource = hasActiveFilters
        ? graphElements.edges.filter(edge => {
            const edgeLabelMatch = edgeLabelFilter.trim() === '' || (edge.label && typeof edge.label === 'string' && edge.label.toLowerCase().includes(edgeLabelFilter.trim().toLowerCase()));
            return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target) && edgeLabelMatch;
        })
        : graphElements.edges;

    const nodesInVisibleEdges = new Set<string>();
    filteredEdgesSource.forEach(edge => {
        nodesInVisibleEdges.add(edge.source);
        nodesInVisibleEdges.add(edge.target);
    });

    const intermediateNodes = edgeLabelFilter.trim() !== ''
        ? filteredNodesSource.filter(node => nodesInVisibleEdges.has(node.id))
        : filteredNodesSource;

    const hiddenByCollapse = new Set<string>();
    collapsedNodeIds.forEach(collapsedId => {
        const descendants = getAllDescendants(collapsedId, graphElements.edges);
        descendants.forEach(id => hiddenByCollapse.add(id));
    });

    const finalFilteredNodes = intermediateNodes.filter(node => !hiddenByCollapse.has(node.id));
    
    const finalVisibleNodeIds = new Set(finalFilteredNodes.map(n => n.id));
    const finalFilteredEdges = filteredEdgesSource.filter(
        edge => finalVisibleNodeIds.has(edge.source) && finalVisibleNodeIds.has(edge.target)
    );

    if (finalFilteredNodes.length === 0 && (hasActiveFilters || collapsedNodeIds.size > 0)) {
        return { nodes: [], edges: [] };
    }

    return { nodes: finalFilteredNodes, edges: finalFilteredEdges };

  }, [graphElements, labelFilter, typeFilters, edgeLabelFilter, collapsedNodeIds, getAllDescendants]);
  
  const displayedGraphElements = useMemo(() => {
    const { nodes: baseNodes, edges: baseEdges } = baseGraphElements;

    if (!hoveredNode) {
        return { nodes: baseNodes, edges: baseEdges };
    }

    const neighborIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();

    graphElements?.edges.forEach(edge => {
        if (edge.source === hoveredNode) {
            neighborIds.add(edge.target);
            highlightedEdgeIds.add(edge.id);
        } else if (edge.target === hoveredNode) {
            neighborIds.add(edge.source);
            highlightedEdgeIds.add(edge.id);
        }
    });

    const displayedNodes = baseNodes.map(n => {
        const isHovered = n.id === hoveredNode;
        const isNeighbor = neighborIds.has(n.id);
        const isDimmed = !isHovered && !isNeighbor;
        
        return {
            ...n,
            className: `${n.className || ''} ${isDimmed ? 'opacity-20' : ''} ${isHovered ? 'border-cyan-400' : ''} ${isNeighbor ? 'border-white' : ''} transition-all duration-300`,
            data: {
                ...n.data,
                isDimmed,
            }
        };
    });

    const displayedEdges = baseEdges.map(e => {
        const isHighlighted = highlightedEdgeIds.has(e.id);
        return {
            ...e,
            style: {
                ...e.style,
                opacity: isHighlighted ? 1 : 0.2,
                strokeWidth: isHighlighted ? 3 : e.style?.strokeWidth,
            },
            className: 'transition-all duration-300',
        };
    });

    return { nodes: displayedNodes, edges: displayedEdges };

  }, [baseGraphElements, hoveredNode, graphElements]);


  useEffect(() => {
    if (baseGraphElements.nodes.length === 0 && (labelFilter.trim() !== '' || typeFilters.size > 0 || edgeLabelFilter.trim() !== '' || collapsedNodeIds.size > 0)) {
        setNodes([]);
        setEdges([]);
        return;
    }

    if (baseGraphElements.nodes.length > 0) {
        setIsLoading(true);
        setLoadingMessage('loadingMessageApplyingFilters');

        const direction = layout.startsWith('LR') ? 'LR' : layout.startsWith('RL') ? 'RL' : layout.startsWith('BT') ? 'BT' : 'TB';
        
        const copiedNodes = JSON.parse(JSON.stringify(displayedGraphElements.nodes));
        const copiedEdges = JSON.parse(JSON.stringify(displayedGraphElements.edges));
        
        const nodesWithLayoutData = copiedNodes.map((node: Node<GraphNode>) => ({
            ...node,
            data: { 
                ...node.data,
                layoutDirection: direction,
                isCollapsed: collapsedNodeIds.has(node.id),
                onToggle: handleNodeToggle,
                onTrace: handleNodeTrace,
                onUngroup: handleUngroupNode,
                ungroupLabel: t('ungroupButton'),
            }
        }));
        
        const edgesWithUpdatedType = copiedEdges.map((edge: Edge) => ({
            ...edge,
            type: layout === 'LR_CURVED' ? 'default' : 'smoothstep',
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodesWithLayoutData,
            edgesWithUpdatedType,
            direction
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [displayedGraphElements, layout, setNodes, setEdges, collapsedNodeIds, t]);
    
  const processTriplets = (data: TripletJsonData): { nodes: Node<GraphNode>[], edges: Edge[] } => {
    const triplets = data.triplets;
    const nodeMap = new Map<string, Node<GraphNode>>();
    const initialEdges: Edge[] = [];

    triplets.forEach((triplet: Triplet, index: number) => {
        if (triplet.s?.label && !nodeMap.has(triplet.s.label)) {
            nodeMap.set(triplet.s.label, {
                id: triplet.s.label,
                type: 'custom',
                data: { 
                  id: triplet.s.label,
                  label: triplet.s.label, 
                  type: triplet.s.type || 'default', 
                  source_quote: triplet.source_quote,
                  source_lines: triplet.source_lines,
                },
                position: { x: 0, y: 0 },
            });
        }
        if (triplet.o?.label && !nodeMap.has(triplet.o.label)) {
            nodeMap.set(triplet.o.label, {
                id: triplet.o.label,
                type: 'custom',
                data: { 
                  id: triplet.o.label,
                  label: triplet.o.label, 
                  type: triplet.o.type || 'default', 
                  source_quote: triplet.source_quote,
                  source_lines: triplet.source_lines,
                },
                position: { x: 0, y: 0 },
            });
        }
        if (triplet.s?.label && triplet.o?.label && triplet.p) {
            const edgeStyle = getEdgeStyle({});
            initialEdges.push({
                id: `e-${index}-${triplet.s.label}-${triplet.o.label}`,
                source: triplet.s.label,
                target: triplet.o.label,
                label: triplet.p,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle.stroke as string },
                style: edgeStyle,
                labelStyle: { fill: '#E2E8F0', fontSize: 12 },
                labelBgStyle: { fill: '#2D3748' },
            });
        }
    });
    
    const sourceIds = new Set(initialEdges.map(e => e.source));
    const nodes = Array.from(nodeMap.values()).map(node => ({
      ...node,
      data: {
        ...node.data,
        hasChildren: sourceIds.has(node.id),
      },
    }));

    const edges = breakCycles(nodes, initialEdges);

    return { nodes, edges };
  };

  const processGraphData = (data: GraphJsonData): { nodes: Node<GraphNode>[], edges: Edge[] } => {
    const initialNodesSource: Node<GraphNode>[] = data.result.nodes.map(node => ({
        id: node.id,
        type: 'custom',
        data: { 
          id: node.id,
          label: node.label, 
          type: node.type || 'default', 
          source_quote: node.source_quote,
          source_lines: node.source_lines,
        },
        position: { x: 0, y: 0 },
    }));

    const initialEdges: Edge[] = data.result.edges.map(edge => {
        const edgeStyle = getEdgeStyle(edge);
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle.stroke as string },
            style: edgeStyle,
            labelStyle: { fill: '#E2E8F0', fontSize: 12 },
            labelBgStyle: { fill: '#2D3748' },
        };
    });
    
    const sourceIds = new Set(initialEdges.map(e => e.source));
    const initialNodes = initialNodesSource.map(node => ({
        ...node,
        data: {
            ...node.data,
            hasChildren: sourceIds.has(node.id),
        },
    }));

    const edges = breakCycles(initialNodes, initialEdges);

    return { nodes: initialNodes, edges };
  };
    
  const processCajalData = useCallback((data: CajalEvent[]): { nodes: Node<GraphNode>[], edges: Edge[] } => {
    const nodeMap = new Map<string, Node<GraphNode>>();
    const initialEdges: Edge[] = [];

    data.forEach((event, index) => {
        const agent = event.hasAgent;
        const affected = event.hasAffectedEntity;

        if (agent.label && !nodeMap.has(agent.label)) {
            nodeMap.set(agent.label, {
                id: agent.label,
                type: 'custom',
                data: {
                    id: agent.label,
                    label: agent.label,
                    type: 'agent',
                    source_quote: event.supportingQuote,
                    source_lines: event.source_lines || 'N/A',
                },
                position: { x: 0, y: 0 },
            });
        }
        if (affected.label && !nodeMap.has(affected.label)) {
            nodeMap.set(affected.label, {
                id: affected.label,
                type: 'custom',
                data: {
                    id: affected.label,
                    label: affected.label,
                    type: 'affectedEntity',
                    source_quote: event.supportingQuote,
                    source_lines: event.source_lines || 'N/A',
                },
                position: { x: 0, y: 0 },
            });
        }

        if (agent.label && affected.label) {
            let strength: 'forte' | 'moderada' | 'fraca' = 'moderada';
            if (event.relationQualifier === 'explicitly causal' || event.relationQualifier === 'strongly implied causal') strength = 'forte';
            else if (event.relationQualifier === 'weakly implied causal') strength = 'fraca';

            let nature: 'positiva' | 'negativa' | 'neutra' = 'neutra';
            const rel = event.hasCausalRelationship.toLowerCase();
            if (rel.includes('increase') || rel.includes('promote') || rel.includes('cause')) nature = 'positiva';
            else if (rel.includes('decrease') || rel.includes('inhibit') || rel.includes('prevent')) nature = 'negativa';

            const edgeStyle = getEdgeStyle({ strength, nature });

            initialEdges.push({
                id: `e-${index}-${agent.label}-${affected.label}`,
                source: agent.label,
                target: affected.label,
                label: event.hasCausalRelationship.replace('cajal:', ''),
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle.stroke as string },
                style: edgeStyle,
                labelStyle: { fill: '#E2E8F0', fontSize: 12 },
                labelBgStyle: { fill: '#2D3748' },
            });
        }
    });
    
    const sourceIds = new Set(initialEdges.map(e => e.source));
    const nodes = Array.from(nodeMap.values()).map(node => ({
      ...node,
      data: {
        ...node.data,
        hasChildren: sourceIds.has(node.id),
      },
    }));

    const edges = breakCycles(nodes, initialEdges);
    return { nodes, edges };
  }, []);

  const processJsonAndSetGraph = useCallback((jsonString: string, options: { preservePreprocessedText?: boolean } = {}): string | null => {
    setError(null);
    setGraphElements(null);
    if (!options.preservePreprocessedText) {
      setPreprocessedText(null);
      setPdfFile(null);
    }
    try {
      const cleanJsonString = extractJsonFromString(jsonString);
      
      let parsedJson = JSON.parse(cleanJsonString);
      let finalJsonToStore = cleanJsonString;
      let processed = false;
      
      // Try parsing as CajalData first if it's an array
      if (Array.isArray(parsedJson)) {
          try {
              const cajalData = CajalDataSchema.parse(parsedJson);
              const { nodes, edges } = processCajalData(cajalData);
              setGraphElements({ nodes, edges });
              finalJsonToStore = JSON.stringify(cajalData, null, 2);
              processed = true;
          } catch (zodError) {
              // Not a valid Cajal array, assume it's the old triplet array format.
              parsedJson = { triplets: parsedJson };
              finalJsonToStore = JSON.stringify(parsedJson, null, 2);
          }
      } else if (parsedJson.causalEvents && Array.isArray(parsedJson.causalEvents)) {
          try {
              const cajalData = CajalDataSchema.parse(parsedJson.causalEvents);
              const { nodes, edges } = processCajalData(cajalData);
              setGraphElements({ nodes, edges });
              finalJsonToStore = JSON.stringify(cajalData, null, 2);
              processed = true;
          } catch (zodError) {
             // It has the key but doesn't match the schema, fall through.
          }
      }

      if (!processed) {
        if ('result' in parsedJson) {

          const nodeIds = new Set(parsedJson.result.nodes.map((n: {id: string}) => n.id));
          parsedJson.result.edges = parsedJson.result.edges.filter((e: {source: string, target: string}) =>
              e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target)
          );
          // Add a default title if it's missing
          if (!parsedJson.result.title) {
            parsedJson.result.title = 'Generated Graph';
          }
          const graphData = GraphJsonDataSchema.parse(parsedJson);
          const { nodes, edges } = processGraphData(graphData);
          setGraphElements({ nodes, edges });
        } else if ('kb' in parsedJson) {
          const kbData: any = KnowledgeBaseJsonDataSchema.parse(parsedJson);
          const tripletData = transformKbToTriplets(kbData);
          const { nodes, edges } = processTriplets(tripletData);
          setGraphElements({ nodes, edges });
          finalJsonToStore = JSON.stringify(tripletData, null, 2);
        } else if ('triplets' in parsedJson) {
          const tripletData = TripletJsonDataSchema.parse(parsedJson);
          const { nodes, edges } = processTriplets(tripletData);
          setGraphElements({ nodes, edges });
          finalJsonToStore = JSON.stringify(tripletData, null, 2);
        } else {
          throw new Error("Invalid JSON structure. The root key must be 'result', 'triplets', or 'kb', or an array of Causal Events.");
        }
      }
      
      setLabelFilter('');
      setEdgeLabelFilter('');
      setTypeFilters(new Set());
      setSelectedNodeIdsForActions([]);
      setCollapsedNodeIds(new Set());
      setActiveTrace(null);
      return finalJsonToStore;
    } catch (e) {
      let errorMessage = 'An unknown error occurred.';
      if (e instanceof ZodError) {
        const formattedErrors = e.issues.map(err => `At '${err.path.join('.')}': ${err.message}`).join('\n');
        errorMessage = t('errorJsonValidation', { errors: formattedErrors });
      } else if (e instanceof SyntaxError) {
        errorMessage = t('errorInvalidJson', { error: e.message });
      } else if (e instanceof Error) {
        errorMessage = e.message;
      }
      setError(errorMessage);
      setIsLoading(false);
      setLoadingMessage('');
      return null;
    }
  }, [t, processCajalData]);

  const handleGenerateGraphFromJson = useCallback(() => {
    if (isLoading || !jsonInput.trim()) return;
    const finalJsonString = processJsonAndSetGraph(jsonInput);
    if (finalJsonString) {
        setJsonInput(finalJsonString);
        setAiJsonOutput(finalJsonString);
    }
  }, [isLoading, jsonInput, processJsonAndSetGraph]);
  
  const canCollapseSelected = useMemo(() => {
    if (!graphElements || selectedNodeIdsForActions.length === 0) return false;
    return selectedNodeIdsForActions.some(id => {
        const node = graphElements.nodes.find(n => n.id === id);
        return node?.data.hasChildren;
    });
  }, [selectedNodeIdsForActions, graphElements]);

  const canExpandSelected = useMemo(() => {
    if (selectedNodeIdsForActions.length === 0 || collapsedNodeIds.size === 0) return false;
    return selectedNodeIdsForActions.some(id => collapsedNodeIds.has(id));
  }, [selectedNodeIdsForActions, collapsedNodeIds]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        setIsPdfDrawerOpen(true);
    } else {
        setPdfFile(null);
    }
  };

  const handleFileGenerate = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setError(null);
    setAiJsonOutput('');
    generationCancelledRef.current = false;

    try {
      setLoadingMessage("loadingMessageReadingFile");
      const fileContent = await readFileContent(selectedFile);
      const processedContent = preprocessText(fileContent);
      setPreprocessedText(processedContent);
      
      if (generationCancelledRef.current) return;
      
      setLoadingMessage("loadingMessageGenerating");
      const finalPrompt = prompt
        .replace('{TEXTO_DE_ENTRADA}', processedContent)
        .replace('{TEXTOS_INTEGRAIS_DOS_ARTIGOS}', processedContent)
        .replace('{MAX_CONCEITOS}', String(maxConcepts))
        .replace('{{article_text}}', processedContent);
        
      const rawAiResponse = await generateJsonFromText(finalPrompt, model, useFlexibleSchema);
      
      if (generationCancelledRef.current) return;
      
      setLoadingMessage("loadingMessageProcessing");
      const finalJsonString = processJsonAndSetGraph(rawAiResponse, { preservePreprocessedText: true });

      if (finalJsonString) {
        setAiJsonOutput(finalJsonString);
        const newHistoryItem: HistoryItem = {
          id: `hist-${Date.now()}`,
          filename: selectedFile.name,
          prompt: prompt,
          jsonString: finalJsonString,
          timestamp: new Date().toISOString(),
        };
        setHistory(prev => [newHistoryItem, ...prev]);
        setJsonInput(finalJsonString);
      } else {
        // If processing failed, show the raw response for debugging.
        setAiJsonOutput(rawAiResponse);
      }
    } catch (e) {
      if (generationCancelledRef.current) {
        setError(t('errorGenerationCancelled'));
      } else {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setError(t('errorGenerationFailed', { error: errorMessage }));
      }
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };
  
  const handleStopGenerating = () => {
    generationCancelledRef.current = true;
    setIsLoading(false);
    setLoadingMessage('');
    setError(t('errorGenerationCancelled'));
  };

  const handleSelectHistoryItem = useCallback((item: HistoryItem) => {
    setJsonInput(item.jsonString);
    setAiJsonOutput(item.jsonString);
    processJsonAndSetGraph(item.jsonString);
    setActiveTab('manual');
  }, [processJsonAndSetGraph]);

  const handleDeleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);
  
  const handleTypeFilterChange = useCallback((type: string) => {
    setTypeFilters(prev => {
        const newSet = new Set(prev);
        if (newSet.has(type)) {
            newSet.delete(type);
        } else {
            newSet.add(type);
        }
        return newSet;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
      setLabelFilter('');
      setEdgeLabelFilter('');
      setTypeFilters(new Set());
      setSelectedNodeIdsForActions([]);
      setCollapsedNodeIds(new Set());
  }, []);

  const handleSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNodeIdsForActions(nodes.map(n => n.id));
  }, []);

  const handleDeleteSelectedNodes = useCallback(() => {
      if (!graphElements) return;

      const selectedIdsSet = new Set(selectedNodeIdsForActions);

      const remainingNodes = graphElements.nodes.filter(n => !selectedIdsSet.has(n.id));
      const remainingEdges = graphElements.edges.filter(
          e => !selectedIdsSet.has(e.source) && !selectedIdsSet.has(e.target)
      );

      setGraphElements({ nodes: remainingNodes, edges: remainingEdges });
      setSelectedNodeIdsForActions([]);
  }, [selectedNodeIdsForActions, graphElements]);
    
  const handleCollapseSelectedNodes = useCallback(() => {
    if (!graphElements) return;
    setCollapsedNodeIds(prev => {
        const newSet = new Set(prev);
        selectedNodeIdsForActions.forEach(id => {
            const node = graphElements.nodes.find(n => n.id === id);
            if (node?.data.hasChildren) {
                newSet.add(id);
            }
        });
        return newSet;
    });
  }, [selectedNodeIdsForActions, graphElements]);

  const handleExpandSelectedNodes = useCallback(() => {
    setCollapsedNodeIds(prev => {
        const newSet = new Set(prev);
        selectedNodeIdsForActions.forEach(id => {
            newSet.delete(id);
        });
        return newSet;
    });
  }, [selectedNodeIdsForActions]);

  const handleGroupSelectedNodes = useCallback(() => {
    if (selectedNodeIdsForActions.length < 2 || !graphElements) return;
    const groupName = window.prompt(t('groupNamePrompt'));
    if (!groupName) return;

    const groupId = `group-${Date.now()}`;
    const selectedNodes = graphElements.nodes.filter(n => selectedNodeIdsForActions.includes(n.id));
    
    // Simple average position for the new group node
    const avgX = selectedNodes.reduce((sum, n) => sum + (n.position?.x || 0), 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((sum, n) => sum + (n.position?.y || 0), 0) / selectedNodes.length;
    
    const groupNode: Node<GraphNode> = {
      id: groupId,
      type: 'custom',
      data: {
        id: groupId,
        label: groupName,
        type: 'group',
      },
      position: { x: avgX, y: avgY },
      style: {
        width: NODE_WIDTH * 2,
        height: 200,
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        borderColor: 'rgb(107, 114, 128)',
        borderStyle: 'dashed',
      },
    };

    const updatedNodes = graphElements.nodes.map(n => {
      if (selectedNodeIdsForActions.includes(n.id)) {
        return { ...n, parentNode: groupId, extent: 'parent' as const };
      }
      return n;
    });

    setGraphElements(prev => ({
        ...prev!,
        nodes: [...updatedNodes, groupNode]
    }));
    setSelectedNodeIdsForActions([]);
  }, [selectedNodeIdsForActions, graphElements, t]);

  const handleUngroupNode = useCallback((groupId: string) => {
    if (!graphElements) return;

    const nodesToRelease = graphElements.nodes.filter(n => n.parentNode === groupId);
    const updatedNodes = graphElements.nodes
        .filter(n => n.id !== groupId) // Remove the group node
        .map(n => {
            if (n.parentNode === groupId) {
                // Release the node from the parent
                const { parentNode, ...rest } = n;
                return rest;
            }
            return n;
        });

    setGraphElements(prev => ({
        ...prev!,
        nodes: updatedNodes,
    }));
  }, [graphElements]);

  const handleNodeToggle = useCallback((nodeId: string) => {
    setCollapsedNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
        } else {
            newSet.add(nodeId);
        }
        return newSet;
    });
  }, []);
    
  const handleNodeTrace = useCallback((nodeData: GraphNode) => {
    setActiveTrace(nodeData);
    setIsTraceInfoPanelOpen(true);
    setIsPdfDrawerOpen(true);
  }, []);

  const handlePromptSelect = (promptId: string) => {
    if (!promptId) {
        setPrompt('');
        return;
    }
    const selected = availablePrompts.find(p => p.id === promptId);
    if (selected) {
        setPrompt(selected.content);
    }
  };

  const renderHighlightedText = (fullText: string, linesStr: string | null) => {
      const linesToHighlight = parseLineNumbers(linesStr);
      if (linesToHighlight.length === 0) {
          return fullText;
      }
      const lines = fullText.split('\n');
      
      return (
          <>
              {lines.map((line, index) => {
                  const lineNumber = index + 1;
                  const isHighlighted = linesToHighlight.includes(lineNumber);
                  return (
                      <span key={index} className={isHighlighted ? 'bg-cyan-900/50 block' : 'block'}>
                          {line}
                      </span>
                  );
              })}
          </>
      );
  };
  
  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, node) => {
    setHoveredNode(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNode(null);
  }, []);


  const reactFlowInstance = useMemo(() => (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={handleSelectionChange}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      nodeTypes={nodeTypes}
      fitView
      className="bg-gray-800"
      multiSelectionKeyCode="Shift"
      selectionOnDrag={true}
    >
      <Background color="#4A5568" gap={16} />
      <Controls />
      {graphElements && graphElements.edges.length > 0 && <EdgeLegend />}
    </ReactFlow>
  ), [nodes, edges, onNodesChange, onEdgesChange, handleSelectionChange, onNodeMouseEnter, onNodeMouseLeave, graphElements]);

  const showPdfViewer = !!pdfFile;
  const showTracePanel = !!activeTrace;
  const showPreprocessedText = showTracePanel && !showPdfViewer && !!preprocessedText;
  const showContextUnavailable = showTracePanel && !showPdfViewer && !preprocessedText;
  const showDrawerContent = showPdfViewer || showTracePanel;

  return (
    <div className="h-screen font-sans text-white bg-gray-900 relative overflow-hidden">
        {!isControlDrawerOpen && (
          <button
            onClick={() => setIsControlDrawerOpen(true)}
            className="absolute top-4 left-4 z-30 p-2 bg-gray-800/70 hover:bg-gray-700/90 rounded-full text-white transition-all duration-300"
            aria-label={t('openPanel')}
            title={t('openPanel')}
          >
            <HamburgerIcon />
          </button>
        )}
      
      <div className={`absolute top-0 left-0 h-full w-full md:w-1/3 lg:w-1/4 p-4 flex flex-col bg-gray-900 border-r border-gray-700 shadow-lg z-20 transform transition-transform duration-300 ease-in-out ${isControlDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <header className="mb-4 flex-shrink-0">
            <div className="grid grid-cols-3 items-center">
                <div className="flex justify-start">
                     <button
                        onClick={toggleLanguage}
                        className="p-2 rounded-md hover:bg-gray-800 transition-colors"
                        aria-label={t('languageLabel')}
                        title={t('changeLanguageTooltip')}
                    >
                        {language === 'pt' ? <BrazilFlagIcon /> : <USFlagIcon />}
                    </button>
                </div>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-cyan-400">{t('appTitle')}</h1>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={() => setIsControlDrawerOpen(false)}
                        className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        aria-label={t('closePanel')}
                        title={t('closePanel')}
                    >
                        <CloseIcon />
                    </button>
                </div>
            </div>
            <p className="text-sm text-gray-400 mt-1 text-center">{t('appDescription')}</p>
        </header>

        <div className="flex border-b border-gray-700 mb-4 flex-shrink-0">
          {(['graph', 'causal', 'testes'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setMainTab(tab)} 
              className={`capitalize text-sm font-medium py-2 px-4 border-b-2 transition-colors duration-200 ${mainTab === tab ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
              {t(`${tab}Tab`)}
            </button>
          ))}
        </div>
        
        <div className="flex-grow min-h-0 overflow-y-auto pr-2 -mr-2">
          {mainTab === 'graph' && (
            <>
              <div className="flex border-b border-gray-700 mb-4 sticky top-0 bg-gray-900">
                  { (['generate', 'manual', 'history'] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`capitalize text-sm font-medium py-2 px-4 border-b-2 transition-colors duration-200 ${activeTab === tab ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
                          {t(`${tab}Tab`)}
                      </button>
                  ))}
              </div>

              <div className="flex-grow flex flex-col min-h-0">
                {activeTab === 'generate' && (
                   <div className="flex flex-col gap-4 flex-grow">
                      <div>
                        <label htmlFor="model-select" className="text-sm font-medium text-gray-300 mb-2 block">
                          {t('modelLabel')}
                        </label>
                        <select
                          id="model-select"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200"
                        >
                          {GEMINI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer" title={t('flexibleSchemaDescription')}>
                          <input
                            type="checkbox"
                            checked={useFlexibleSchema}
                            onChange={(e) => setUseFlexibleSchema(e.target.checked)}
                            className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 rounded text-cyan-500 focus:ring-cyan-600 transition-colors"
                          />
                          {t('flexibleSchemaLabel')}
                        </label>
                      </div>

                      <div>
                        <label htmlFor="max-concepts-input" className="text-sm font-medium text-gray-300 mb-2 block">
                          {t('maxConceptsLabel')}
                        </label>
                        <input
                          id="max-concepts-input"
                          type="number"
                          value={maxConcepts}
                          onChange={(e) => setMaxConcepts(Math.max(1, parseInt(e.target.value, 10)) || 1)}
                          min="1"
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200"
                        />
                      </div>
                    
                      <div>
                          <label htmlFor="file-upload" className="text-sm font-medium text-gray-300 mb-2 block">
                              {t('uploadLabel')}
                          </label>
                          <input type="file" id="file-upload" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt,.md" className="hidden"/>
                          <button onClick={() => fileInputRef.current?.click()} className="w-full text-sm p-3 bg-gray-800 border border-dashed border-gray-600 rounded-md text-gray-400 hover:bg-gray-700 hover:border-cyan-500 transition duration-200">
                              {selectedFile ? t('selectedFile', { filename: selectedFile.name }) : t('selectFileButton')}
                          </button>
                      </div>

                      <div>
                          <label htmlFor="prompt-select" className="text-sm font-medium text-gray-300 mb-2 block">
                              {t('selectPromptLabel')}
                          </label>
                          <select
                              id="prompt-select"
                              onChange={(e) => handlePromptSelect(e.target.value)}
                              defaultValue=""
                              className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200"
                          >
                              <option value="">{t('selectPromptPlaceholder')}</option>
                              {availablePrompts.map(p => (
                                  <option key={p.id} value={p.id}>{p.title}</option>
                              ))}
                          </select>
                      </div>

                      <div className="flex flex-col flex-grow">
                          <label htmlFor="prompt-input" className="text-sm font-medium text-gray-300 mb-2">
                              {t('promptLabel')}
                          </label>
                          <textarea id="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full flex-grow p-3 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200" placeholder={t('promptPlaceholder')} />
                      </div>
                      
                      <div>
                          <label htmlFor="ai-json-output" className="text-sm font-medium text-gray-300 mb-2 block">
                              {t('jsonOutputLabel')}
                          </label>
                          <textarea
                              id="ai-json-output"
                              value={aiJsonOutput}
                              readOnly
                              placeholder={t('jsonOutputPlaceholder')}
                              className="w-full h-32 p-3 bg-emerald-950/50 border border-gray-600 rounded-md text-gray-300 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200"
                          />
                      </div>

                      {isLoading ? (
                        <button onClick={handleStopGenerating} className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                          {t('stopGeneratingButton')}
                        </button>
                      ) : (
                        <button onClick={handleFileGenerate} disabled={!selectedFile || prompt.trim() === ''} className="mt-auto w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed">
                          {t('generateWithAIButton')}
                        </button>
                      )}
                  </div>
                )}

                {activeTab === 'manual' && (
                  <div className="flex flex-col gap-4 flex-grow">
                      <div className="flex-grow flex flex-col">
                          <label htmlFor="json-input" className="text-sm font-medium text-gray-300 mb-2">
                              {t('pasteJsonLabel')}
                          </label>
                          <textarea id="json-input" value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} className="w-full flex-grow p-3 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-xs font-mono focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200" placeholder="Enter JSON data..." />
                      </div>
                      <button onClick={handleGenerateGraphFromJson} disabled={isLoading || !jsonInput.trim()} className="mt-auto w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed">
                          {t('generateGraphButton')}
                      </button>
                  </div>
                )}
                  
                {activeTab === 'history' && (
                   <div className="flex flex-col gap-2 flex-grow">
                      {history.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center mt-4">{t('historyEmpty')}</p>
                      ) : (
                          history.map(item => (
                              <div key={item.id} className="bg-gray-800 p-3 rounded-md border border-gray-700 text-xs">
                                  <div className="font-bold text-gray-300 truncate">{item.filename}</div>
                                  <p className="text-gray-400 mt-1 italic truncate">"{item.prompt}"</p>
                                  <div className="text-gray-500 text-[10px] mt-2">{new Date(item.timestamp).toLocaleString()}</div>
                                  <div className="flex gap-2 mt-2">
                                      <button onClick={() => handleSelectHistoryItem(item)} className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white text-xs py-1 px-2 rounded">{t('historyLoadButton')}</button>
                                      <button onClick={() => handleDeleteHistoryItem(item.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs py-1 px-2 rounded">{t('historyDeleteButton')}</button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
                )}
              </div>

              {error && <div className="mt-4 p-3 bg-red-800 border border-red-600 text-red-200 rounded-md text-sm whitespace-pre-wrap">{error}</div>}

              {isLoading && (
                  <div className="mt-4 w-full text-white py-2 px-4 rounded-md flex items-center justify-center">
                       <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       <span className="text-sm">{loadingMessage ? t(loadingMessage) : t('loadingDefault')}</span>
                  </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-gray-700">
                  <h2 className="text-sm font-medium text-gray-300 mb-3">{t('layoutDirectionTitle')}</h2>
                  <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(LAYOUTS) as Array<keyof typeof LAYOUTS>).map((dir) => (
                          <button
                              key={dir}
                              onClick={() => setLayout(dir)}
                              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors duration-200 ${ layout === dir ? 'bg-cyan-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300' }`}
                          >
                              {t(LAYOUTS[dir])}
                          </button>
                      ))}
                  </div>
                  <button
                      onClick={handleGenerateGraphFromJson}
                      disabled={isLoading || !jsonInput.trim()}
                      className="mt-4 w-full py-2 px-3 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                      title={!jsonInput.trim() ? 'No JSON data to process' : 'Regenerate graph from JSON input'}
                  >
                      {t('regenerateGraphButton')}
                  </button>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-700">
                  <h2 className="text-sm font-medium text-gray-300 mb-3">{t('filtersTitle')}</h2>
                  <div className="flex flex-col gap-4">
                      <input
                          type="text"
                          placeholder={t('filterByLabelPlaceholder')}
                          value={labelFilter}
                          onChange={e => setLabelFilter(e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                      />
                      <input
                          type="text"
                          placeholder={t('filterByEdgeLabelPlaceholder')}
                          value={edgeLabelFilter}
                          onChange={e => setEdgeLabelFilter(e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                      />
                      <div className="grid grid-cols-2 gap-2 text-sm">
                          {availableTypes.map(type => (
                              <label key={type} className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                  <input
                                      type="checkbox"
                                      checked={typeFilters.has(type)}
                                      onChange={() => handleTypeFilterChange(type)}
                                      className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 rounded text-cyan-500 focus:ring-cyan-600 transition-colors"
                                  />
                                  <span className="capitalize">{type}</span>
                              </label>
                          ))}
                      </div>
                       { (labelFilter.trim() !== '' || typeFilters.size > 0 || edgeLabelFilter.trim() !== '') && (
                          <button
                              onClick={handleClearFilters}
                              className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                          >
                              {t('clearFiltersButton')}
                          </button>
                       )}
                  </div>
              </div>

              {selectedNodeIdsForActions.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-700">
                      <h2 className="text-sm font-medium text-gray-300 mb-3">
                          {t('bulkActionsTitle', { count: selectedNodeIdsForActions.length })}
                      </h2>
                      <div className="flex flex-col gap-2">
                           <button
                              onClick={handleCollapseSelectedNodes}
                              disabled={!canCollapseSelected}
                              className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                          >
                              {t('collapseSelectedButton')}
                          </button>
                          <button
                              onClick={handleExpandSelectedNodes}
                              disabled={!canExpandSelected}
                              className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                          >
                              {t('expandSelectedButton')}
                          </button>
                          <button
                              onClick={handleGroupSelectedNodes}
                              disabled={selectedNodeIdsForActions.length < 2}
                              className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                          >
                              {t('groupSelectedButton')}
                          </button>
                          <button
                              onClick={handleDeleteSelectedNodes}
                              className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-red-800 hover:bg-red-700 text-white transition-colors mt-2"
                          >
                              {t('deleteSelectedButton')}
                          </button>
                      </div>
                  </div>
              )}
            </>
          )}
          {mainTab === 'causal' && <ScaffoldedControlPanel tabName="Causal" />}
          {mainTab === 'testes' && <ScaffoldedControlPanel tabName="Testes" />}
        </div>
      </div>
      <main className="w-full h-full">
        {reactFlowInstance}
      </main>
      <button
          onClick={() => setIsPdfDrawerOpen(!isPdfDrawerOpen)}
          className="absolute top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600 text-white rounded-l-full w-8 h-16 flex items-center justify-center z-30 transition-all duration-300 ease-in-out"
          style={{ right: isPdfDrawerOpen ? `calc(${PDF_DRAWER_WIDTH} - 1px)` : '0', transform: isPdfDrawerOpen ? 'translateX(0)' : 'translateX(50%)' }}
          title={t(isPdfDrawerOpen ? 'closePdfDrawerTooltip' : 'openPdfDrawerTooltip')}
          aria-label={t(isPdfDrawerOpen ? 'closePdfDrawerTooltip' : 'openPdfDrawerTooltip')}
      >
          {isPdfDrawerOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>

       <div 
         ref={pdfDrawerRef}
         className={`absolute top-0 right-0 h-screen bg-gray-800 border-l border-gray-700 shadow-2xl z-20 transform transition-transform duration-300 ease-in-out flex flex-col`}
         style={{ width: PDF_DRAWER_WIDTH, transform: isPdfDrawerOpen ? 'translateX(0%)' : 'translateX(100%)' }}
         onMouseDown={isPdfDrawerOpen ? handlePdfDrawerDragStart : undefined}
       >
        {showDrawerContent ? (
          <div className="relative h-full w-full overflow-hidden">
              {showTracePanel && (
                <>
                  <button
                      onClick={() => setIsTraceInfoPanelOpen(prev => !prev)}
                      title={t(isTraceInfoPanelOpen ? 'collapseTracePanelTooltip' : 'expandTracePanelTooltip')}
                      aria-label={t(isTraceInfoPanelOpen ? 'collapseTracePanelTooltip' : 'expandTracePanelTooltip')}
                      className="absolute top-0 left-1/2 w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center z-40 transition-all duration-300 transform hover:scale-110"
                      style={{ transform: `translateX(-50%) translateY(-33%)` }}
                  >
                      <ChevronDownIcon isOpen={isTraceInfoPanelOpen} />
                  </button>

                  <div className={`absolute top-0 left-0 right-0 p-4 bg-gray-800 border-b border-gray-700 shadow-lg z-30 transform transition-transform duration-500 ease-in-out ${isTraceInfoPanelOpen ? 'translate-y-0' : '-translate-y-full'}`}>
                      <div className="flex justify-between items-center mb-4 flex-shrink-0">
                          <h2 className="text-lg font-bold text-cyan-400">{t('traceabilityDrawerTitle')}</h2>
                          <button onClick={() => { setActiveTrace(null); setIsTraceInfoPanelOpen(false); }} className="text-gray-400 hover:text-white" aria-label="Close">
                               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                      </div>
                      <div className="flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-300 mb-2 truncate" title={activeTrace!.label}>
                              {activeTrace!.label}
                          </div>
                          {activeTrace!.source_lines && (
                              <div className="text-xs text-gray-400 mb-2 font-mono">
                                  <span className="font-semibold">{t('traceabilityDrawerLinesLabel')}</span> {activeTrace!.source_lines}
                              </div>
                          )}
                          <div className="bg-gray-900 p-3 rounded-md text-gray-300 text-sm italic border border-gray-700 max-h-40 overflow-y-auto">
                              "{activeTrace!.source_quote || t('traceabilityDrawerEmpty')}"
                          </div>
                      </div>
                  </div>
                </>
              )}

              <div className="h-full pt-4">
                  {showPdfViewer ? (
                    <PdfViewer file={pdfFile} highlightText={activeTrace?.source_quote || ''} />
                  ) : showPreprocessedText ? (
                      <div className="overflow-y-auto h-full bg-gray-900 p-2 rounded-md">
                          <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                              {renderHighlightedText(preprocessedText!, activeTrace!.source_lines || null)}
                          </pre>
                      </div>
                  ) : showContextUnavailable ? (
                      <div className="overflow-y-auto h-full bg-gray-900 p-3 rounded-md flex items-center justify-center">
                         <p className="text-gray-500 text-sm italic text-center">{t('traceabilityDrawerFullContextUnavailable')}</p>
                      </div>
                  ) : null}
              </div>
          </div>
        ) : (
           <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 italic px-4 text-center">{t('traceabilityDrawerPlaceholder')}</p>
            </div>
        )}
    </div>
    </div> 
  );
}

export default App;