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
    const prev = {
      title: document.title,
      description: document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.getAttribute('content') ?? '',
      ogTitle: document.head.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.getAttribute('content') ?? '',
      ogDescription: document.head.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.getAttribute('content') ?? '',
      ogType: document.head.querySelector<HTMLMetaElement>('meta[property="og:type"]')?.getAttribute('content') ?? '',
      ogImage: document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.getAttribute('content') ?? '',
      ogUrl: document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.getAttribute('content') ?? '',
      twitterCard: document.head.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.getAttribute('content') ?? '',
    };

    if (meta.title) document.title = meta.title.length > 70 ? meta.title.slice(0, 69) + '…' : meta.title;

    const descTxt = (meta.description ?? '').slice(0, 200);
    setMeta('meta[name="description"]', 'name', 'description', descTxt);
    setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title ?? document.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', descTxt);
    setMeta('meta[property="og:type"]', 'property', 'og:type', meta.type ?? 'website');
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary');
    if (meta.image) setMeta('meta[property="og:image"]', 'property', 'og:image', meta.image);
    if (meta.url) setMeta('meta[property="og:url"]', 'property', 'og:url', meta.url);

    return () => {
      document.title = prev.title;
      const restore = (selector: string, value: string) => {
        const el = document.head.querySelector<HTMLMetaElement>(selector);
        if (!el) return;
        if (value) el.setAttribute('content', value);
        else el.removeAttribute('content');
      };
      restore('meta[name="description"]', prev.description);
      restore('meta[property="og:title"]', prev.ogTitle);
      restore('meta[property="og:description"]', prev.ogDescription);
      restore('meta[property="og:type"]', prev.ogType);
      restore('meta[property="og:image"]', prev.ogImage);
      restore('meta[property="og:url"]', prev.ogUrl);
      restore('meta[name="twitter:card"]', prev.twitterCard);
    };
  }, [meta.title, meta.description, meta.image, meta.url, meta.type]);
}
