import type { Category } from '../types';

interface CategoryTabsProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onAddCategory: (name: string) => void;
}

export function CategoryTabs({ categories, activeCategoryId, onSelect, onAddCategory }: CategoryTabsProps) {
  return (
    <div className="category-tabs">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`category-tab${c.id === activeCategoryId ? ' category-tab--active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          {c.name}
          {c.championTeamId && <span className="category-tab-trophy"> 🏆</span>}
        </button>
      ))}
      <button
        type="button"
        className="category-tab category-tab--add"
        onClick={() => {
          const name = window.prompt('Nome da nova categoria (ex: Masculino A, Feminino, Misto):');
          if (name && name.trim()) onAddCategory(name.trim());
        }}
      >
        + Categoria
      </button>
    </div>
  );
}
