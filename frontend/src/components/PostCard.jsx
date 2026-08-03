import { Link } from "react-router-dom";
import { formatDateTime } from "../lib/time";

export function PostCard({ post }) {
  return (
    <article className="post-card">
      <Link to={`/post/${post.id}`} className="post-cover-link">
        <img src={post.imageUrl || "https://placehold.co/1200x700?text=No+Image"} alt={post.title} className="post-cover" />
      </Link>
      <div className="post-content">
        <Link to={`/post/${post.id}`} className="post-title-link">
          <h3>{post.title}</h3>
        </Link>
        <p className="post-meta">
          {post.authorName} · {formatDateTime(post.updatedAt || post.createdAt)}
        </p>
        <p className="post-excerpt">{post.content.slice(0, 140)}...</p>
        {post.onchain && <span className="onchain-badge">On-chain Registered</span>}
      </div>
    </article>
  );
}
