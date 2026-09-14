import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// GAP-RM03: Tipos de JSON-LD
type SchemaType = 'WebSite' | 'Product' | 'Profile' | 'Article' | 'Tournament';

interface JsonLdProps {
  type: SchemaType;
  data: Record<string, any>;
}

// GAP-RM03: Gerador de JSON-LD
function generateJsonLd({ type, data }: JsonLdProps): string {
  const base = {
    '@context': 'https://schema.org',
    '@type': type,
  };
  
  const templates: Record<SchemaType, Record<string, any>> = {
    WebSite: {
      name: data.name || 'MIDIAS',
      description: data.description || 'Plataforma gamer',
      url: data.url || window.location.origin,
    },
    Product: {
      name: data.name,
      description: data.description,
      image: data.image,
      offers: {
        '@type': 'Offer',
        price: data.price,
        priceCurrency: 'BRL',
        availability: data.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
      aggregateRating: data.rating ? {
        '@type': 'AggregateRating',
        ratingValue: data.rating,
        reviewCount: data.reviewCount || 0,
      } : undefined,
    },
    Profile: {
      name: data.name,
      description: data.bio || data.description,
      image: data.image,
      url: data.url,
    },
    Article: {
      headline: data.title,
      description: data.description,
      image: data.image,
      author: {
        '@type': 'Person',
        name: data.author || 'MIDIAS',
      },
      datePublished: data.datePublished,
    },
    Tournament: {
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      location: {
        '@type': 'VirtualLocation',
        name: 'MIDIAS Online',
      },
      organizer: {
        '@type': 'Organization',
        name: 'MIDIAS',
      },
    },
  };

  const schema = { ...base, ...templates[type] };
  // Remove undefined values
  Object.keys(schema).forEach(key => {
    if (schema[key] === undefined) delete schema[key];
  });
  
  return JSON.stringify(schema);
}

// GAP-RM04: Injetar canonical
function injectCanonical(url: string) {
  const existing = document.querySelector('link[rel="canonical"]');
  if (existing) {
    existing.setAttribute('href', url);
  } else {
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = url;
    document.head.appendChild(link);
  }
}

interface RouteMetaProps {
  title: string;
  description: string;
  type?: 'website' | 'profile' | 'article' | 'product' | 'tournament';
  /** GAP-RM01: Imagem para Open Graph */
  image?: string;
  /** GAP-RM01: URL completa */
  url?: string;
  /** GAP-RM03: Dados para JSON-LD */
  jsonLdData?: Record<string, any>;
  /** GAP-RM02: Twitter Card type */
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  /** GAP-RM04: URL canonical customizada */
  canonicalUrl?: string;
}

/**
 * Aplica título + metadescrição da rota (tabela em WebRoutes).
 * Renderizado ANTES da página no shell: se a página tiver seu próprio
 * `useDocumentMeta` (conteúdo dinâmico, ex.: jogo, perfil, torneio),
 * o efeito dela roda depois e sobrescreve estes valores base.
 */
export default function RouteMeta({
  title,
  description,
  type = 'website',
  image,
  url,
  jsonLdData,
  twitterCard = 'summary_large_image',
  canonicalUrl,
}: RouteMetaProps) {
  const location = useLocation();
  const fullUrl = url || `${window.location.origin}${location.pathname}`;
  const ogType = type === 'profile' ? 'profile' : type === 'article' ? 'article' : type === 'product' ? 'product' : 'website';

  // GAP-RM01: Open Graph
  useDocumentMeta({
    title,
    description,
    type: 'website',
    image: image || '/og-default.jpg',
    url: fullUrl,
  });

  // GAP-RM01: Open Graph tags específicas
  useEffect(() => {
    // OG:title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', title);
      document.head.appendChild(meta);
    }

    // OG:description
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      meta.setAttribute('content', description);
      document.head.appendChild(meta);
    }

    // OG:type
    const ogTypeEl = document.querySelector('meta[property="og:type"]');
    if (ogTypeEl) ogTypeEl.setAttribute('content', ogType);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:type');
      meta.setAttribute('content', ogType);
      document.head.appendChild(meta);
    }

    // OG:url
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', fullUrl);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:url');
      meta.setAttribute('content', fullUrl);
      document.head.appendChild(meta);
    }

    // OG:image
    if (image) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', image);
      else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:image');
        meta.setAttribute('content', image);
        document.head.appendChild(meta);
      }
    }

    // GAP-RM02: Twitter Card
    const twitterCardEl = document.querySelector('meta[name="twitter:card"]');
    if (twitterCardEl) twitterCardEl.setAttribute('content', twitterCard);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:card');
      meta.setAttribute('content', twitterCard);
      document.head.appendChild(meta);
    }

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', title);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:title');
      meta.setAttribute('content', title);
      document.head.appendChild(meta);
    }

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute('content', description);
    else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:description');
      meta.setAttribute('content', description);
      document.head.appendChild(meta);
    }

    if (image) {
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) twitterImage.setAttribute('content', image);
      else {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'twitter:image');
        meta.setAttribute('content', image);
        document.head.appendChild(meta);
      }
    }

    // GAP-RM03: JSON-LD
    if (jsonLdData) {
      const schemaTypeMap: Record<string, SchemaType> = {
        website: 'WebSite',
        profile: 'Profile',
        article: 'Article',
        product: 'Product',
        tournament: 'Tournament',
      };
      const schemaType = schemaTypeMap[type] || 'WebSite';
      
      // Remove existing JSON-LD
      const existing = document.querySelector('script[type="application/ld+json"]');
      if (existing) existing.remove();
      
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = generateJsonLd({ 
        type: schemaType, 
        data: { ...jsonLdData, url: fullUrl } 
      });
      document.head.appendChild(script);
    }

    // GAP-RM04: Canonical URL
    if (canonicalUrl || fullUrl) {
      injectCanonical(canonicalUrl || fullUrl);
    }

    // Cleanup
    return () => {
      // Opcional: remover tags específicas se necessário
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) jsonLd.remove();
    };
  }, [title, description, ogType, fullUrl, image, twitterCard, jsonLdData, canonicalUrl]);

  return null;
}