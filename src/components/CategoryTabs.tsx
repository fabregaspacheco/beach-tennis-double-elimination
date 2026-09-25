import type { Category } from '../types';

interface CategoryTabsProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (categoryId: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategoryId,
  onSelect,
  onAddCategory,
  onRemoveCategory,
}: CategoryTabsProps) {
  return (
    <div className="category-tabs">
      {categories.map((c) => (
        <span key={c.id} className="category-tab-wrap">
          <button
            type="button"
            className={`category-tab${c.id === activeCategoryId ? ' category-tab--active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            {c.name}
            {c.championTeamId && <span className="category-tab-trophy"> 🏆</span>}
          </button>
          <button
            type="button"
            className="category-tab-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCategory(c.id);
            }}
            title={`Excluir categoria ${c.name}`}
            aria-label={`Excluir categoria ${c.name}`}
          >
            ×
          </button>
        </span>
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
