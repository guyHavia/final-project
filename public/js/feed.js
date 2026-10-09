document.addEventListener('DOMContentLoaded', () => {
  const bootstrap = document.getElementById('feed-bootstrap');
  if (!bootstrap) return;

  let nextCursor = bootstrap.dataset.nextCursor || null;
  let currentQ = bootstrap.dataset.queryQ || '';
  let currentCategory = bootstrap.dataset.queryCategory || '';
  let currentSort = bootstrap.dataset.querySort || 'date';

  const searchInput = document.getElementById('feed-search');
  const sortSelect = document.getElementById('feed-sort');
  const viewedSelect = document.getElementById('feed-viewed');
  const feedTitle = document.getElementById('feed-title');
  const categoryLinks = document.querySelectorAll('.category-bar .category-link');
  const cardList = document.getElementById('article-card-list');
  const sentinel = document.getElementById('scroll-sentinel');
  const retryBtn = document.getElementById('retry-btn');
  const endOfFeedMsg = document.getElementById('end-of-feed-msg');

  const SEEN_KEY = 'dw_seen_articles';
  function getSeenSet() {
    try {
      const data = localStorage.getItem(SEEN_KEY);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch {
      return new Set();
    }
  }

  function markSeen(id) {
    if (!id) return;
    const seen = getSeenSet();
    if (!seen.has(id)) {
      seen.add(id);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
      } catch {
        // Storage blocked or full (e.g. private mode): the "viewed" mark just isn't remembered.
      }
    }
  }

  // 'all' | 'viewed' | 'unviewed'
  let viewedFilter = 'all';

  function applyViewedState() {
    const seen = getSeenSet();
    cardList.querySelectorAll('.article-card').forEach(card => {
      const isSeen = seen.has(card.dataset.id);
      card.classList.toggle('viewed', isSeen);
      const hide = (viewedFilter === 'viewed' && !isSeen) || (viewedFilter === 'unviewed' && isSeen);
      card.classList.toggle('filtered-out', hide);
    });
  }

  cardList.querySelectorAll('.article-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', () => markSeen(id));
  });
  applyViewedState();

  if (viewedSelect) {
    viewedSelect.addEventListener('change', (e) => {
      viewedFilter = e.target.value;
      applyViewedState();
    });
  }

  let isLoading = false;

  // If loading the next page fails (e.g. a network hiccup), try again by
  // itself after 2s, 4s and 8s; the Retry button only appears after that.
  const MAX_AUTO_RETRIES = 3;
  let failedAttempts = 0;

  async function fetchFeed(reset = false) {
    if (isLoading) return;
    isLoading = true;
    if (retryBtn) retryBtn.hidden = true;

    try {
      const params = new URLSearchParams();
      params.set('state', 'published');
      params.set('limit', '20');
      if (currentQ) params.set('q', currentQ);
      if (currentCategory) params.set('category', currentCategory);
      if (currentSort) params.set('sort', currentSort);
      if (!reset && nextCursor) params.set('cursor', nextCursor);

      const res = await fetch(`/api/articles?${params.toString()}`, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) throw new Error('Failed to fetch articles');
      const json = await res.json();
      const { items, nextCursor: newCursor } = json.data;

      nextCursor = newCursor;
      if (endOfFeedMsg) endOfFeedMsg.hidden = nextCursor !== null;

      if (reset) {
        cardList.innerHTML = '';
      }

      if (items.length === 0 && reset) {
        cardList.innerHTML = '<li class="empty-state"><p>No published articles found matching your criteria.</p></li>';
      } else {
        for (const item of items) {
          const li = document.createElement('li');
          li.className = 'article-card';
          li.dataset.id = item.id;
          li.dataset.slug = item.slug || '';

          const pubDate = new Date(item.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          const isoDate = new Date(item.publishedAt).toISOString();

          let thumbHtml = '';
          if (item.image) {
            thumbHtml = `<figure class="card-thumb"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" /></figure>`;
          }

          li.innerHTML = `
            ${thumbHtml}
            <div class="card-content">
              <span class="card-category cat-${escapeHtml(item.category)}">${escapeHtml(item.category)}</span>
              <h2 dir="auto"><a href="/article/${escapeHtml(item.slug || item.id)}">${escapeHtml(item.title)}</a></h2>
              ${item.abstract ? `<p class="card-abstract" dir="auto">${escapeHtml(item.abstract)}</p>` : ''}
              <div class="card-meta">
                <span class="byline">${escapeHtml(item.author.displayName)}</span>
                <span>&bull;</span>
                <time datetime="${isoDate}">${pubDate}</time>
                <span>&bull;</span>
                <span class="view-count">${item.viewCount} views</span>
              </div>
            </div>
          `;

          li.addEventListener('click', () => markSeen(item.id));
          cardList.appendChild(li);
        }
      }

      applyViewedState();
      failedAttempts = 0;
    } catch (err) {
      console.error(err);
      failedAttempts += 1;
      if (failedAttempts <= MAX_AUTO_RETRIES) {
        setTimeout(() => fetchFeed(reset), 1000 * 2 ** failedAttempts);
      } else if (retryBtn) {
        retryBtn.hidden = false;
      }
    } finally {
      isLoading = false;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && nextCursor !== null && !isLoading) {
      fetchFeed(false);
    }
  }, { rootMargin: '200px' });

  if (sentinel) observer.observe(sentinel);
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      failedAttempts = 0; // a manual retry gets a fresh set of automatic retries
      fetchFeed(false);
    });
  }

  function updateURL() {
    const params = new URLSearchParams();
    if (currentQ) params.set('q', currentQ);
    if (currentCategory) params.set('category', currentCategory);
    if (currentSort && currentSort !== 'date') params.set('sort', currentSort);

    const newQuery = params.toString();
    const newUrl = newQuery ? `/?${newQuery}` : '/';
    history.replaceState({}, '', newUrl);
  }

  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentQ = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        nextCursor = null;
        updateURL();
        fetchFeed(true);
      }, 300);
    });
  }

  categoryLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      currentCategory = new URL(link.href).searchParams.get('category') || '';
      categoryLinks.forEach((other) => other.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'page');
      if (feedTitle) feedTitle.textContent = currentCategory || 'Latest Stories';
      nextCursor = null;
      updateURL();
      fetchFeed(true);
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      nextCursor = null;
      updateURL();
      fetchFeed(true);
    });
  }
});