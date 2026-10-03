document.addEventListener('DOMContentLoaded', () => {
  const bootstrap = document.getElementById('feed-bootstrap');
  if (!bootstrap) return;

  let nextCursor = bootstrap.dataset.nextCursor || null;
  let currentQ = bootstrap.dataset.queryQ || '';
  let currentCategory = bootstrap.dataset.queryCategory || '';
  let currentSort = bootstrap.Dataset?.querySort || 'date';

  const searchInput = document.getElementById('feed-search');
  const categorySelect = document.getElementById('feed-category');
  const sortSelect = document.getElementById('feed-sort');
  const toggleViewedBtn = document.getElementById('toggle-viewed-btn');
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
      } catch {}
    }
  }

  let hideViewed = false;

  function applyViewedState() {
    const seen = getSeenSet();
    cardList.querySelectorAll('.article-card').forEach(card => {
      const id = card.dataset.id;
      if (seen.has(id)) {
        card.classList.add('viewed');
        if (hideViewed) {
          card.classList.add('hidden-viewed');
        } else {
          card.classList.remove('hidden-viewed');
        }
      } else {
        card.classList.remove('viewed', 'hidden-viewed');
      }
    });
  }

  cardList.querySelectorAll('.article-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', () => markSeen(id));
  });
  applyViewedState();

  if (toggleViewedBtn) {
    toggleViewedBtn.addEventListener('click', () => {
      hideViewed = !hideViewed;
      toggleViewedBtn.setAttribute('aria-pressed', hideViewed ? 'true' : 'false');
      toggleViewedBtn.textContent = hideViewed ? 'Show all' : 'Hide viewed';
      applyViewedState();
    });
  }

  let isLoading = false;

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
              <span class="card-category">${escapeHtml(item.category)}</span>
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
    } catch (err) {
      console.error(err);
      if (retryBtn) retryBtn.hidden = false;
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
  if (retryBtn) retryBtn.addEventListener('click', () => fetchFeed(false));

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

  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      nextCursor = null;
      updateURL();
      fetchFeed(true);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      nextCursor = null;
      updateURL();
      fetchFeed(true);
    });
  }
});