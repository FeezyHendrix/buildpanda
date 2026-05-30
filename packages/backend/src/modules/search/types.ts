export interface SearchProjectHit {
  id: string;
  name: string;
  address: string;
  snippet: string;
}

export interface SearchUpdateHit {
  id: string;
  projectId: string;
  title: string;
  snippet: string;
  category: string;
}

export interface SearchDocumentHit {
  id: string;
  projectId: string;
  fileName: string;
  category: string;
}

export interface SearchInspectionHit {
  id: string;
  projectId: string;
  title: string;
  snippet: string;
  category: string;
}

export interface SearchResults {
  query: string;
  projects: SearchProjectHit[];
  updates: SearchUpdateHit[];
  documents: SearchDocumentHit[];
  inspections: SearchInspectionHit[];
}
