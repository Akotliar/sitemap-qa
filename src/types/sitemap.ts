export interface Risk {
  category: string;
  pattern: string;
  type: 'literal' | 'glob' | 'regex';
  reason: string;
}

export interface SitemapUrl {
  loc: string;
  source: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  risks: Risk[];
}
