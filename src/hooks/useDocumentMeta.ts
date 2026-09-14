import { useEffect } from 'react';

/**
 * Define <title> e principais meta tags dinâmicas (description, OG e Twitter Card)
 * sem depender de react-helmet. Restaura os valores anteriores no unmount.
 */
export interface DocumentMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'profile' | 'article' | 'product';
}

const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
  return el;
};

export function useDocumentMeta(meta: DocumentMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.getAttribute('content') ?? '';

    if (meta.title) document.title = meta.title.slice(0, 70);

    const descTxt = (meta.description ?? '').slice(0, 200);
    setMeta('meta[name="description"]', 'name', 'description', descTxt);
    setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title ?? document.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', descTxt);
    setMeta('meta[property="og:type"]', 'property', 'og:type', meta.type ?? 'website');
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary');
    if (meta.image) setMeta('meta[property="og:image"]', 'property', 'og:image', meta.image);
    if (meta.url) setMeta('meta[property="og:url"]', 'property', 'og:url', meta.url);

    return () => {
      document.title = prevTitle;
      const d = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (d) d.setAttribute('content', prevDesc);
    };
  }, [meta.title, meta.description, meta.image, meta.url, meta.type]);
}
