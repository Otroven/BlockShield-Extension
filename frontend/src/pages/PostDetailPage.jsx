import { Link, useParams } from "react-router-dom";
import { useBlog } from "../context/BlogContext";
import { formatDateTime } from "../lib/time";

export function PostDetailPage() {
  const { postId } = useParams();
  const { posts } = useBlog();
  const post = posts.find((item) => item.id === postId);

  if (!post) {
    return (
      <section className="page container">
        <p className="empty">게시글을 찾을 수 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="page container detail">
      <img
        src={post.imageUrl || "https://placehold.co/1200x700?text=No+Image"}
        alt={post.title}
        className="detail-cover"
      />
      <h1>{post.title}</h1>
      <p className="post-meta">
        {post.authorName} · {formatDateTime(post.updatedAt || post.createdAt)}
      </p>
      <p className="detail-content">{post.content}</p>

      <div className="detail-actions">
        <Link to={`/editor/${post.id}`} className="btn-secondary">
          글 수정하기
        </Link>
      </div>
    </section>
  );
}
