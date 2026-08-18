import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useBlog } from "../context/BlogContext";
import { PostCard } from "../components/PostCard";

export function FeedPage() {
  const { posts } = useBlog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.authorName.toLowerCase().includes(q)
    );
  }, [posts, query]);

  const isSearching = query.trim().length > 0;

  return (
    <section className="page container">
      <div className="feed-header">
        <h1>피드</h1>
        <p>이웃 블로그의 새 글을 확인해 보세요.</p>
      </div>

      <div className="search-box">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목, 내용, 작성자 검색"
          aria-label="피드 검색"
        />
      </div>

      <div className="post-grid">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">
          {isSearching ? (
            <p>검색 결과가 없습니다.</p>
          ) : (
            <>
              <p>아직 작성된 글이 없습니다.</p>
              <Link to="/editor" className="btn-primary">
                글쓰기
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}
