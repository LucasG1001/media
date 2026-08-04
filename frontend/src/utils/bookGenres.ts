export interface BookGenre {
  value: string;
  label: string;
}

// `value` é o nome exato da tag de categoria "Genre" (tag_category_id 1) da Hardcover —
// não é texto livre. Todos foram conferidos contra a API: nome errado devolve lista
// vazia em silêncio. "Manga" não existe como gênero lá; quadrinho é "Comics".
export const BOOK_GENRES: BookGenre[] = [
  { value: "Fiction", label: "Ficção" },
  { value: "Fantasy", label: "Fantasia" },
  { value: "Science Fiction", label: "Ficção Científica" },
  { value: "Romance", label: "Romance" },
  { value: "Mystery", label: "Mistério" },
  { value: "Thriller", label: "Thriller" },
  { value: "Suspense", label: "Suspense" },
  { value: "Horror", label: "Terror" },
  { value: "Classics", label: "Clássicos" },
  { value: "Young Adult", label: "Jovem Adulto" },
  { value: "Historical Fiction", label: "Ficção Histórica" },
  { value: "Nonfiction", label: "Não Ficção" },
  { value: "Biography", label: "Biografia" },
  { value: "History", label: "História" },
  { value: "Philosophy", label: "Filosofia" },
  { value: "Comics", label: "Quadrinhos" },
  { value: "Poetry", label: "Poesia" },
  { value: "Self-Help", label: "Autoajuda" },
  { value: "Business", label: "Negócios" },
];
