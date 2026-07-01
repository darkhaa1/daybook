import { useCategories } from '../context/CategoriesContext.tsx';

export function CategoryDot({ categoryKey }: { categoryKey: string }) {
  const { colorOf } = useCategories();
  return (
    <span
      className="cat-dot"
      style={{ background: colorOf(categoryKey) }}
      aria-hidden="true"
    />
  );
}
