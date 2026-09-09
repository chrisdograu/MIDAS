import { Link } from 'react-router-dom';
import { List, Users } from 'lucide-react';

export function CuratedListCard({ id, title, description, cover_image, item_count, creator_name, follow_count }) {
  return (
    <Link
      to={`/lista/${id}`}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group"
    >
      <div className="aspect-video bg-secondary relative">
        {cover_image ? (
          <img src={cover_image} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <List className="h-12 w-12" />
          </div>
        )}
        <div className="absolute top-2 right-2 text-[10px] font-semibold bg-background/80 backdrop-blur px-2 py-1 rounded-full">
          {item_count} jogos
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold group-hover:text-primary transition-colors">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>por {creator_name}</span>
          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {follow_count}</span>
        </div>
      </div>
    </Link>
  );
}