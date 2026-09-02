// Shapes shared by the search API route and the client that renders it.
export interface SearchPostSuggestion {
  id: number;
  headline: string;
  author_name: string;
  author_handle: string | null;
}

export interface SearchSuggestionPerson {
  user_id: string;
  handle: string | null;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  followers_count: number;
}

export interface SearchSuggestions {
  people: SearchSuggestionPerson[];
  posts: SearchPostSuggestion[];
}
