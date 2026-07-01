import { useCategories } from '../context/CategoriesContext.tsx';
import { CategoryDot } from './CategoryDot.tsx';

export function CategoryChip({ categoryKey }: { categoryKey: string }) {
  const { labelOf } = useCategories();
  return (
    <span className="chip cat-chip" title={labelOf(categoryKey)}>
      <CategoryDot categoryKey={categoryKey} />
      {categoryKey}
    </span>
  );
}
