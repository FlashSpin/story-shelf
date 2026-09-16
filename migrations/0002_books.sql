-- Shared family book catalog. Rows are unowned (no user_id): any visitor can
-- browse and update the shelf. Do not store personal names or private notes.
create table if not exists books (
  id              serial primary key,
  title           text not null,
  authors         text not null default '',
  isbn            text,
  cover_url       text,
  publisher       text,
  published_year  text,
  page_count      integer,
  description     text,
  notes           text,
  age_band        text,
  added_at        timestamptz not null default now()
);

create unique index if not exists books_isbn_unique
  on books (isbn)
  where isbn is not null;

create index if not exists books_added_at_idx on books (added_at desc);

insert into books (
  title, authors, isbn, cover_url, publisher, published_year, age_band
)
select v.title, v.authors, v.isbn, v.cover_url, v.publisher, v.published_year, v.age_band
from (
  values
    (
      'The Very Hungry Caterpillar',
      'Eric Carle',
      '9780399226908',
      'https://covers.openlibrary.org/b/isbn/9780399226908-L.jpg',
      'Philomel',
      '1969',
      'Picture book'
    ),
    (
      'Where the Wild Things Are',
      'Maurice Sendak',
      '9780064431781',
      'https://covers.openlibrary.org/b/isbn/9780064431781-L.jpg',
      'HarperCollins',
      '1963',
      'Picture book'
    ),
    (
      'Goodnight Moon',
      'Margaret Wise Brown',
      '9780064430173',
      'https://covers.openlibrary.org/b/isbn/9780064430173-L.jpg',
      'Harper',
      '1947',
      'Board book'
    ),
    (
      'The Cat in the Hat',
      'Dr. Seuss',
      '9780394800011',
      'https://covers.openlibrary.org/b/isbn/9780394800011-L.jpg',
      'Random House',
      '1957',
      'Early reader'
    ),
    (
      'Green Eggs and Ham',
      'Dr. Seuss',
      '9780394800165',
      'https://covers.openlibrary.org/b/isbn/9780394800165-L.jpg',
      'Random House',
      '1960',
      'Early reader'
    ),
    (
      'Charlotte''s Web',
      'E. B. White',
      '9780064400558',
      'https://covers.openlibrary.org/b/isbn/9780064400558-L.jpg',
      'HarperCollins',
      '1952',
      'Chapter book'
    ),
    (
      'The Gruffalo',
      'Julia Donaldson',
      '9780142403877',
      'https://covers.openlibrary.org/b/isbn/9780142403877-L.jpg',
      'Puffin',
      '1999',
      'Picture book'
    ),
    (
      'Brown Bear, Brown Bear, What Do You See?',
      'Bill Martin Jr.',
      '9780805047905',
      'https://covers.openlibrary.org/b/isbn/9780805047905-L.jpg',
      'Henry Holt',
      '1967',
      'Picture book'
    ),
    (
      'Corduroy',
      'Don Freeman',
      '9780140501735',
      'https://covers.openlibrary.org/b/isbn/9780140501735-L.jpg',
      'Viking',
      '1968',
      'Picture book'
    ),
    (
      'The Tale of Peter Rabbit',
      'Beatrix Potter',
      '9780723247708',
      'https://covers.openlibrary.org/b/isbn/9780723247708-L.jpg',
      'Frederick Warne',
      '1902',
      'Picture book'
    ),
    (
      'Madeline',
      'Ludwig Bemelmans',
      '9780140564396',
      'https://covers.openlibrary.org/b/isbn/9780140564396-L.jpg',
      'Viking',
      '1939',
      'Picture book'
    ),
    (
      'Harry Potter and the Sorcerer''s Stone',
      'J. K. Rowling',
      '9780590353427',
      'https://covers.openlibrary.org/b/isbn/9780590353427-L.jpg',
      'Scholastic',
      '1998',
      'Middle grade'
    ),
    (
      'Matilda',
      'Roald Dahl',
      '9780142410370',
      'https://covers.openlibrary.org/b/isbn/9780142410370-L.jpg',
      'Puffin',
      '1988',
      'Chapter book'
    ),
    (
      'The Lion, the Witch and the Wardrobe',
      'C. S. Lewis',
      '9780064404990',
      'https://covers.openlibrary.org/b/isbn/9780064404990-L.jpg',
      'HarperCollins',
      '1950',
      'Middle grade'
    ),
    (
      'The Snowy Day',
      'Ezra Jack Keats',
      '9780140501827',
      'https://covers.openlibrary.org/b/isbn/9780140501827-L.jpg',
      'Viking',
      '1962',
      'Picture book'
    ),
    (
      'Chicka Chicka Boom Boom',
      'Bill Martin Jr. & John Archambault',
      '9781442450707',
      'https://covers.openlibrary.org/b/isbn/9781442450707-L.jpg',
      'Little Simon',
      '1989',
      'Picture book'
    )
) as v(title, authors, isbn, cover_url, publisher, published_year, age_band)
where not exists (select 1 from books b where b.isbn = v.isbn);
