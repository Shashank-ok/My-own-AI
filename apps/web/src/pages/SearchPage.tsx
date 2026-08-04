import React, { useState, useEffect, FormEvent } from 'react';
import { api, DocumentDTO, SearchHitDTO, SearchResponse } from '../api';
import { PageContainer, Button, Input, Alert, EmptyState, Card } from '../components/ui';
import { DistanceExplanation } from '../components/search/DistanceExplanation';
import { SearchHistory } from '../components/search/SearchHistory';
import { SearchResultCard } from '../components/search/SearchResultCard';
import { DocumentFilterSelect } from '../components/search/DocumentFilterSelect';

const HISTORY_STORAGE_KEY = 'your_own_ai_search_history';

export const SearchPage: React.FC = () => {
  // Search inputs & options
  const [query, setQuery] = useState('');
  const [k, setK] = useState<number>(5);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  // Available documents for filtering
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);

  // Search execution state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Local Search History (Session)
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem(HISTORY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load user's documents on mount for document filter scope
  useEffect(() => {
    const fetchDocs = async () => {
      setIsLoadingDocs(true);
      try {
        const res = await api.documents.listDocuments();
        setDocuments(res.documents || []);
      } catch (err) {
        console.warn('[SearchPage] Could not load document filter list:', err);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, []);

  // Save history to sessionStorage
  const addQueryToHistory = (newQuery: string) => {
    const trimmed = newQuery.trim();
    if (!trimmed) return;
    const filtered = [trimmed, ...history.filter((h) => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setHistory(filtered);
    try {
      sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore storage errors
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      sessionStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Perform search call
  const executeSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setError('Please enter a search query or question.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await api.search.search({
        query: trimmed,
        k: Number(k),
        ...(selectedDocumentIds.length > 0 ? { documentIds: selectedDocumentIds } : {}),
      });

      setSearchResponse(response);
      addQueryToHistory(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Semantic search failed';
      setError(msg);
      setSearchResponse(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSelectHistoryQuery = (selectedQuery: string) => {
    setQuery(selectedQuery);
    executeSearch(selectedQuery);
  };

  return (
    <PageContainer
      title="Semantic Vector Search"
      subtitle="Query your isolated user vector namespace in the C++ engine and hydrate authorized MongoDB chunks."
    >
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        {/* Search Input Card */}
        <Card style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Input
                  label="Search Query"
                  id="search-query-input"
                  placeholder="Ask a question or enter semantic search terms…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  required
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '36px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                    }}
                    aria-label="Clear query input"
                  >
                    ×
                  </button>
                )}
              </div>

              <div style={{ paddingTop: '1.5rem' }}>
                <Button type="submit" variant="primary" size="md" isLoading={isSearching} leftIcon="🔍">
                  Search
                </Button>
              </div>
            </div>

            {/* Configurable Top-K and Document Filters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', paddingTop: '0.5rem' }}>
              {/* Top-K Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label htmlFor="top-k-select" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Top-K Results
                  </label>
                  <span className="badge badge-primary" style={{ fontSize: '0.78rem' }}>
                    k = {k}
                  </span>
                </div>
                <select
                  id="top-k-select"
                  className="form-control"
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value={1}>k = 1 hit</option>
                  <option value={3}>k = 3 hits</option>
                  <option value={5}>k = 5 hits (default)</option>
                  <option value={10}>k = 10 hits</option>
                  <option value={15}>k = 15 hits</option>
                  <option value={20}>k = 20 hits</option>
                </select>
              </div>

              {/* Document Scoping Filter */}
              <DocumentFilterSelect
                documents={documents}
                selectedDocumentIds={selectedDocumentIds}
                onChangeSelected={setSelectedDocumentIds}
                isLoading={isLoadingDocs}
              />
            </div>
          </form>

          {/* Session Search History */}
          <SearchHistory history={history} onSelectQuery={handleSelectHistoryQuery} onClearHistory={clearHistory} />
        </Card>

        {/* Distance Metric Educational Banner */}
        <DistanceExplanation />

        {/* Error Alert */}
        {error && (
          <Alert variant="error" title="Search Error" onClose={() => setError(null)} style={{ marginBottom: '1.5rem' }}>
            {error}
          </Alert>
        )}

        {/* Loading State Skeleton */}
        {isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚙️ Generating vector embedding & querying engine…</span>
            </div>
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  height: '110px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'hsla(224, 25%, 10%, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${idx * 150}ms`,
                }}
              />
            ))}
          </div>
        )}

        {/* Search Results Summary Header */}
        {!isSearching && searchResponse && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
              Found <strong style={{ color: 'var(--text-primary)' }}>{searchResponse.totalHits}</strong> matching chunk
              {searchResponse.totalHits !== 1 ? 's' : ''} in <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{(searchResponse.latencyUs / 1000).toFixed(1)} ms</span>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Namespace: <span style={{ fontFamily: 'monospace' }}>{searchResponse.namespace}</span>
            </div>
          </div>
        )}

        {/* Results List */}
        {!isSearching && searchResponse && searchResponse.results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {searchResponse.results.map((hit: SearchHitDTO, idx: number) => (
              <SearchResultCard key={hit.chunkId || idx} hit={hit} rank={idx + 1} />
            ))}
          </div>
        )}

        {/* Empty State when zero results returned */}
        {!isSearching && hasSearched && searchResponse && searchResponse.results.length === 0 && (
          <EmptyState
            icon="🔍"
            title="No Matching Chunks Found"
            description={`No document chunks in your vector index matched "${searchResponse.query}" within the selected scope.`}
          />
        )}

        {/* Initial Idle Guidance State */}
        {!isSearching && !hasSearched && (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', opacity: 0.8 }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔎</div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Enter a search query to explore your knowledge base
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto' }}>
              Queries are converted into 768-dimensional embeddings using Ollama and searched across your private user namespace.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </PageContainer>
  );
};

export default SearchPage;
