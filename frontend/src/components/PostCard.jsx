import { Link } from "react-router-dom";
import { formatDateTime } from "../lib/time";

function excerpt(text) {
  const normalized = (text || "").trim();
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 140)}…`;
}

export function PostCard({ post }) {
  return (
    <article className="post-card">
      <Link to={`/post/${post.id}`} className="post-cover-link">
        <img
          src={post.imageUrl || "/no-image.svg"}
          alt=""
          className="post-cover"
        />
      </Link>
      <div className="post-content">
        <Link to={`/post/${post.id}`} className="post-title-link">
          <h3>{post.title}</h3>
        </Link>
        <p className="post-meta">
          {post.authorName} · {formatDateTime(post.updatedAt || post.createdAt)}
        </p>
        <p className="post-excerpt">{excerpt(post.content)}</p>
      </div>
    </article>
  );
}
