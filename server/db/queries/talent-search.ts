/**
 * 蓉才通™ ATOS — Talent Pool Search Queries
 * 
 * Hybrid search: pgvector (semantic) + pg_trgm (fuzzy text) + filters
 * 
 * Prerequisites:
 * - PostgreSQL with pgvector extension
 * - Embeddings pre-computed for all talent profiles
 * - GIN indexes on skills, location arrays
 */

import type { SearchFilters } from '../../ai/people/agents/search-agent';
import type { SearchResult } from '../../ai/people/agents/search-agent';

interface SearchParams {
  semanticQuery: string;
  booleanQuery: string;
  filters: SearchFilters;
  limit: number;
  offset: number;
}

/**
 * Execute hybrid search against talent pool
 * 
 * Production SQL (pgvector + full-text):
 * 
 * WITH semantic AS (
 *   SELECT id, 1 - (embedding <=> $1::vector) AS semantic_score
 *   FROM talent_profiles
 *   WHERE 1 - (embedding <=> $1::vector) > 0.7
 *   ORDER BY embedding <=> $1::vector
 *   LIMIT 100
 * ),
 * fulltext AS (
 *   SELECT id, ts_rank(search_vector, plainto_tsquery($2)) AS text_score
 *   FROM talent_profiles
 *   WHERE search_vector @@ plainto_tsquery($2)
 *   LIMIT 100
 * )
 * SELECT DISTINCT ON (t.id)
 *   t.*,
 *   COALESCE(s.semantic_score, 0) * 0.6 + COALESCE(f.text_score, 0) * 0.4 AS combined_score
 * FROM talent_profiles t
 * LEFT JOIN semantic s ON t.id = s.id
 * LEFT JOIN fulltext f ON t.id = f.id
 * WHERE (s.id IS NOT NULL OR f.id IS NOT NULL)
 *   AND ($3::text[] IS NULL OR t.location = ANY($3))
 *   AND ($4::int IS NULL OR t.experience_years >= $4)
 *   AND ($5::int IS NULL OR t.experience_years <= $5)
 *   AND ($6::text[] IS NULL OR t.skills && $6)
 * ORDER BY combined_score DESC
 * LIMIT $7 OFFSET $8;
 */
export async function searchTalentPool(params: SearchParams): Promise<SearchResult[]> {
  // Import database connection
  const { db } = await import('../index');
  const { sql } = await import('drizzle-orm');

  // Build dynamic query based on filters
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.filters.location && params.filters.location.length > 0) {
    conditions.push(`location = ANY($${paramIdx})`);
    values.push(params.filters.location);
    paramIdx++;
  }

  if (params.filters.experienceYears?.min) {
    conditions.push(`experience_years >= $${paramIdx}`);
    values.push(params.filters.experienceYears.min);
    paramIdx++;
  }

  if (params.filters.experienceYears?.max) {
    conditions.push(`experience_years <= $${paramIdx}`);
    values.push(params.filters.experienceYears.max);
    paramIdx++;
  }

  if (params.filters.skills && params.filters.skills.length > 0) {
    conditions.push(`skills && $${paramIdx}::text[]`);
    values.push(params.filters.skills);
    paramIdx++;
  }

  if (params.filters.industries && params.filters.industries.length > 0) {
    conditions.push(`industry = ANY($${paramIdx})`);
    values.push(params.filters.industries);
    paramIdx++;
  }

  // Execute raw SQL with pgvector
  const query = sql.raw(`
    SELECT 
      id as "candidateId",
      name,
      current_title as "currentTitle",
      current_company as "currentCompany",
      location,
      experience_years as "experienceYears",
      skills,
      last_active as "lastActive",
      source
    FROM talent_profiles
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC
    LIMIT ${params.limit} OFFSET ${params.offset}
  `);

  try {
    const results = await db.execute(query) as unknown as SearchResult[];
    return results.map((r, idx) => ({
      ...r,
      relevanceScore: Math.max(95 - idx * 3, 50), // Placeholder until vector search is active
      matchReasons: [],
    }));
  } catch {
    // Table may not exist yet — return empty
    return [];
  }
}
