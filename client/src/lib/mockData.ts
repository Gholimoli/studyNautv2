// --- Types ---
export type NoteSourceType = 'PDF' | 'YouTube' | 'Audio' | 'Image' | 'Text';

export interface Note {
  id: number;
  title: string;
  summary?: string;
  content?: string; 
  sourceType: NoteSourceType;
  createdAt: string | Date;
  folderId?: number | null;
  isFavorite?: boolean;
  tags?: { id: number; name: string }[];
  languageCode?: string;
}

export interface FolderType {
  id: number;
  name: string;
  // Add parentId if needed for hierarchy later
  parentId?: number | null;
}

// --- localStorage Keys ---
const NOTES_KEY = 'mockNotesData';
const FOLDERS_KEY = 'mockFoldersData';

// --- Initial Mock Data (Defaults) ---
const defaultNotes: Note[] = [
  { id: 1, title: 'Quantum Mechanics', sourceType: 'PDF', createdAt: '2025-04-01T10:00:00Z', isFavorite: true, folderId: 99, summary: 'Wave functions, Schrödinger equation...', languageCode: 'en', tags: [{id: 101, name: 'Physics'}, {id: 102, name: 'Quantum'}, {id: 103, name: 'Advanced'}] }, // Start QM in Maths
  { id: 2, title: 'Neural Networks', sourceType: 'YouTube', createdAt: '2025-03-30T11:30:00Z', isFavorite: false, folderId: null, summary: 'Deep learning, activation functions...', languageCode: 'en', tags: [{id: 201, name: 'AI'}, {id: 202, name: 'Deep Learning'}, {id: 203, name: 'CS'}] },
  { id: 3, title: 'Événements WWII', sourceType: 'Text', createdAt: '2025-03-28T15:00:00Z', isFavorite: false, folderId: null, summary: 'Chronologie des batailles et de la politique...', languageCode: 'fr', tags: [{id: 301, name: 'History'}, {id: 302, name: 'War'}] },
  { id: 4, title: 'Organic Chemistry Intro', sourceType: 'PDF', createdAt: '2025-03-25T09:00:00Z', isFavorite: false, folderId: null, summary: 'Functional groups, nomenclature...', languageCode: 'en', tags: [{id: 401, name: 'Chemistry'}, {id: 402, name: 'Organic'}, {id: 403, name: 'Intro'}, {id: 404, name: 'Science'}, {id: 405, name: 'Difficult'}] }, 
  { id: 5, title: 'Grabación de la conferencia 1', sourceType: 'Audio', createdAt: '2025-03-22T14:00:00Z', isFavorite: true, folderId: null, summary: 'Transcripción de la primera conferencia...', languageCode: 'es' },
  { id: 6, title: 'Lab Results Scan', sourceType: 'Image', createdAt: '2025-03-20T16:45:00Z', isFavorite: false, folderId: 99, summary: 'Scan of the experimental data...', languageCode: 'en', tags: [{id: 601, name: 'Lab'}, {id: 602, name: 'Experiment'}] }, // Start Lab results in Maths
];

const defaultFolders: FolderType[] = [
  { id: 99, name: 'Maths', parentId: null }, 
];

// --- Load Data from localStorage or Defaults ---

function loadData<T>(key: string, defaultValue: T): T {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      return JSON.parse(storedValue);
    } else {
      // Initialize localStorage with default if not present
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
  } catch (error) {
    console.error(`Error loading data for ${key} from localStorage:`, error);
    // Fallback to default and attempt to reset localStorage
    try {
       localStorage.setItem(key, JSON.stringify(defaultValue));
    } catch (setError) {
        console.error(`Failed to set fallback data for ${key} in localStorage:`, setError);
    }
    return defaultValue;
  }
}

// Exported variables now loaded from localStorage
export let mockNotesData: Note[] = loadData<Note[]>(NOTES_KEY, defaultNotes);
export let mockFoldersData: FolderType[] = loadData<FolderType[]>(FOLDERS_KEY, defaultFolders);

// --- Modifier Functions (Update localStorage) ---

export const addMockFolder = (folder: FolderType) => {
  mockFoldersData = [...mockFoldersData, folder];
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(mockFoldersData));
  console.log('Mock data: Added folder, updated localStorage');
};

export const deleteMockFolder = (folderId: number) => {
  // Filter out the folder
  mockFoldersData = mockFoldersData.filter(f => f.id !== folderId);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(mockFoldersData));
  
  // Unassign notes from the deleted folder
  mockNotesData = mockNotesData.map(n => 
    n.folderId === folderId ? { ...n, folderId: null } : n
  );
  localStorage.setItem(NOTES_KEY, JSON.stringify(mockNotesData));
  console.log(`Mock data: Deleted folder ${folderId}, unassigned notes, updated localStorage`);
};

export const updateMockFolder = (folderId: number, updateData: Partial<FolderType>) => {
  mockFoldersData = mockFoldersData.map(f => 
    f.id === folderId ? { ...f, ...updateData } : f
  );
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(mockFoldersData));
  console.log(`Mock data: Updated folder ${folderId}, updated localStorage`);
};

// New function to update a note's folder
export const updateMockNoteFolder = (noteId: number, folderId: number | null) => {
  mockNotesData = mockNotesData.map(n => 
    n.id === noteId ? { ...n, folderId: folderId } : n
  );
  localStorage.setItem(NOTES_KEY, JSON.stringify(mockNotesData));
  console.log(`Mock data: Moved note ${noteId} to folder ${folderId}, updated localStorage`);
};

// Function to reset mock data (useful for testing)
export const resetMockData = () => {
  mockNotesData = [...defaultNotes];
  mockFoldersData = [...defaultFolders];
  localStorage.setItem(NOTES_KEY, JSON.stringify(mockNotesData));
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(mockFoldersData));
  console.log('Mock data: Reset to defaults and updated localStorage');
  window.location.reload(); // Force reload to ensure components pick up reset state
};

// Example: Expose reset function to window for easy dev console access
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   (window as any).resetMockData = resetMockData;
// } 