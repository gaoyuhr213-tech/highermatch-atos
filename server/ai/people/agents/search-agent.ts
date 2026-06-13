/**
 * 蓉才通™ ATOS — PeopleGPT Search Agent
 * 
 * 自然语言人才搜索引擎：
 * - 将自然语言查询转换为结构化搜索条件
 * - 支持语义搜索（向量相似度）
 * - 支持布尔搜索（精确匹配）
 * - 多源聚合（内部人才库 + 外部渠道）
 * - 搜索意图理解
 */

import { llm, type LLMMessage } from '../../shared/llm/client';
import { SEARCH_QUERY_PROMPT } from '../prompts/search';

export interface SearchQuery {
  naturalLanguage: string;
  tenantId: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  location?: string[];
  experienceYears?: { min?: number; max?: number };
  skills?: string[];
  industries?: string[];
  companies?: string[];
  education?: string[];
  currentlyEmployed?: boolean;
  salaryRange?: { min?: number; max?: number; currency?: string };
}

export interface StructuredSearchQuery {
  intent: 'find_candidates' | 'find_similar' | 'market_mapping' | 'diversity_search';
  mustHave: string[];
  niceToHave: string[];
  excludeTerms: string[];
  semanticQuery: string; // For vector search
  booleanQuery: string; // For traditional search
  filters: SearchFilters;
  sortBy: 'relevance' | 'experience' | 'recency' | 'activity';
  explanation: string;
}

export interface SearchResult {
  candidateId: string;
  name: string;
  currentTitle: string;
  currentCompany: string;
  location: string;
  experienceYears: number;
  relevanceScore: number; // 0-100
  matchReasons: string[];
  skills: string[];
  lastActive?: string;
  source: 'internal' | 'linkedin' | 'github' | 'other';
}

export interface SearchResponse {
  query: StructuredSearchQuery;
  results: SearchResult[];
  totalCount: number;
  searchTime_ms: number;
  suggestions: string[]; // Query refinement suggestions
}

export class SearchAgent {
  readonly name = 'search-agent';

  /**
   * Convert natural language to structured search query
   */
  async parseQuery(input: SearchQuery): Promise<StructuredSearchQuery> {
    const messages: LLMMessage[] = [
      { role: 'system', content: SEARCH_QUERY_PROMPT },
      {
        role: 'user',
        content: `Natural language query: "${input.naturalLanguage}"

Additional filters provided: ${JSON.stringify(input.filters || {})}

Convert to structured search query. Return JSON.`,
      },
    ];

    const response = await llm.complete({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      metadata: { tenantId: input.tenantId, agentName: this.name },
    });

    return JSON.parse(response.content) as StructuredSearchQuery;
  }

  /**
   * Execute search against talent database
   */
  async search(input: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    // Step 1: Parse natural language to structured query
    const structuredQuery = await this.parseQuery(input);

    // Step 2: Execute against database (vector + boolean hybrid)
    // In production, this queries PostgreSQL with pgvector + full-text search
    const results = await this.executeSearch(structuredQuery, input.limit || 20, input.offset || 0);

    return {
      query: structuredQuery,
      results,
      totalCount: results.length, // Would be actual count from DB
      searchTime_ms: Date.now() - startTime,
      suggestions: this.generateSuggestions(structuredQuery, results.length),
    };
  }

  private async executeSearch(
    query: StructuredSearchQuery,
    limit: number,
    offset: number
  ): Promise<SearchResult[]> {
    // Production implementation would:
    // 1. Generate embedding for semanticQuery via OpenAI embeddings API
    // 2. Query pgvector for cosine similarity
    // 3. Combine with boolean full-text search
    // 4. Apply filters
    // 5. Re-rank results
    
    // This is the interface contract — actual DB query implementation
    // lives in server/db/queries/talent-search.ts
    const { searchTalentPool } = await import('../../db/queries/talent-search');
    return searchTalentPool({
      semanticQuery: query.semanticQuery,
      booleanQuery: query.booleanQuery,
      filters: query.filters,
      limit,
      offset,
    });
  }

  private generateSuggestions(query: StructuredSearchQuery, resultCount: number): string[] {
    const suggestions: string[] = [];
    if (resultCount === 0) {
      suggestions.push('Try broadening your search by removing some must-have requirements');
      suggestions.push('Consider equivalent skills or alternative job titles');
    }
    if (resultCount > 100) {
      suggestions.push('Add more specific filters to narrow results');
      suggestions.push('Consider adding location or experience constraints');
    }
    return suggestions;
  }
}

export const searchAgent = new SearchAgent();
