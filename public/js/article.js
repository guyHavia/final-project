document.addEventListener('DOMContentLoaded', () => {
  const commentsSection = document.getElementById('comments-section');
  if (!commentsSection) return;

  const articleId = commentsSection.dataset.articleId;
  const commentsList = document.getElementById('comments-list');
  const commentForm = document.getElementById('comment-form');
  const commentFormError = document.getElementById('comment-form-error');
  const submitBtn = document.getElementById('submit-comment-btn');
  const loadMoreBtn = document.getElementById('load-more-comments');
  const emptyMsg = document.getElementById('comments-empty-msg');
  const countLive = document.getElementById('comment-count-live');

  let nextCursor = null;
  let totalCount = 0;

  function updateLiveCount(newTotal) {
    totalCount = newTotal;
    if (countLive) {
      countLive.textContent = `${totalCount} comment${totalCount === 1 ? '' : 's'}`;
    }
  }

  async function loadComments(cursor = null) {
    try {
      let url = `/api/articles/${articleId}/comments?limit=20`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load comments');
      
      const json = await res.json();
      const { items, nextCursor: newCursor } = json.data;
      nextCursor = newCursor;

      if (loadMoreBtn) loadMoreBtn.hidden = !nextCursor;

      if (items.length === 0 && commentsList.children.length === 0) {
        if (emptyMsg) emptyMsg.hidden = false;
      } else {
        if (emptyMsg) emptyMsg.hidden = true;
        for (const comment of items) {
          appendCommentElement(comment, false);
        }
      }
      updateLiveCount(commentsList.children.length);
    } catch (err) {
      console.error(err);
    }
  }

  function appendCommentElement(comment, prepend = false) {
    if (emptyMsg) emptyMsg.hidden = true;
    const li = document.createElement('li');
    li.className = 'comment-item';
    li.dataset.commentId = comment.id;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'comment-header';

    const authorSpan = document.createElement('span');
    authorSpan.className = 'comment-author';
    authorSpan.textContent = comment.authorName; // XSS protection via textContent

    const timeEl = document.createElement('time');
    timeEl.datetime = comment.createdAt;
    timeEl.textContent = new Date(comment.createdAt).toLocaleDateString(undefined, { 
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    headerDiv.appendChild(authorSpan);
    headerDiv.appendChild(timeEl);

    const bodyP = document.createElement('p');
    bodyP.className = 'comment-body-text';
    bodyP.textContent = comment.body; // XSS protection via textContent

    li.appendChild(headerDiv);
    li.appendChild(bodyP);

    if (prepend) {
      commentsList.prepend(li);
    } else {
      commentsList.appendChild(li);
    }
    updateLiveCount(commentsList.children.length);
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      if (nextCursor) loadComments(nextCursor);
    });
  }

  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (commentFormError) {
        commentFormError.hidden = true;
        commentFormError.textContent = '';
      }

      const authorNameInput = document.getElementById('comment-author');
      const bodyInput = document.getElementById('comment-body');

      const authorName = authorNameInput.value.trim();
      const body = bodyInput.value.trim();

      if (!authorName || !body) {
        if (commentFormError) {
          commentFormError.textContent = 'Name and comment body are required.';
          commentFormError.hidden = false;
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(`/api/articles/${articleId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ authorName, body })
        });

        // 429 Rate Limit Handling per specs
        if (res.status === 429) {
          if (commentFormError) {
            commentFormError.textContent = 'you are posting too fast, wait a moment';
            commentFormError.hidden = false;
          }
          return;
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error?.message || 'Failed to post comment');
        }

        const json = await res.json();
        const createdComment = json.data;

        // Prepend single node immediately, no full list re-render
        appendCommentElement(createdComment, true);
        bodyInput.value = '';
      } catch (err) {
        if (commentFormError) {
          commentFormError.textContent = err.message || 'An error occurred while posting your comment.';
          commentFormError.hidden = false;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  loadComments();
});