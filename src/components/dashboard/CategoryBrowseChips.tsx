import { Link } from "react-router-dom";
import { DEFAULT_SERVICE_CATEGORIES, SERVICE_CATEGORY_ICONS } from "../../constants/serviceCatalog";

export default function CategoryBrowseChips() {
  return (
    <div className="db-category-chips">
      {DEFAULT_SERVICE_CATEGORIES.slice(0, 8).map((category) => (
        <Link
          key={category}
          className="db-category-chips__item"
          to={`/browse?category=${encodeURIComponent(category)}`}
        >
          <span aria-hidden="true">{SERVICE_CATEGORY_ICONS[category] || "✨"}</span>
          <span>{category}</span>
        </Link>
      ))}
    </div>
  );
}
