export interface Flashcard {
    id: number;
    word: string;
    translation: string;
    example: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }
  
  export interface FlashcardResponse {
    words: Flashcard[];
    error?: string;
  }