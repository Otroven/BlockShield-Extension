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

  return (
    <section className="page container">
      <div className="hero">
        <h1>Blockshield 블로그 피드</h1>
      </div>

      <div className="search-box">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목, 내용, 작성자 검색"
        />
      </div>

      <div className="post-grid">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {!filtered.length && <p className="empty">검색 결과가 없습니다.</p>}
    </section>
  );
}
